import { getDb } from './database';
import {
  fieldsForNewRecord,
  fieldsForUpdate,
  fieldsForDelete,
  fieldsForApplied,
  fieldsForConflict,
  fieldsForError,
  fieldsForResolveUseServer,
  fieldsForResolveKeepMine,
} from './syncableRecord';
import { rankCase, worseOf } from './syncRollup';

function toBool(n) {
  return !!n;
}

// Correlated subquery: the worst severity found among this household's
// members AND those members' assessments — i.e. two levels down. Combined
// with the household's own syncStatus (in JS, via worseOf) to produce
// `effectiveSyncStatus`, which is what the UI badges actually display —
// so a pending assessment three levels down still surfaces at the top.
const CHILD_MAX_RANK_SUBQUERY = `(
  SELECT COALESCE(MAX(rank), 0) FROM (
    SELECT ${rankCase('syncStatus')} as rank
    FROM household_members WHERE householdId = households.id AND deletedAt IS NULL
    UNION ALL
    SELECT ${rankCase('ha.syncStatus')} as rank
    FROM health_assessments ha
    JOIN household_members hm ON ha.memberId = hm.id
    WHERE hm.householdId = households.id AND ha.deletedAt IS NULL AND hm.deletedAt IS NULL
  )
)`;

function withEffectiveStatus(row) {
  if (!row) return row;
  return { ...row, effectiveSyncStatus: worseOf(row.syncStatus, row.childMaxRank) };
}

