const { syncService } = require('./sync.service');

const syncController = {
  async push(req, res) {
    const results = await syncService.push(req.user, req.body.changes);
    res.status(200).json({ results });
  },

  async pull(req, res) {
    const data = await syncService.pull(req.user, req.query.since);
    res.status(200).json(data);
  },
};

module.exports = { syncController };
