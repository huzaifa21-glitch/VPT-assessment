const { householdsService } = require('./households.service');
const { assertAreaAccess } = require('../../common/utils/area-access');
const { ForbiddenError } = require('../../common/errors/app-error');

const householdsController = {
  async list(req, res) {
    const query = req.query;

    if (req.user.role === 'FIELD_WORKER') {
      if (!req.user.areaId) {
        // Not assigned to an area yet — must see nothing, not "everything".
        // Falling through to an unfiltered query would return all areas.
        return res
          .status(200)
          .json({ items: [], total: 0, page: query.page, pageSize: query.pageSize });
      }
      const result = await householdsService.list({ ...query, areaId: req.user.areaId });
      return res.status(200).json(result);
    }

    const result = await householdsService.list(query);
    res.status(200).json(result);
  },

  async getById(req, res) {
    const household = await householdsService.getById(req.params.id);
    assertAreaAccess(req.user, household.areaId);
    res.status(200).json(household);
  },

  async create(req, res) {
    if (req.user.role === 'FIELD_WORKER') {
      if (!req.user.areaId || req.user.areaId !== req.body.areaId) {
        throw new ForbiddenError('You can only register households in your assigned area');
      }
    }
    const household = await householdsService.create({ ...req.body, registeredById: req.user.id });
    res.status(201).json(household);
  },

  async update(req, res) {
    const existing = await householdsService.getById(req.params.id);
    assertAreaAccess(req.user, existing.areaId);
    const updated = await householdsService.update(req.params.id, req.body);
    res.status(200).json(updated);
  },

  async remove(req, res) {
    const existing = await householdsService.getById(req.params.id);
    assertAreaAccess(req.user, existing.areaId);
    await householdsService.softDelete(req.params.id);
    res.status(204).send();
  },
};

module.exports = { householdsController };
