const { prisma } = require('../../prisma/client');
const { BadRequestError, NotFoundError } = require('../../common/errors/app-error');

const areasService = {
  async list() {
    return prisma.area.findMany({ orderBy: { name: 'asc' } });
  },

  async getById(id) {
    const area = await prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundError('Area not found');
    return area;
  },

  async create(input) {
    const existing = await prisma.area.findUnique({ where: { code: input.code } });
    if (existing) throw new BadRequestError('An area with this code already exists');
    return prisma.area.create({ data: input });
  },
};

module.exports = { areasService };
