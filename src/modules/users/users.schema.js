const { z } = require('zod');

const createFieldWorkerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  areaId: z.string().uuid().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const assignAreaSchema = z.object({
  areaId: z.string().uuid(),
});

const listFieldWorkersQuerySchema = z.object({
  areaId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { createFieldWorkerSchema, updateStatusSchema, assignAreaSchema, listFieldWorkersQuerySchema };
