import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createCampaign, joinCampaign } from "@/lib/campaignStore";
import { createCharacter } from "@/lib/vaultStore";
import { createCharacterNote, listCampaignPresence, listCharacterNotes, touchCampaignPresence } from "@/lib/dmTable/store";
import { characterInput } from "./fixtures/character";

let dataDir = "";

beforeEach(() => {
  closeDb(); dataDir = mkdtempSync(path.join(tmpdir(), "forge-dm-table-")); process.env.FORGE_VAULT_DIR = dataDir;
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at)VALUES(?,?,?,?,?)").run("dm", "DM", "dm@table.test", "unused", now);
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at)VALUES(?,?,?,?,?)").run("player", "Player", "player@table.test", "unused", now);
});

afterEach(() => { closeDb(); rmSync(dataDir, { recursive: true, force: true }); delete process.env.FORGE_VAULT_DIR; });

describe("DM table presence and private notes", () => {
  it("derives connected, background, away, and disconnected presence from heartbeats", async () => {
    const hero = await createCharacter("player", characterInput("Rook"));
    const run = createCampaign("dm", "Presence Table"); joinCampaign("player", run.code, hero.id);
    touchCampaignPresence(run.id, "player", "hidden");
    expect(listCampaignPresence(run.id, "dm").find((item) => item.userId === "player")?.state).toBe("background");
    getDb().prepare("UPDATE campaign_presence SET last_seen_at=? WHERE campaign_id=? AND user_id='player'").run(new Date(Date.now() - 45_000).toISOString(), run.id);
    expect(listCampaignPresence(run.id, "dm").find((item) => item.userId === "player")?.state).toBe("away");
    getDb().prepare("UPDATE campaign_presence SET last_seen_at=? WHERE campaign_id=? AND user_id='player'").run(new Date(Date.now() - 120_000).toISOString(), run.id);
    expect(listCampaignPresence(run.id, "dm").find((item) => item.userId === "player")?.state).toBe("disconnected");
  });

  it("keeps character notes DM-only and campaign-scoped", async () => {
    const hero = await createCharacter("player", characterInput("Rook"));
    const run = createCampaign("dm", "Notes Table"); joinCampaign("player", run.code, hero.id);
    const note = createCharacterNote(run.id, "dm", { characterId: hero.id, category: "secret", title: "Hidden lineage", body: "The crown recognizes the signet." });
    expect(listCharacterNotes(run.id, "dm", hero.id)).toEqual([expect.objectContaining({ id: note.id, category: "secret" })]);
    expect(() => listCharacterNotes(run.id, "player", hero.id)).toThrow(/Only the DM/);
  });
});
