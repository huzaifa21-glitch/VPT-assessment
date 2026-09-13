const { dashboardService } = require('./dashboard.service');

const dashboardController = {
  async stats(_req, res) {
    res.status(200).json(await dashboardService.getStats());
  },
  async activity(_req, res) {
    res.status(200).json(await dashboardService.recentActivity());
  },
};

module.exports = { dashboardController };
