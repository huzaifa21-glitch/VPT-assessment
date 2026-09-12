const { prisma } = require('../../prisma/client');
const { assertAreaAccess } = require('../../common/utils/area-access');
const { householdsService } = require('../households/households.service');
const { membersService } = require('../household-members/members.service');
const { assessmentsService } = require('../health-assessments/assessments.service');

// Resolves the areaId a change belongs to, for the sole purpose of enforcing
// "field workers only touch their own area" on the sync path exactly like
// the REST controllers do. Returns null when the target record doesn't exist
// yet (or never did) — in that case the entity service itself will raise the
// appropriate NotFound/creation error, so there's nothing to authorize against.
async function resolveAreaId(change) {
  const { entityType, entityId, operation, payload } = change;

  if (entityType === 'HOUSEHOLD') {
    if (operation === 'CREATE') return payload.areaId || null;
    const household = await prisma.household.findUnique({ where: { id: entityId } });
    return household ? household.areaId : null;
  }

  if (entityType === 'HOUSEHOLD_MEMBER') {
    if (operation === 'CREATE') {
      const household = await prisma.household.findUnique({ where: { id: payload.householdId } });
      return household ? household.areaId : null;
    }
    const member = await prisma.householdMember.findUnique({
      where: { id: entityId },
      include: { household: true },
    });
    return member ? member.household.areaId : null;
  }

  // HEALTH_ASSESSMENT
  if (operation === 'CREATE') {
    const member = await prisma.householdMember.findUnique({
      where: { id: payload.memberId },
      include: { household: true },
    });
    return member ? member.household.areaId : null;
  }
  const assessment = await prisma.healthAssessment.findUnique({
    where: { id: entityId },
    include: { member: { include: { household: true } } },
  });
  return assessment ? assessment.member.household.areaId : null;
}

async function applyChange(user, change) {
  const { entityType, entityId, operation, baseVersion, payload } = change;

  if (entityType === 'HOUSEHOLD') {
    if (operation === 'CREATE') {
      return householdsService.applySyncCreate({
        id: entityId,
        householdCode: payload.householdCode,
        address: payload.address,
        latitude: payload.latitude,
        longitude: payload.longitude,
        areaId: payload.areaId,
        registeredById: user.id,
      });
    }
    if (operation === 'UPDATE') return householdsService.applySyncUpdate(entityId, baseVersion, payload);
    return householdsService.applySyncDelete(entityId, baseVersion);
  }

  if (entityType === 'HOUSEHOLD_MEMBER') {
    if (operation === 'CREATE') {
      return membersService.applySyncCreate({
        id: entityId,
        householdId: payload.householdId,
        name: payload.name,
        age: payload.age,
        gender: payload.gender,
        relationship: payload.relationship,
      });
    }
    if (operation === 'UPDATE') return membersService.applySyncUpdate(entityId, baseVersion, payload);
    return membersService.applySyncDelete(entityId, baseVersion);
  }

  // HEALTH_ASSESSMENT
  if (operation === 'CREATE') {
    return assessmentsService.applySyncCreate({
      id: entityId,
      memberId: payload.memberId,
      temperatureC: payload.temperatureC,
      hasFever: payload.hasFever,
      hasCough: payload.hasCough,
      hasBreathingDifficulty: payload.hasBreathingDifficulty,
      bloodPressureSystolic: payload.bloodPressureSystolic,
      bloodPressureDiastolic: payload.bloodPressureDiastolic,
      notes: payload.notes,
      flagForReview: payload.flagForReview,
    });
  }
  if (operation === 'UPDATE') return assessmentsService.applySyncUpdate(entityId, baseVersion, payload);
  return assessmentsService.applySyncDelete(entityId, baseVersion);
}

const syncService = {
  // Processes each queued change independently — one bad/conflicting change
  // in a batch never blocks the rest, and the client can selectively retry
  // only the ones that came back CONFLICT or ERROR.
  async push(user, changes) {
    const results = [];

    for (const change of changes) {
      // Idempotency: a clientChangeId already recorded as APPLIED/CONFLICT
      // means this exact change already mutated data — replay that result
      // rather than re-applying it. An ERROR means nothing was actually
      // applied, so there's nothing to "duplicate" — it must be retried,
      // not replayed forever.
      const existingLog = await prisma.syncLog.findUnique({ where: { clientChangeId: change.clientChangeId } });
      if (existingLog && existingLog.status !== 'ERROR') {
        results.push({
          clientChangeId: change.clientChangeId,
          status: existingLog.status,
          serverEntity: existingLog.resultSnapshot || undefined,
        });
        continue;
      }

      try {
        const areaId = await resolveAreaId(change);
        if (areaId) assertAreaAccess(user, areaId);

        const { conflict, entity } = await applyChange(user, change);
        const status = conflict ? 'CONFLICT' : 'APPLIED';

        // upsert, not create — a retried change that previously errored
        // already has a SyncLog row for this clientChangeId; this updates
        // it in place instead of colliding with the unique constraint.
        await prisma.syncLog.upsert({
          where: { clientChangeId: change.clientChangeId },
          create: {
            clientChangeId: change.clientChangeId,
            userId: user.id,
            entityType: change.entityType,
            entityId: change.entityId,
            status,
            resultSnapshot: entity,
          },
          update: { status, resultSnapshot: entity },
        });

        results.push({ clientChangeId: change.clientChangeId, status, serverEntity: entity });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await prisma.syncLog.upsert({
          where: { clientChangeId: change.clientChangeId },
          create: {
            clientChangeId: change.clientChangeId,
            userId: user.id,
            entityType: change.entityType,
            entityId: change.entityId,
            status: 'ERROR',
            resultSnapshot: { message },
          },
          update: { status: 'ERROR', resultSnapshot: { message } },
        });
        results.push({ clientChangeId: change.clientChangeId, status: 'ERROR', message });
      }
    }

    return results;
  },

  // Pull: everything touched (created/updated/soft-deleted) since `since`,
  // scoped to the caller's area (field worker) or unscoped (admin). The
  // mobile client applies these into its local store, including tombstones.
  async pull(user, since) {
    const sinceDate = since ? new Date(since) : new Date(0);
    const areaFilter = user.role === 'FIELD_WORKER' ? { areaId: user.areaId || '__none__' } : {};

    const households = await prisma.household.findMany({
      where: { ...areaFilter, updatedAt: { gt: sinceDate } },
    });
    const householdIds = user.role === 'FIELD_WORKER'
      ? households.map((h) => h.id)
      : undefined; // admin: no need to prefilter, fetch all changed members/assessments directly

    const members = await prisma.householdMember.findMany({
      where: {
        updatedAt: { gt: sinceDate },
        ...(householdIds ? { householdId: { in: householdIds.length ? householdIds : ['__none__'] } } : {}),
      },
    });

    const assessments = await prisma.healthAssessment.findMany({
      where: {
        updatedAt: { gt: sinceDate },
        member: householdIds ? { householdId: { in: householdIds.length ? householdIds : ['__none__'] } } : undefined,
      },
    });

    return { serverTime: new Date().toISOString(), households, members, assessments };
  },
};

module.exports = { syncService };