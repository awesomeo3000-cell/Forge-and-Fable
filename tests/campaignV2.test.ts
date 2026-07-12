import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { addCampaignTrack, CampaignConflictError, createCampaign, joinCampaign, postCampaignEvent, postRoll, syncCampaign, updateCampaignAudio, updateCampaignInitiative } from "@/lib/campaignStore";
import { encodeCampaignCursor } from "@/lib/campaignCursor";
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
      { id: "monster:secret", name: "Secret monster", initiative: 18, kind: "enemy", hidden: true, currentHp: 12, maxHp: 12, ac: 14, privateNote: "the DM's secret", conditions: [{ id: "c1", label: "Enraged" }] },
      { id: "monster:open", name: "Open monster", initiative: 11, kind: "enemy", currentHp: 5, maxHp: 12, ac: 15, visibility: "approximate-health", reactionUsed: true, turnStatus: "readied", statBlock: { resistances: "fire" } },
    ] }, 0);
    expect(syncCampaign(campaign.id, "player").initiative.data.combatants.map((item) => item.id)).toEqual(["monster:open"]);
    expect(syncCampaign(campaign.id, "dm").initiative.data.combatants).toHaveLength(2);

    // DM sees private data
    const dmCombatants = syncCampaign(campaign.id, "dm").initiative.data.combatants;
    const secret = dmCombatants.find((c) => c.id === "monster:secret" as unknown)!;
    expect(secret.privateNote).toBe("the DM's secret");
    expect(secret.conditions).toHaveLength(1);

    // Player should NOT see privateNote or conditions (stripped in visibleInitiative);
    // the hidden combatant is already filtered, so check the open one has no private data leakage.
    const playerCombatants = syncCampaign(campaign.id, "player").initiative.data.combatants;
    const open = playerCombatants.find((c) => c.id === "monster:open" as unknown)!;
    expect(open.privateNote).toBeUndefined();
    expect(open.conditions).toBeUndefined();
    expect(open.currentHp).toBeUndefined();
    expect(open.maxHp).toBeUndefined();
    expect(open.ac).toBeUndefined();
    expect(open.healthLabel).toBe("Bloodied");
    // Regression guard: CHANGES-25 claimed statBlock was stripped for players,
    // but visibleInitiative originally leaked it (resistances/immunities are
    // DM secrets even on VISIBLE combatants).
    expect(open.statBlock).toBeUndefined();
    const dmOpen = syncCampaign(campaign.id, "dm").initiative.data.combatants.find((c) => c.id === ("monster:open" as unknown))!;
    expect(dmOpen.statBlock).toMatchObject({ resistances: "fire" });
    expect(dmOpen.currentHp).toBe(5);
    expect(dmOpen).toMatchObject({ reactionUsed: true, turnStatus: "readied" });

    const track = addCampaignTrack(campaign.id, "dm", { title: "Tavern", url: "https://example.test/tavern.mp3", kind: "music" });
    const audio = updateCampaignAudio(campaign.id, "dm", track.id, 0);
    expect(audio).toMatchObject({ trackId: track.id, title: "Tavern", loop: true, version: 1 });
    expect(() => updateCampaignAudio(campaign.id, "dm", null, 0)).toThrow(CampaignConflictError);
  });

  it("advances event and roll cursors independently across identical timestamps", () => {
    const campaign = createCampaign("dm", "Cursor Table");
    const eventA = postCampaignEvent(campaign.id, "dm", "announce", { message: "A" });
    const eventB = postCampaignEvent(campaign.id, "dm", "announce", { message: "B" });
    const rollA = postRoll(campaign.id, "dm", "DM", "Check", "1d20", 10);
    const sharedTime = "2026-07-11T12:00:00.000Z";
    const db = getDb();
    db.prepare("UPDATE campaign_events SET created_at = ? WHERE id IN (?, ?)").run(sharedTime, eventA.id, eventB.id);
    db.prepare("UPDATE campaign_rolls SET created_at = ? WHERE id = ?").run(sharedTime, rollA.id);

    const first = syncCampaign(campaign.id, "dm");
    const sortedEvents = [...first.events].sort((a, b) => a.id.localeCompare(b.id));
    const afterFirstEvent = syncCampaign(campaign.id, "dm", { events: encodeCampaignCursor(sortedEvents[0]) });
    expect(afterFirstEvent.events.map((event) => event.id)).toEqual([sortedEvents[1].id]);
    expect(afterFirstEvent.rolls).toHaveLength(1);

    const afterRollOnly = syncCampaign(campaign.id, "dm", { rolls: encodeCampaignCursor(first.rolls[0]) });
    expect(afterRollOnly.events).toHaveLength(2);
    expect(afterRollOnly.rolls).toHaveLength(0);
  });
});
