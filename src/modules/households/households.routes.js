const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { authenticate } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const { createHouseholdSchema, listHouseholdsQuerySchema, updateHouseholdSchema } = require('./households.schema');
const { householdsController } = require('./households.controller');

const householdsRouter = Router();

householdsRouter.use(authenticate);


householdsRouter.get('/', validate(listHouseholdsQuerySchema, 'query'), asyncHandler(householdsController.list));
householdsRouter.get('/:id', asyncHandler(householdsController.getById));
householdsRouter.post('/', validate(createHouseholdSchema), asyncHandler(householdsController.create));
householdsRouter.patch('/:id', validate(updateHouseholdSchema), asyncHandler(householdsController.update));
householdsRouter.delete('/:id', asyncHandler(householdsController.remove));

module.exports = { householdsRouter };
