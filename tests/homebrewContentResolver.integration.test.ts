import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createDefinition, deprecateVersion, publishVersion } from "@/lib/homebrew/homebrewStore";
import { resolveHomebrewItemSource } from "@/lib/homebrew/contentResolver";
import { resolveMechanics } from "@/lib/homebrew/mechanicsResolver";
import { plusTwoWeapon } from "./fixtures/homebrew";
import type { HomebrewItemInstanceState } from "@/types/homebrew";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-hb-resolve-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run("alice", "Alice", "alice@example.com", "x", new Date().toISOString());
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

function pinnedInstance(definitionId: string, versionId: string): HomebrewItemInstanceState {
  return {
    contentRef: { source: "homebrew", kind: "item", definitionId, versionId, ruleset: "2014" },
    equipped: true,
    attuned: false,
    activeToggleIds: [],
  };
}

describe("pinned homebrew item resolution", () => {
  it("resolves a pinned published item's effects through the store", () => {
    const { definition, version } = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Moonsteel Blade",
      payload: plusTwoWeapon,
    });
    publishVersion("alice", definition.id, version.id);

    const source = resolveHomebrewItemSource(pinnedInstance(definition.id, version.id), 5);
    expect(source).not.toBeNull();
    const result = resolveMechanics([source!]);
    expect(Object.values(result.sourceItemBonuses)[0]).toMatchObject({ "weapon-attack": 2, "weapon-damage": 2 });
  });

  it("keeps resolving a pinned version after it is deprecated (continued use, §11.2)", () => {
    const { definition, version } = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Moonsteel Blade",
      payload: plusTwoWeapon,
    });
    publishVersion("alice", definition.id, version.id);
    deprecateVersion("alice", definition.id, version.id);

    const source = resolveHomebrewItemSource(pinnedInstance(definition.id, version.id), 5);
    expect(source).not.toBeNull();
    expect(resolveMechanics([source!]).contributions.length).toBeGreaterThan(0);
  });

  it("returns null for a missing version", () => {
    expect(resolveHomebrewItemSource(pinnedInstance("nope", "nope"), 5)).toBeNull();
  });
});