export const householdsRepo = {
  // areaId is required — the local DB is one shared file for the whole app
  // install, so if a different field worker logged in on this device before,
  // their area's data can still be sitting in local storage. Filtering here
  // is what actually keeps it out of view, regardless of what's cached.
  async listAll(areaId) {
    const db = await getDb();
    if (!areaId) return [];
    const rows = await db.getAllAsync(
      `SELECT households.*, ${CHILD_MAX_RANK_SUBQUERY} as childMaxRank
       FROM households
       WHERE deletedAt IS NULL AND areaId = ?
       ORDER BY updatedAt DESC`,
      [areaId],
    );
    return rows.map(withEffectiveStatus);
  },

  async getById(id) {
    const db = await getDb();
    const row = await db.getFirstAsync(
      `SELECT households.*, ${CHILD_MAX_RANK_SUBQUERY} as childMaxRank
       FROM households WHERE id = ?`,
      [id],
    );
    return withEffectiveStatus(row);
  },

  async create({ householdCode, address, latitude, longitude, areaId, areaName }) {
    const db = await getDb();
    const f = fieldsForNewRecord();
    await db.runAsync(
      `INSERT INTO households
        (id, householdCode, address, latitude, longitude, areaId, areaName, version, deletedAt,
         updatedAt, syncStatus, pendingOperation, baseVersion, pendingChangeId, conflictServerSnapshot, lastSyncError)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        f.id, householdCode, address, latitude ?? null, longitude ?? null, areaId, areaName ?? null,
        f.version, f.updatedAt, f.syncStatus, f.pendingOperation, f.baseVersion, f.pendingChangeId,
        f.conflictServerSnapshot, f.lastSyncError,
      ],
    );
    return this.getById(f.id);
  },

  async update(id, patch) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) throw new Error('Household not found locally');
    const f = fieldsForUpdate(current);

    await db.runAsync(
      `UPDATE households SET
        address = COALESCE(?, address),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        updatedAt = ?, syncStatus = ?, pendingOperation = ?, baseVersion = ?, pendingChangeId = ?,
        conflictServerSnapshot = NULL, lastSyncError = NULL
       WHERE id = ?`,
      [
        patch.address ?? null, patch.latitude ?? null, patch.longitude ?? null,
        f.updatedAt, f.syncStatus, f.pendingOperation, f.baseVersion, f.pendingChangeId, id,
      ],
    );
    return this.getById(id);
  },

  async softDelete(id) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return;
    const f = fieldsForDelete(current);

    if (f.hardDelete) {
      await db.runAsync('DELETE FROM households WHERE id = ?', [id]);
      return;
    }
    await db.runAsync(
      `UPDATE households SET deletedAt = ?, updatedAt = ?, syncStatus = ?, pendingOperation = ?,
        baseVersion = ?, pendingChangeId = ? WHERE id = ?`,
      [f.deletedAt, f.updatedAt, f.syncStatus, f.pendingOperation, f.baseVersion, f.pendingChangeId, id],
    );
  },

  // --- used by the sync engine ---

  async listPendingForPush() {
    const db = await getDb();
    return db.getAllAsync(
      "SELECT * FROM households WHERE syncStatus IN ('pending', 'error') ORDER BY updatedAt ASC",
    );
  },

  async applyPushResult(id, status, serverEntity, message) {
    const db = await getDb();
    let f;
    if (status === 'APPLIED') f = fieldsForApplied(serverEntity);
    else if (status === 'CONFLICT') f = fieldsForConflict(serverEntity);
    else f = fieldsForError(message);

    if (status === 'APPLIED') {
      await db.runAsync(
        `UPDATE households SET householdCode = ?, address = ?, latitude = ?, longitude = ?, areaId = ?,
          version = ?, updatedAt = ?, deletedAt = ?, syncStatus = ?, pendingOperation = ?, baseVersion = ?,
          pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?`,
        [
          serverEntity.householdCode, serverEntity.address, serverEntity.latitude, serverEntity.longitude,
          serverEntity.areaId, f.version, f.updatedAt, f.deletedAt, f.syncStatus, f.pendingOperation,
          f.baseVersion, f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id,
        ],
      );
    } else {
      await db.runAsync(
        'UPDATE households SET syncStatus = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?',
        [f.syncStatus, f.conflictServerSnapshot ?? null, f.lastSyncError ?? null, id],
      );
    }
  },

  async resolveUseServer(id) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current || !current.conflictServerSnapshot) return;
    const serverEntity = JSON.parse(current.conflictServerSnapshot);
    const f = fieldsForResolveUseServer(serverEntity);
    await db.runAsync(
      `UPDATE households SET householdCode = ?, address = ?, latitude = ?, longitude = ?, areaId = ?,
        version = ?, updatedAt = ?, deletedAt = ?, syncStatus = ?, pendingOperation = ?, baseVersion = ?,
        pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?`,
      [
        f.householdCode, f.address, f.latitude, f.longitude, f.areaId, f.version, f.updatedAt, f.deletedAt,
        f.syncStatus, f.pendingOperation, f.baseVersion, f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id,
      ],
    );
  },

  async resolveKeepMine(id) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current || !current.conflictServerSnapshot) return;
    const serverEntity = JSON.parse(current.conflictServerSnapshot);
    const f = fieldsForResolveKeepMine(current, serverEntity);
    await db.runAsync(
      'UPDATE households SET baseVersion = ?, syncStatus = ?, pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?',
      [f.baseVersion, f.syncStatus, f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id],
    );
  },

  // --- used by the sync engine's pull step ---

  async upsertFromServer(record) {
    const db = await getDb();
    const existing = await this.getById(record.id);
    // Never overwrite a record the user has an unsynced local edit on —
    // that gets reconciled through the push/conflict path instead.
    if (existing && existing.syncStatus !== 'synced') return;

    await db.runAsync(
      `INSERT OR REPLACE INTO households
        (id, householdCode, address, latitude, longitude, areaId, areaName, version, deletedAt, updatedAt,
         syncStatus, pendingOperation, baseVersion, pendingChangeId, conflictServerSnapshot, lastSyncError)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, NULL, NULL, NULL, NULL)`,
      [
        record.id, record.householdCode, record.address, record.latitude ?? null, record.longitude ?? null,
        record.areaId, record.area ? record.area.name : (existing ? existing.areaName : null),
        record.version, record.deletedAt, record.updatedAt,
      ],
    );
  },
};

export { toBool };
