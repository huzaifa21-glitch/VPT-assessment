const { prisma } = require('../../src/prisma/client');
const { dashboardService } = require('../../src/modules/dashboard/dashboard.service');
const { householdsService } = require('../../src/modules/households/households.service');
const { NotFoundError } = require('../../src/common/errors/app-error');

// Instead of vi.mock() (which targets ESM's static `import` and doesn't reliably
// intercept CommonJS require() calls), we spy directly on the real singleton
// objects. require() always returns the same shared object, so replacing a
// method here is seen by households.service.js too — no real DB/Redis is hit.
let findUniqueSpy;
let updateSpy;

beforeEach(() => {
  findUniqueSpy = vi.spyOn(prisma.household, 'findUnique');
  updateSpy = vi.spyOn(prisma.household, 'update');
  vi.spyOn(dashboardService, 'invalidate').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('householdsService.applySyncUpdate', () => {
  it('applies the update and bumps version when baseVersion matches the current version', async () => {
    findUniqueSpy.mockResolvedValue({ id: 'h1', version: 3, deletedAt: null });
    updateSpy.mockResolvedValue({ id: 'h1', version: 4, address: 'New address' });

    const result = await householdsService.applySyncUpdate('h1', 3, { address: 'New address' });

    expect(result.conflict).toBe(false);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { address: 'New address', version: { increment: 1 } },
    });
  });

  it('returns a conflict with the server copy when baseVersion is stale', async () => {
    // Simulates: field worker downloaded version 3, admin edited it to version 4
    // in the meantime, field worker's queued change still carries baseVersion 3.
    findUniqueSpy.mockResolvedValue({ id: 'h1', version: 4, deletedAt: null, address: 'Admin edited address' });

    const result = await householdsService.applySyncUpdate('h1', 3, { address: 'Field worker edit' });

    expect(result.conflict).toBe(true);
    expect(result.entity.address).toBe('Admin edited address');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for a soft-deleted or missing household', async () => {
    findUniqueSpy.mockResolvedValue({ id: 'h1', version: 3, deletedAt: new Date() });
    await expect(householdsService.applySyncUpdate('h1', 3, {})).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('householdsService.applySyncDelete', () => {
  it('soft-deletes and bumps version when baseVersion matches', async () => {
    findUniqueSpy.mockResolvedValue({ id: 'h1', version: 2, deletedAt: null });
    updateSpy.mockResolvedValue({ id: 'h1', version: 3, deletedAt: new Date() });

    const result = await householdsService.applySyncDelete('h1', 2);

    expect(result.conflict).toBe(false);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { deletedAt: expect.any(Date), version: { increment: 1 } },
    });
  });

  it('is idempotent when the record was already deleted (e.g. duplicate sync retry)', async () => {
    const already = { id: 'h1', version: 5, deletedAt: new Date() };
    findUniqueSpy.mockResolvedValue(already);

    const result = await householdsService.applySyncDelete('h1', 2);

    expect(result.conflict).toBe(false);
    expect(result.entity).toBe(already);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('returns a conflict when baseVersion is stale', async () => {
    findUniqueSpy.mockResolvedValue({ id: 'h1', version: 9, deletedAt: null });

    const result = await householdsService.applySyncDelete('h1', 2);

    expect(result.conflict).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
