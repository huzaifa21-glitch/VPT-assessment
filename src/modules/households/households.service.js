const { prisma } = require('../../prisma/client');
const { NotFoundError } = require('../../common/errors/app-error');
const { dashboardService } = require('../dashboard/dashboard.service');

const householdWithMembers = {
  include: { members: { where: { deletedAt: null } }, area: true },
};

const householdsService = {
  async list(params) {
    const { areaId, search, page, pageSize } = params;
    const where = {
      deletedAt: null,
      ...(areaId ? { areaId } : {}),
      ...(search
        ? {
            OR: [
              { householdCode: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.household.findMany({
        where,
        include: { area: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.household.count({ where }),
    ]);

    return { items, total, page, pageSize };
  },

  async getById(id) {
    const household = await prisma.household.findFirst({
      where: { id, deletedAt: null },
      ...householdWithMembers,
    });
    if (!household) throw new NotFoundError('Household not found');
    return household;
  },

  // Used by the plain REST endpoint (admin / online field-worker path) —
  // always applies against whatever the current version is.
  async create(data) {
    const created = await prisma.household.create({ data });
    await dashboardService.invalidate();
    return created;
  },

  async update(id, data) {
    const current = await prisma.household.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Household not found');
    return prisma.household.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  },

  async softDelete(id) {
    const current = await prisma.household.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundError('Household not found');
    const deleted = await prisma.household.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    await dashboardService.invalidate();
    return deleted;
  },

 

  async applySyncCreate(data) {
    const existing = await prisma.household.findUnique({ where: { id: data.id } });
    if (existing) {
      // Same id already exists (e.g. replayed create) — treat as no-op, return current state.
      return { conflict: false, entity: existing };
    }
    const created = await prisma.household.create({ data });
    await dashboardService.invalidate();
    return { conflict: false, entity: created };
  },

  async applySyncUpdate(id, baseVersion, data) {
    const current = await prisma.household.findUnique({ where: { id } });
    if (!current || current.deletedAt) throw new NotFoundError('Household not found');

    if (current.version !== baseVersion) {
      // Someone else (admin web, or another sync) changed this since the
      // client last saw it — server copy wins, client is told to reconcile.
      return { conflict: true, entity: current };
    }

    const updated = await prisma.household.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
    return { conflict: false, entity: updated };
  },

  async applySyncDelete(id, baseVersion) {
    const current = await prisma.household.findUnique({ where: { id } });
    if (!current) throw new NotFoundError('Household not found');
    if (current.deletedAt) return { conflict: false, entity: current }; // already deleted, idempotent

    if (current.version !== baseVersion) {
      return { conflict: true, entity: current };
    }

    const updated = await prisma.household.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    await dashboardService.invalidate();
    return { conflict: false, entity: updated };
  },
};

module.exports = { householdsService };
