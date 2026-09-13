const { createUrgentAssessmentWorker } = require('./jobs/urgent-assessment.processor');
const { prisma } = require('./prisma/client');

// Separate process entry point (npm run start:worker) — the assignment
// requires the BullMQ worker not run inside the API process.
const worker = createUrgentAssessmentWorker();

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job && job.id} failed (attempt ${job && job.attemptsMade}):`, err.message);
});

async function shutdown(signal) {
  console.log(`[worker] received ${signal}, shutting down`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('[worker] urgent-assessment worker started');
