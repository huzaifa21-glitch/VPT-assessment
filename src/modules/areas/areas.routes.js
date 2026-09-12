const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { authenticate, authorize } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const { createAreaSchema } = require('./areas.schema');
const { areasController } = require('./areas.controller');

const areasRouter = Router();

areasRouter.use(authenticate);

// Both roles can read areas (a field worker needs to see their own area's
// name); only admins can create new areas.
areasRouter.get('/', asyncHandler(areasController.list));
areasRouter.post('/', authorize('SUPER_ADMIN'), validate(createAreaSchema), asyncHandler(areasController.create));

module.exports = { areasRouter };
