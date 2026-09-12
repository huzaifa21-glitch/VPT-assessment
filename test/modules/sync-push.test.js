
vi.spyOn('../../src/prisma/client', () => ({
  prisma: {
    syncLog: { findUnique: vi.fn(), create: vi.fn() },
    household: { findUnique: vi.fn() },
    householdMember: { findUnique: vi.fn() },
    healthAssessment: { findUnique: vi.fn() },
  },
}));
vi.spyOn('../../src/modules/households/households.service', () => ({
  householdsService: {
    applySyncCreate: vi.fn(),
    applySyncUpdate: vi.fn(),
    applySyncDelete: vi.fn(),
  },
}));
vi.spyOn('../../src/modules/household-members/members.service', () => ({
  membersService: { applySyncCreate: vi.fn(), applySyncUpdate: vi.fn(), applySyncDelete: vi.fn() },
}));
vi.spyOn('../../src/modules/health-assessments/assessments.service', () => ({
  assessmentsService: { applySyncCreate: vi.fn(), applySyncUpdate: vi.fn(), applySyncDelete: vi.fn() },
}));

const { prisma } = require('../../src/prisma/client');
const { householdsService } = require('../../src/modules/households/households.service');
const { syncService } = require('../../src/modules/sync/sync.service');

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncService.push — idempotency', () => {
  it('replays the stored result for a clientChangeId that was already processed', async () => {
    prisma.syncLog.findUnique.mockResolvedValue({
      status: 'APPLIED',
      resultSnapshot: { id: baseChange.entityId, address: 'Addr' },
    });

    const results = await syncService.push(admin, [baseChange]);

    expect(results[0].status).toBe('APPLIED');
    expect(householdsService.applySyncCreate).not.toHaveBeenCalled();
  });

  it('applies a new change and records it in the sync log for future idempotency', async () => {
    prisma.syncLog.findUnique.mockResolvedValue(null);
    householdsService.applySyncCreate.mockResolvedValue({
      conflict: false,
      entity: { id: baseChange.entityId },
    });

    const results = await syncService.push(admin, [baseChange]);

    expect(results[0].status).toBe('APPLIED');
    expect(prisma.syncLog.create).toHaveBeenCalledOnce();
  });
});

describe('syncService.push — per-change isolation', () => {
  it('does not let one failing change block the rest of the batch', async () => {
    prisma.syncLog.findUnique.mockResolvedValue(null);
    householdsService.applySyncCreate
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
    prisma.syncLog.findUnique.mockResolvedValue(null);
    const updateChange = { ...baseChange, operation: 'UPDATE', baseVersion: 3 };
    prisma.household.findUnique.mockResolvedValue({ id: updateChange.entityId, areaId: 'area-1' });
    householdsService.applySyncUpdate.mockResolvedValue({
      conflict: true,
      entity: { id: updateChange.entityId, version: 4 },
    });

    const results = await syncService.push(admin, [updateChange]);

    expect(results[0].status).toBe('CONFLICT');
  });
});
