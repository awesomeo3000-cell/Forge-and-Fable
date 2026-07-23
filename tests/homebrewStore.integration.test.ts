import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import {
  createDefinition,
  deprecateVersion,
  getDefinitionDetail,
  getVersion,
  HomebrewConflictError,
  HomebrewStateError,
  publishVersion,
  saveVersion,
  updateDefinitionMetadata,
} from "@/lib/homebrew/homebrewStore";
import { deleteUserById } from "@/lib/vaultStore";
import { plusTwoWeapon } from "./fixtures/homebrew";
import type { ContentBaseline, HomebrewItemPayload } from "@/types/homebrew";

let dataDir = "";

function seedUser(id: string) {
  getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, id, `${id}@example.com`, "x", new Date().toISOString());
}

function newItem(overrides: Partial<HomebrewItemPayload> = {}): HomebrewItemPayload {
  return { ...structuredClone(plusTwoWeapon), ...overrides };
}

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-hb-store-"));
  process.env.FORGE_VAULT_DIR = dataDir;
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

describe("createDefinition", () => {
  it("creates a definition with an initial ordinal-1 draft", () => {
    seedUser("alice");
    const { definition, version } = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Moonsteel Blade",
      payload: newItem(),
    });
    expect(definition.revision).toBe(0);
    expect(definition.slug).toBe("moonsteel-blade");
    expect(definition.isOwner).toBe(true);
    expect(version.ordinal).toBe(1);
    expect(version.status).toBe("draft");
  });

  it("rejects an invalid payload with field paths", () => {
    seedUser("alice");
    expect(() =>
      createDefinition("alice", {
        kind: "item",
        ruleset: "2014",
        title: "Bad",
        payload: newItem({ effects: [{ id: "x", type: "numeric-bonus", target: "ac", value: 99, gate: { type: "always" } }] as never }),
      }),
    ).toThrowError(/value/);
  });

  it("deep-copies a cloned baseline and preserves provenance", () => {
    seedUser("alice");
    const source = newItem();
    const baseline: ContentBaseline = {
      sourceRef: { source: "builtin", kind: "item", id: "longsword", ruleset: "2014" },
      copiedAt: new Date().toISOString(),
      sourceTitle: "Longsword",
    };
    const { definition, version } = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Cloned Blade",
      payload: source,
      baseline,
    });
    // Mutating the caller's object must not affect stored content.
    source.name = "MUTATED";
    (source.effects[0] as { value: number }).value = 7;
    const stored = getVersion("alice", definition.id, version.id);
    expect((stored.payload as HomebrewItemPayload).name).toBe("Moonsteel Blade");
    expect((stored.payload as HomebrewItemPayload).effects[0]).toMatchObject({ value: 2 });
    expect(stored.baseline?.sourceTitle).toBe("Longsword");
  });

  it("auto-suffixes a colliding slug", () => {
    seedUser("alice");
    const a = createDefinition("alice", { kind: "item", ruleset: "2014", title: "Same Name", payload: newItem() });
    const b = createDefinition("alice", { kind: "item", ruleset: "2014", title: "Same Name", payload: newItem() });
    expect(a.definition.slug).toBe("same-name");
    expect(b.definition.slug).toBe("same-name-2");
  });
});

describe("saveVersion", () => {
  it("assigns sequential ordinals 1 and 2 across two saves", () => {
    seedUser("alice");
    const { definition } = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Blade",
      payload: newItem(),
    });
    saveVersion("alice", definition.id, {
      payload: newItem({ description: "sharper" }),
      changeSummary: "tweak",
      expectedRevision: 0,
    });
    const detail = getDefinitionDetail("alice", definition.id);
    expect(detail.versions.map((v) => v.ordinal)).toEqual([1, 2]);
    expect(detail.definition.revision).toBe(1);
  });

  it("rejects a stale definition revision with 409", () => {
    seedUser("alice");
    const { definition } = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Blade",
      payload: newItem(),
    });
    expect(() =>
      saveVersion("alice", definition.id, { payload: newItem(), changeSummary: "x", expectedRevision: 99 }),
    ).toThrowError(HomebrewConflictError);
  });
});

describe("publish and immutability", () => {
  it("publishing v1 then saving v2 does not mutate v1", () => {
    seedUser("alice");
    const created = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Blade",
      payload: newItem(),
    });
    const v1Id = created.version.id;
    const v1Hash = created.version.contentHash;

    publishVersion("alice", created.definition.id, v1Id);
    const afterPublish = getDefinitionDetail("alice", created.definition.id);
    saveVersion("alice", created.definition.id, {
      payload: newItem({ effects: [{ id: "atk", type: "numeric-bonus", target: "weapon-attack", value: 3, scope: "source-item", gate: { type: "equipped" } }] as never }),
      changeSummary: "+3",
      expectedRevision: afterPublish.definition.revision,
    });

    const v1 = getVersion("alice", created.definition.id, v1Id);
    expect(v1.status).toBe("published");
    expect(v1.contentHash).toBe(v1Hash);
    expect((v1.payload as HomebrewItemPayload).effects[0]).toMatchObject({ value: 2 });
  });

  it("refuses to deprecate a draft, but deprecates a published version", () => {
    seedUser("alice");
    const created = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Blade",
      payload: newItem(),
    });
    expect(() => deprecateVersion("alice", created.definition.id, created.version.id)).toThrowError(
      HomebrewStateError,
    );
    publishVersion("alice", created.definition.id, created.version.id);
    const deprecated = deprecateVersion("alice", created.definition.id, created.version.id);
    expect(deprecated.status).toBe("deprecated");
  });
});

describe("metadata concurrency", () => {
  it("rejects a stale metadata update and bumps revision on success", () => {
    seedUser("alice");
    const { definition } = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Blade",
      payload: newItem(),
    });
    const updated = updateDefinitionMetadata("alice", definition.id, { title: "Renamed", expectedRevision: 0 });
    expect(updated.title).toBe("Renamed");
    expect(updated.revision).toBe(1);
    expect(() =>
      updateDefinitionMetadata("alice", definition.id, { title: "Again", expectedRevision: 0 }),
    ).toThrowError(HomebrewConflictError);
  });
});

describe("account deletion", () => {
  it("preserves referenced published versions and nulls the owner", async () => {
    seedUser("alice");
    const created = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Blade",
      payload: newItem(),
    });
    publishVersion("alice", created.definition.id, created.version.id);

    await deleteUserById("alice");

    const defRow = getDb()
      .prepare("SELECT owner_user_id FROM homebrew_definitions WHERE id = ?")
      .get(created.definition.id) as { owner_user_id: string | null } | undefined;
    const verRow = getDb()
      .prepare("SELECT status FROM homebrew_versions WHERE id = ?")
      .get(created.version.id) as { status: string } | undefined;
    expect(defRow).toBeTruthy();
    expect(defRow?.owner_user_id).toBeNull();
    expect(verRow?.status).toBe("published");
  });
});
