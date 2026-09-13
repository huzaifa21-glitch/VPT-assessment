const { ForbiddenError } = require('../errors/app-error');

// Field workers may only touch data in their currently assigned area, even
// though the route itself is shared with admins. Centralized here so every
// module (households, members, assessments) enforces it the same way.
function assertAreaAccess(user, resourceAreaId) {
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.areaId || user.areaId !== resourceAreaId) {
    throw new ForbiddenError('You do not have access to this area');
  }
}

module.exports = { assertAreaAccess };
