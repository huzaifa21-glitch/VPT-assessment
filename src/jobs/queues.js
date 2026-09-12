const { Queue } = require('bullmq');
const { redis } = require('../redis/client');

const QUEUE_NAMES = {
  URGENT_ASSESSMENT: 'urgent-assessment',
};

// One queue instance per process, reused everywhere a job needs enqueuing —
// avoids creating a new BullMQ connection per request.
const urgentAssessmentQueue = new Queue(QUEUE_NAMES.URGENT_ASSESSMENT, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

module.exports = { QUEUE_NAMES, urgentAssessmentQueue };
