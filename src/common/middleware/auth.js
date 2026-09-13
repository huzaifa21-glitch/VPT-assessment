const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const { prisma } = require('../../prisma/client');
const { asyncHandler } = require('../utils/async-handler');
const { ForbiddenError, UnauthorizedError } = require('../errors/app-error');


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


  req.user = { id: user.id, role: user.role, areaId: user.areaId };
  next();
}

const authenticate = asyncHandler(authenticateHandler);


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
