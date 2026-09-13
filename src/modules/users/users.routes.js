const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { authenticate, authorize } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const {
  assignAreaSchema,
  createFieldWorkerSchema,
  listFieldWorkersQuerySchema,
  updateStatusSchema,
} = require('./users.schema');
const { usersController } = require('./users.controller');

const usersRouter = Router();

usersRouter.use(authenticate);

// Available to any authenticated user — a field worker fetching "their own
// assigned area" is just this endpoint's areaId field.
usersRouter.get('/me', asyncHandler(usersController.me));

// Everything below is admin-only: managing other users is explicitly
usersRouter.get(
  '/field-workers',
  authorize('SUPER_ADMIN'),
  validate(listFieldWorkersQuerySchema, 'query'),
  asyncHandler(usersController.list),
);
usersRouter.post(
  '/field-workers',
  authorize('SUPER_ADMIN'),
  validate(createFieldWorkerSchema),
  asyncHandler(usersController.create),
);
usersRouter.patch(
  '/field-workers/:id/status',
  authorize('SUPER_ADMIN'),
  validate(updateStatusSchema),
  asyncHandler(usersController.setStatus),
);
usersRouter.patch(
  '/field-workers/:id/area',
  authorize('SUPER_ADMIN'),
  validate(assignAreaSchema),
  asyncHandler(usersController.assignArea),
);

module.exports = { usersRouter };
