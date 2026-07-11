import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/lib/db";
import { createCharacter } from "@/lib/vaultStore";
import { signToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET, PUT } from "@/app/api/characters/[id]/route";
import { DELETE } from "@/app/api/characters/[id]/route";
import { GET as LIST, POST } from "@/app/api/characters/route";
import { GET as HEALTH } from "@/app/api/health/route";
import { characterInput } from "./fixtures/character";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-foundation-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "foundation-test-secret-foundation-test-secret";
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

async function seededCharacter() {
  const userId = "user-1";
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, "Tester", "tester@example.com", "not-used", new Date().toISOString());
  const character = await createCharacter(userId, characterInput());
  const token = await signToken({ userId });
  const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
  return { character, cookie };
}

async function seededUser() {
  const userId = "user-1";
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, "Tester", "tester@example.com", "not-used", new Date().toISOString());
  const token = await signToken({ userId });
  return { userId, cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` };
}

describe("character API persistence", () => {
  it("requires revisions, persists an update, and rejects a stale writer", async () => {
    const { character, cookie } = await seededCharacter();
    const context = { params: Promise.resolve({ id: character.id }) };

    const missingRevision = await PUT(new Request(`http://local/api/characters/${character.id}`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ currentHp: 9 }),
    }), context);
    expect(missingRevision.status).toBe(428);

    const updatedResponse = await PUT(new Request(`http://local/api/characters/${character.id}`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json", "If-Match": "0" },
      body: JSON.stringify({ currentHp: 9 }),
    }), context);
    expect(updatedResponse.status).toBe(200);
    const updated = await updatedResponse.json();
    expect(updated.character).toMatchObject({ currentHp: 9, revision: 1 });

    const staleResponse = await PUT(new Request(`http://local/api/characters/${character.id}`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json", "If-Match": "0" },
      body: JSON.stringify({ currentHp: 4 }),
    }), context);
    expect(staleResponse.status).toBe(409);
    expect(await staleResponse.json()).toMatchObject({ character: { currentHp: 9, revision: 1 } });

    const reloaded = await GET(new Request(`http://local/api/characters/${character.id}`, { headers: { cookie } }), context);
    expect(await reloaded.json()).toMatchObject({ character: { currentHp: 9, revision: 1 } });
  });

  it("adopts an existing database and records the revision migration", () => {
    closeDb();
    mkdirSync(dataDir, { recursive: true });
    const legacy = new DatabaseSync(path.join(dataDir, "forge.db"));
    legacy.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE characters (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
    legacy.close();

    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(characters)").all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === "revision")).toBe(true);
    expect(db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()).toMatchObject({ version: 4 });
  });

  it("creates, lists, advances, reloads, and deletes through route handlers", async () => {
    const { cookie } = await seededUser();
    const createdResponse = await POST(new Request("http://local/api/characters", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify(characterInput("Route Hero")),
    }));
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).character;
    expect(created).toMatchObject({ name: "Route Hero", revision: 0 });

    const listedResponse = await LIST(new Request("http://local/api/characters", { headers: { cookie } }));
    expect((await listedResponse.json()).characters).toEqual([expect.objectContaining({ id: created.id, revision: 0 })]);

    const context = { params: Promise.resolve({ id: created.id as string }) };
    const advancedResponse = await PUT(new Request(`http://local/api/characters/${created.id}`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json", "If-Match": "0" },
      body: JSON.stringify({ level: 2, maxHp: 20, currentHp: 20, hpRolls: [8] }),
    }), context);
    expect(advancedResponse.status).toBe(200);

    closeDb();
    const reloaded = await GET(new Request(`http://local/api/characters/${created.id}`, { headers: { cookie } }), context);
    expect(await reloaded.json()).toMatchObject({ character: { level: 2, maxHp: 20, hpRolls: [8], revision: 1 } });

    const deleted = await DELETE(new Request(`http://local/api/characters/${created.id}`, {
      method: "DELETE",
      headers: { cookie },
    }), context);
    expect(deleted.status).toBe(200);
    const missing = await GET(new Request(`http://local/api/characters/${created.id}`, { headers: { cookie } }), context);
    expect(missing.status).toBe(404);
  });

  it("reports database write health", async () => {
    const response = await HEALTH();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: { writable: true, schemaVersion: 4 } });
  });
});
