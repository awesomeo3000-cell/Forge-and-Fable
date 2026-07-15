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
  var __forgeDbLastWriteHealthAt: number | undefined;
}

const SCHEMA_REVISION = 17;

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

    CREATE TABLE IF NOT EXISTS auth_attempts (
      attempt_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      first_attempt_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_attempts_time ON auth_attempts(first_attempt_at);

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      dm_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme_key TEXT NOT NULL DEFAULT 'observatory',
      banner_image_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_members (
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
      is_ghost INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS campaign_presence (
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
      visibility TEXT NOT NULL CHECK(visibility IN ('visible', 'hidden')),
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (campaign_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_presence_seen ON campaign_presence(campaign_id, last_seen_at);

    CREATE TABLE IF NOT EXISTS campaign_character_notes (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      reminder_id TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_character_notes_character ON campaign_character_notes(campaign_id, character_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS campaign_requests (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      resolution TEXT NOT NULL,
      target_user_ids TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_requests_created ON campaign_requests(campaign_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS campaign_request_responses (
      request_id TEXT NOT NULL REFERENCES campaign_requests(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      total INTEGER,
      passed INTEGER,
      summary TEXT NOT NULL,
      responded_at TEXT NOT NULL,
      PRIMARY KEY (request_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS campaign_scenes (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_scenes_active ON campaign_scenes(campaign_id, active, updated_at DESC);
    CREATE TABLE IF NOT EXISTS campaign_npcs (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_npcs_updated ON campaign_npcs(campaign_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS campaign_loot_parcels (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_loot_updated ON campaign_loot_parcels(campaign_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS creature_library (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_creatures_owner_updated ON creature_library(owner_user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_creatures_campaign ON creature_library(campaign_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS saved_encounters (
      id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      origin TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_encounters_campaign_updated ON saved_encounters(campaign_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_encounters_owner_updated ON saved_encounters(owner_user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS campaign_handouts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0,
      first_shared_at TEXT,
      last_shared_at TEXT,
      share_count INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_handouts_campaign_updated ON campaign_handouts(campaign_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS campaign_journal_entries (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL,
      visibility TEXT NOT NULL,
      status TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_journal_campaign_updated ON campaign_journal_entries(campaign_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS campaign_sessions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      session_number INTEGER,
      title TEXT,
      started_at TEXT NOT NULL,
      scheduled_at TEXT,
      duration_minutes INTEGER,
      location TEXT,
      ended_at TEXT,
      status TEXT NOT NULL,
      dm_notes TEXT,
      summary_json TEXT,
      published_journal_entry_id TEXT REFERENCES campaign_journal_entries(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_campaign_started ON campaign_sessions(campaign_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS session_pins (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES campaign_sessions(id) ON DELETE CASCADE,
      event_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_pins_session ON session_pins(session_id, created_at);

    CREATE TABLE IF NOT EXISTS encounter_runs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      encounter_id TEXT REFERENCES saved_encounters(id) ON DELETE SET NULL,
      session_id TEXT REFERENCES campaign_sessions(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      live_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_runs_campaign_started ON encounter_runs(campaign_id, started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_events_campaign_time ON campaign_events(campaign_id, created_at);

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      max_uses INTEGER,
      uses INTEGER NOT NULL DEFAULT 0,
      revoked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_portraits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mime TEXT NOT NULL,
      bytes BLOB NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_user_portraits_user ON user_portraits(user_id);

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
    recordMigration(db, 5, "pre-session DM tools, campaign memory, and session lifecycle");
    // Rounds before revision 6 did not enforce one character per campaign.
    // Preserve the newest enrollment and detach older memberships before the
    // unique index is created. The character and campaign membership remain;
    // only the stale character assignment is cleared.
    db.exec(`
      UPDATE campaign_members AS stale
      SET character_id = NULL
      WHERE stale.character_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM campaign_members AS newer
          WHERE newer.character_id = stale.character_id
            AND (
              newer.joined_at > stale.joined_at
              OR (newer.joined_at = stale.joined_at AND newer.rowid > stale.rowid)
            )
        );
    `);
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_members_character_unique
        ON campaign_members(character_id)
        WHERE character_id IS NOT NULL;
    `);
    recordMigration(db, 6, "one campaign enrollment per character; preserve newest enrollment");
    recordMigration(db, 7, "persistent login and registration throttling");
    recordMigration(db, 8, "campaign presence and private character notes");
    recordMigration(db, 9, "tracked roll and rest requests");
    recordMigration(db, 10, "campaign scenes and persistent NPC state");
    recordMigration(db, 11, "campaign loot parcels and player proposals");
    recordMigration(db, 12, "admin invite codes");
    if (!tableHasColumn(db, "campaign_members", "is_ghost")) {
      db.exec("ALTER TABLE campaign_members ADD COLUMN is_ghost INTEGER NOT NULL DEFAULT 0");
    }
    recordMigration(db, 13, "DM rehearsal party ghost members");
    recordMigration(db, 14, "user-uploaded portrait images");
    if (!tableHasColumn(db, "campaigns", "theme_key")) {
      db.exec("ALTER TABLE campaigns ADD COLUMN theme_key TEXT NOT NULL DEFAULT 'observatory'");
    }
    recordMigration(db, 15, "campaign banner themes");
    if (!tableHasColumn(db, "campaign_sessions", "scheduled_at")) {
      db.exec("ALTER TABLE campaign_sessions ADD COLUMN scheduled_at TEXT");
    }
    if (!tableHasColumn(db, "campaign_sessions", "duration_minutes")) {
      db.exec("ALTER TABLE campaign_sessions ADD COLUMN duration_minutes INTEGER");
    }
    if (!tableHasColumn(db, "campaign_sessions", "location")) {
      db.exec("ALTER TABLE campaign_sessions ADD COLUMN location TEXT");
    }
    recordMigration(db, 16, "scheduled campaign sessions");
    if (!tableHasColumn(db, "campaigns", "banner_image_url")) {
      db.exec("ALTER TABLE campaigns ADD COLUMN banner_image_url TEXT");
    }
    recordMigration(db, 17, "custom campaign banner artwork");
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
  globalThis.__forgeDbLastWriteHealthAt = undefined;
}

export function checkDatabaseHealth() {
  const db = getDb();
  db.prepare("SELECT 1 AS ok").get();
  const migration = db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as { version: number | null };
  const now = Date.now();
  if (globalThis.__forgeDbLastWriteHealthAt && now - globalThis.__forgeDbLastWriteHealthAt < 60_000) {
    return { writable: true, schemaVersion: migration.version ?? 0 };
  }
  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    db.exec("ROLLBACK");
    transactionStarted = false;
    globalThis.__forgeDbLastWriteHealthAt = now;
  } catch (error) {
    if (transactionStarted) {
      try { db.exec("ROLLBACK"); } catch { /* original health failure wins */ }
    }
    throw error;
  }
  return { writable: true, schemaVersion: migration.version ?? 0 };
}
