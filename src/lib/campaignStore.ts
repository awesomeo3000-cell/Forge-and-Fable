/**
 * Campaign Store - SQLite-backed CRUD for campaigns, members, rolls, events,
 * and shared initiative.
 */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { computeArmorClass } from "@/lib/equipment";
import { effectTotal } from "@/lib/effects";
import { computeFeatBonuses } from "@/lib/featBonuses";
import { maxSlots } from "@/lib/spellSlots";
import { BACKGROUND_SKILLS, SKILLS } from "@/lib/srd";
import { applyRaceBonuses, abilityModifier } from "@/lib/utils";
import { ruleset } from "@/lib/ruleset";
import type { Character } from "@/types/game";
import type { CampaignAudioState, CampaignCombatant, CampaignCombatantCondition, CampaignEvent, CampaignMemberSummary, CampaignSyncPayload, CampaignTrack, InitiativeState } from "@/types/campaign";

// -- Types -----------------------------------------------------------------

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

type CampaignTrackRow = {
  id: string;
  campaign_id: string;
  title: string;
  url: string;
  kind: "music" | "cue";
  sort: number;
  created_at: string;
};

type CampaignAudioRow = {
  campaign_id: string;
  track_id: string | null;
  url: string | null;
  title: string | null;
  loop: number;
  started_at: string | null;
  version: number;
};

export type CampaignDetail = {
  id: string;
  name: string;
  code: string;
  dmUserId: string;
  createdAt: string;
  members: CampaignMemberSummary[];
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

export class CampaignConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignConflictError";
  }
}

const MAX_ROLLS_PER_CAMPAIGN = 200;
const MAX_EVENTS_PER_CAMPAIGN = 200;
const EMPTY_INITIATIVE: InitiativeState = { combatants: [], turnIndex: 0, round: 1 };
const EMPTY_AUDIO: CampaignAudioState = { trackId: null, url: null, title: null, loop: true, startedAt: null, version: 0 };

// -- Helpers ----------------------------------------------------------------

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function nowIso() {
  return new Date().toISOString();
}

function parseCharacter(data: string): Character | null {
  try {
    return JSON.parse(data) as Character;
  } catch {
    return null;
  }
}

function getCampaignOrThrow(campaignId: string) {
  const campaign = getDb().prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as CampaignRow | undefined;
  if (!campaign) throw new Error("Campaign not found.");
  return campaign;
}

