const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { authRouter } = require('./modules/auth/auth.routes');
const { usersRouter } = require('./modules/users/users.routes');
const { areasRouter } = require('./modules/areas/areas.routes');
const { householdsRouter } = require('./modules/households/households.routes');
const { membersRouter } = require('./modules/household-members/members.routes');
const { assessmentsRouter } = require('./modules/health-assessments/assessments.routes');
const { syncRouter } = require('./modules/sync/sync.routes');
const { dashboardRouter } = require('./modules/dashboard/dashboard.routes');
const { errorHandler, notFoundHandler } = require('./common/middleware/error-handler');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(process.env.NODE_ENV === 'test' ? 'dev' : 'combined'));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/areas', areasRouter);
  api.use('/households', householdsRouter);
  api.use('/members', membersRouter);
  api.use('/assessments', assessmentsRouter);
  api.use('/sync', syncRouter);
  api.use('/dashboard', dashboardRouter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
