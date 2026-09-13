const { z } = require('zod');

const createAssessmentSchema = z.object({
  id: z.string().uuid().optional(),
  memberId: z.string().uuid(),
  temperatureC: z.number().min(30).max(45).optional(),
  hasFever: z.boolean().default(false),
  hasCough: z.boolean().default(false),
  hasBreathingDifficulty: z.boolean().default(false),
  bloodPressureSystolic: z.number().int().min(50).max(260).optional(),
  bloodPressureDiastolic: z.number().int().min(30).max(160).optional(),
  notes: z.string().max(2000).optional(),
  flagForReview: z.boolean().default(false), // manual override, in addition to the automatic condition
});

const updateAssessmentSchema = createAssessmentSchema.omit({ id: true, memberId: true }).partial();

module.exports = { createAssessmentSchema, updateAssessmentSchema };
