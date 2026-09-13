const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { authenticate } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const { syncPullQuerySchema, syncPushSchema } = require('./sync.schema');
const { syncController } = require('./sync.controller');

const syncRouter = Router();

syncRouter.use(authenticate);

syncRouter.post('/push', validate(syncPushSchema), asyncHandler(syncController.push));
syncRouter.get('/pull', validate(syncPullQuerySchema, 'query'), asyncHandler(syncController.pull));

module.exports = { syncRouter };
