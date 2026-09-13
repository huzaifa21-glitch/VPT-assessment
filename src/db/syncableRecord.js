import { uuid } from '../utils/uuid';



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


export function fieldsForUpdate(current) {
  const now = new Date().toISOString();

  if (current.pendingOperation === 'CREATE') {
   
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
   
    baseVersion: alreadyPending ? current.baseVersion : current.version,
    pendingChangeId: alreadyPending ? current.pendingChangeId : uuid(),
  };
}


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


export function fieldsForResolveKeepMine(current, serverEntity) {
  return {
    baseVersion: serverEntity.version,
    syncStatus: 'pending',
    pendingChangeId: uuid(),
    conflictServerSnapshot: null,
    lastSyncError: null,
  };
}