function requireMembership(campaignId: string, userId: string) {
  const membership = getDb()
    .prepare("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, userId) as CampaignMemberRow | undefined;
  if (!membership) throw new Error("Not a member of this campaign.");
  return membership;
}

function requireDm(campaignId: string, userId: string) {
  const campaign = getCampaignOrThrow(campaignId);
  if (campaign.dm_user_id !== userId) throw new Error("Only the DM can do that.");
  return campaign;
}

function pruneTable(table: "campaign_rolls" | "campaign_events", campaignId: string, limit: number) {
  getDb().prepare(`
    DELETE FROM ${table} WHERE campaign_id = ? AND id NOT IN (
      SELECT id FROM ${table} WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(campaignId, campaignId, limit);
}

const VALID_KINDS = new Set(["player", "ally", "enemy", "neutral"]);

function clampConditions(raw: unknown): CampaignCombatantCondition[] {
  if (!Array.isArray(raw)) return [];
  const clamped: CampaignCombatantCondition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.label !== "string" || !c.label.trim()) continue;
    const entry: CampaignCombatantCondition = {
      id: c.id.slice(0, 80),
      label: c.label.trim().slice(0, 48),
    };
    if (c.advantageMode === "advantage" || c.advantageMode === "disadvantage") {
      entry.advantageMode = c.advantageMode;
    }
    if (typeof c.stack === "number" && Number.isInteger(c.stack) && c.stack >= 1 && c.stack <= 6) {
      entry.stack = c.stack;
    }
    clamped.push(entry);
    if (clamped.length >= 20) break;
  }
  return clamped;
}

function clampStatBlock(raw: unknown): CampaignCombatant["statBlock"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["speed", "saves", "senses", "resistances", "immunities", "vulnerabilities"]) {
    if (typeof input[key] === "string" && input[key].trim()) {
      out[key] = (input[key] as string).trim().slice(0, 120);
    }
  }
  return Object.keys(out).length > 0 ? out as CampaignCombatant["statBlock"] : undefined;
}

function clampCombatant(raw: Record<string, unknown>): CampaignCombatant | null {
  if (!raw ||
      typeof raw.id !== "string" ||
      typeof raw.name !== "string" ||
      typeof raw.initiative !== "number") {
    return null;
  }

  // -- kind ---------------------------------------------------------------
  let kind: CampaignCombatant["kind"] = "enemy";
  if (typeof raw.kind === "string" && VALID_KINDS.has(raw.kind)) {
    kind = raw.kind as CampaignCombatant["kind"];
  } else if (raw.isPlayer === true) {
    // backward compat: old combatants with isPlayer: true
    kind = "player";
  }

  // -- references ---------------------------------------------------------
  const memberUserId = typeof raw.memberUserId === "string" && raw.memberUserId.trim()
    ? raw.memberUserId.trim().slice(0, 80) : undefined;
  const characterId = typeof raw.characterId === "string" && raw.characterId.trim()
    ? raw.characterId.trim().slice(0, 80) : undefined;

  // -- HP / AC (flat, with backward compat for old nested hp) --------------
  let currentHp: number | undefined;
  let maxHp: number | undefined;
  let tempHp: number | undefined;

  if (raw.hp && typeof raw.hp === "object" && !Array.isArray(raw.hp)) {
    // old format: hp: { current, max }
    const old = raw.hp as Record<string, unknown>;
    if (typeof old.current === "number") currentHp = Math.max(0, Math.min(9999, Math.trunc(old.current)));
    if (typeof old.max === "number") maxHp = Math.max(1, Math.min(9999, Math.trunc(old.max)));
  }
  // new format takes precedence
  if (typeof raw.currentHp === "number" && Number.isFinite(raw.currentHp)) {
    currentHp = Math.max(0, Math.min(9999, Math.trunc(raw.currentHp)));
  }
  if (typeof raw.maxHp === "number" && Number.isFinite(raw.maxHp)) {
    maxHp = Math.max(1, Math.min(9999, Math.trunc(raw.maxHp)));
  }
  if (typeof raw.tempHp === "number" && Number.isFinite(raw.tempHp)) {
    tempHp = Math.max(0, Math.min(9999, Math.trunc(raw.tempHp)));
  }

  // -- AC -----------------------------------------------------------------
  const ac = typeof raw.ac === "number" && Number.isFinite(raw.ac)
    ? Math.max(0, Math.min(99, Math.trunc(raw.ac))) : undefined;

  // -- flags ---------------------------------------------------------------
  const hidden = raw.hidden === true ? true : undefined;
  const defeated = raw.defeated === true ? true : undefined;

  // -- text fields ---------------------------------------------------------
  const concentratingOn = typeof raw.concentratingOn === "string" && raw.concentratingOn.trim()
    ? raw.concentratingOn.trim().slice(0, 80) : undefined;

  // privateNote: prefer new field, fall back to old `note`
  const rawNote = typeof raw.privateNote === "string" ? raw.privateNote : raw.note;
  const privateNote = typeof rawNote === "string" && rawNote.trim()
    ? rawNote.trim().slice(0, 200) : undefined;

  // -- conditions ----------------------------------------------------------
  const conditions = clampConditions(raw.conditions);

  // -- stat block ----------------------------------------------------------
  const statBlock = clampStatBlock(raw.statBlock);

  return {
    id: raw.id.slice(0, 80),
    name: raw.name.slice(0, 80),
    initiative: Math.max(-99, Math.min(99, Math.trunc(raw.initiative))),
    kind,
    ...(memberUserId ? { memberUserId } : {}),
    ...(characterId ? { characterId } : {}),
    ...(currentHp !== undefined ? { currentHp } : {}),
    ...(maxHp !== undefined ? { maxHp } : {}),
    ...(tempHp !== undefined ? { tempHp } : {}),
    ...(ac !== undefined ? { ac } : {}),
    ...(hidden ? { hidden: true } : {}),
    ...(defeated ? { defeated: true } : {}),
    ...(concentratingOn ? { concentratingOn } : {}),
    ...(conditions.length ? { conditions } : {}),
    ...(privateNote ? { privateNote } : {}),
    ...(statBlock ? { statBlock } : {}),
  };
}

function clampInitiativeState(raw: InitiativeState): InitiativeState {
  const combatants: CampaignCombatant[] = [];
  if (Array.isArray(raw.combatants)) {
    for (const item of raw.combatants) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const clamped = clampCombatant(item as Record<string, unknown>);
      if (clamped) combatants.push(clamped);
    }
  }
  const round = Math.max(1, Math.min(999, Math.trunc(raw.round || 1)));
  const turnIndex = combatants.length === 0 ? 0 : Math.max(0, Math.min(combatants.length - 1, Math.trunc(raw.turnIndex || 0)));
  return { combatants, turnIndex, round };
}

function getCampaignAudio(campaignId: string): CampaignAudioState {
  const row = getDb().prepare("SELECT * FROM campaign_audio WHERE campaign_id = ?").get(campaignId) as CampaignAudioRow | undefined;
  if (!row) return EMPTY_AUDIO;
  return {
    trackId: row.track_id,
    url: row.url,
    title: row.title,
    loop: Boolean(row.loop),
    startedAt: row.started_at,
    version: row.version,
  };
}

function toTrack(row: CampaignTrackRow): CampaignTrack {
  return { id: row.id, campaignId: row.campaign_id, title: row.title, url: row.url, kind: row.kind, sort: row.sort, createdAt: row.created_at };
}

function visibleInitiative(initiative: ReturnType<typeof getInitiativeRow>, isDm: boolean) {
  if (isDm) return initiative;
  const currentId = initiative.data.combatants[initiative.data.turnIndex]?.id;
  const combatants = initiative.data.combatants
    .filter((combatant) => !combatant.hidden)
    .map((combatant) => {
      const { privateNote, conditions, ...rest } = combatant;
      void privateNote; void conditions;
      return rest as CampaignCombatant;
    });
  return {
    ...initiative,
    data: {
      ...initiative.data,
      combatants,
      turnIndex: Math.max(0, combatants.findIndex((combatant) => combatant.id === currentId)),
    },
  };
}

function sortCombatants(combatants: InitiativeState["combatants"]) {
  return combatants
    .map((combatant, index) => ({ combatant, index }))
    .sort((a, b) => b.combatant.initiative - a.combatant.initiative || a.index - b.index)
    .map((item) => item.combatant);
}

function calculateMemberSummary(
  userId: string,
  userName: string,
  characterId: string | null,
  isDm: boolean,
  viewerUserId: string,
): CampaignMemberSummary {
  let characterJson: Character | null = null;

  if (characterId) {
    const charRow = getDb()
      .prepare("SELECT data FROM characters WHERE id = ? AND user_id = ?")
      .get(characterId, userId) as { data: string } | undefined;
    if (charRow) characterJson = parseCharacter(charRow.data);
  }

  if (!characterJson) {
    return {
      userId,
      userName,
      characterId,
      characterName: null,
      characterClass: null,
      characterLevel: null,
      currentHp: null,
      maxHp: null,
      ac: null,
      passivePerception: null,
      conditions: [],
      spellSlots: [],
      ...(isDm ? { characterJson: null } : {}),
    };
  }

  const raced = applyRaceBonuses(characterJson.abilities, characterJson.raceId, ruleset);
  const featInfo = computeFeatBonuses(characterJson.asiChoices);
  for (const key of Object.keys(raced) as Array<keyof typeof raced>) {
    raced[key] += featInfo.abilityIncreases[key] ?? 0;
  }
  const acInfo = computeArmorClass(raced, characterJson.classId, characterJson.equipment, characterJson.inventory);
  const ruleAc = characterJson.customRules.filter((rule) => rule.type === "ac").reduce((sum, rule) => sum + rule.value, 0);
  const ac = acInfo.total + ruleAc + featInfo.acBonus + effectTotal(characterJson.effects, "ac");
  const perception = SKILLS.find((skill) => skill.id === "perception");
  const hasPerception =
    (characterJson.skillProficiencies ?? []).includes("perception") ||
    (BACKGROUND_SKILLS[characterJson.background] ?? []).includes("perception");
  const passivePerception = perception
    ? 10 + abilityModifier(raced[perception.ability]) + (hasPerception ? 2 + Math.floor((characterJson.level - 1) / 4) : 0)
    : null;
  const conditions = (characterJson.effects ?? [])
    .filter((effect) => effect.active && (effect.source === "DM" || effect.advantageMode))
    .map((effect) => effect.label.slice(0, 32))
    .slice(0, 8);
  const casterType = ruleset.classes.find((item) => item.id === characterJson.classId)?.casterType ?? "none";
  const slots = maxSlots(casterType, characterJson.level, characterJson.classId);
  const spellSlots = slots
    .map((max, index) => ({
      level: index + 1,
      max,
      remaining: Math.max(0, max - (casterType === "pact"
        ? (characterJson.pactSlotsUsed ?? 0)
        : (characterJson.spellSlotsUsed?.[index + 1] ?? 0))),
    }))
    .filter((slot) => slot.max > 0);

  return {
    userId,
    userName,
    characterId,
    characterName: characterJson.name,
    characterClass: characterJson.classId,
    characterLevel: characterJson.level,
    currentHp: characterJson.currentHp,
    maxHp: characterJson.maxHp,
    ac,
    passivePerception,
    conditions,
    spellSlots,
    ...(isDm || userId === viewerUserId ? { characterJson } : {}),
  };
}

function listMembers(campaignId: string, isDm: boolean, viewerUserId: string): CampaignMemberSummary[] {
  const memberRows = getDb().prepare(`
    SELECT cm.user_id, cm.character_id, u.name AS user_name
    FROM campaign_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.campaign_id = ?
    ORDER BY cm.joined_at ASC
  `).all(campaignId) as Array<{ user_id: string; character_id: string | null; user_name: string }>;

  return memberRows.map((row) => calculateMemberSummary(row.user_id, row.user_name, row.character_id, isDm, viewerUserId));
}

function getInitiativeRow(campaignId: string) {
  const row = getDb()
    .prepare("SELECT data, version, updated_at FROM campaign_initiative WHERE campaign_id = ?")
    .get(campaignId) as { data: string; version: number; updated_at: string } | undefined;
  if (!row) return { data: EMPTY_INITIATIVE, version: 0, updatedAt: null };
  try {
    return {
      data: clampInitiativeState(JSON.parse(row.data) as InitiativeState),
      version: row.version,
      updatedAt: row.updated_at,
    };
  } catch {
    return { data: EMPTY_INITIATIVE, version: row.version, updatedAt: row.updated_at };
  }
}

// -- Create / Join / List ---------------------------------------------------

export function createCampaign(userId: string, name: string): CampaignRow {
  const db = getDb();
  const id = randomUUID();
  const createdAt = nowIso();
  const trimmedName = name.trim().slice(0, 60);

  db.exec("BEGIN IMMEDIATE");
  try {
    let code = generateCode();
    for (let attempts = 0; attempts < 10; attempts++) {
      const existing = db.prepare("SELECT 1 FROM campaigns WHERE code = ?").get(code);
      if (!existing) break;
      code = generateCode();
    }

    db.prepare("INSERT INTO campaigns (id, name, code, dm_user_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, trimmedName, code, userId, createdAt);
    db.prepare("INSERT INTO campaign_members (campaign_id, user_id, character_id, joined_at) VALUES (?, ?, NULL, ?)")
      .run(id, userId, createdAt);
    db.prepare("INSERT INTO campaign_initiative (campaign_id, data, version, updated_at) VALUES (?, ?, 0, ?)")
      .run(id, JSON.stringify(EMPTY_INITIATIVE), createdAt);
    db.prepare("INSERT INTO campaign_audio (campaign_id, loop, version) VALUES (?, 1, 0)")
      .run(id);
    db.exec("COMMIT");
    return { id, name: trimmedName, code, dm_user_id: userId, created_at: createdAt };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function joinCampaign(userId: string, code: string, characterId: string): CampaignRow {
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE code = ?").get(code) as CampaignRow | undefined;
  if (!campaign) throw new Error("Campaign not found.");

  const charRow = db.prepare("SELECT id FROM characters WHERE id = ? AND user_id = ?").get(characterId, userId) as { id: string } | undefined;
  if (!charRow) throw new Error("Character not found or does not belong to you.");

  db.prepare(`
    INSERT INTO campaign_members (campaign_id, user_id, character_id, joined_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(campaign_id, user_id) DO UPDATE SET character_id = excluded.character_id, joined_at = excluded.joined_at
  `).run(campaign.id, userId, characterId, nowIso());

  return campaign;
}

export function listCampaigns(userId: string): CampaignSummary[] {
  const rows = getDb().prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM campaign_members WHERE campaign_id = c.id) AS member_count
    FROM campaigns c
    INNER JOIN campaign_members cm ON cm.campaign_id = c.id AND cm.user_id = ?
    ORDER BY c.created_at DESC
  `).all(userId) as Array<CampaignRow & { member_count: number }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    dmUserId: row.dm_user_id,
    createdAt: row.created_at,
    memberCount: row.member_count,
  }));
}

