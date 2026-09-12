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

// Same idea as households.js one level down: the worst severity among this
// member's own health assessments.
const CHILD_MAX_RANK_SUBQUERY = `(
  SELECT COALESCE(MAX(${rankCase('syncStatus')}), 0)
  FROM health_assessments WHERE memberId = household_members.id AND deletedAt IS NULL
)`;

function withEffectiveStatus(row) {
  if (!row) return row;
  return { ...row, effectiveSyncStatus: worseOf(row.syncStatus, row.childMaxRank) };
}

export const membersRepo = {
  async listByHousehold(householdId) {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT household_members.*, ${CHILD_MAX_RANK_SUBQUERY} as childMaxRank
       FROM household_members
       WHERE householdId = ? AND deletedAt IS NULL
       ORDER BY updatedAt DESC`,
      [householdId],
    );
    return rows.map(withEffectiveStatus);
  },

  async getById(id) {
    const db = await getDb();
    const row = await db.getFirstAsync(
      `SELECT household_members.*, ${CHILD_MAX_RANK_SUBQUERY} as childMaxRank
       FROM household_members WHERE id = ?`,
      [id],
    );
    return withEffectiveStatus(row);
  },

  async create({ householdId, name, age, gender, relationship }) {
    const db = await getDb();
    const f = fieldsForNewRecord();
    await db.runAsync(
      `INSERT INTO household_members
        (id, householdId, name, age, gender, relationship, version, deletedAt, updatedAt,
         syncStatus, pendingOperation, baseVersion, pendingChangeId, conflictServerSnapshot, lastSyncError)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        f.id, householdId, name, age, gender, relationship, f.version, f.updatedAt, f.syncStatus,
        f.pendingOperation, f.baseVersion, f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError,
      ],
    );
    return this.getById(f.id);
  },

  async update(id, patch) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) throw new Error('Member not found locally');
    const f = fieldsForUpdate(current);

    await db.runAsync(
      `UPDATE household_members SET
        name = COALESCE(?, name), age = COALESCE(?, age), gender = COALESCE(?, gender),
        relationship = COALESCE(?, relationship),
        updatedAt = ?, syncStatus = ?, pendingOperation = ?, baseVersion = ?, pendingChangeId = ?,
        conflictServerSnapshot = NULL, lastSyncError = NULL
       WHERE id = ?`,
      [
        patch.name ?? null, patch.age ?? null, patch.gender ?? null, patch.relationship ?? null,
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
      await db.runAsync('DELETE FROM household_members WHERE id = ?', [id]);
      return;
    }
    await db.runAsync(
      `UPDATE household_members SET deletedAt = ?, updatedAt = ?, syncStatus = ?, pendingOperation = ?,
        baseVersion = ?, pendingChangeId = ? WHERE id = ?`,
      [f.deletedAt, f.updatedAt, f.syncStatus, f.pendingOperation, f.baseVersion, f.pendingChangeId, id],
    );
  },

  async listPendingForPush() {
    const db = await getDb();
    return db.getAllAsync(
      "SELECT * FROM household_members WHERE syncStatus IN ('pending', 'error') ORDER BY updatedAt ASC",
    );
  },

  async applyPushResult(id, status, serverEntity, message) {
    const db = await getDb();
    if (status === 'APPLIED') {
      const f = fieldsForApplied(serverEntity);
      await db.runAsync(
        `UPDATE household_members SET name = ?, age = ?, gender = ?, relationship = ?, version = ?,
          updatedAt = ?, deletedAt = ?, syncStatus = ?, pendingOperation = ?, baseVersion = ?,
          pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?`,
        [
          serverEntity.name, serverEntity.age, serverEntity.gender, serverEntity.relationship,
          f.version, f.updatedAt, f.deletedAt, f.syncStatus, f.pendingOperation, f.baseVersion,
          f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id,
        ],
      );
    } else {
      const f = status === 'CONFLICT' ? fieldsForConflict(serverEntity) : fieldsForError(message);
      await db.runAsync(
        'UPDATE household_members SET syncStatus = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?',
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
      `UPDATE household_members SET name = ?, age = ?, gender = ?, relationship = ?, version = ?,
        updatedAt = ?, deletedAt = ?, syncStatus = ?, pendingOperation = ?, baseVersion = ?,
        pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?`,
      [
        f.name, f.age, f.gender, f.relationship, f.version, f.updatedAt, f.deletedAt, f.syncStatus,
        f.pendingOperation, f.baseVersion, f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id,
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
      'UPDATE household_members SET baseVersion = ?, syncStatus = ?, pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?',
      [f.baseVersion, f.syncStatus, f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id],
    );
  },

  async upsertFromServer(record) {
    const db = await getDb();
    const existing = await this.getById(record.id);
    if (existing && existing.syncStatus !== 'synced') return;

    await db.runAsync(
      `INSERT OR REPLACE INTO household_members
        (id, householdId, name, age, gender, relationship, version, deletedAt, updatedAt,
         syncStatus, pendingOperation, baseVersion, pendingChangeId, conflictServerSnapshot, lastSyncError)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, NULL, NULL, NULL, NULL)`,
      [
        record.id, record.householdId, record.name, record.age, record.gender, record.relationship,
        record.version, record.deletedAt, record.updatedAt,
      ],
    );
  },
};
