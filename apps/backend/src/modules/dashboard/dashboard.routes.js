const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { authenticate, authorize } = require('../../common/middleware/auth');
const { dashboardController } = require('./dashboard.controller');

const dashboardRouter = Router();

dashboardRouter.use(authenticate, authorize('SUPER_ADMIN'));

dashboardRouter.get('/stats', asyncHandler(dashboardController.stats));
dashboardRouter.get('/activity', asyncHandler(dashboardController.activity));

module.exports = { dashboardRouter };
