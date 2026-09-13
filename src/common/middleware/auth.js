const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const { prisma } = require('../../prisma/client');
const { asyncHandler } = require('../utils/async-handler');
const { ForbiddenError, UnauthorizedError } = require('../errors/app-error');

// Verifies the bearer access token AND re-checks the account's current state
// in the database on every request. Just verifying the JWT's signature isn't
// enough on its own — a deactivated (or reassigned) user's still-unexpired
// access token would otherwise keep working for up to its full 15-minute
// lifetime, since a JWT is self-contained and normally never re-checked
// against the database once issued. This closes that gap: deactivation takes
// effect on the very next request, not just once the token naturally expires.
async function authenticateHandler(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = jwt.verify(token, env.jwtAccessSecret);
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Account is no longer active');
  }

  // Sourced fresh from the DB (not the JWT payload) so an area reassignment
  // also takes effect immediately, as a side effect of this same check.
  req.user = { id: user.id, role: user.role, areaId: user.areaId };
  next();
}

const authenticate = asyncHandler(authenticateHandler);

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
