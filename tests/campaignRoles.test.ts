import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createCampaign, joinCampaign, listCampaigns, syncCampaign } from "@/lib/campaignStore";
import { createCharacter } from "@/lib/vaultStore";
import { characterInput } from "./fixtures/character";

let dataDir = "";

beforeEach(async () => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-campaign-roles-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  const now = new Date().toISOString();
  for (const [id, name, email] of [["dm", "Dungeon Master", "dm@roles.test"], ["player", "Player", "player@roles.test"]]) {
    getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at)VALUES(?,?,?,?,?)").run(id, name, email, "unused", now);
  }
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

describe("campaign roles and character eligibility", () => {
  it("returns DM/player role and enrolled character metadata", async () => {
    const character = await createCharacter("player", characterInput("Rook"));
    const run = createCampaign("dm", "Run Table");
    const play = createCampaign("dm", "Play Table");
    joinCampaign("player", play.code, character.id);

    expect(listCampaigns("dm").map((campaign) => campaign.myRole)).toEqual(["dm", "dm"]);
    expect(listCampaigns("player")).toEqual([
      expect.objectContaining({
        id: play.id,
        myRole: "player",
        myCharacterId: character.id,
        myCharacterName: "Rook",
      }),
    ]);
    expect(listCampaigns("player").some((campaign) => campaign.id === run.id)).toBe(false);
  });

  it("persists the selected campaign theme through summaries and sync", () => {
    const campaign = createCampaign("dm", "Moonlit Table", "forge");

    expect(listCampaigns("dm")[0]).toMatchObject({ themeKey: "forge" });
    expect(syncCampaign(campaign.id, "dm").campaign.themeKey).toBe("forge");
  });

  it("rejects a character already enrolled in another campaign", async () => {
    const character = await createCharacter("player", characterInput("Rook"));
    const first = createCampaign("dm", "First Table");
    const second = createCampaign("dm", "Second Table");
    joinCampaign("player", first.code, character.id);

    expect(() => joinCampaign("player", second.code, character.id)).toThrow(
      'This character is already enrolled in "First Table".',
    );
  });

  it("keeps the enrollment invariant database-enforced", async () => {
    const character = await createCharacter("player", characterInput("Rook"));
    const first = createCampaign("dm", "First Table");
    const second = createCampaign("dm", "Second Table");
    const now = new Date().toISOString();
    getDb().prepare("INSERT INTO campaign_members(campaign_id,user_id,character_id,joined_at)VALUES(?,?,?,?)").run(first.id, "player", character.id, now);

    expect(() => getDb().prepare("INSERT INTO campaign_members(campaign_id,user_id,character_id,joined_at)VALUES(?,?,?,?)").run(second.id, "player", character.id, now)).toThrow(/unique|constraint/i);
  });

  it("repairs legacy duplicate enrollments before creating the unique index", async () => {
    const character = await createCharacter("player", characterInput("Rook"));
    const older = createCampaign("dm", "Older Table");
    const newer = createCampaign("dm", "Newer Table");
    const oldJoinedAt = "2026-07-01T00:00:00.000Z";
    const newJoinedAt = "2026-07-02T00:00:00.000Z";
    const db = getDb();
    db.exec("DROP INDEX idx_campaign_members_character_unique");
    db.prepare("INSERT INTO campaign_members(campaign_id,user_id,character_id,joined_at)VALUES(?,?,?,?)").run(older.id, "player", character.id, oldJoinedAt);
    db.prepare("INSERT INTO campaign_members(campaign_id,user_id,character_id,joined_at)VALUES(?,?,?,?)").run(newer.id, "player", character.id, newJoinedAt);
    closeDb();

    const migrated = getDb();
    const rows = migrated.prepare("SELECT campaign_id, character_id FROM campaign_members WHERE campaign_id IN (?, ?) ORDER BY campaign_id").all(older.id, newer.id) as Array<{ campaign_id: string; character_id: string | null }>;
    expect(rows.filter((row) => row.character_id === character.id)).toHaveLength(1);
    expect(migrated.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_campaign_members_character_unique'").all()).toHaveLength(1);
  });
});
