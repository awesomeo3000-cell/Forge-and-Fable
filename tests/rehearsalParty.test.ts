import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createCampaign, postCampaignEvent, syncCampaign } from "@/lib/campaignStore";
import { createCharacter } from "@/lib/vaultStore";
import { characterInput } from "./fixtures/character";
import { createCampaignRequest } from "@/lib/dmTable/store";
import { clearRehearsalParty, resolveRehearsalRequest, seatRehearsalParty } from "@/lib/dmTable/rehearsal";

let dataDir = "";

beforeEach(async () => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-rehearsal-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)").run("dm", "DM", "dm@rehearsal.test", "unused", now);
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)").run("player", "Player", "player@rehearsal.test", "unused", now);
});

afterEach(() => { closeDb(); rmSync(dataDir, { recursive: true, force: true }); delete process.env.FORGE_VAULT_DIR; });

describe("DM rehearsal party", () => {
  it("seats real premade sheets for the DM and hides ghosts from players", async () => {
    const character = await createCharacter("player", characterInput("Rook"));
    const campaign = createCampaign("dm", "Rehearsal Table");
    getDb().prepare("INSERT INTO campaign_members(campaign_id,user_id,character_id,joined_at) VALUES(?,?,?,?)").run(campaign.id, "player", character.id, new Date().toISOString());

    expect(seatRehearsalParty(campaign.id, "dm")).toHaveLength(4);
    expect(syncCampaign(campaign.id, "dm").members.filter((member) => member.isGhost)).toHaveLength(4);
    expect(syncCampaign(campaign.id, "player").members.some((member) => member.isGhost)).toBe(false);
  });

  it("answers a tracked roll with a real sheet modifier and posts to the DM feed", () => {
    const campaign = createCampaign("dm", "Roll Rehearsal");
    const ghosts = seatRehearsalParty(campaign.id, "dm");
    const request = createCampaignRequest(campaign.id, "dm", { kind: "roll", resolution: "individual", targetUserIds: [ghosts[0].user_id], payload: { kind: "check", keyType: "ability", key: "strength", advantage: "advantage" } });
    resolveRehearsalRequest(campaign.id, request.id);

    expect(syncCampaign(campaign.id, "dm").rolls).toHaveLength(1);
    expect(syncCampaign(campaign.id, "dm").requests[0]).toMatchObject({ status: "completed", responses: [expect.objectContaining({ userId: ghosts[0].user_id })] });
  });

  it("clears ghost users, sheets, pending requests, and rehearsal traces", () => {
    const campaign = createCampaign("dm", "Clear Rehearsal");
    const ghosts = seatRehearsalParty(campaign.id, "dm");
    createCampaignRequest(campaign.id, "dm", { kind: "rest-long", resolution: "individual", targetUserIds: ghosts.map((ghost) => ghost.user_id), payload: {} });
    postCampaignEvent(campaign.id, "dm", "condition-apply", { label: "Poisoned" }, ghosts[0].user_id);

    expect(clearRehearsalParty(campaign.id, "dm")).toEqual({ removed: 4 });
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM campaign_members WHERE campaign_id=? AND is_ghost=1").get(campaign.id)).toEqual({ count: 0 });
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM users WHERE id LIKE 'rehearsal-user-%'").get()).toEqual({ count: 0 });
    expect(syncCampaign(campaign.id, "dm").requests).toHaveLength(0);
  });
});
