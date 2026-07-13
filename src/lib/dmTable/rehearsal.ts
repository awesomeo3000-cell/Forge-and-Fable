import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { buildQuickDraft, PREMADE_ARCHETYPES } from "@/lib/quickbuild";
import { ruleset } from "@/lib/ruleset";
import { BACKGROUND_SKILLS, SKILLS } from "@/lib/srd";
import { applyRaceBonuses, abilityModifier, proficiencyBonus } from "@/lib/utils";
import { computeFeatBonuses } from "@/lib/featBonuses";
import { combineRollModes, rollRequestDescriptor, rollRequestMode } from "@/lib/rollRequest";
import { effectiveAdvantageMode } from "@/lib/effects";
import { deathSavePatch, type DeathSaveAction } from "@/lib/deathSaves";
import { longRestRecovery, recoverFeatureResources } from "@/lib/restRecovery";
import type { CampaignEventType } from "@/types/campaign";
import type { Character, CharacterEffect } from "@/types/game";

export const REHEARSAL_RESPONSE_DELAY_MS = 2500;
const REHEARSAL_SIZE = 4;

type GhostRow = { user_id: string; character_id: string; is_ghost: number };
type RequestRow = { id: string; kind: "roll" | "rest-short" | "rest-long"; target_user_ids: string; payload: string; status: string };

function ghostRows(campaignId: string) {
  return getDb().prepare("SELECT user_id, character_id, is_ghost FROM campaign_members WHERE campaign_id=? AND is_ghost=1 AND character_id IS NOT NULL ORDER BY joined_at").all(campaignId) as GhostRow[];
}

function ghostCharacter(userId: string, characterId: string) {
  const row = getDb().prepare("SELECT data FROM characters WHERE id=? AND user_id=?").get(characterId, userId) as { data: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.data) as Character; } catch { return null; }
}

function updateGhostCharacter(character: Character, patch: Partial<Character>) {
  const next = { ...character, ...patch, revision: (character.revision ?? 0) + 1 };
  getDb().prepare("UPDATE characters SET data=?, revision=revision+1, updated_at=? WHERE id=? AND user_id=?")
    .run(JSON.stringify(next), new Date().toISOString(), character.id, character.userId);
  return next;
}

export function seatRehearsalParty(campaignId: string, dmUserId: string) {
  const db = getDb();
  const campaign = db.prepare("SELECT dm_user_id FROM campaigns WHERE id=?").get(campaignId) as { dm_user_id: string } | undefined;
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.dm_user_id !== dmUserId) throw new Error("Only the DM can seat a rehearsal party.");
  const existing = ghostRows(campaignId);
  if (existing.length) return existing;

  const now = new Date().toISOString();
  const created: GhostRow[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const archetype of PREMADE_ARCHETYPES.slice(0, REHEARSAL_SIZE)) {
      const userId = `rehearsal-user-${randomUUID()}`;
      const characterId = `rehearsal-character-${randomUUID()}`;
      const draft = buildQuickDraft(ruleset, archetype.classId, archetype.raceId, `Rehearsal ${archetype.label}`);
      const character: Character = { ...draft, id: characterId, userId, revision: 0, createdAt: now };
      db.prepare("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)")
        .run(userId, `Rehearsal ${archetype.label}`, `${userId}@rehearsal.invalid`, "rehearsal-only", now);
      db.prepare("INSERT INTO characters(id,user_id,data,revision,created_at,updated_at) VALUES(?,?,?,?,?,?)")
        .run(characterId, userId, JSON.stringify(character), 0, now, now);
      db.prepare("INSERT INTO campaign_members(campaign_id,user_id,character_id,is_ghost,joined_at) VALUES(?,?,?,?,?)")
        .run(campaignId, userId, characterId, 1, now);
      created.push({ user_id: userId, character_id: characterId, is_ghost: 1 });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return created;
}

