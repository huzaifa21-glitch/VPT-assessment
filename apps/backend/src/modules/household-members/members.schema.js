const { z } = require('zod');

const GENDER_VALUES = ['MALE', 'FEMALE', 'OTHER'];
const RELATIONSHIP_VALUES = ['HEAD', 'SPOUSE', 'CHILD', 'OTHER'];

const createMemberSchema = z.object({
  id: z.string().uuid().optional(),
  householdId: z.string().uuid(),
  name: z.string().min(1),
  age: z.number().int().min(0).max(150),
  gender: z.enum(GENDER_VALUES),
  relationship: z.enum(RELATIONSHIP_VALUES),
});

const updateMemberSchema = z.object({
  name: z.string().min(1).optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(GENDER_VALUES).optional(),
  relationship: z.enum(RELATIONSHIP_VALUES).optional(),
});

module.exports = { createMemberSchema, updateMemberSchema };
