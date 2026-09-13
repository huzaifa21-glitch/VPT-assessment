const { Router } = require('express');
const { asyncHandler } = require('../../common/utils/async-handler');
const { validate } = require('../../common/middleware/validate');
const { loginSchema, logoutSchema, refreshSchema } = require('./auth.schema');
const { authController } = require('./auth.controller');

const authRouter = Router();

authRouter.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh', validate(refreshSchema), asyncHandler(authController.refresh));
authRouter.post('/logout', validate(logoutSchema), asyncHandler(authController.logout));

module.exports = { authRouter };
