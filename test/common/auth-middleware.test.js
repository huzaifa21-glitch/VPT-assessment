const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../../src/common/middleware/auth');
const { ForbiddenError, UnauthorizedError } = require('../../src/common/errors/app-error');
const { env } = require('../../src/config/env');
const { prisma } = require('../../src/prisma/client');

function makeReq(headers = {}) {
  return { headers };
}

let findUniqueSpy;

beforeEach(() => {
  findUniqueSpy = vi.spyOn(prisma.user, 'findUnique');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('authenticate', () => {
  // authenticate now looks the user up on every request (not just verifying
  // the JWT), so it's async — errors reach `next(err)` rather than throwing
  // synchronously. Await the call, then check what `next` was called with.

  it('rejects a request with no bearer token', async () => {
    const next = vi.fn();
    await authenticate(makeReq(), {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(findUniqueSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const next = vi.fn();
    await authenticate(makeReq({ authorization: 'Bearer not-a-real-token' }), {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(findUniqueSpy).not.toHaveBeenCalled();
  });

  it('attaches req.user for a valid token belonging to an active user', async () => {
    findUniqueSpy.mockResolvedValue({ id: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1', isActive: true });
    const token = jwt.sign({ sub: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1' }, env.jwtAccessSecret, {
      expiresIn: '15m',
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    await authenticate(req, {}, next);

    expect(req.user).toEqual({ id: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a valid token whose account has since been deactivated', async () => {
    // The whole point of this check: an unexpired token is not enough on its
    // own once the account has been deactivated in the meantime.
    findUniqueSpy.mockResolvedValue({ id: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1', isActive: false });
    const token = jwt.sign({ sub: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1' }, env.jwtAccessSecret, {
      expiresIn: '15m',
    });
    const next = vi.fn();

    await authenticate(makeReq({ authorization: `Bearer ${token}` }), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rejects a valid token whose account no longer exists', async () => {
    findUniqueSpy.mockResolvedValue(null);
    const token = jwt.sign({ sub: 'user-1', role: 'FIELD_WORKER', areaId: 'area-1' }, env.jwtAccessSecret, {
      expiresIn: '15m',
    });
    const next = vi.fn();

    await authenticate(makeReq({ authorization: `Bearer ${token}` }), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
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
