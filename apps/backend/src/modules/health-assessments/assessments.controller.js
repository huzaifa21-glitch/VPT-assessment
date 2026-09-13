const { assessmentsService } = require('./assessments.service');
const { membersService } = require('../household-members/members.service');
const { assertAreaAccess } = require('../../common/utils/area-access');

const assessmentsController = {
  async listByMember(req, res) {
    const member = await membersService.getById(req.params.memberId);
    assertAreaAccess(req.user, member.household.areaId);
    res.status(200).json(await assessmentsService.listByMember(req.params.memberId));
  },

  async create(req, res) {
    const member = await membersService.getById(req.body.memberId);
    assertAreaAccess(req.user, member.household.areaId);
    const assessment = await assessmentsService.create(req.body);
    res.status(201).json(assessment);
  },

  async update(req, res) {
    const existing = await assessmentsService.getById(req.params.id);
    assertAreaAccess(req.user, existing.member.household.areaId);
    const updated = await assessmentsService.update(req.params.id, req.body);
    res.status(200).json(updated);
  },

  async remove(req, res) {
    const existing = await assessmentsService.getById(req.params.id);
    assertAreaAccess(req.user, existing.member.household.areaId);
    await assessmentsService.softDelete(req.params.id);
    res.status(204).send();
  },
};

module.exports = { assessmentsController };
