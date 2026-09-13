const { areasService } = require('./areas.service');

const areasController = {
  async list(_req, res) {
    res.status(200).json(await areasService.list());
  },
  async create(req, res) {
    res.status(201).json(await areasService.create(req.body));
  },
};

module.exports = { areasController };
