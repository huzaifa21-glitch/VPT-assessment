const { assertAreaAccess } = require('../../src/common/utils/area-access');
const { ForbiddenError } = require('../../src/common/errors/app-error');

describe('assertAreaAccess', () => {
  it('allows a super admin regardless of area', () => {
    expect(() => assertAreaAccess({ role: 'SUPER_ADMIN', areaId: null }, 'area-1')).not.toThrow();
    expect(() => assertAreaAccess({ role: 'SUPER_ADMIN', areaId: 'area-2' }, 'area-1')).not.toThrow();
  });

  it('allows a field worker accessing their own assigned area', () => {
    expect(() => assertAreaAccess({ role: 'FIELD_WORKER', areaId: 'area-1' }, 'area-1')).not.toThrow();
  });

  it('rejects a field worker accessing a different area', () => {
    expect(() => assertAreaAccess({ role: 'FIELD_WORKER', areaId: 'area-1' }, 'area-2')).toThrow(ForbiddenError);
  });

  it('rejects a field worker with no assigned area', () => {
    expect(() => assertAreaAccess({ role: 'FIELD_WORKER', areaId: null }, 'area-1')).toThrow(ForbiddenError);
  });
});
