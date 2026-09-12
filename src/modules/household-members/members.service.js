const { prisma } = require('../../prisma/client');
const { NotFoundError } = require('../../common/errors/app-error');

const membersService = {
  async getById(id) {
    const member = await prisma.householdMember.findFirst({
      where: { id, deletedAt: null },
      include: { household: { select: { id: true, areaId: true } } },
    });
    if (!member) throw new NotFoundError('Household member not found');
    return member;
  },

  async listByHousehold(householdId) {
    return prisma.householdMember.findMany({ where: { householdId, deletedAt: null } });
  },

  async create(data) {
    const household = await prisma.household.findFirst({ where: { id: data.householdId, deletedAt: null } });
    if (!household) throw new NotFoundError('Household not found');
    return prisma.householdMember.create({ data });
  },

  async update(id, data) {
    const current = await prisma.householdMember.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Household member not found');
    return prisma.householdMember.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
  },

  async softDelete(id) {
    const current = await prisma.householdMember.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Household member not found');
    return prisma.householdMember.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },

  async applySyncCreate(data) {
    const existing = await prisma.householdMember.findUnique({ where: { id: data.id } });
    if (existing) return { conflict: false, entity: existing };

    const household = await prisma.household.findUnique({ where: { id: data.householdId } });
    if (!household) throw new NotFoundError('Household not found');

    const created = await prisma.householdMember.create({ data });
    return { conflict: false, entity: created };
  },

  async applySyncUpdate(id, baseVersion, data) {
    const current = await prisma.householdMember.findUnique({ where: { id } });
    if (!current || current.deletedAt) throw new NotFoundError('Household member not found');
    if (current.version !== baseVersion) return { conflict: true, entity: current };

    const updated = await prisma.householdMember.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    return { conflict: false, entity: updated };
  },

  async applySyncDelete(id, baseVersion) {
    const current = await prisma.householdMember.findUnique({ where: { id } });
    if (!current) throw new NotFoundError('Household member not found');
    if (current.deletedAt) return { conflict: false, entity: current };
    if (current.version !== baseVersion) return { conflict: true, entity: current };

    const updated = await prisma.householdMember.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    return { conflict: false, entity: updated };
  },
};

module.exports = { membersService };
