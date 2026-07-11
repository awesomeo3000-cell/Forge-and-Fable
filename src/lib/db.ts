import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type StoredUserJson = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

type LegacyVaultJson = {
  users: StoredUserJson[];
  characters: unknown[];
  feedback?: unknown[];
};

declare global {
  var __forgeDb: DatabaseSync | undefined;
  var __forgeDbSchemaRevision: number | undefined;
}

const SCHEMA_REVISION = 4;

function getDataDir() {
  const configuredDir = process.env.FORGE_VAULT_DIR?.trim() || process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (!configuredDir) return path.join(process.cwd(), "data");
  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.join(/*turbopackIgnore: true*/ process.cwd(), configuredDir);
}

function getDbFile() {
  return path.join(getDataDir(), "forge.db");
}

function getLegacyVaultFile() {
  return path.join(getDataDir(), "forge-vault.json");
}

function validateLegacyVault(data: unknown): data is LegacyVaultJson {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Record<string, unknown>;
  return (
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.characters) &&
    (candidate.feedback === undefined || Array.isArray(candidate.feedback))
  );
}

function createSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      dm_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_members (
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (campaign_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS campaign_rolls (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      character_name TEXT NOT NULL,
      label TEXT NOT NULL,
      detail TEXT NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rolls_campaign_time ON campaign_rolls(campaign_id, created_at);

    CREATE TABLE IF NOT EXISTS campaign_events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      target_user_id TEXT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_initiative (
      campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_tracks (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('music', 'cue')),
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_tracks_sort ON campaign_tracks(campaign_id, sort, created_at);

    CREATE TABLE IF NOT EXISTS campaign_audio (
      campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
      track_id TEXT REFERENCES campaign_tracks(id) ON DELETE SET NULL,
      url TEXT,
      title TEXT,
      loop INTEGER NOT NULL DEFAULT 1,
      started_at TEXT,
      version INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_events_campaign_time ON campaign_events(campaign_id, created_at);

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function tableHasColumn(db: DatabaseSync, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function recordMigration(db: DatabaseSync, version: number, name: string) {
  db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
    .run(version, name, new Date().toISOString());
}

/**
 * Apply ordered, idempotent schema migrations. Existing installations created
 * before migration tracking are adopted in place and receive the same records.
 */
function migrateSchema(db: DatabaseSync) {
  createSchema(db);

  db.exec("BEGIN IMMEDIATE");
  try {
    recordMigration(db, 1, "users, characters, and feedback");
    recordMigration(db, 2, "campaign collaboration tables");

    if (!tableHasColumn(db, "characters", "revision")) {
      db.exec("ALTER TABLE characters ADD COLUMN revision INTEGER NOT NULL DEFAULT 0");
    }
    recordMigration(db, 3, "optimistic character revision");
    recordMigration(db, 4, "campaign audio tracks and now-playing state");
    db.exec(`PRAGMA user_version = ${SCHEMA_REVISION}`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function migrateLegacyVault(db: DatabaseSync) {
  const userCountRow = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  const legacyVaultFile = getLegacyVaultFile();
  if (userCountRow.count !== 0 || !existsSync(legacyVaultFile)) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(legacyVaultFile, "utf8"));
  } catch (error) {
    throw new Error(`Legacy vault JSON could not be parsed. Migration aborted: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  if (!validateLegacyVault(parsed)) {
    throw new Error("Legacy vault JSON has an unexpected structure. Migration aborted.");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const insertUser = db.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)");
    const insertCharacter = db.prepare("INSERT INTO characters (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
    const insertFeedback = db.prepare("INSERT INTO feedback (id, user_id, data, created_at) VALUES (?, ?, ?, ?)");

    for (const user of parsed.users) {
      insertUser.run(user.id, user.name, user.email, user.passwordHash, user.createdAt);
    }

    for (const item of parsed.characters) {
      const character = item as { id?: unknown; userId?: unknown; createdAt?: unknown };
      if (typeof character.id !== "string" || typeof character.userId !== "string" || typeof character.createdAt !== "string") {
        throw new Error("Legacy vault contains a character without id, userId, or createdAt.");
      }
      insertCharacter.run(character.id, character.userId, JSON.stringify(item), character.createdAt, character.createdAt);
    }

    for (const item of parsed.feedback ?? []) {
      const feedback = item as { id?: unknown; userId?: unknown; createdAt?: unknown };
      if (typeof feedback.id !== "string" || typeof feedback.userId !== "string" || typeof feedback.createdAt !== "string") {
        throw new Error("Legacy vault contains feedback without id, userId, or createdAt.");
      }
      insertFeedback.run(feedback.id, feedback.userId, JSON.stringify(item), feedback.createdAt);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const migratedFile = legacyVaultFile.replace(/\.json$/i, `.migrated-${timestamp}.json`);
  renameSync(legacyVaultFile, migratedFile);
  console.log(
    `Forge vault migrated to SQLite: ${parsed.users.length} users, ${parsed.characters.length} characters, ${(parsed.feedback ?? []).length} feedback entries. Legacy file renamed to ${path.basename(migratedFile)}.`,
  );
}

function openDb() {
  mkdirSync(getDataDir(), { recursive: true });
  const db = new DatabaseSync(getDbFile());
  migrateSchema(db);
  migrateLegacyVault(db);
  return db;
}

export function getDb() {
  globalThis.__forgeDb ??= openDb();
  if (globalThis.__forgeDbSchemaRevision !== SCHEMA_REVISION) {
    migrateSchema(globalThis.__forgeDb);
    globalThis.__forgeDbSchemaRevision = SCHEMA_REVISION;
  }
  return globalThis.__forgeDb;
}

export function closeDb() {
  globalThis.__forgeDb?.close();
  globalThis.__forgeDb = undefined;
  globalThis.__forgeDbSchemaRevision = undefined;
}

export function checkDatabaseHealth() {
  const db = getDb();
  db.prepare("SELECT 1 AS ok").get();
  const migration = db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as { version: number | null };
  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    db.exec("ROLLBACK");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try { db.exec("ROLLBACK"); } catch { /* original health failure wins */ }
    }
    throw error;
  }
  return { writable: true, schemaVersion: migration.version ?? 0 };
}
