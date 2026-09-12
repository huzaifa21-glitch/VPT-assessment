const { householdsService } = require('./households.service');
const { assertAreaAccess } = require('../../common/utils/area-access');
const { ForbiddenError } = require('../../common/errors/app-error');

const householdsController = {
  async list(req, res) {
    const query = req.query;
    // A field worker's list is implicitly scoped to their own area regardless
    // of what areaId (if any) they pass — enforced here, not trusted from input.
    const areaId = req.user.role === 'FIELD_WORKER' ? req.user.areaId || undefined : query.areaId;
    const result = await householdsService.list({ ...query, areaId });
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
