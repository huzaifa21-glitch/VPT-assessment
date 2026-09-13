const { ForbiddenError } = require('../errors/app-error');


function assertAreaAccess(user, resourceAreaId) {
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.areaId || user.areaId !== resourceAreaId) {
    throw new ForbiddenError('You do not have access to this area');
  }
}

module.exports = { assertAreaAccess };
