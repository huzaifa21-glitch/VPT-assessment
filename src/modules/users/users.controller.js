const { usersService } = require('./users.service');

const usersController = {
  async me(req, res) {
    const user = await usersService.getById(req.user.id);
    res.status(200).json(user);
  },

  async list(req, res) {
    const result = await usersService.listFieldWorkers(req.query);
    res.status(200).json(result);
  },

  async create(req, res) {
    const worker = await usersService.createFieldWorker(req.body);
    res.status(201).json(worker);
  },

  async setStatus(req, res) {
    const worker = await usersService.setActiveStatus(req.params.id, req.body.isActive);
    res.status(200).json(worker);
  },

  async assignArea(req, res) {
    const worker = await usersService.assignArea(req.params.id, req.body.areaId);
    res.status(200).json(worker);
  },
};

module.exports = { usersController };
