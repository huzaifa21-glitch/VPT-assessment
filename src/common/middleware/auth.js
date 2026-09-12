const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../errors/app-error');

// Verifies the bearer access token and attaches req.user. Every protected
// route goes through this; there is no per-route auth logic.
function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: payload.sub, role: payload.role, areaId: payload.areaId || null };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

// Role-based access control. Usage: router.get('/', authenticate, authorize('SUPER_ADMIN'), ...)
// The frontend never decides this — every admin-only route in this backend
// carries this guard, so calling it directly with a field-worker token is rejected.
function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = { authenticate, authorize };
