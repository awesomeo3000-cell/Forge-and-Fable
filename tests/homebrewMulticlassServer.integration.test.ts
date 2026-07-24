/**
 * Phase 6c — the server registry resolves a character's pinned homebrew class
 * through the same validation/aggregation path as built-in classes.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createDefinition, listAvailableClasses, publishVersion } from "@/lib/homebrew/homebrewStore";
import { createCharacter } from "@/lib/vaultStore";
import { serverRulesContentRegistry } from "@/lib/homebrew/serverRegistry";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import { builtinClassRef, classLevelMirrors } from "@/lib/multiclass";
import { characterInput } from "./fixtures/character";
import { fullCasterClass } from "./fixtures/homebrew";
import type { Character } from "@/types/game";
import type { CharacterClassLevel, RulesContentRef } from "@/types/homebrew";

let dataDir = "";

function seedUser(id: string) {
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, id, `${id}@example.com`, "x", new Date().toISOString());
}

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-hb-mc-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  seedUser("alice");
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

function publishRuneweaver(): RulesContentRef {
  const created = createDefinition("alice", { kind: "class", ruleset: "2014", title: "Runeweaver", payload: fullCasterClass });
  publishVersion("alice", created.definition.id, created.version.id);
  return { source: "homebrew", kind: "class", definitionId: created.definition.id, versionId: created.version.id, ruleset: "2014" };
}

function fighterPlusHomebrew(classRef: RulesContentRef): Omit<Character, "id" | "userId" | "createdAt"> {
  const classLevels: CharacterClassLevel[] = [
    { classRef: builtinClassRef("2014", "fighter"), level: 3, acquiredOrder: 0 },
    { classRef, level: 2, acquiredOrder: 1 },
  ];
  const mirrors = classLevelMirrors(classLevels);
  const base: Character = {
    ...characterInput("Alice"),
    id: "x", userId: "alice", createdAt: "",
    classLevels, level: mirrors.level, classId: mirrors.classId, maxHp: 30, currentHp: 30,
  } as Character;
  const patch = progressionPatchForCharacter(base, serverRulesContentRegistry);
  const full = { ...base, ...patch } as Character;
  return characterInputFrom(full);
}

/** Drop the server-managed identity fields to make a createCharacter input. */
function characterInputFrom(character: Character): Omit<Character, "id" | "userId" | "createdAt"> {
  const input: Partial<Character> = { ...character };
  delete input.id;
  delete input.userId;
  delete input.createdAt;
  return input as Omit<Character, "id" | "userId" | "createdAt">;
}

describe("server-side homebrew multiclass resolution", () => {
  it("resolves the server registry to a normalized homebrew class packet", () => {
    const classRef = publishRuneweaver();
    const packet = serverRulesContentRegistry.getClassPacket(classRef);
    expect(packet.name).toBe("Runeweaver");
    expect(packet.spellcasting?.type).toBe("full");
    expect(Object.keys(packet.levels)).toHaveLength(20);
  });

  it("saves a Fighter 3 / homebrew-Runeweaver 2 whose progression aggregates the homebrew features", async () => {
    const classRef = publishRuneweaver();
    const saved = await createCharacter("alice", fighterPlusHomebrew(classRef));

    expect(saved.level).toBe(5);
    expect(saved.classId).toBe("fighter");
    const state = saved.progressionState!;
    // The homebrew class contributes its level-1/2 features through the shared
    // progression path — the same buildLevelUpPlan built-ins use.
    expect(state.featureIds).toContain("rw-spellcasting");
    expect(state.featureIds).toContain("rw-rune-mark");
    expect(state.classes).toEqual([
      { classId: "fighter", level: 3 },
      { classId: `hb:${classRef.source === "homebrew" ? classRef.definitionId : ""}`, level: 2 },
    ]);
  });

  it("lists an owned published class as available, and hides it from other users", () => {
    seedUser("bob");
    const classRef = publishRuneweaver();
    const owner = listAvailableClasses("alice", "2014");
    expect(owner).toHaveLength(1);
    expect(owner[0].payload.name).toBe("Runeweaver");
    expect(owner[0].version.id).toBe(classRef.source === "homebrew" ? classRef.versionId : "");
    // Alice's class is private; Bob (no ownership, no shared campaign) sees none.
    expect(listAvailableClasses("bob", "2014")).toHaveLength(0);
  });

  it("rejects a homebrew class newly selected without access (another user's private class)", async () => {
    seedUser("bob");
    const classRef = publishRuneweaver();
    const classLevels: CharacterClassLevel[] = [
      { classRef: builtinClassRef("2014", "fighter"), level: 3, acquiredOrder: 0 },
      { classRef, level: 2, acquiredOrder: 1 },
    ];
    const mirrors = classLevelMirrors(classLevels);
    await expect(createCharacter("bob", {
      ...characterInput("Bob"), classLevels, level: mirrors.level, classId: mirrors.classId, maxHp: 30, currentHp: 30,
    })).rejects.toThrow(/unavailable|invalid/);
  });

  it("rejects a draft (unpublished) class even for its owner (drafts are not selectable)", async () => {
    const created = createDefinition("alice", { kind: "class", ruleset: "2014", title: "Draft Class", payload: fullCasterClass });
    const draftRef: RulesContentRef = { source: "homebrew", kind: "class", definitionId: created.definition.id, versionId: created.version.id, ruleset: "2014" };
    const classLevels: CharacterClassLevel[] = [
      { classRef: builtinClassRef("2014", "fighter"), level: 3, acquiredOrder: 0 },
      { classRef: draftRef, level: 2, acquiredOrder: 1 },
    ];
    const mirrors = classLevelMirrors(classLevels);
    await expect(createCharacter("alice", {
      ...characterInput("Alice"), classLevels, level: mirrors.level, classId: mirrors.classId, maxHp: 30, currentHp: 30,
    })).rejects.toThrow(/unavailable/);
  });

  it("rejects a classLevels ref whose homebrew version does not exist", async () => {
    const missing: RulesContentRef = { source: "homebrew", kind: "class", definitionId: "ghost", versionId: "v-missing", ruleset: "2014" };
    const classLevels: CharacterClassLevel[] = [
      { classRef: builtinClassRef("2014", "fighter"), level: 3, acquiredOrder: 0 },
      { classRef: missing, level: 2, acquiredOrder: 1 },
    ];
    const mirrors = classLevelMirrors(classLevels);
    await expect(createCharacter("alice", {
      ...characterInput("Alice"), classLevels, level: mirrors.level, classId: mirrors.classId, maxHp: 30, currentHp: 30,
    })).rejects.toThrow(/invalid for 2014|is invalid/);
  });
});
