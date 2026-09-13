import * as SQLite from 'expo-sqlite';

let dbPromise = null;


export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('healthsurvey.db');
  }
  return dbPromise;
}


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


export async function resetLocalDatabase() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM households;
    DELETE FROM household_members;
    DELETE FROM health_assessments;
    DELETE FROM sync_meta;
  `);
}