export function clearRehearsalParty(campaignId: string, dmUserId: string) {
  const db = getDb();
  const campaign = db.prepare("SELECT dm_user_id FROM campaigns WHERE id=?").get(campaignId) as { dm_user_id: string } | undefined;
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.dm_user_id !== dmUserId) throw new Error("Only the DM can clear a rehearsal party.");
  const ghosts = ghostRows(campaignId);
  if (!ghosts.length) return { removed: 0 };
  const ghostIds = new Set(ghosts.map((row) => row.user_id));

  db.exec("BEGIN IMMEDIATE");
  try {
    const requests = db.prepare("SELECT id,target_user_ids FROM campaign_requests WHERE campaign_id=?").all(campaignId) as Array<{ id: string; target_user_ids: string }>;
    for (const request of requests) {
      const original = JSON.parse(request.target_user_ids) as string[];
      const remaining = original.filter((id) => !ghostIds.has(id));
      if (!remaining.length) db.prepare("DELETE FROM campaign_requests WHERE id=?").run(request.id);
      else if (remaining.length !== original.length) db.prepare("UPDATE campaign_requests SET target_user_ids=? WHERE id=?").run(JSON.stringify(remaining), request.id);
    }
    const placeholders = ghosts.map(() => "?").join(",");
    const ids = ghosts.map((row) => row.user_id);
    db.prepare(`DELETE FROM campaign_request_responses WHERE user_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM campaign_events WHERE campaign_id=? AND target_user_id IN (${placeholders})`).run(campaignId, ...ids);
    db.prepare(`DELETE FROM campaign_rolls WHERE campaign_id=? AND user_id IN (${placeholders})`).run(campaignId, ...ids);
    db.prepare(`DELETE FROM campaign_presence WHERE campaign_id=? AND user_id IN (${placeholders})`).run(campaignId, ...ids);

    const initiative = db.prepare("SELECT data FROM campaign_initiative WHERE campaign_id=?").get(campaignId) as { data: string } | undefined;
    if (initiative) {
      try {
        const parsed = JSON.parse(initiative.data) as { combatants?: Array<{ memberUserId?: string }>; turnIndex?: number; round?: number };
        const combatants = (parsed.combatants ?? []).filter((combatant) => !combatant.memberUserId || !ghostIds.has(combatant.memberUserId));
        db.prepare("UPDATE campaign_initiative SET data=?,version=version+1,updated_at=? WHERE campaign_id=?")
          .run(JSON.stringify({ ...parsed, combatants, turnIndex: Math.min(parsed.turnIndex ?? 0, Math.max(0, combatants.length - 1)) }), new Date().toISOString(), campaignId);
      } catch { /* malformed initiative is left untouched; the ghost rows still clear safely */ }
    }
    db.prepare(`DELETE FROM campaign_members WHERE campaign_id=? AND user_id IN (${placeholders})`).run(campaignId, ...ids);
    db.prepare(`DELETE FROM characters WHERE user_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { removed: ghosts.length };
}

function saveGhostResponse(campaignId: string, request: RequestRow, userId: string, input: { total?: number; passed?: boolean; summary: string }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO campaign_request_responses(request_id,user_id,status,total,passed,summary,responded_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(request_id,user_id) DO UPDATE SET status=excluded.status,total=excluded.total,passed=excluded.passed,summary=excluded.summary,responded_at=excluded.responded_at`)
    .run(request.id, userId, "completed", input.total ?? null, input.passed === undefined ? null : Number(input.passed), input.summary.slice(0, 240), now);
  const targets = JSON.parse(request.target_user_ids) as string[];
  const count = (db.prepare("SELECT COUNT(*) AS count FROM campaign_request_responses WHERE request_id=?").get(request.id) as { count: number }).count;
  if (count >= targets.length) db.prepare("UPDATE campaign_requests SET status='completed',resolved_at=? WHERE id=? AND status='open'").run(now, request.id);
}

