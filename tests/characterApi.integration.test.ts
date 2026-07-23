import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/lib/db";
import { createCharacter } from "@/lib/vaultStore";
import * as vaultStore from "@/lib/vaultStore";
import { signToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET, PUT } from "@/app/api/characters/[id]/route";
import { DELETE } from "@/app/api/characters/[id]/route";
import { GET as LIST, POST } from "@/app/api/characters/route";
import { GET as HEALTH } from "@/app/api/health/route";
import { characterInput } from "./fixtures/character";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import { HOMEBREW_CLASS_ID } from "@/lib/homebrewIdentity";
import type { Character } from "@/types/game";

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

  it("persists inventory quantity changes", async () => {
    const { character, cookie } = await seededCharacter();
    const item = {
      id: "item-torch",
      name: "Torch",
      quantity: 1,
      rarity: "Common",
      attunement: false,
      notes: "",
    };
    const updatedResponse = await PUT(new Request(`http://local/api/characters/${character.id}`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json", "If-Match": "0" },
      body: JSON.stringify({ inventory: [{ ...item, quantity: 12 }] }),
    }), { params: Promise.resolve({ id: character.id }) });

    expect(updatedResponse.status).toBe(200);
    expect(await updatedResponse.json()).toMatchObject({ character: { inventory: [{ id: item.id, quantity: 12 }], revision: 1 } });

    const reloaded = await GET(new Request(`http://local/api/characters/${character.id}`, { headers: { cookie } }), { params: Promise.resolve({ id: character.id }) });
    expect(await reloaded.json()).toMatchObject({ character: { inventory: [{ id: item.id, quantity: 12 }] } });
  });

  it("normalizes legacy short-form ability keys before returning a character", async () => {
    const { userId, cookie } = await seededUser();
    await createCharacter(userId, {
      ...characterInput("Legacy Ability Hero"),
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as unknown as Character["abilities"],
    });

    const listedResponse = await LIST(new Request("http://local/api/characters", { headers: { cookie } }));
    expect(listedResponse.status).toBe(200);
    expect((await listedResponse.json()).characters[0].abilities).toEqual({
      strength: 16,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    });
  });

  it("keeps a malformed stored ability block from breaking roster hydration", async () => {
    const { userId, cookie } = await seededUser();
    const legacy = { ...characterInput("Malformed Ability Hero"), abilities: { strength: "oops" } };
    const id = "malformed-ability-hero";
    const now = new Date().toISOString();
    getDb().prepare("INSERT INTO characters (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, userId, JSON.stringify({ ...legacy, id, userId, createdAt: now }), now, now);

    const response = await LIST(new Request("http://local/api/characters", { headers: { cookie } }));
    expect(response.status).toBe(200);
    expect((await response.json()).characters[0].abilities).toEqual({
      strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    });
  });

  it("rejects unknown race and class identifiers", async () => {
    const { cookie } = await seededUser();
    const response = await POST(new Request("http://local/api/characters", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ ...characterInput("Invalid Ruleset Hero"), raceId: "not-a-real-race" }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/raceId.*recognized/i) });
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
    expect(db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()).toMatchObject({ version: 25 });
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
      body: JSON.stringify({
        level: 2, maxHp: 20, currentHp: 20, hpRolls: [8],
        ...progressionPatchForCharacter({ ...created, level: 2 }),
      }),
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

  it("persists manual homebrew classes without catalog progression rules", async () => {
    const { cookie } = await seededUser();
    const createdResponse = await POST(new Request("http://local/api/characters", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...characterInput("Glass Warden"),
        classId: HOMEBREW_CLASS_ID,
        customClassName: "Warden of the Glass Sea",
        level: 5,
      }),
    }));

    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).character;
    expect(created).toMatchObject({
      name: "Glass Warden",
      classId: HOMEBREW_CLASS_ID,
      customClassName: "Warden of the Glass Sea",
      level: 5,
    });

    const listedResponse = await LIST(new Request("http://local/api/characters", { headers: { cookie } }));
    const listed = (await listedResponse.json()).characters;
    expect(listed).toEqual([expect.objectContaining({
      id: created.id,
      classId: HOMEBREW_CLASS_ID,
      customClassName: "Warden of the Glass Sea",
    })]);
  });

  it("loads the full roster when a stored character references a retired catalog portrait", async () => {
    const { userId, cookie } = await seededUser();
    const current = await createCharacter(userId, characterInput("Current Portrait Hero"));
    const createdAt = new Date(Date.now() - 1_000).toISOString();
    const legacy = {
      ...characterInput("Legacy Portrait Hero"),
      id: "legacy-portrait-character",
      userId,
      createdAt,
      portraitUrl: "portrait-aasimar-02",
    };
    getDb().prepare("INSERT INTO characters (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(legacy.id, userId, JSON.stringify(legacy), createdAt, createdAt);

    const response = await LIST(new Request("http://local/api/characters", { headers: { cookie } }));
    expect(response.status).toBe(200);
    const characters = (await response.json()).characters as Array<Record<string, unknown>>;
    expect(characters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: current.id, name: "Current Portrait Hero" }),
    ]));
    expect(characters.find((character) => character.id === legacy.id)).toMatchObject({
      name: "Legacy Portrait Hero",
    });
    expect(characters.find((character) => character.id === legacy.id)).not.toHaveProperty("portraitUrl");
  });

  it("keeps malformed payloads at 400 and reports storage failures as 500", async () => {
    const { cookie } = await seededUser();
    const invalid = await POST(new Request("http://local/api/characters", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", ruleset: "2014" }),
    }));
    expect(invalid.status).toBe(400);

    const createSpy = vi.spyOn(vaultStore, "createCharacter").mockRejectedValueOnce(new Error("disk unavailable"));
    try {
      const failed = await POST(new Request("http://local/api/characters", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify(characterInput("Storage Failure")),
      }));
      expect(failed.status).toBe(500);
      expect(await failed.json()).toEqual({ error: "Could not create character." });
    } finally {
      createSpy.mockRestore();
    }
  });

  it("reports database write health", async () => {
    const response = await HEALTH();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("persists subclass choices and rejects incomplete progression patches", async () => {
    const { cookie } = await seededUser();
    const input = {
      ...characterInput("Battle Master"),
      level: 3,
      subclassId: "battle-master",
      featureChoices: {
        "choose-fighting-style": ["defense"],
        "choose-3-maneuvers": ["parry", "precision-attack", "trip-attack"],
        "choose-artisans-tool": ["smiths-tools"],
      },
    };
    const payload = { ...input, ...progressionPatchForCharacter(input) };
    const createdResponse = await POST(new Request("http://local/api/characters", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).character;
    expect(created).toMatchObject({
      subclassId: "battle-master",
      featureChoices: { "choose-3-maneuvers": ["parry", "precision-attack", "trip-attack"] },
      featureResources: { "superiority-dice": { maximum: 4, die: "d8" } },
      progressionState: { appliedThroughLevel: 3 },
    });

    const legacyResponse = await POST(new Request("http://local/api/characters", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify(characterInput("Legacy Fighter")),
    }));
    const character = (await legacyResponse.json()).character;
    const invalid = await PUT(new Request(`http://local/api/characters/${character.id}`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json", "If-Match": "0" },
      body: JSON.stringify({ level: 3, subclassId: "battle-master" }),
    }), { params: Promise.resolve({ id: character.id }) });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: expect.stringMatching(/choice|required|progressionState/) });
  });

  it("keeps known, prepared, and always-prepared spell sources distinct after reload", async () => {
    const { cookie } = await seededUser();
    const input = {
      ...characterInput("Life Cleric"),
      classId: "cleric",
      level: 5,
      subclassId: "life-domain",
      spellsKnown: ["guidance", "sacred-flame", "thaumaturgy", "light"],
      preparedSpells: ["guidance", "bless", "cure-wounds"],
      asiChoices: [{ type: "asi" as const, level: 4, increases: { wisdom: 2 } }],
    };
    const payload = { ...input, ...progressionPatchForCharacter(input) };
    const response = await POST(new Request("http://local/api/characters", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
    const created = (await response.json()).character;
    expect(created.alwaysPreparedSpells).toEqual(expect.arrayContaining(["bless", "cure-wounds", "lesser-restoration", "spiritual-weapon", "beacon-of-hope", "revivify"]));
    expect(created.preparedSpells).toEqual(["guidance", "bless", "cure-wounds"]);

    closeDb();
    const loaded = await GET(new Request(`http://local/api/characters/${created.id}`, { headers: { cookie } }), { params: Promise.resolve({ id: created.id as string }) });
    expect(await loaded.json()).toMatchObject({ character: {
      spellsKnown: ["guidance", "sacred-flame", "thaumaturgy", "light"],
      preparedSpells: ["guidance", "bless", "cure-wounds"],
      alwaysPreparedSpells: expect.arrayContaining(["bless", "revivify"]),
    } });

    const invalidSpell = await PUT(new Request(`http://local/api/characters/${created.id}`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json", "If-Match": "0" },
      body: JSON.stringify({ spellsKnown: [...created.spellsKnown, "not-a-real-spell"] }),
    }), { params: Promise.resolve({ id: created.id as string }) });
    expect(invalidSpell.status).toBe(400);
    expect(await invalidSpell.json()).toMatchObject({ error: expect.stringMatching(/spell.*invalid/) });
  });
});
