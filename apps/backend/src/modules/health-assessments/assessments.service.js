const { prisma } = require('../../prisma/client');
const { NotFoundError } = require('../../common/errors/app-error');
const { urgentAssessmentQueue } = require('../../jobs/queues');
const { dashboardService } = require('../dashboard/dashboard.service');

// Trigger condition for the background job (documented in README too):
// an assessment is "urgent" if fever + breathing difficulty co-occur, or the
// field worker manually flags it for review.
function computeIsUrgent(input) {
  return Boolean((input.hasFever && input.hasBreathingDifficulty) || input.flagForReview);
}

async function enqueueUrgentJobIfNeeded(assessmentId, memberId, wasUrgent, isUrgentNow) {
  if (!isUrgentNow || wasUrgent) return; // only enqueue on the false -> true transition

  const member = await prisma.householdMember.findUnique({ where: { id: memberId } });
  await urgentAssessmentQueue.add(
    'notify-urgent-assessment',
    {
      assessmentId,
      memberId,
      memberName: member ? member.name : 'Unknown',
      reason: 'fever+breathing-difficulty-or-manual-flag',
    },
    { jobId: `urgent-${assessmentId}` }, // stable id => re-triggering the same assessment dedupes
  );
}

const assessmentsService = {
  async getById(id) {
    const assessment = await prisma.healthAssessment.findFirst({
      where: { id, deletedAt: null },
      include: { member: { include: { household: { select: { id: true, areaId: true } } } } },
    });
    if (!assessment) throw new NotFoundError('Health assessment not found');
    return assessment;
  },

  async listByMember(memberId) {
    return prisma.healthAssessment.findMany({ where: { memberId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  },

  async create(data) {
    const member = await prisma.householdMember.findFirst({ where: { id: data.memberId, deletedAt: null } });
    if (!member) throw new NotFoundError('Household member not found');

    const { flagForReview, ...rest } = data;
    const isUrgent = computeIsUrgent(data);
    const created = await prisma.healthAssessment.create({ data: { ...rest, isUrgent } });
    await enqueueUrgentJobIfNeeded(created.id, created.memberId, false, isUrgent);
    await dashboardService.invalidate();
    return created;
  },

  async update(id, data) {
    const current = await prisma.healthAssessment.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Health assessment not found');

    const merged = { ...current, ...data };
    const isUrgent = computeIsUrgent(merged);
    const { flagForReview, ...rest } = data;
    const updated = await prisma.healthAssessment.update({
      where: { id },
      data: { ...rest, isUrgent, version: { increment: 1 } },
    });
    await enqueueUrgentJobIfNeeded(id, current.memberId, current.isUrgent, isUrgent);
    return updated;
  },

  async softDelete(id) {
    const current = await prisma.healthAssessment.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Health assessment not found');
    const deleted = await prisma.healthAssessment.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
    await dashboardService.invalidate();
    return deleted;
  },

  async applySyncCreate(data) {
    const existing = await prisma.healthAssessment.findUnique({ where: { id: data.id } });
    if (existing) return { conflict: false, entity: existing };

    const member = await prisma.householdMember.findUnique({ where: { id: data.memberId } });
    if (!member) throw new NotFoundError('Household member not found');

    const { flagForReview, ...rest } = data;
    const isUrgent = computeIsUrgent(data);
    const created = await prisma.healthAssessment.create({ data: { ...rest, isUrgent } });
    await enqueueUrgentJobIfNeeded(created.id, created.memberId, false, isUrgent);
    await dashboardService.invalidate();
    return { conflict: false, entity: created };
  },

  async applySyncUpdate(id, baseVersion, data) {
    const current = await prisma.healthAssessment.findUnique({ where: { id } });
    if (!current || current.deletedAt) throw new NotFoundError('Health assessment not found');
    if (current.version !== baseVersion) return { conflict: true, entity: current };

    const merged = { ...current, ...data };
    const isUrgent = computeIsUrgent(merged);
    const { flagForReview, ...rest } = data;
    const updated = await prisma.healthAssessment.update({
      where: { id },
      data: { ...rest, isUrgent, version: { increment: 1 } },
    });
    await enqueueUrgentJobIfNeeded(id, current.memberId, current.isUrgent, isUrgent);
    return { conflict: false, entity: updated };
  },

  async applySyncDelete(id, baseVersion) {
    const current = await prisma.healthAssessment.findUnique({ where: { id } });
    if (!current) throw new NotFoundError('Health assessment not found');
    if (current.deletedAt) return { conflict: false, entity: current };
    if (current.version !== baseVersion) return { conflict: true, entity: current };

    const updated = await prisma.healthAssessment.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    await dashboardService.invalidate();
    return { conflict: false, entity: updated };
  },
};

module.exports = { assessmentsService };
