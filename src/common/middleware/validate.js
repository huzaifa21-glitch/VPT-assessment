const { ZodError } = require('zod');
const { ValidationError } = require('../errors/app-error');


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
