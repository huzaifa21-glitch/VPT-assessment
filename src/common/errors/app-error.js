// Central error hierarchy — every handler throws these instead of shaping
// its own error response, so the error middleware is the only place that
// decides status codes / response shape.
class AppError extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request', details) {
    super(400, message, 'BAD_REQUEST', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', details) {
    super(409, message, 'CONFLICT', details);
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super(422, 'Validation failed', 'VALIDATION_ERROR', details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
};
