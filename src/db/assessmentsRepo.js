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

// Mirrors the backend's rule (assessments.service.js) so the field worker
// sees an accurate "Urgent" hint immediately, offline, before the server has
// ever confirmed it — the server recomputes this authoritatively from the
// same inputs once the record syncs, and that value wins on APPLIED.
function computeLocalIsUrgent({ hasFever, hasBreathingDifficulty, flagForReview }) {
  return (hasFever && hasBreathingDifficulty) || flagForReview ? 1 : 0;
}

function b(value) {
  return value ? 1 : 0;
}

export const assessmentsRepo = {
  async listByMember(memberId) {
    const db = await getDb();
    return db.getAllAsync(
      'SELECT * FROM health_assessments WHERE memberId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC',
      [memberId],
    );
  },

  async getById(id) {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM health_assessments WHERE id = ?', [id]);
  },

  async create(input) {
    const db = await getDb();
    const f = fieldsForNewRecord();
    const isUrgent = computeLocalIsUrgent(input);
    await db.runAsync(
      `INSERT INTO health_assessments
        (id, memberId, temperatureC, hasFever, hasCough, hasBreathingDifficulty, bloodPressureSystolic,
         bloodPressureDiastolic, notes, isUrgent, flagForReview, version, deletedAt, updatedAt,
         syncStatus, pendingOperation, baseVersion, pendingChangeId, conflictServerSnapshot, lastSyncError)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        f.id, input.memberId, input.temperatureC ?? null, b(input.hasFever), b(input.hasCough),
        b(input.hasBreathingDifficulty), input.bloodPressureSystolic ?? null,
        input.bloodPressureDiastolic ?? null, input.notes ?? null, isUrgent, b(input.flagForReview),
        f.version, f.updatedAt, f.syncStatus, f.pendingOperation, f.baseVersion, f.pendingChangeId,
        f.conflictServerSnapshot, f.lastSyncError,
      ],
    );
    return this.getById(f.id);
  },

  async update(id, patch) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) throw new Error('Assessment not found locally');
    const f = fieldsForUpdate(current);

    const merged = {
      hasFever: patch.hasFever ?? !!current.hasFever,
      hasBreathingDifficulty: patch.hasBreathingDifficulty ?? !!current.hasBreathingDifficulty,
      flagForReview: patch.flagForReview ?? !!current.flagForReview,
    };
    const isUrgent = computeLocalIsUrgent(merged);

    await db.runAsync(
      `UPDATE health_assessments SET
        temperatureC = COALESCE(?, temperatureC),
        hasFever = COALESCE(?, hasFever), hasCough = COALESCE(?, hasCough),
        hasBreathingDifficulty = COALESCE(?, hasBreathingDifficulty),
        bloodPressureSystolic = COALESCE(?, bloodPressureSystolic),
        bloodPressureDiastolic = COALESCE(?, bloodPressureDiastolic),
        notes = COALESCE(?, notes), isUrgent = ?, flagForReview = COALESCE(?, flagForReview),
        updatedAt = ?, syncStatus = ?, pendingOperation = ?, baseVersion = ?, pendingChangeId = ?,
        conflictServerSnapshot = NULL, lastSyncError = NULL
       WHERE id = ?`,
      [
        patch.temperatureC ?? null,
        patch.hasFever === undefined ? null : b(patch.hasFever),
        patch.hasCough === undefined ? null : b(patch.hasCough),
        patch.hasBreathingDifficulty === undefined ? null : b(patch.hasBreathingDifficulty),
        patch.bloodPressureSystolic ?? null, patch.bloodPressureDiastolic ?? null, patch.notes ?? null,
        isUrgent, patch.flagForReview === undefined ? null : b(patch.flagForReview),
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
      await db.runAsync('DELETE FROM health_assessments WHERE id = ?', [id]);
      return;
    }
    await db.runAsync(
      `UPDATE health_assessments SET deletedAt = ?, updatedAt = ?, syncStatus = ?, pendingOperation = ?,
        baseVersion = ?, pendingChangeId = ? WHERE id = ?`,
      [f.deletedAt, f.updatedAt, f.syncStatus, f.pendingOperation, f.baseVersion, f.pendingChangeId, id],
    );
  },

  async listPendingForPush() {
    const db = await getDb();
    return db.getAllAsync(
      "SELECT * FROM health_assessments WHERE syncStatus IN ('pending', 'error') ORDER BY updatedAt ASC",
    );
  },

  async applyPushResult(id, status, serverEntity, message) {
    const db = await getDb();
    if (status === 'APPLIED') {
      const f = fieldsForApplied(serverEntity);
      await db.runAsync(
        `UPDATE health_assessments SET temperatureC = ?, hasFever = ?, hasCough = ?,
          hasBreathingDifficulty = ?, bloodPressureSystolic = ?, bloodPressureDiastolic = ?, notes = ?,
          isUrgent = ?, version = ?, updatedAt = ?, deletedAt = ?, syncStatus = ?, pendingOperation = ?,
          baseVersion = ?, pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?`,
        [
          serverEntity.temperatureC, b(serverEntity.hasFever), b(serverEntity.hasCough),
          b(serverEntity.hasBreathingDifficulty), serverEntity.bloodPressureSystolic,
          serverEntity.bloodPressureDiastolic, serverEntity.notes, b(serverEntity.isUrgent),
          f.version, f.updatedAt, f.deletedAt, f.syncStatus, f.pendingOperation, f.baseVersion,
          f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id,
        ],
      );
    } else {
      const f = status === 'CONFLICT' ? fieldsForConflict(serverEntity) : fieldsForError(message);
      await db.runAsync(
        'UPDATE health_assessments SET syncStatus = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?',
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
      `UPDATE health_assessments SET temperatureC = ?, hasFever = ?, hasCough = ?,
        hasBreathingDifficulty = ?, bloodPressureSystolic = ?, bloodPressureDiastolic = ?, notes = ?,
        isUrgent = ?, version = ?, updatedAt = ?, deletedAt = ?, syncStatus = ?, pendingOperation = ?,
        baseVersion = ?, pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?`,
      [
        f.temperatureC, b(f.hasFever), b(f.hasCough), b(f.hasBreathingDifficulty), f.bloodPressureSystolic,
        f.bloodPressureDiastolic, f.notes, b(f.isUrgent), f.version, f.updatedAt, f.deletedAt, f.syncStatus,
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
      'UPDATE health_assessments SET baseVersion = ?, syncStatus = ?, pendingChangeId = ?, conflictServerSnapshot = ?, lastSyncError = ? WHERE id = ?',
      [f.baseVersion, f.syncStatus, f.pendingChangeId, f.conflictServerSnapshot, f.lastSyncError, id],
    );
  },

  async upsertFromServer(record) {
    const db = await getDb();
    const existing = await this.getById(record.id);
    if (existing && existing.syncStatus !== 'synced') return;

    await db.runAsync(
      `INSERT OR REPLACE INTO health_assessments
        (id, memberId, temperatureC, hasFever, hasCough, hasBreathingDifficulty, bloodPressureSystolic,
         bloodPressureDiastolic, notes, isUrgent, flagForReview, version, deletedAt, updatedAt,
         syncStatus, pendingOperation, baseVersion, pendingChangeId, conflictServerSnapshot, lastSyncError)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'synced', NULL, NULL, NULL, NULL, NULL)`,
      [
        record.id, record.memberId, record.temperatureC, b(record.hasFever), b(record.hasCough),
        b(record.hasBreathingDifficulty), record.bloodPressureSystolic, record.bloodPressureDiastolic,
        record.notes, b(record.isUrgent), record.version, record.deletedAt, record.updatedAt,
      ],
    );
  },
};
