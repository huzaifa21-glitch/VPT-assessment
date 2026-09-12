import * as SQLite from 'expo-sqlite';

let dbPromise = null;

// One shared connection for the whole app. expo-sqlite's modern API is
// promise-based (openDatabaseAsync/execAsync/runAsync/getAllAsync), unlike
// the older callback-based WebSQL-style API from a few years ago.
export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('healthsurvey.db');
  }
  return dbPromise;
}

// Every syncable table shares the same "sync columns":
//   syncStatus         'synced' | 'pending' | 'conflict' | 'error'
//   pendingOperation   'CREATE' | 'UPDATE' | 'DELETE' | NULL
//   baseVersion        the server version this pending change was queued against
//   pendingChangeId    stable id reused across retries of the SAME queued change,
//                      so a repeated push of it is idempotent on the backend
//   conflictServerSnapshot   JSON of the server's copy, set only when syncStatus='conflict'
//   lastSyncError      human-readable message from the last failed push attempt
export async function initDatabase() {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY NOT NULL,
      householdCode TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      areaId TEXT NOT NULL,
      areaName TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deletedAt TEXT,
      updatedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL DEFAULT 'pending',
      pendingOperation TEXT,
      baseVersion INTEGER,
      pendingChangeId TEXT,
      conflictServerSnapshot TEXT,
      lastSyncError TEXT
    );

    CREATE TABLE IF NOT EXISTS household_members (
      id TEXT PRIMARY KEY NOT NULL,
      householdId TEXT NOT NULL,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      relationship TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deletedAt TEXT,
      updatedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL DEFAULT 'pending',
      pendingOperation TEXT,
      baseVersion INTEGER,
      pendingChangeId TEXT,
      conflictServerSnapshot TEXT,
      lastSyncError TEXT
    );

    CREATE TABLE IF NOT EXISTS health_assessments (
      id TEXT PRIMARY KEY NOT NULL,
      memberId TEXT NOT NULL,
      temperatureC REAL,
      hasFever INTEGER NOT NULL DEFAULT 0,
      hasCough INTEGER NOT NULL DEFAULT 0,
      hasBreathingDifficulty INTEGER NOT NULL DEFAULT 0,
      bloodPressureSystolic INTEGER,
      bloodPressureDiastolic INTEGER,
      notes TEXT,
      isUrgent INTEGER NOT NULL DEFAULT 0,
      flagForReview INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      deletedAt TEXT,
      updatedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL DEFAULT 'pending',
      pendingOperation TEXT,
      baseVersion INTEGER,
      pendingChangeId TEXT,
      conflictServerSnapshot TEXT,
      lastSyncError TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_members_household ON household_members(householdId);
    CREATE INDEX IF NOT EXISTS idx_assessments_member ON health_assessments(memberId);
  `);

  return db;
}

// Wipes all local domain data (not the schema) — used on logout so the next
// login starts clean instead of showing the previous field worker's queued
// changes. Never call this without confirming there's nothing unsynced the
// user still needs (see HouseholdListScreen's logout handler).
export async function resetLocalDatabase() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM households;
    DELETE FROM household_members;
    DELETE FROM health_assessments;
    DELETE FROM sync_meta;
  `);
}
