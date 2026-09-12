
// Mock the Prisma singleton and the dashboard cache-invalidation call so this
// test exercises only the conflict-detection logic in households.service,
// with no real database or Redis connection.
vi.mock('../../src/prisma/client', () => ({
  prisma: {
    household: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock('../../src/modules/dashboard/dashboard.service', () => ({
  dashboardService: { invalidate: vi.fn() },
}));

const { prisma } = require('../../src/prisma/client');
const { householdsService } = require('../../src/modules/households/households.service');
const { NotFoundError } = require('../../src/common/errors/app-error');

const mockedFindUnique = prisma.household.findUnique;
const mockedUpdate = prisma.household.update;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('householdsService.applySyncUpdate', () => {
  it('applies the update and bumps version when baseVersion matches the current version', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'h1', version: 3, deletedAt: null });
    mockedUpdate.mockResolvedValue({ id: 'h1', version: 4, address: 'New address' });

    const result = await householdsService.applySyncUpdate('h1', 3, { address: 'New address' });

    expect(result.conflict).toBe(false);
    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { address: 'New address', version: { increment: 1 } },
    });
  });

  it('returns a conflict with the server copy when baseVersion is stale', async () => {
    // Simulates: field worker downloaded version 3, admin edited it to version 4
    // in the meantime, field worker's queued change still carries baseVersion 3.
    mockedFindUnique.mockResolvedValue({ id: 'h1', version: 4, deletedAt: null, address: 'Admin edited address' });

    const result = await householdsService.applySyncUpdate('h1', 3, { address: 'Field worker edit' });

    expect(result.conflict).toBe(true);
    expect(result.entity.address).toBe('Admin edited address');
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for a soft-deleted or missing household', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'h1', version: 3, deletedAt: new Date() });
    await expect(householdsService.applySyncUpdate('h1', 3, {})).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('householdsService.applySyncDelete', () => {
  it('soft-deletes and bumps version when baseVersion matches', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'h1', version: 2, deletedAt: null });
    mockedUpdate.mockResolvedValue({ id: 'h1', version: 3, deletedAt: new Date() });

    const result = await householdsService.applySyncDelete('h1', 2);

    expect(result.conflict).toBe(false);
    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { deletedAt: expect.any(Date), version: { increment: 1 } },
    });
  });

  it('is idempotent when the record was already deleted (e.g. duplicate sync retry)', async () => {
    const already = { id: 'h1', version: 5, deletedAt: new Date() };
    mockedFindUnique.mockResolvedValue(already);

    const result = await householdsService.applySyncDelete('h1', 2);

    expect(result.conflict).toBe(false);
    expect(result.entity).toBe(already);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('returns a conflict when baseVersion is stale', async () => {
    mockedFindUnique.mockResolvedValue({ id: 'h1', version: 9, deletedAt: null });

    const result = await householdsService.applySyncDelete('h1', 2);

    expect(result.conflict).toBe(true);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});
