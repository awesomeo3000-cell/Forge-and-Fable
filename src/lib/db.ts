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

const SCHEMA_REVISION = 2;

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

    CREATE INDEX IF NOT EXISTS idx_events_campaign_time ON campaign_events(campaign_id, created_at);
  `);
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
  createSchema(db);
  migrateLegacyVault(db);
  return db;
}

export function getDb() {
  globalThis.__forgeDb ??= openDb();
  if (globalThis.__forgeDbSchemaRevision !== SCHEMA_REVISION) {
    createSchema(globalThis.__forgeDb);
    globalThis.__forgeDbSchemaRevision = SCHEMA_REVISION;
  }
  return globalThis.__forgeDb;
}
