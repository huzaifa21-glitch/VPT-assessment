const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../../src/common/middleware/auth');
const { ForbiddenError, UnauthorizedError } = require('../../src/common/errors/app-error');
const { env } = require('../../src/config/env');

function makeReq(headers = {}) {
  return { headers };
}

describe('authenticate', () => {
  it('rejects a request with no bearer token', () => {
    const next = vi.fn();
    expect(() => authenticate(makeReq(), {}, next)).toThrow(UnauthorizedError);
  });

  it('rejects an invalid token', () => {
    const next = vi.fn();
    expect(() => authenticate(makeReq({ authorization: 'Bearer not-a-real-token' }), {}, next)).toThrow(
      UnauthorizedError,
    );
  });

  it('attaches req.user for a valid token', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1' }, env.jwtAccessSecret, {
      expiresIn: '15m',
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    authenticate(req, {}, next);

    expect(req.user).toEqual({ id: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1' });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('authorize', () => {
  it('calls next when the user has an allowed role', () => {
    const req = { user: { id: 'u1', role: 'SUPER_ADMIN', areaId: null } };
    const next = vi.fn();

    authorize('SUPER_ADMIN')(req, {}, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('throws Forbidden when calling an admin-only route with a field-worker token', () => {
    const req = { user: { id: 'u1', role: 'FIELD_WORKER', areaId: 'area-1' } };
    const next = vi.fn();

    expect(() => authorize('SUPER_ADMIN')(req, {}, next)).toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });
});