// -- Detail / Sync ----------------------------------------------------------

export function getCampaignDetail(campaignId: string, userId: string): CampaignDetail {
  const campaign = getCampaignOrThrow(campaignId);
  requireMembership(campaignId, userId);
  const isDm = campaign.dm_user_id === userId;
  const members = listMembers(campaignId, isDm, userId);
  const rolls = getDb().prepare(
    "SELECT * FROM campaign_rolls WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 50",
  ).all(campaignId) as CampaignRollRow[];

  return {
    id: campaign.id,
    name: campaign.name,
    code: campaign.code,
    dmUserId: campaign.dm_user_id,
    createdAt: campaign.created_at,
    members,
    rolls: rolls.reverse(),
    memberCount: members.length,
  };
}

export function syncCampaign(campaignId: string, userId: string, since?: string): CampaignSyncPayload {
  const campaign = getCampaignOrThrow(campaignId);
  requireMembership(campaignId, userId);
  const sinceValue = since && !Number.isNaN(Date.parse(since)) ? since : "0000-01-01T00:00:00.000Z";
  const isDm = campaign.dm_user_id === userId;
  const events = getDb().prepare(`
    SELECT * FROM campaign_events
    WHERE campaign_id = ?
      AND created_at > ?
      AND (target_user_id IS NULL OR target_user_id = ?)
    ORDER BY created_at ASC
    LIMIT 200
  `).all(campaignId, sinceValue, userId) as CampaignEvent[];
  const rolls = getDb().prepare(`
    SELECT * FROM campaign_rolls
    WHERE campaign_id = ? AND created_at > ?
    ORDER BY created_at ASC
    LIMIT 200
  `).all(campaignId, sinceValue) as CampaignRollRow[];

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      code: campaign.code,
      dmUserId: campaign.dm_user_id,
    },
    events,
    rolls,
    initiative: visibleInitiative(getInitiativeRow(campaignId), isDm),
    members: listMembers(campaignId, isDm, userId),
    audio: getCampaignAudio(campaignId),
  };
}

