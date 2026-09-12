const { z } = require('zod');

const createHouseholdSchema = z.object({
  id: z.string().uuid().optional(), // allows client-generated id for offline-created records
  householdCode: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  areaId: z.string().uuid(),
});

const updateHouseholdSchema = z.object({
  address: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const listHouseholdsQuerySchema = z.object({
  areaId: z.string().uuid().optional(),
  search: z.string().optional(), // matches householdCode or address
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { createHouseholdSchema, updateHouseholdSchema, listHouseholdsQuerySchema };
