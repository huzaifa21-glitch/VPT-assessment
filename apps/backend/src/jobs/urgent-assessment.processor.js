const { Worker } = require('bullmq');
const { redis } = require('../redis/client');
const { prisma } = require('../prisma/client');
const { QUEUE_NAMES } = require('./queues');
const { dashboardService } = require('../modules/dashboard/dashboard.service');

// Runs in the separate worker process (src/worker.js), never inside the API
// process — so a slow/failing job can't block request handling.
function createUrgentAssessmentWorker() {
  return new Worker(
    QUEUE_NAMES.URGENT_ASSESSMENT,
    async (job) => {
      const { assessmentId, memberId, memberName, reason } = job.data;

      // Idempotent regardless of BullMQ's own dedup: if an ActivityLog for
      // this assessment already exists (e.g. reprocessed after a crash before
      // ack), don't write a second one.
      const existing = await prisma.activityLog.findFirst({
        where: { type: 'URGENT_ASSESSMENT', relatedEntityId: assessmentId },
      });
      if (existing) return;

      await prisma.activityLog.create({
        data: {
          type: 'URGENT_ASSESSMENT',
          message: `Urgent health assessment recorded for ${memberName} (${reason})`,
          relatedEntityType: 'HEALTH_ASSESSMENT',
          relatedEntityId: assessmentId,
        },
      });
      await dashboardService.invalidate();
      console.log(`[worker] urgent assessment activity logged for member ${memberId}`);
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );
}

module.exports = { createUrgentAssessmentWorker };
