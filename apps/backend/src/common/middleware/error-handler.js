const { Prisma } = require('@prisma/client');
const { AppError } = require('../errors/app-error');
const { env } = require('../../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

// Single place that turns any thrown error into a consistent JSON response.
// Route handlers just `throw` — they never build their own error payloads.
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'UNIQUE_CONSTRAINT', message: 'A record with this value already exists', details: err.meta },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
      return;
    }
  }

  console.error('[unhandled error]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      details: env.nodeEnv === 'development' ? String(err) : undefined,
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