function rollGhost(character: Character, payload: Record<string, unknown>) {
  const raced = applyRaceBonuses(character.abilities, character.raceId, ruleset);
  const feat = computeFeatBonuses(character.asiChoices);
  const abilities = { ...raced };
  for (const key of Object.keys(abilities) as Array<keyof typeof abilities>) abilities[key] += feat.abilityIncreases[key] ?? 0;
  const kind = typeof payload.kind === "string" ? payload.kind : "check";
  const keyType = payload.keyType === "skill" || kind === "skill" ? "skill" : "ability";
  const key = typeof payload.key === "string" ? payload.key : "dexterity";
  const pb = proficiencyBonus(character.level);
  let modifier = 0;
  if (kind === "initiative") modifier = abilityModifier(abilities.dexterity);
  else if (keyType === "skill") {
    const skill = SKILLS.find((item) => item.id === key);
    if (skill) {
      const proficient = new Set([...(character.skillProficiencies ?? []), ...(BACKGROUND_SKILLS[character.background] ?? [])]);
      modifier = abilityModifier(abilities[skill.ability]) + (proficient.has(key) ? pb : 0);
    }
  } else if (Object.prototype.hasOwnProperty.call(abilities, key)) {
    modifier = abilityModifier(abilities[key as keyof typeof abilities]);
    if (kind === "save" && character.savingThrowProficiencies?.includes(key as never)) modifier += pb;
  }
  const mode = combineRollModes(rollRequestMode(payload), effectiveAdvantageMode(character.effects));
  const rolls = mode === "normal" ? [Math.floor(Math.random() * 20) + 1] : [Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1];
  const d20 = mode === "advantage" ? Math.max(...rolls) : mode === "disadvantage" ? Math.min(...rolls) : rolls[0];
  return { total: d20 + modifier, detail: `${rolls.join(" / ")} + ${modifier} modifier${mode === "normal" ? "" : ` (${mode})`}` };
}

