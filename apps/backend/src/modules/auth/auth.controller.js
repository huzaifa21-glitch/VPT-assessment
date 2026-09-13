const { authService } = require('./auth.service');

const authController = {
  async login(req, res) {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  },

  async refresh(req, res) {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.status(200).json(result);
  },

  async logout(req, res) {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.status(204).send();
  },
};

module.exports = { authController };
