const bcrypt = require('bcrypt');
const { prisma } = require('../../prisma/client');
const { BadRequestError, NotFoundError } = require('../../common/errors/app-error');
const { dashboardService } = require('../dashboard/dashboard.service');

const SALT_ROUNDS = 12;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  areaId: true,
  area: { select: { id: true, name: true, code: true } },
  createdAt: true,
};

const usersService = {
  async listFieldWorkers(query) {
    const { areaId, isActive, page, pageSize } = query;
    const where = {
      role: 'FIELD_WORKER',
      ...(areaId ? { areaId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  },

  async createFieldWorker(input) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new BadRequestError('A user with this email already exists');
    }
    if (input.areaId) {
      const area = await prisma.area.findUnique({ where: { id: input.areaId } });
      if (!area) throw new NotFoundError('Area not found');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'FIELD_WORKER',
        areaId: input.areaId || null,
      },
      select: publicUserSelect,
    });
    await dashboardService.invalidate();
    return created;
  },

  async setActiveStatus(userId, isActive) {
    const user = await prisma.user.findFirst({ where: { id: userId, role: 'FIELD_WORKER' } });
    if (!user) throw new NotFoundError('Field worker not found');

    return prisma.user.update({ where: { id: userId }, data: { isActive }, select: publicUserSelect });
  },

  // A field worker is assigned to exactly one area at a time — this simply
  // overwrites the previous assignment (reassignment), never adds a second one.
  async assignArea(userId, areaId) {
    const [user, area] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, role: 'FIELD_WORKER' } }),
      prisma.area.findUnique({ where: { id: areaId } }),
    ]);
    if (!user) throw new NotFoundError('Field worker not found');
    if (!area) throw new NotFoundError('Area not found');

    return prisma.user.update({ where: { id: userId }, data: { areaId }, select: publicUserSelect });
  },

  async getById(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!user) throw new NotFoundError('User not found');
    return user;
  },
};

module.exports = { usersService };
