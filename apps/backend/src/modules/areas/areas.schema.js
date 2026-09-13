const { z } = require('zod');

const createAreaSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

module.exports = { createAreaSchema };
