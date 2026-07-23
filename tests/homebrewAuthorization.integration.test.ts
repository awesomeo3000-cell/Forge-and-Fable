import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import {
  createDefinition,
  getDefinitionDetail,
  getVersion,
  HomebrewAuthorizationError,
  HomebrewNotFoundError,
  publishVersion,
  saveVersion,
  updateDefinitionMetadata,
} from "@/lib/homebrew/homebrewStore";
import { plusTwoWeapon } from "./fixtures/homebrew";

let dataDir = "";

function seedUser(id: string) {
  getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, id, `${id}@example.com`, "x", new Date().toISOString());
}

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-hb-authz-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  seedUser("alice");
  seedUser("bob");
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

function alicesPrivateItem() {
  return createDefinition("alice", { kind: "item", ruleset: "2014", title: "Secret Blade", payload: plusTwoWeapon });
}

describe("private draft isolation", () => {
  it("hides Alice's private definition from Bob (404, not 403 — no existence leak)", () => {
    const { definition } = alicesPrivateItem();
    expect(() => getDefinitionDetail("bob", definition.id)).toThrowError(HomebrewNotFoundError);
  });

  it("hides Alice's draft version from Bob", () => {
    const { definition, version } = alicesPrivateItem();
    expect(() => getVersion("bob", definition.id, version.id)).toThrowError(HomebrewNotFoundError);
  });

  it("forbids Bob from saving a new version onto Alice's definition", () => {
    const { definition } = alicesPrivateItem();
    expect(() =>
      saveVersion("bob", definition.id, { payload: plusTwoWeapon, changeSummary: "x", expectedRevision: 0 }),
    ).toThrowError(HomebrewNotFoundError);
  });

  it("forbids Bob from editing Alice's metadata", () => {
    const { definition } = alicesPrivateItem();
    expect(() =>
      updateDefinitionMetadata("bob", definition.id, { title: "Hijacked", expectedRevision: 0 }),
    ).toThrowError(HomebrewNotFoundError);
  });

  it("forbids Bob from publishing Alice's version", () => {
    const { definition, version } = alicesPrivateItem();
    expect(() => publishVersion("bob", definition.id, version.id)).toThrowError(HomebrewNotFoundError);
  });
});

describe("campaign-shared visibility", () => {
  it("lets a campaign member read a shared published version but not draft versions", () => {
    // Alice authors and publishes; shares with a campaign Bob belongs to.
    const created = createDefinition("alice", {
      kind: "item",
      ruleset: "2014",
      title: "Shared Blade",
      payload: plusTwoWeapon,
      visibility: "campaign",
    });
    publishVersion("alice", created.definition.id, created.version.id);
    // Save a second, still-draft version.
    const detail = getDefinitionDetail("alice", created.definition.id);
    const draft = saveVersion("alice", created.definition.id, {
      payload: { ...plusTwoWeapon, description: "wip" },
      changeSummary: "wip",
      expectedRevision: detail.definition.revision,
    });

    const now = new Date().toISOString();
    getDb()
      .prepare("INSERT INTO campaigns (id, name, code, dm_user_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("camp-1", "Table", "CODE01", "alice", now);
    getDb()
      .prepare("INSERT INTO campaign_members (campaign_id, user_id, joined_at) VALUES (?, ?, ?)")
      .run("camp-1", "bob", now);
    getDb()
      .prepare(
        "INSERT INTO campaign_homebrew_access (campaign_id, definition_id, allowed_version_id, added_by_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("camp-1", created.definition.id, created.version.id, "alice", now);

    // Bob can now read the definition and its published version...
    const bobDetail = getDefinitionDetail("bob", created.definition.id);
    expect(bobDetail.definition.isOwner).toBe(false);
    expect(bobDetail.versions.map((v) => v.status)).toEqual(["published"]);
    expect(() => getVersion("bob", created.definition.id, created.version.id)).not.toThrow();
    // ...but not the draft, and not mutate anything.
    expect(() => getVersion("bob", created.definition.id, draft.id)).toThrowError(HomebrewNotFoundError);
    expect(() =>
      saveVersion("bob", created.definition.id, { payload: plusTwoWeapon, changeSummary: "x", expectedRevision: bobDetail.definition.revision }),
    ).toThrowError(HomebrewAuthorizationError);
  });
});
