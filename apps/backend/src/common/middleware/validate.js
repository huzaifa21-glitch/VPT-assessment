const { ZodError } = require('zod');
const { ValidationError } = require('../errors/app-error');

// Generic zod-validation middleware factory. Reused across every route —
// e.g. validate(createHouseholdSchema, 'body'), validate(syncPushSchema).
// On success, req[target] is replaced with the parsed (typed, defaulted) value.
const validate = (schema, target = 'body') => (req, _res, next) => {
  try {
    req[target] = schema.parse(req[target]);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      next(new ValidationError(err.flatten()));
      return;
    }
    next(err);
  }
};

module.exports = { validate };
