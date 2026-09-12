const { z } = require('zod');

const syncEntityType = z.enum(['HOUSEHOLD', 'HOUSEHOLD_MEMBER', 'HEALTH_ASSESSMENT']);
const syncOperation = z.enum(['CREATE', 'UPDATE', 'DELETE']);

const syncChangeSchema = z.object({
  clientChangeId: z.string().uuid(),
  entityType: syncEntityType,
  entityId: z.string().uuid(),
  operation: syncOperation,
  baseVersion: z.number().int().nullable(),
  payload: z.record(z.unknown()),
  clientTimestamp: z.string(),
});

const syncPushSchema = z.object({
  changes: z.array(syncChangeSchema).min(1).max(200),
});

const syncPullQuerySchema = z.object({
  since: z.string().datetime().optional(), // omit to pull everything in scope
});

module.exports = { syncChangeSchema, syncPushSchema, syncPullQuerySchema };
