const { PrismaClient } = require('@prisma/client');
const { env } = require('../config/env');

// Single shared PrismaClient instance for the whole process (connection pooling
// is handled by Prisma/pg under the hood — do not instantiate per-request).
const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = { prisma };
