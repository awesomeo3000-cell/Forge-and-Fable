import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createCampaign, joinCampaign } from "@/lib/campaignStore";
import { createCharacter } from "@/lib/vaultStore";
import { createCampaignRequest, createCharacterNote, listCampaignPresence, listCampaignRequests, listCharacterNotes, respondToCampaignRequest, touchCampaignPresence } from "@/lib/dmTable/store";
import { characterInput } from "./fixtures/character";
import { createNpc, createScene, listNpcs, listScenes, updateNpc, updateScene } from "@/lib/dmTable/worldStore";

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

  it("tracks only targeted player responses and completes a request", async () => {
    const hero = await createCharacter("player", characterInput("Rook"));
    const run = createCampaign("dm", "Request Table"); joinCampaign("player", run.code, hero.id);
    const request = createCampaignRequest(run.id, "dm", { kind: "roll", resolution: "group", targetUserIds: ["player"], payload: { kind: "save", key: "wisdom", dc: 15 } });
    const response = respondToCampaignRequest(run.id, "player", request.id, { status: "completed", total: 17, passed: true, summary: "Wisdom save: 17 pass" });
    expect(response).toMatchObject({ userId: "player", total: 17, passed: true });
    expect(listCampaignRequests(run.id, "dm")[0]).toMatchObject({ id: request.id, status: "completed", responses: [expect.objectContaining({ total: 17 })] });
    expect(() => respondToCampaignRequest(run.id, "dm", request.id, { status: "completed", summary: "No" })).toThrow(/not sent|no longer open/);
  });

  it("persists DM-only scene and NPC state across updates", async () => {
    const run = createCampaign("dm", "World Table");
    const scene = createScene(run.id, "dm", { title: "Ruined Gate", active: true, objectives: ["Find a way inside"], clues: ["Broken seal"] });
    const npc = createNpc(run.id, "dm", { name: "Captain Merrow", attitude: "Suspicious", status: "alive", disposition: "neutral", currentSceneId: scene.id, currentHp: 22, maxHp: 22 });
    updateScene(run.id, "dm", scene.id, { npcIds: [npc.id], revealedClues: ["Broken seal"] });
    updateNpc(run.id, "dm", npc.id, { disposition: "allied", lastLocation: "Ruined Gate" });
    expect(listScenes(run.id, "dm")[0]).toMatchObject({ title: "Ruined Gate", npcIds: [npc.id], revealedClues: ["Broken seal"] });
    expect(listNpcs(run.id, "dm")[0]).toMatchObject({ disposition: "allied", lastLocation: "Ruined Gate" });
    expect(() => listScenes(run.id, "player")).toThrow(/Only the DM/);
  });
});
