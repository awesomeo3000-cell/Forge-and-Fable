import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { signToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { POST } from "@/app/api/import/pdf/create/route";
import { GET as LIST_CHARACTERS } from "@/app/api/characters/route";
import { emptyDraft, reviewField, type ImportDraft } from "@/lib/import/pdfTypes";
import { HOMEBREW_CLASS_ID, HOMEBREW_RACE_ID, resolveCharacterClass, resolveCharacterRace } from "@/lib/homebrewIdentity";
import { ruleset } from "@/lib/ruleset";
import type { AbilityKey, Character } from "@/types/game";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-pdf-create-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "pdf-create-test-secret-pdf-create-test-secret";
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

async function seededCookie() {
  const userId = "pdf-user";
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, "PDF Tester", "pdf@example.com", "unused", new Date().toISOString());
  const token = await signToken({ userId });
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

function importDraft(className: string, species: string): ImportDraft {
  const draft = emptyDraft();
  draft.source = { kind: "generic-pdf", pages: 2, fileName: "homebrew.pdf" };
  draft.identity.name = reviewField("Nyra Vale");
  draft.identity.className = reviewField(className);
  draft.identity.species = reviewField(species);
  draft.identity.level = reviewField(6);
  draft.identity.background = reviewField("Wanderer");
  draft.vitals.maxHp = reviewField(52);
  draft.vitals.currentHp = reviewField(47);
  draft.vitals.speed = reviewField("40 ft.");
  const scores: Record<AbilityKey, number> = {
    strength: 11,
    dexterity: 18,
    constitution: 14,
    intelligence: 13,
    wisdom: 16,
    charisma: 9,
  };
  for (const [key, score] of Object.entries(scores) as Array<[AbilityKey, number]>) {
    draft.abilities[key] = reviewField(score);
  }
  return draft;
}

async function createFromDraft(draft: ImportDraft) {
  const cookie = await seededCookie();
  const response = await POST(new Request("http://local/api/import/pdf/create", {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  }));
  return { response, cookie };
}

describe("PDF character creation", () => {
  it("keeps catalog matches on standard class and species IDs", { timeout: 15_000 }, async () => {
    const { response } = await createFromDraft(importDraft("Ranger", "Wood"));
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
    const character = (await response.json()).character as Character;

    expect(character).toMatchObject({ classId: "ranger", raceId: "wood-elf-legacy" });
    expect(character.customClassName).toBeUndefined();
    expect(character.customRaceName).toBeUndefined();
  });

  it("persists non-catalog class and species names as homebrew identity", { timeout: 15_000 }, async () => {
    const { response, cookie } = await createFromDraft(importDraft("Echo Knight Savant", "Starling-Born"));
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
    const character = (await response.json()).character as Character;

    expect(character).toMatchObject({
      classId: HOMEBREW_CLASS_ID,
      customClassName: "Echo Knight Savant",
      raceId: HOMEBREW_RACE_ID,
      customRaceName: "Starling-Born",
      customRaceSpeed: "40 ft.",
      level: 6,
      abilities: { dexterity: 18, wisdom: 16 },
    });
    expect(resolveCharacterClass(character, ruleset)).toMatchObject({ name: "Echo Knight Savant", casterType: "none" });
    expect(resolveCharacterRace(character, ruleset)).toMatchObject({ name: "Starling-Born", speed: "40 ft.", bonuses: {} });

    const reloaded = await LIST_CHARACTERS(new Request("http://local/api/characters", { headers: { cookie } }));
    expect(reloaded.status).toBe(200);
    await expect(reloaded.json()).resolves.toMatchObject({
      characters: [expect.objectContaining({ id: character.id, customClassName: "Echo Knight Savant", customRaceName: "Starling-Born" })],
    });
  });

  it("asks for a more specific name when a partial standard match is ambiguous", { timeout: 15_000 }, async () => {
    const { response } = await createFromDraft(importDraft("Ranger", "Dwa"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/matches more than one standard option/i),
    });
  });
});
