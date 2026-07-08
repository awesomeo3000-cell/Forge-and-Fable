/**
 * Campaign Store — SQLite-backed CRUD for campaigns, members, and rolls.
 */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { Character } from "@/types/game";

// ── Types ──

export type CampaignRow = {
  id: string;
  name: string;
  code: string;
  dm_user_id: string;
  created_at: string;
};

export type CampaignMemberRow = {
  campaign_id: string;
  user_id: string;
  character_id: string | null;
  joined_at: string;
};

export type CampaignRollRow = {
  id: string;
  campaign_id: string;
  user_id: string;
  character_name: string;
  label: string;
  detail: string;
  total: number;
  created_at: string;
};

export type CampaignDetail = {
  id: string;
  name: string;
  code: string;
  dmUserId: string;
  createdAt: string;
  members: Array<{
    userId: string;
    userName: string;
    characterId: string | null;
    characterName: string | null;
    characterClass: string | null;
    characterLevel: number | null;
    characterJson?: Character | null; // DM only
  }>;
  rolls: CampaignRollRow[];
  memberCount: number;
};

export type CampaignSummary = {
  id: string;
  name: string;
  code: string;
  dmUserId: string;
  createdAt: string;
  memberCount: number;
};

// ── Helpers ──

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for readability
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const MAX_ROLLS_PER_CAMPAIGN = 200;

// ── Create ──

export function createCampaign(userId: string, name: string): CampaignRow {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const trimmedName = name.trim().slice(0, 60);

  // Retry loop for unique code collision
  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = db.prepare("SELECT 1 FROM campaigns WHERE code = ?").get(code);
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO campaigns (id, name, code, dm_user_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, trimmedName, code, userId, createdAt);
    // DM auto-joins as member (no character yet)
    db.prepare("INSERT INTO campaign_members (campaign_id, user_id, character_id, joined_at) VALUES (?, ?, NULL, ?)")
      .run(id, userId, createdAt);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return { id, name: trimmedName, code, dm_user_id: userId, created_at: createdAt };
}

// ── Join ──

export function joinCampaign(userId: string, code: string, characterId: string): CampaignRow {
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE code = ?").get(code) as CampaignRow | undefined;
  if (!campaign) throw new Error("Campaign not found.");

  // Verify character belongs to user
  const charRow = db.prepare("SELECT id FROM characters WHERE id = ? AND user_id = ?").get(characterId, userId) as { id: string } | undefined;
  if (!charRow) throw new Error("Character not found or does not belong to you.");

  const now = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO campaign_members (campaign_id, user_id, character_id, joined_at) VALUES (?, ?, ?, ?)")
    .run(campaign.id, userId, characterId, now);

  return campaign;
}

// ── List ──

export function listCampaigns(userId: string): CampaignSummary[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM campaign_members WHERE campaign_id = c.id) AS member_count
    FROM campaigns c
    INNER JOIN campaign_members cm ON cm.campaign_id = c.id AND cm.user_id = ?
    ORDER BY c.created_at DESC
  `).all(userId) as Array<CampaignRow & { member_count: number }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    dmUserId: r.dm_user_id,
    createdAt: r.created_at,
    memberCount: r.member_count,
  }));
}

// ── Detail ──

export function getCampaignDetail(campaignId: string, userId: string): CampaignDetail {
  const db = getDb();

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as CampaignRow | undefined;
  if (!campaign) throw new Error("Campaign not found.");

  // Verify membership
  const membership = db.prepare("SELECT 1 FROM campaign_members WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId);
  if (!membership) throw new Error("Not a member of this campaign.");

  const isDm = campaign.dm_user_id === userId;

  // Get members with character info
  const memberRows = db.prepare(`
    SELECT cm.user_id, cm.character_id, cm.joined_at, u.name AS user_name
    FROM campaign_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.campaign_id = ?
  `).all(campaignId) as Array<{ user_id: string; character_id: string | null; joined_at: string; user_name: string }>;

  const members: CampaignDetail["members"] = memberRows.map((m) => {
    let characterName: string | null = null;
    let characterClass: string | null = null;
    let characterLevel: number | null = null;
    let characterJson: Character | null = null;

    if (m.character_id) {
      const charRow = db.prepare("SELECT data FROM characters WHERE id = ?").get(m.character_id) as { data: string } | undefined;
      if (charRow) {
        const parsed = JSON.parse(charRow.data) as Character;
        characterName = parsed.name ?? null;
        characterClass = parsed.classId ?? null;
        characterLevel = parsed.level ?? null;
        if (isDm) characterJson = parsed;
      }
    }

    return {
      userId: m.user_id,
      userName: m.user_name,
      characterId: m.character_id,
      characterName,
      characterClass,
      characterLevel,
      characterJson,
    };
  });

  // Get latest 50 rolls
  const rollRows = db.prepare(
    "SELECT * FROM campaign_rolls WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 50"
  ).all(campaignId) as CampaignRollRow[];

  return {
    id: campaign.id,
    name: campaign.name,
    code: campaign.code,
    dmUserId: campaign.dm_user_id,
    createdAt: campaign.created_at,
    members,
    rolls: rollRows.reverse(), // chronological order
    memberCount: members.length,
  };
}

// ── Post a roll ──

export function postRoll(
  campaignId: string,
  userId: string,
  characterName: string,
  label: string,
  detail: string,
  total: number,
): CampaignRollRow {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const safeLabel = label.slice(0, 80);
  const safeDetail = detail.slice(0, 200);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "INSERT INTO campaign_rolls (id, campaign_id, user_id, character_name, label, detail, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, campaignId, userId, characterName, safeLabel, safeDetail, total, createdAt);

    // Enforce 200-roll cap
    db.prepare(`
      DELETE FROM campaign_rolls WHERE campaign_id = ? AND id NOT IN (
        SELECT id FROM campaign_rolls WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(campaignId, campaignId, MAX_ROLLS_PER_CAMPAIGN);

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return { id, campaign_id: campaignId, user_id: userId, character_name: characterName, label: safeLabel, detail: safeDetail, total, created_at: createdAt };
}

// ── Delete / Leave ──

export function deleteCampaign(campaignId: string, userId: string): void {
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as CampaignRow | undefined;
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.dm_user_id !== userId) throw new Error("Only the DM can delete the campaign.");

  db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);
}

export function leaveCampaign(campaignId: string, userId: string): void {
  const db = getDb();
  const membership = db.prepare("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId);
  if (!membership) throw new Error("Not a member of this campaign.");

  // Don't allow DM to leave — they must delete instead
  const campaign = db.prepare("SELECT dm_user_id FROM campaigns WHERE id = ?").get(campaignId) as { dm_user_id: string };
  if (campaign.dm_user_id === userId) throw new Error("The DM cannot leave. Delete the campaign instead.");

  db.prepare("DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?").run(campaignId, userId);
}
