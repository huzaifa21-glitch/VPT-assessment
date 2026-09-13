const { membersService } = require('./members.service');
const { householdsService } = require('../households/households.service');
const { assertAreaAccess } = require('../../common/utils/area-access');

const membersController = {
  async listByHousehold(req, res) {
    const household = await householdsService.getById(req.params.householdId);
    assertAreaAccess(req.user, household.areaId);
    res.status(200).json(await membersService.listByHousehold(req.params.householdId));
  },

  async create(req, res) {
    const household = await householdsService.getById(req.body.householdId);
    assertAreaAccess(req.user, household.areaId);
    const member = await membersService.create(req.body);
    res.status(201).json(member);
  },

  async update(req, res) {
    const existing = await membersService.getById(req.params.id);
    assertAreaAccess(req.user, existing.household.areaId);
    const updated = await membersService.update(req.params.id, req.body);
    res.status(200).json(updated);
  },

  async remove(req, res) {
    const existing = await membersService.getById(req.params.id);
    assertAreaAccess(req.user, existing.household.areaId);
    await membersService.softDelete(req.params.id);
    res.status(204).send();
  },
};

module.exports = { membersController };
