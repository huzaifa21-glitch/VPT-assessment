import { api, isOffline } from '../api/client';
import { householdsRepo } from '../db/householdsRepo';
import { membersRepo } from '../db/membersRepo';
import { assessmentsRepo } from '../db/assessmentsRepo';
import { getMeta, setMeta, LAST_PULLED_AT_KEY } from '../db/syncMeta';
import { getDb } from '../db/database';

const repos = {
  HOUSEHOLD: householdsRepo,
  HOUSEHOLD_MEMBER: membersRepo,
  HEALTH_ASSESSMENT: assessmentsRepo,
};

function toChangePayload(entityType, row) {
  if (entityType === 'HOUSEHOLD') {
    return {
      householdCode: row.householdCode,
      address: row.address,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      areaId: row.areaId,
    };
  }
  if (entityType === 'HOUSEHOLD_MEMBER') {
    return {
      householdId: row.householdId,
      name: row.name,
      age: row.age,
      gender: row.gender,
      relationship: row.relationship,
    };
  }
  // HEALTH_ASSESSMENT
  return {
    memberId: row.memberId,
    temperatureC: row.temperatureC ?? undefined,
    hasFever: !!row.hasFever,
    hasCough: !!row.hasCough,
    hasBreathingDifficulty: !!row.hasBreathingDifficulty,
    bloodPressureSystolic: row.bloodPressureSystolic ?? undefined,
    bloodPressureDiastolic: row.bloodPressureDiastolic ?? undefined,
    notes: row.notes ?? undefined,
    flagForReview: !!row.flagForReview,
  };
}


async function buildChangeBatch() {
  const [households, members, assessments] = await Promise.all([
    householdsRepo.listPendingForPush(),
    membersRepo.listPendingForPush(),
    assessmentsRepo.listPendingForPush(),
  ]);

  const changes = [];
  for (const [entityType, rows] of [
    ['HOUSEHOLD', households],
    ['HOUSEHOLD_MEMBER', members],
    ['HEALTH_ASSESSMENT', assessments],
  ]) {
    for (const row of rows) {
      changes.push({
        clientChangeId: row.pendingChangeId,
        entityType,
        entityId: row.id,
        operation: row.pendingOperation,
        baseVersion: row.baseVersion,
        payload: row.pendingOperation === 'DELETE' ? {} : toChangePayload(entityType, row),
        clientTimestamp: row.updatedAt,
      });
    }
  }
  return changes;
}


async function push() {
  const allChanges = await buildChangeBatch();
  if (allChanges.length === 0) return { pushed: 0, applied: 0, conflicts: 0, errors: 0 };

  let applied = 0;
  let conflicts = 0;
  let errors = 0;

  for (let i = 0; i < allChanges.length; i += 200) {
    const batch = allChanges.slice(i, i + 200);
    const { results } = await api.syncPush(batch);

    for (const result of results) {
      const change = batch.find((c) => c.clientChangeId === result.clientChangeId);
      if (!change) continue;
      const repo = repos[change.entityType];

      if (result.status === 'APPLIED') {
        applied += 1;
        await repo.applyPushResult(change.entityId, 'APPLIED', result.serverEntity);
      } else if (result.status === 'CONFLICT') {
        conflicts += 1;
        await repo.applyPushResult(change.entityId, 'CONFLICT', result.serverEntity);
      } else {
        errors += 1;
        await repo.applyPushResult(change.entityId, 'ERROR', null, result.message);
      }
    }
  }

  return { pushed: allChanges.length, applied, conflicts, errors };
}


async function pull() {
  const since = await getMeta(LAST_PULLED_AT_KEY);
  const data = await api.syncPull(since || undefined);

  for (const record of data.households) await householdsRepo.upsertFromServer(record);
  for (const record of data.members) await membersRepo.upsertFromServer(record);
  for (const record of data.assessments) await assessmentsRepo.upsertFromServer(record);

  await setMeta(LAST_PULLED_AT_KEY, data.serverTime);
  return {
    households: data.households.length,
    members: data.members.length,
    assessments: data.assessments.length,
  };
}


export async function runSync() {
  try {
    const pushResult = await push();
    const pullResult = await pull();
    return { ok: true, offline: false, pushResult, pullResult };
  } catch (err) {
    if (isOffline(err)) {
      return { ok: false, offline: true };
    }
    return { ok: false, offline: false, error: err.message };
  }
}

export async function getPendingCounts() {
  const [households, members, assessments] = await Promise.all([
    householdsRepo.listPendingForPush(),
    membersRepo.listPendingForPush(),
    assessmentsRepo.listPendingForPush(),
  ]);
  const all = [...households, ...members, ...assessments];
  return {
    pending: all.filter((r) => r.syncStatus === 'pending').length,
    error: all.filter((r) => r.syncStatus === 'error').length,
  };
}


export async function getConflictCount() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       (SELECT COUNT(*) FROM households WHERE syncStatus = 'conflict') +
       (SELECT COUNT(*) FROM household_members WHERE syncStatus = 'conflict') +
       (SELECT COUNT(*) FROM health_assessments WHERE syncStatus = 'conflict') AS count`,
  );
  return rows[0]?.count ?? 0;
}
