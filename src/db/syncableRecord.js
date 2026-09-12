import { uuid } from '../utils/uuid';

// Shared logic for how ANY syncable table (households, members, assessments)
// transitions its sync-tracking columns when the user edits or deletes a
// record locally. Written once here so households/members/assessments repos
// don't each reimplement the same rules slightly differently.
//
// The core idea: only ONE outstanding change is tracked per record at a time.
// Editing an already-pending record just updates its payload in place and
// reuses the same pendingChangeId/baseVersion — it does NOT queue a second
// change. This keeps the push batch simple (one row = one change) and keeps
// retries idempotent (same pendingChangeId → backend's SyncLog dedupes it).

export function fieldsForNewRecord() {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    version: 1,
    updatedAt: now,
    syncStatus: 'pending',
    pendingOperation: 'CREATE',
    baseVersion: null,
    pendingChangeId: uuid(),
    conflictServerSnapshot: null,
    lastSyncError: null,
  };
}

// Called when the user edits a record that already exists locally.
export function fieldsForUpdate(current) {
  const now = new Date().toISOString();

  if (current.pendingOperation === 'CREATE') {
    // Never synced yet — still just one queued CREATE, now with newer data.
    return {
      updatedAt: now,
      syncStatus: 'pending',
      pendingOperation: 'CREATE',
      baseVersion: null,
      pendingChangeId: current.pendingChangeId,
    };
  }

  const alreadyPending = current.pendingOperation === 'UPDATE' || current.pendingOperation === 'DELETE';
  return {
    updatedAt: now,
    syncStatus: 'pending',
    pendingOperation: 'UPDATE',
    // Reuse the same baseVersion/pendingChangeId if this record already had
    // a queued change — that queued change just gets newer field values.
    // Otherwise this is a fresh edit against the last known synced version.
    baseVersion: alreadyPending ? current.baseVersion : current.version,
    pendingChangeId: alreadyPending ? current.pendingChangeId : uuid(),
  };
}

// Called when the user deletes a record. Returns { hardDelete: true } if the
// record was never synced (so there's nothing the server needs to know —
// just remove it locally), otherwise the sync-tracking fields for a queued
// DELETE, same reuse-if-already-pending logic as updates.
export function fieldsForDelete(current) {
  if (current.pendingOperation === 'CREATE') {
    return { hardDelete: true };
  }

  const now = new Date().toISOString();
  const alreadyPending = current.pendingOperation === 'UPDATE' || current.pendingOperation === 'DELETE';
  return {
    hardDelete: false,
    deletedAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    pendingOperation: 'DELETE',
    baseVersion: alreadyPending ? current.baseVersion : current.version,
    pendingChangeId: alreadyPending ? current.pendingChangeId : uuid(),
  };
}

// Applied after a push response comes back APPLIED for this record.
export function fieldsForApplied(serverEntity) {
  return {
    version: serverEntity.version,
    updatedAt: serverEntity.updatedAt,
    deletedAt: serverEntity.deletedAt || null,
    syncStatus: 'synced',
    pendingOperation: null,
    baseVersion: null,
    pendingChangeId: null,
    conflictServerSnapshot: null,
    lastSyncError: null,
  };
}

// Applied after a push response comes back CONFLICT — the local pending
// change is preserved (not lost!) so the user can review and choose.
export function fieldsForConflict(serverEntity) {
  return {
    syncStatus: 'conflict',
    conflictServerSnapshot: JSON.stringify(serverEntity),
    lastSyncError: null,
  };
}

export function fieldsForError(message) {
  return {
    syncStatus: 'error',
    lastSyncError: message,
  };
}

// User chooses "use server version" on a conflict: discard the local edit,
// adopt the server's copy as-is.
export function fieldsForResolveUseServer(serverEntity) {
  return {
    ...serverEntity,
    syncStatus: 'synced',
    pendingOperation: null,
    baseVersion: null,
    pendingChangeId: null,
    conflictServerSnapshot: null,
    lastSyncError: null,
  };
}

// User chooses "keep my changes": re-queue the same edit against the
// server's current version, so the next sync attempt has a fresh baseVersion.
export function fieldsForResolveKeepMine(current, serverEntity) {
  return {
    baseVersion: serverEntity.version,
    syncStatus: 'pending',
    pendingChangeId: uuid(),
    conflictServerSnapshot: null,
    lastSyncError: null,
  };
}
