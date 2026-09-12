const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { authenticate } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const { createMemberSchema, updateMemberSchema } = require('./members.schema');
const { membersController } = require('./members.controller');

const membersRouter = Router();

membersRouter.use(authenticate);

membersRouter.get('/by-household/:householdId', asyncHandler(membersController.listByHousehold));
membersRouter.post('/', validate(createMemberSchema), asyncHandler(membersController.create));
membersRouter.patch('/:id', validate(updateMemberSchema), asyncHandler(membersController.update));
membersRouter.delete('/:id', asyncHandler(membersController.remove));

module.exports = { membersRouter };
