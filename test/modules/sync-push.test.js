const { prisma } = require('../../src/prisma/client');
const { householdsService } = require('../../src/modules/households/households.service');
const { syncService } = require('../../src/modules/sync/sync.service');

// Same approach as households-sync.test.js: spy on the real singletons rather
// than vi.mock() (which doesn't reliably intercept CommonJS require()).
let syncLogFindUniqueSpy;
let syncLogUpsertSpy;
let householdFindUniqueSpy;
let applySyncCreateSpy;
let applySyncUpdateSpy;

beforeEach(() => {
  syncLogFindUniqueSpy = vi.spyOn(prisma.syncLog, 'findUnique');
  syncLogUpsertSpy = vi.spyOn(prisma.syncLog, 'upsert').mockResolvedValue({});
  householdFindUniqueSpy = vi.spyOn(prisma.household, 'findUnique');
  applySyncCreateSpy = vi.spyOn(householdsService, 'applySyncCreate');
  applySyncUpdateSpy = vi.spyOn(householdsService, 'applySyncUpdate');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const admin = { id: 'admin-1', role: 'SUPER_ADMIN', areaId: null };

const baseChange = {
  clientChangeId: '11111111-1111-1111-1111-111111111111',
  entityType: 'HOUSEHOLD',
  entityId: '22222222-2222-2222-2222-222222222222',
  operation: 'CREATE',
  baseVersion: null,
  payload: { householdCode: 'HH-1', address: 'Addr', areaId: 'area-1' },
  clientTimestamp: new Date().toISOString(),
};

describe('syncService.push — idempotency', () => {
  it('replays the stored result for a clientChangeId that was already processed', async () => {
    syncLogFindUniqueSpy.mockResolvedValue({
      status: 'APPLIED',
      resultSnapshot: { id: baseChange.entityId, address: 'Addr' },
    });

    const results = await syncService.push(admin, [baseChange]);

    expect(results[0].status).toBe('APPLIED');
    expect(applySyncCreateSpy).not.toHaveBeenCalled();
  });

  it('applies a new change and records it in the sync log for future idempotency', async () => {
    syncLogFindUniqueSpy.mockResolvedValue(null);
    applySyncCreateSpy.mockResolvedValue({
      conflict: false,
      entity: { id: baseChange.entityId },
    });

    const results = await syncService.push(admin, [baseChange]);

    expect(results[0].status).toBe('APPLIED');
    expect(syncLogUpsertSpy).toHaveBeenCalledOnce();
  });
});

describe('syncService.push — per-change isolation', () => {
  it('does not let one failing change block the rest of the batch', async () => {
    syncLogFindUniqueSpy.mockResolvedValue(null);
    applySyncCreateSpy
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ conflict: false, entity: { id: 'ok' } });

    const secondChange = {
      ...baseChange,
      clientChangeId: '33333333-3333-3333-3333-333333333333',
      entityId: '44444444-4444-4444-4444-444444444444',
    };

    const results = await syncService.push(admin, [baseChange, secondChange]);

    expect(results[0].status).toBe('ERROR');
    expect(results[1].status).toBe('APPLIED');
  });

  it('reports CONFLICT when the entity service detects a stale baseVersion', async () => {
    syncLogFindUniqueSpy.mockResolvedValue(null);
    const updateChange = { ...baseChange, operation: 'UPDATE', baseVersion: 3 };
    householdFindUniqueSpy.mockResolvedValue({ id: updateChange.entityId, areaId: 'area-1' });
    applySyncUpdateSpy.mockResolvedValue({
      conflict: true,
      entity: { id: updateChange.entityId, version: 4 },
    });

    const results = await syncService.push(admin, [updateChange]);

    expect(results[0].status).toBe('CONFLICT');
  });
});
