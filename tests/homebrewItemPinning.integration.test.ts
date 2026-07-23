import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createDefinition, deprecateVersion, publishVersion } from "@/lib/homebrew/homebrewStore";
import { createCharacter, getCharacterForDmReadOnly, updateCharacter } from "@/lib/vaultStore";
import { createCampaign, joinCampaign } from "@/lib/campaignStore";
import { homebrewPayloadToInventory } from "@/lib/homebrew/itemIntegration";
import { characterInput } from "./fixtures/character";
import { plusTwoWeapon } from "./fixtures/homebrew";

let dataDir = "";

function seedUser(id: string) {
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, id, `${id}@example.com`, "x", new Date().toISOString());
}

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-hb-item-pin-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  seedUser("alice");
  seedUser("bob");
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

describe("character homebrew item pinning", () => {
  it("accepts a published authorized version and rejects another user's private item", async () => {
    const created = createDefinition("alice", { kind: "item", ruleset: "2014", title: "Moonsteel", payload: plusTwoWeapon });
    publishVersion("alice", created.definition.id, created.version.id);
    const item = homebrewPayloadToInventory(created.definition.id, created.version.id, "2014", plusTwoWeapon);

    const alice = await createCharacter("alice", { ...characterInput("Alice"), inventory: [item] });
    expect(alice.inventory[0].homebrew?.contentRef).toMatchObject({ versionId: created.version.id });

    await expect(createCharacter("bob", { ...characterInput("Bob"), inventory: [{ ...item, id: crypto.randomUUID() }] }))
      .rejects.toThrow(/unavailable/);
  });

  it("keeps an existing deprecated pin working but rejects a newly added copy", async () => {
    const created = createDefinition("alice", { kind: "item", ruleset: "2014", title: "Moonsteel", payload: plusTwoWeapon });
    publishVersion("alice", created.definition.id, created.version.id);
    const item = homebrewPayloadToInventory(created.definition.id, created.version.id, "2014", plusTwoWeapon);
    const character = await createCharacter("alice", { ...characterInput("Alice"), inventory: [item] });
    deprecateVersion("alice", created.definition.id, created.version.id);

    const retained = await updateCharacter("alice", character.id, {
      inventory: [{ ...item, homebrew: { ...item.homebrew!, instanceNotes: "Still resolves." } }],
    }, 0);
    expect(retained.inventory[0].homebrew?.instanceNotes).toBe("Still resolves.");

    await expect(updateCharacter("alice", character.id, {
      inventory: [...retained.inventory, { ...item, id: crypto.randomUUID() }],
    }, 1)).rejects.toThrow(/unavailable/);
  });

  it("resolves pinned items to a campaign DM without granting ordinary character access", async () => {
    const created = createDefinition("bob", { kind: "item", ruleset: "2014", title: "Moonsteel", payload: plusTwoWeapon });
    publishVersion("bob", created.definition.id, created.version.id);
    const item = homebrewPayloadToInventory(created.definition.id, created.version.id, "2014", plusTwoWeapon);
    const character = await createCharacter("bob", { ...characterInput("Bob"), inventory: [item] });
    const campaign = createCampaign("alice", "DM Resolution Table");
    joinCampaign("bob", campaign.code, character.id);

    const resolvedRef = (await getCharacterForDmReadOnly("alice", character.id))?.inventory[0].homebrew?.contentRef;
    expect(resolvedRef?.source).toBe("homebrew");
    if (resolvedRef?.source === "homebrew") expect(resolvedRef.versionId).toBe(created.version.id);
    expect(await getCharacterForDmReadOnly("bob", character.id)).toBeNull();
  });
});