// -- Soundboard -------------------------------------------------------------

export function listCampaignTracks(campaignId: string, userId: string): CampaignTrack[] {
  requireMembership(campaignId, userId);
  return (getDb().prepare("SELECT * FROM campaign_tracks WHERE campaign_id = ? ORDER BY sort ASC, created_at ASC")
    .all(campaignId) as CampaignTrackRow[]).map(toTrack);
}

export function addCampaignTrack(campaignId: string, userId: string, input: Omit<CampaignTrack, "id" | "campaignId" | "sort" | "createdAt">): CampaignTrack {
  requireDm(campaignId, userId);
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(MAX(sort), -1) AS max_sort FROM campaign_tracks WHERE campaign_id = ?").get(campaignId) as { max_sort: number };
  const id = randomUUID();
  const createdAt = nowIso();
  db.prepare("INSERT INTO campaign_tracks (id, campaign_id, title, url, kind, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, campaignId, input.title, input.url, input.kind, row.max_sort + 1, createdAt);
  return { id, campaignId, title: input.title, url: input.url, kind: input.kind, sort: row.max_sort + 1, createdAt };
}

export function deleteCampaignTrack(campaignId: string, userId: string, trackId: string) {
  requireDm(campaignId, userId);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const audio = getCampaignAudio(campaignId);
    if (audio.trackId === trackId) {
      db.prepare("UPDATE campaign_audio SET track_id = NULL, url = NULL, title = NULL, started_at = NULL, version = version + 1 WHERE campaign_id = ?").run(campaignId);
    }
    db.prepare("DELETE FROM campaign_tracks WHERE campaign_id = ? AND id = ?").run(campaignId, trackId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateCampaignAudio(campaignId: string, userId: string, trackId: string | null, version: number): CampaignAudioState {
  requireDm(campaignId, userId);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = getCampaignAudio(campaignId);
    if (current.version !== version) throw new CampaignConflictError("Audio changed. Refetch and try again.");
    let track: CampaignTrackRow | undefined;
    if (trackId) {
      track = db.prepare("SELECT * FROM campaign_tracks WHERE campaign_id = ? AND id = ? AND kind = 'music'").get(campaignId, trackId) as CampaignTrackRow | undefined;
      if (!track) throw new Error("Music track not found.");
    }
    const nextVersion = version + 1;
    const startedAt = track ? nowIso() : null;
    db.prepare(`
      INSERT INTO campaign_audio (campaign_id, track_id, url, title, loop, started_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO UPDATE SET track_id = excluded.track_id, url = excluded.url, title = excluded.title,
        loop = excluded.loop, started_at = excluded.started_at, version = excluded.version
    `).run(campaignId, track?.id ?? null, track?.url ?? null, track?.title ?? null, track ? 1 : 0, startedAt, nextVersion);
    db.exec("COMMIT");
    return { trackId: track?.id ?? null, url: track?.url ?? null, title: track?.title ?? null, loop: Boolean(track), startedAt, version: nextVersion };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// -- Rolls / Events ---------------------------------------------------------

export function postRoll(
  campaignId: string,
  userId: string,
  characterName: string,
  label: string,
  detail: string,
  total: number,
): CampaignRollRow {
  requireMembership(campaignId, userId);
  const db = getDb();
  const id = randomUUID();
  const createdAt = nowIso();
  const safeLabel = label.slice(0, 80);
  const safeDetail = detail.slice(0, 200);
  const safeName = characterName.slice(0, 80);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "INSERT INTO campaign_rolls (id, campaign_id, user_id, character_name, label, detail, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(id, campaignId, userId, safeName, safeLabel, safeDetail, total, createdAt);
    pruneTable("campaign_rolls", campaignId, MAX_ROLLS_PER_CAMPAIGN);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return { id, campaign_id: campaignId, user_id: userId, character_name: safeName, label: safeLabel, detail: safeDetail, total, created_at: createdAt };
}

export function postCampaignEvent(
  campaignId: string,
  userId: string,
  type: CampaignEvent["type"],
  payload: unknown,
  targetUserId?: string | null,
): CampaignEvent {
  requireDm(campaignId, userId);
  if (targetUserId) requireMembership(campaignId, targetUserId);

  const db = getDb();
  const id = randomUUID();
  const createdAt = nowIso();
  const target = targetUserId ?? null;
  const payloadJson = JSON.stringify(payload);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "INSERT INTO campaign_events (id, campaign_id, target_user_id, type, payload, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, campaignId, target, type, payloadJson, userId, createdAt);
    pruneTable("campaign_events", campaignId, MAX_EVENTS_PER_CAMPAIGN);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return { id, campaign_id: campaignId, target_user_id: target, type, payload: payloadJson, created_by: userId, created_at: createdAt };
}

// -- Initiative -------------------------------------------------------------

export function updateCampaignInitiative(campaignId: string, userId: string, data: InitiativeState, version: number) {
  requireDm(campaignId, userId);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = getInitiativeRow(campaignId);
    if (current.version !== version) {
      throw new CampaignConflictError("Initiative changed. Refetch and try again.");
    }
    const nextData = clampInitiativeState(data);
    const nextVersion = version + 1;
    const updatedAt = nowIso();
    db.prepare(`
      INSERT INTO campaign_initiative (campaign_id, data, version, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at
    `).run(campaignId, JSON.stringify(nextData), nextVersion, updatedAt);
    db.exec("COMMIT");
    return { data: nextData, version: nextVersion, updatedAt };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function rollCampaignInitiative(campaignId: string, userId: string, characterName: string, initiative: number) {
  const membership = requireMembership(campaignId, userId);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = getInitiativeRow(campaignId);
    const playerId = `player:${userId}`;
    const combatants = current.data.combatants.filter((combatant) => combatant.id !== playerId);
    combatants.push({
      id: playerId,
      name: characterName.trim().slice(0, 80),
      initiative: Math.max(-99, Math.min(99, Math.trunc(initiative))),
      kind: "player",
      memberUserId: userId,
      ...(membership.character_id ? { characterId: membership.character_id } : {}),
    });
    const sortedCurrent = sortCombatants(current.data.combatants);
    const currentId = sortedCurrent[current.data.turnIndex]?.id;
    const sortedNext = sortCombatants(combatants);
    const nextData = clampInitiativeState({
      ...current.data,
      combatants,
      turnIndex: currentId ? Math.max(0, sortedNext.findIndex((item) => item.id === currentId)) : 0,
    });
    const nextVersion = current.version + 1;
    const updatedAt = nowIso();
    db.prepare(`
      INSERT INTO campaign_initiative (campaign_id, data, version, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at
    `).run(campaignId, JSON.stringify(nextData), nextVersion, updatedAt);
    db.exec("COMMIT");
    return { data: nextData, version: nextVersion, updatedAt };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// -- Delete / Leave ---------------------------------------------------------

export function deleteCampaign(campaignId: string, userId: string): void {
  const campaign = getCampaignOrThrow(campaignId);
  if (campaign.dm_user_id !== userId) throw new Error("Only the DM can delete the campaign.");
  getDb().prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);
}

export function leaveCampaign(campaignId: string, userId: string): void {
  requireMembership(campaignId, userId);
  const campaign = getCampaignOrThrow(campaignId);
  if (campaign.dm_user_id === userId) throw new Error("The DM cannot leave. Delete the campaign instead.");
  getDb().prepare("DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?").run(campaignId, userId);
}

export function switchCampaignCharacter(campaignId: string, userId: string, characterId: string): void {
  requireMembership(campaignId, userId);

  const charRow = getDb()
    .prepare("SELECT id FROM characters WHERE id = ? AND user_id = ?")
    .get(characterId, userId) as { id: string } | undefined;

  if (!charRow) {
    throw new Error("Character not found or does not belong to you.");
  }

  getDb()
    .prepare("UPDATE campaign_members SET character_id = ? WHERE campaign_id = ? AND user_id = ?")
    .run(characterId, campaignId, userId);
}