export function resolveRehearsalRequest(campaignId: string, requestId: string) {
  const db = getDb();
  const request = db.prepare("SELECT id,kind,target_user_ids,payload,status FROM campaign_requests WHERE id=? AND campaign_id=?").get(requestId, campaignId) as RequestRow | undefined;
  if (!request || request.status !== "open") return;
  const targets = new Set(JSON.parse(request.target_user_ids) as string[]);
  for (const ghost of ghostRows(campaignId)) {
    if (!targets.has(ghost.user_id)) continue;
    const character = ghostCharacter(ghost.user_id, ghost.character_id);
    if (!character) continue;
    const payload = JSON.parse(request.payload) as Record<string, unknown>;
    if (request.kind === "roll") {
      const outcome = rollGhost(character, payload);
      const dc = typeof payload.dc === "number" ? payload.dc : undefined;
      db.prepare("INSERT INTO campaign_rolls(id,campaign_id,user_id,character_name,label,detail,total,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(randomUUID(), campaignId, ghost.user_id, character.name, rollRequestDescriptor(payload), outcome.detail, outcome.total, new Date().toISOString());
      if (payload.kind === "initiative") {
        const initiative = db.prepare("SELECT data,version FROM campaign_initiative WHERE campaign_id=?").get(campaignId) as { data: string; version: number } | undefined;
        if (initiative) {
          const state = JSON.parse(initiative.data) as { combatants: Array<Record<string, unknown>>; turnIndex: number; round: number };
          const combatants = state.combatants.filter((combatant) => combatant.memberUserId !== ghost.user_id);
          combatants.push({ id: `player:${ghost.user_id}`, name: character.name, initiative: outcome.total, kind: "player", memberUserId: ghost.user_id, characterId: character.id });
          db.prepare("UPDATE campaign_initiative SET data=?,version=version+1,updated_at=? WHERE campaign_id=?")
            .run(JSON.stringify({ ...state, combatants }), new Date().toISOString(), campaignId);
        }
      }
      saveGhostResponse(campaignId, request, ghost.user_id, { total: outcome.total, ...(dc !== undefined ? { passed: outcome.total >= dc } : {}), summary: `${rollRequestDescriptor(payload)}: ${outcome.total}${dc !== undefined ? outcome.total >= dc ? " pass" : " fail" : ""}` });
    } else if (request.kind === "rest-long") {
      updateGhostCharacter(character, longRestRecovery(character).patch);
      saveGhostResponse(campaignId, request, ghost.user_id, { summary: "Long rest completed; HP, spell slots, and eligible resources restored." });
    } else {
      const featureResources = recoverFeatureResources(character, "short");
      updateGhostCharacter(character, { pactSlotsUsed: 0, ...(featureResources.changed ? { featureResources: featureResources.featureResources } : {}) });
      saveGhostResponse(campaignId, request, ghost.user_id, { summary: "Short rest acknowledged; short-rest resources restored." });
    }
  }
}

export function scheduleRehearsalRequest(campaignId: string, requestId: string) {
  if (!ghostRows(campaignId).length) return;
  setTimeout(() => { try { resolveRehearsalRequest(campaignId, requestId); } catch { /* rehearsal must never break the DM request */ } }, REHEARSAL_RESPONSE_DELAY_MS);
}

function applyGhostEvent(campaignId: string, eventId: string, type: CampaignEventType, targetUserId: string, payload: Record<string, unknown>) {
  const row = getDb().prepare("SELECT character_id FROM campaign_members WHERE campaign_id=? AND user_id=? AND is_ghost=1").get(campaignId, targetUserId) as { character_id: string | null } | undefined;
  if (!row?.character_id) return;
  const character = ghostCharacter(targetUserId, row.character_id);
  if (!character) return;
  if (type === "condition-apply" || type === "condition-remove") {
    const label = typeof payload.label === "string" ? payload.label.trim() : "";
    if (!label) return;
    const effects = character.effects ?? [];
    const nextEffects = type === "condition-apply"
      ? effects.some((effect) => effect.source === "DM" && effect.label.toLowerCase() === label.toLowerCase()) ? effects : [...effects, { ...(payload as Partial<CharacterEffect>), id: `dm-${eventId}`, label, source: "DM", active: true } as CharacterEffect]
      : effects.filter((effect) => !(effect.source === "DM" && effect.label.toLowerCase() === label.toLowerCase()));
    updateGhostCharacter(character, { effects: nextEffects });
  } else if (type === "concentration-end") {
    updateGhostCharacter(character, { concentratingOn: null });
  } else if (type === "death-save-update") {
    const action = typeof payload.action === "string" ? payload.action as DeathSaveAction : "reset";
    updateGhostCharacter(character, deathSavePatch(character, action, typeof payload.amount === "number" ? payload.amount : 0));
  } else if (type === "loot-offer") {
    const parcelId = typeof payload.parcelId === "string" ? payload.parcelId : "";
    const itemId = typeof payload.itemId === "string" ? payload.itemId : "";
    const parcelRow = getDb().prepare("SELECT data FROM campaign_loot_parcels WHERE id=? AND campaign_id=?").get(parcelId, campaignId) as { data: string } | undefined;
    if (!parcelRow) return;
    const parcel = JSON.parse(parcelRow.data) as { id: string; items: Array<{ id: string; name: string; quantity: number; description?: string; assignedUserId?: string; status: string }>; status: string; updatedAt: string };
    const item = parcel.items.find((entry) => entry.id === itemId);
    if (!item || item.assignedUserId !== targetUserId || item.status !== "offered") return;
    item.status = "accepted";
    parcel.status = parcel.items.every((entry) => entry.status === "accepted" || entry.status === "declined") ? "resolved" : "partially-assigned";
    parcel.updatedAt = new Date().toISOString();
    getDb().prepare("UPDATE campaign_loot_parcels SET data=?,updated_at=? WHERE id=? AND campaign_id=?").run(JSON.stringify(parcel), parcel.updatedAt, parcel.id, campaignId);
    const additions = Array.from({ length: Math.max(1, Math.min(99, item.quantity)) }, () => ({ id: randomUUID(), name: item.name, rarity: "Mundane", attunement: false, notes: "Accepted during rehearsal", ...(item.description ? { description: item.description } : {}) }));
    updateGhostCharacter(character, { inventory: [...character.inventory, ...additions] });
  }
}

export function scheduleRehearsalEvent(campaignId: string, eventId: string, type: CampaignEventType, targetUserId: string, payload: unknown) {
  if (!targetUserId) return;
  const ghost = getDb().prepare("SELECT 1 FROM campaign_members WHERE campaign_id=? AND user_id=? AND is_ghost=1").get(campaignId, targetUserId);
  if (!ghost) return;
  setTimeout(() => { try { applyGhostEvent(campaignId, eventId, type, targetUserId, (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>); } catch { /* rehearsal is best-effort */ } }, REHEARSAL_RESPONSE_DELAY_MS);
}
