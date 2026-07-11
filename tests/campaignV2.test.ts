import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { addCampaignTrack, CampaignConflictError, createCampaign, joinCampaign, syncCampaign, updateCampaignAudio, updateCampaignInitiative } from "@/lib/campaignStore";
import { createCharacter } from "@/lib/vaultStore";
import { characterInput } from "./fixtures/character";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-campaign-v2-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("dm", "DM", "dm@example.com", "unused", now);
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("player", "Player", "player@example.com", "unused", now);
});

afterEach(() => { closeDb(); rmSync(dataDir, { recursive: true, force: true }); delete process.env.FORGE_VAULT_DIR; });

describe("campaign v2 store", () => {
  it("keeps hidden combatants out of player syncs and versions audio state", async () => {
    const player = await createCharacter("player", characterInput("Pip"));
    const campaign = createCampaign("dm", "Review Table");
    joinCampaign("player", campaign.code, player.id);
    updateCampaignInitiative(campaign.id, "dm", { round: 1, turnIndex: 0, combatants: [
      { id: "monster:secret", name: "Secret monster", initiative: 18, hidden: true, hp: { current: 12, max: 12 }, ac: 14 },
      { id: "monster:open", name: "Open monster", initiative: 11 },
    ] }, 0);
    expect(syncCampaign(campaign.id, "player").initiative.data.combatants.map((item) => item.id)).toEqual(["monster:open"]);
    expect(syncCampaign(campaign.id, "dm").initiative.data.combatants).toHaveLength(2);

    const track = addCampaignTrack(campaign.id, "dm", { title: "Tavern", url: "https://example.test/tavern.mp3", kind: "music" });
    const audio = updateCampaignAudio(campaign.id, "dm", track.id, 0);
    expect(audio).toMatchObject({ trackId: track.id, title: "Tavern", loop: true, version: 1 });
    expect(() => updateCampaignAudio(campaign.id, "dm", null, 0)).toThrow(CampaignConflictError);
  });
});
