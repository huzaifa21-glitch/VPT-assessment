const { createApp } = require('./app');
const { env } = require('./config/env');
const { prisma } = require('./prisma/client');

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[api] listening on port ${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`[api] received ${signal}, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
