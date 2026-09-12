const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { authenticate } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const { createAssessmentSchema, updateAssessmentSchema } = require('./assessments.schema');
const { assessmentsController } = require('./assessments.controller');

const assessmentsRouter = Router();

assessmentsRouter.use(authenticate);

assessmentsRouter.get('/by-member/:memberId', asyncHandler(assessmentsController.listByMember));
assessmentsRouter.post('/', validate(createAssessmentSchema), asyncHandler(assessmentsController.create));
assessmentsRouter.patch('/:id', validate(updateAssessmentSchema), asyncHandler(assessmentsController.update));
assessmentsRouter.delete('/:id', asyncHandler(assessmentsController.remove));

module.exports = { assessmentsRouter };
