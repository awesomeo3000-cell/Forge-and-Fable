import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { BUILT_IN_CREATURES, getBuiltInCreature } from "@/lib/builtInCreatures";
import { generateEncounter, type GenerateEncounterInput } from "@/lib/encounterGenerator";
import { syncCampaign } from "@/lib/campaignStore";
import { parseDiceFormula, rollFormula } from "@/lib/utils";
import type {
  CampaignHandout,
  CampaignJournalEntry,
  CampaignSession,
  CreatureFeature,
  CreatureLibraryRecord,
  EncounterPartyProfile,
  EncounterReminder,
  EncounterRun,
  EncounterWave,
  PlayerCampaignMemory,
  SavedEncounter,
  SessionSummary,
} from "@/types/dmTools";

const CREATURE_KINDS = new Set(["custom", "named-npc", "template", "hazard", "summon"]);
const HANDOUT_CATEGORIES = new Set(["location", "npc", "item", "letter", "clue", "map", "lore", "other"]);
const JOURNAL_TYPES = new Set(["session", "location", "npc", "faction", "quest", "lore", "item", "freeform"]);
const safeText = (value: unknown, max: number, fallback = "") =>
  typeof value === "string" ? value.trim().slice(0, max) : fallback;
const safeStringArray = (value: unknown, maxItems: number, maxLength = 40) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .slice(0, maxItems)
        .map((item) => item.trim().slice(0, maxLength))
    : [];
const safeInt = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : fallback;
const nowIso = () => new Date().toISOString();
const parseJson = <T>(value: string): T => JSON.parse(value) as T;

function transaction<T>(work: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function campaignRow(campaignId: string) {
  const row = getDb().prepare("SELECT id, dm_user_id FROM campaigns WHERE id = ?").get(campaignId) as
    { id: string; dm_user_id: string } | undefined;
  if (!row) throw new Error("Campaign not found.");
  return row;
}
function requireMember(campaignId: string, userId: string) {
  campaignRow(campaignId);
  const row = getDb()
    .prepare("SELECT 1 FROM campaign_members WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, userId);
  if (!row) throw new Error("Not a member of this campaign.");
}
function requireDm(campaignId: string, userId: string) {
  if (campaignRow(campaignId).dm_user_id !== userId) throw new Error("Only the DM can do that.");
}
function isDm(campaignId: string, userId: string) {
  return campaignRow(campaignId).dm_user_id === userId;
}

function sanitizeFeatures(value: unknown): CreatureFeature[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item) => {
    const source = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      name: safeText(source.name, 60, "Feature"),
      description: safeText(source.description, 1000),
      ...(typeof source.attackBonus === "number" ? { attackBonus: safeInt(source.attackBonus, -20, 30, 0) } : {}),
      ...(safeText(source.damage, 40) ? { damage: safeText(source.damage, 40) } : {}),
      ...(typeof source.averageDamage === "number" ? { averageDamage: safeInt(source.averageDamage, 0, 999, 0) } : {}),
    };
  });
}

export function sanitizeCreature(
  input: unknown,
  identity: { id: string; ownerUserId: string; campaignId?: string; createdAt: string },
): CreatureLibraryRecord {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Creature payload must be an object.");
  const raw = input as Record<string, unknown>;
  const name = safeText(raw.name, 80);
  if (!name) throw new Error("Creature name is required.");
  const kind =
    typeof raw.kind === "string" && CREATURE_KINDS.has(raw.kind)
      ? (raw.kind as CreatureLibraryRecord["kind"])
      : "custom";
  const armorClass = safeInt(raw.armorClass, 0, 40, 10);
  const hpInput = raw.hitPoints && typeof raw.hitPoints === "object" ? (raw.hitPoints as Record<string, unknown>) : {};
  const average = safeInt(hpInput.average, 1, 9999, 1);
  const formula = safeText(hpInput.formula, 40);
  if (formula && parseDiceFormula(formula).groups.length === 0)
    throw new Error("Hit point formula must contain dice, such as 2d8+4.");
  const url = safeText(raw.portraitUrl, 500);
  if (url && !/^https:\/\//i.test(url)) throw new Error("Portrait URL must use https.");
  const now = nowIso();
  return {
    id: identity.id,
    ownerUserId: identity.ownerUserId,
    ...(identity.campaignId ? { campaignId: identity.campaignId } : {}),
    kind,
    name,
    ...(safeText(raw.source, 60) ? { source: safeText(raw.source, 60) } : {}),
    tags: safeStringArray(raw.tags, 20),
    ...(safeText(raw.creatureType, 40) ? { creatureType: safeText(raw.creatureType, 40) } : {}),
    ...(safeText(raw.size, 20) ? { size: safeText(raw.size, 20) } : {}),
    ...(safeText(raw.alignment, 60) ? { alignment: safeText(raw.alignment, 60) } : {}),
    ...(typeof raw.challengeRating === "number"
      ? { challengeRating: Math.max(0, Math.min(30, raw.challengeRating)) }
      : {}),
    ...(typeof raw.experienceValue === "number" ? { experienceValue: safeInt(raw.experienceValue, 0, 200000, 0) } : {}),
    environments: safeStringArray(raw.environments, 20),
    armorClass,
    hitPoints: { average, ...(formula ? { formula } : {}) },
    ...(safeText(raw.speed, 120) ? { speed: safeText(raw.speed, 120) } : {}),
    ...(safeText(raw.savingThrows, 200) ? { savingThrows: safeText(raw.savingThrows, 200) } : {}),
    ...(safeText(raw.skills, 200) ? { skills: safeText(raw.skills, 200) } : {}),
    ...(safeText(raw.senses, 200) ? { senses: safeText(raw.senses, 200) } : {}),
    ...(safeText(raw.languages, 200) ? { languages: safeText(raw.languages, 200) } : {}),
    ...(typeof raw.passivePerception === "number"
      ? { passivePerception: safeInt(raw.passivePerception, 0, 40, 10) }
      : {}),
    ...Object.fromEntries(
      ["vulnerabilities", "resistances", "immunities", "conditionImmunities", "tacticsNotes", "privateNotes"].flatMap(
        (key) =>
          safeText(raw[key], key.endsWith("Notes") ? 2000 : 300)
            ? [[key, safeText(raw[key], key.endsWith("Notes") ? 2000 : 300)]]
            : [],
      ),
    ),
    traits: sanitizeFeatures(raw.traits),
    actions: sanitizeFeatures(raw.actions),
    bonusActions: sanitizeFeatures(raw.bonusActions),
    reactions: sanitizeFeatures(raw.reactions),
    legendaryActions: sanitizeFeatures(raw.legendaryActions),
    lairActions: sanitizeFeatures(raw.lairActions),
    ...(url ? { portraitUrl: url } : {}),
    archived: raw.archived === true,
    createdAt: identity.createdAt,
    updatedAt: now,
  } as CreatureLibraryRecord;
}

type CreatureFilters = {
  search?: string;
  campaignId?: string;
  custom?: boolean;
  builtIn?: boolean;
  type?: string;
  environment?: string;
  source?: string;
  tag?: string;
  minCr?: number;
  maxCr?: number;
  sort?: string;
  limit?: number;
  offset?: number;
};
export function listCreatures(userId: string, filters: CreatureFilters = {}) {
  if (filters.campaignId) requireMember(filters.campaignId, userId);
  const rows = getDb()
    .prepare(
      `SELECT data, owner_user_id, campaign_id FROM creature_library WHERE archived = 0 AND (owner_user_id = ? OR campaign_id IN (SELECT campaign_id FROM campaign_members WHERE user_id = ?))`,
    )
    .all(userId, userId) as Array<{ data: string; owner_user_id: string; campaign_id: string | null }>;
  const custom = rows.map((row) => {
    const record = parseJson<CreatureLibraryRecord>(row.data);
    return row.owner_user_id !== userId && row.campaign_id && !isDm(row.campaign_id, userId)
      ? { ...record, privateNotes: undefined }
      : record;
  });
  let records = [...(filters.custom ? [] : BUILT_IN_CREATURES), ...(filters.builtIn ? [] : custom)];
  const search = filters.search?.trim().toLowerCase();
  records = records.filter(
    (item) =>
      (!filters.campaignId || !item.campaignId || item.campaignId === filters.campaignId) &&
      (!search || `${item.name} ${item.source ?? ""} ${item.tags.join(" ")}`.toLowerCase().includes(search)) &&
      (!filters.type || item.creatureType === filters.type) &&
      (!filters.environment || item.environments?.includes(filters.environment)) &&
      (!filters.source || item.source === filters.source) &&
      (!filters.tag || item.tags.includes(filters.tag)) &&
      (filters.minCr === undefined || (item.challengeRating ?? 0) >= filters.minCr) &&
      (filters.maxCr === undefined || (item.challengeRating ?? 0) <= filters.maxCr),
  );
  records.sort(
    filters.sort === "cr"
      ? (a, b) => (a.challengeRating ?? 0) - (b.challengeRating ?? 0) || a.name.localeCompare(b.name)
      : filters.sort === "recent"
        ? (a, b) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt)
        : (a, b) => a.name.localeCompare(b.name),
  );
  const total = records.length,
    offset = Math.max(0, filters.offset ?? 0),
    limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  return { creatures: records.slice(offset, offset + limit), total };
}

export function getCreature(userId: string, id: string) {
  const builtIn = getBuiltInCreature(id);
  if (builtIn) return builtIn;
  const row = getDb()
    .prepare("SELECT data, owner_user_id, campaign_id FROM creature_library WHERE id = ? AND archived = 0")
    .get(id) as { data: string; owner_user_id: string; campaign_id: string | null } | undefined;
  if (!row) throw new Error("Creature not found.");
  if (row.owner_user_id !== userId && row.campaign_id) requireMember(row.campaign_id, userId);
  else if (row.owner_user_id !== userId) throw new Error("Creature not found.");
  const record = parseJson<CreatureLibraryRecord>(row.data);
  if (row.owner_user_id !== userId && row.campaign_id && !isDm(row.campaign_id, userId))
    return { ...record, privateNotes: undefined };
  return record;
}

export function createCreature(userId: string, input: unknown, campaignId?: string) {
  if (campaignId) requireDm(campaignId, userId);
  const createdAt = nowIso(),
    record = sanitizeCreature(input, {
      id: randomUUID(),
      ownerUserId: userId,
      ...(campaignId ? { campaignId } : {}),
      createdAt,
    });
  getDb()
    .prepare(
      "INSERT INTO creature_library (id, owner_user_id, campaign_id, kind, data, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      record.id,
      userId,
      campaignId ?? null,
      record.kind,
      JSON.stringify(record),
      record.archived ? 1 : 0,
      createdAt,
      record.updatedAt,
    );
  return record;
}
export function updateCreature(userId: string, id: string, input: unknown) {
  if (id.startsWith("builtin:")) throw new Error("Built-in creatures are immutable. Duplicate it first.");
  const row = getDb()
    .prepare("SELECT data,owner_user_id,campaign_id,created_at FROM creature_library WHERE id=?")
    .get(id) as { data: string; owner_user_id: string; campaign_id: string | null; created_at: string } | undefined;
  if (!row || row.owner_user_id !== userId) throw new Error("Creature not found.");
  if (row.campaign_id) requireDm(row.campaign_id, userId);
  const merged = {
    ...parseJson<CreatureLibraryRecord>(row.data),
    ...(input && typeof input === "object" ? input : {}),
  };
  const record = sanitizeCreature(merged, {
    id,
    ownerUserId: userId,
    ...(row.campaign_id ? { campaignId: row.campaign_id } : {}),
    createdAt: row.created_at,
  });
  getDb()
    .prepare("UPDATE creature_library SET kind=?,data=?,archived=?,updated_at=? WHERE id=?")
    .run(record.kind, JSON.stringify(record), record.archived ? 1 : 0, record.updatedAt, id);
  return record;
}
export function archiveCreature(userId: string, id: string) {
  return updateCreature(userId, id, { archived: true });
}
export function duplicateCreature(userId: string, id: string, campaignId?: string) {
  const source = getCreature(userId, id);
  return createCreature(
    userId,
    {
      ...source,
      id: undefined,
      name: `${source.name} Copy`,
      kind: "custom",
      archived: false,
      privateNotes: source.privateNotes ?? "",
    },
    campaignId,
  );
}

function sanitizeReminder(input: unknown): EncounterReminder | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>,
    label = safeText(raw.label, 120);
  if (!label) return null;
  const triggerRaw = raw.trigger && typeof raw.trigger === "object" ? (raw.trigger as Record<string, unknown>) : {};
  const type = typeof triggerRaw.type === "string" ? triggerRaw.type : "manual";
  const valid = new Set([
    "encounter-start",
    "round-start",
    "round-end",
    "turn-start",
    "turn-end",
    "initiative-count",
    "manual",
  ]);
  const triggerType = valid.has(type) ? type : "manual";
  const trigger: EncounterReminder["trigger"] =
    triggerType === "round-start" || triggerType === "round-end"
      ? {
          type: triggerType,
          ...(typeof triggerRaw.round === "number" ? { round: safeInt(triggerRaw.round, 1, 999, 1) } : {}),
        }
      : triggerType === "turn-start" || triggerType === "turn-end"
        ? { type: triggerType, combatantId: safeText(triggerRaw.combatantId, 80) }
        : triggerType === "initiative-count"
          ? { type: triggerType, count: safeInt(triggerRaw.count, -99, 99, 20) }
          : { type: triggerType as "encounter-start" | "manual" };
  return {
    id: safeText(raw.id, 80) || randomUUID(),
    label,
    ...(safeText(raw.details, 500) ? { details: safeText(raw.details, 500) } : {}),
    trigger,
    repeat: raw.repeat === true,
    completed: raw.completed === true,
    ...(typeof raw.snoozedUntilRound === "number"
      ? { snoozedUntilRound: safeInt(raw.snoozedUntilRound, 1, 999, 1) }
      : {}),
  };
}
function sanitizeWave(input: unknown): EncounterWave | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>,
    name = safeText(raw.name, 80);
  if (!name) return null;
  const t = raw.trigger && typeof raw.trigger === "object" ? (raw.trigger as Record<string, unknown>) : {};
  const trigger =
    t.type === "round-start"
      ? { type: "round-start" as const, round: safeInt(t.round, 1, 999, 2) }
      : t.type === "combatant-hp"
        ? {
            type: "combatant-hp" as const,
            combatantId: safeText(t.combatantId, 80),
            belowPercent: safeInt(t.belowPercent, 1, 99, 50),
          }
        : t.type === "combatant-defeated"
          ? { type: "combatant-defeated" as const, combatantId: safeText(t.combatantId, 80) }
        : { type: "manual" as const };
  return {
    id: safeText(raw.id, 80) || randomUUID(),
    name,
    trigger,
    combatantIds: safeStringArray(raw.combatantIds, 50, 80),
  };
}

export function sanitizeEncounter(
  input: unknown,
  identity: { id: string; ownerUserId: string; campaignId?: string; createdAt: string },
): SavedEncounter {
  if (!input || typeof input !== "object") throw new Error("Encounter payload must be an object.");
  const raw = input as Record<string, unknown>,
    name = safeText(raw.name, 100);
  if (!name) throw new Error("Encounter name is required.");
  const combatants = (Array.isArray(raw.combatants) ? raw.combatants : []).slice(0, 50).map((item) => {
    const c = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const hpMode = ["average", "roll", "custom"].includes(String(c.startingHpMode))
      ? (String(c.startingHpMode) as "average" | "roll" | "custom")
      : "average";
    const initMode = ["roll", "fixed", "group"].includes(String(c.initiativeMode))
      ? (String(c.initiativeMode) as "roll" | "fixed" | "group")
      : "roll";
    const visibility = [
      "hidden",
      "name-only",
      "name-and-conditions",
      "approximate-health",
      "exact-hp",
      "full-public",
    ].includes(String(c.visibility))
      ? (c.visibility as SavedEncounter["combatants"][number]["visibility"])
      : "name-only";
    return {
      id: safeText(c.id, 80) || randomUUID(),
      ...(safeText(c.creatureId, 80) ? { creatureId: safeText(c.creatureId, 80) } : {}),
      name: safeText(c.name, 80, "Combatant"),
      quantity: safeInt(c.quantity, 1, 50, 1),
      kind: ["enemy", "ally", "neutral", "hazard"].includes(String(c.kind))
        ? (c.kind as "enemy" | "ally" | "neutral" | "hazard")
        : "enemy",
      startingHpMode: hpMode,
      ...(typeof c.customStartingHp === "number" ? { customStartingHp: safeInt(c.customStartingHp, 1, 9999, 1) } : {}),
      ...(typeof c.armorClassOverride === "number"
        ? { armorClassOverride: safeInt(c.armorClassOverride, 0, 99, 10) }
        : {}),
      initiativeMode: initMode,
      ...(typeof c.fixedInitiative === "number" ? { fixedInitiative: safeInt(c.fixedInitiative, -99, 99, 0) } : {}),
      hidden: c.hidden === true,
      visibility,
      startingConditions: Array.isArray(c.startingConditions)
        ? c.startingConditions
            .slice(0, 20)
            .map((condition) => ({
              id: safeText((condition as Record<string, unknown>).id, 80) || randomUUID(),
              label: safeText((condition as Record<string, unknown>).label, 48, "Condition"),
            }))
        : [],
      ...(safeText(c.waveId, 80) ? { waveId: safeText(c.waveId, 80) } : {}),
      ...(safeText(c.privateNote, 200) ? { privateNote: safeText(c.privateNote, 200) } : {}),
    };
  });
  const now = nowIso();
  return {
    id: identity.id,
    ownerUserId: identity.ownerUserId,
    ...(identity.campaignId ? { campaignId: identity.campaignId } : {}),
    name,
    ...(safeText(raw.description, 500) ? { description: safeText(raw.description, 500) } : {}),
    status: ["draft", "ready", "archived"].includes(String(raw.status))
      ? (raw.status as SavedEncounter["status"])
      : "draft",
    origin: ["manual", "generated", "remixed"].includes(String(raw.origin))
      ? (raw.origin as SavedEncounter["origin"])
      : "manual",
    ...(safeText(raw.environment, 60) ? { environment: safeText(raw.environment, 60) } : {}),
    ...(safeText(raw.encounterType, 60) ? { encounterType: safeText(raw.encounterType, 60) } : {}),
    ...(["easy", "medium", "hard", "deadly", "custom"].includes(String(raw.difficulty))
      ? { difficulty: raw.difficulty as SavedEncounter["difficulty"] }
      : {}),
    ...Object.fromEntries(
      ["objective", "readAloud", "tactics", "environmentNotes", "developments", "loot", "privateNotes"].flatMap(
        (key) =>
          safeText(raw[key], key === "privateNotes" ? 4000 : 2000)
            ? [[key, safeText(raw[key], key === "privateNotes" ? 4000 : 2000)]]
            : [],
      ),
    ),
    combatants,
    waves: (Array.isArray(raw.waves) ? raw.waves : [])
      .slice(0, 10)
      .map(sanitizeWave)
      .filter((item): item is EncounterWave => Boolean(item)),
    reminders: (Array.isArray(raw.reminders) ? raw.reminders : [])
      .slice(0, 30)
      .map(sanitizeReminder)
      .filter((item): item is EncounterReminder => Boolean(item)),
    handoutIds: safeStringArray(raw.handoutIds, 50, 80),
    ...(raw.partySnapshot && typeof raw.partySnapshot === "object"
      ? { partySnapshot: raw.partySnapshot as SavedEncounter["partySnapshot"] }
      : {}),
    generatedWarnings: Array.isArray(raw.generatedWarnings)
      ? (raw.generatedWarnings.slice(0, 20) as SavedEncounter["generatedWarnings"])
      : [],
    createdAt: identity.createdAt,
    updatedAt: now,
  };
}

function encounterRow(userId: string, id: string) {
  const row = getDb().prepare("SELECT * FROM saved_encounters WHERE id=?").get(id) as
    { id: string; campaign_id: string | null; owner_user_id: string; data: string; created_at: string } | undefined;
  if (!row) throw new Error("Encounter not found.");
  if (row.campaign_id) requireDm(row.campaign_id, userId);
  else if (row.owner_user_id !== userId) throw new Error("Encounter not found.");
  return row;
}
export function listEncounters(userId: string, campaignId?: string) {
  if (campaignId) requireDm(campaignId, userId);
  const rows = getDb()
    .prepare(
      campaignId
        ? "SELECT data FROM saved_encounters WHERE campaign_id=? ORDER BY updated_at DESC"
        : "SELECT data FROM saved_encounters WHERE owner_user_id=? ORDER BY updated_at DESC",
    )
    .all(campaignId ?? userId) as Array<{ data: string }>;
  return rows.map((row) => parseJson<SavedEncounter>(row.data));
}
export function getEncounter(userId: string, id: string) {
  return parseJson<SavedEncounter>(encounterRow(userId, id).data);
}
export function createEncounter(userId: string, input: unknown, campaignId?: string) {
  if (campaignId) requireDm(campaignId, userId);
  const createdAt = nowIso(),
    record = sanitizeEncounter(input, {
      id: randomUUID(),
      ownerUserId: userId,
      ...(campaignId ? { campaignId } : {}),
      createdAt,
    });
  getDb()
    .prepare(
      "INSERT INTO saved_encounters(id,campaign_id,owner_user_id,status,origin,data,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      record.id,
      campaignId ?? null,
      userId,
      record.status,
      record.origin,
      JSON.stringify(record),
      createdAt,
      record.updatedAt,
    );
  return record;
}
export function updateEncounter(userId: string, id: string, input: unknown) {
  const row = encounterRow(userId, id),
    merged = { ...parseJson<SavedEncounter>(row.data), ...(input && typeof input === "object" ? input : {}) };
  const record = sanitizeEncounter(merged, {
    id,
    ownerUserId: row.owner_user_id,
    ...(row.campaign_id ? { campaignId: row.campaign_id } : {}),
    createdAt: row.created_at,
  });
  getDb()
    .prepare("UPDATE saved_encounters SET status=?,origin=?,data=?,updated_at=? WHERE id=?")
    .run(record.status, record.origin, JSON.stringify(record), record.updatedAt, id);
  return record;
}
export function deleteEncounter(userId: string, id: string) {
  encounterRow(userId, id);
  getDb().prepare("DELETE FROM saved_encounters WHERE id=?").run(id);
}
export function duplicateEncounter(userId: string, id: string) {
  const source = getEncounter(userId, id);
  return createEncounter(
    userId,
    { ...source, id: undefined, name: `${source.name} Copy`, origin: "remixed", status: "draft" },
    source.campaignId,
  );
}

export function getPartyProfile(campaignId: string, userId: string): EncounterPartyProfile {
  requireDm(campaignId, userId);
  const members = syncCampaign(campaignId, userId).members.filter((member) => member.characterId);
  const chars = members.flatMap((member) => (member.characterJson ? [member.characterJson] : []));
  const levels = members.flatMap((member) => (member.characterLevel ? [member.characterLevel] : [])),
    acs = members.flatMap((member) => (member.ac !== null ? [member.ac] : [])),
    hps = members.flatMap((member) => (member.maxHp !== null ? [member.maxHp] : [])),
    text = JSON.stringify(chars).toLowerCase();
  const cap = (tokens: string[]) => tokens.some((token) => text.includes(token));
  return {
    memberCount: members.length,
    levels,
    averageLevel: levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 1,
    averageArmorClass: acs.length ? acs.reduce((a, b) => a + b, 0) / acs.length : undefined,
    totalMaxHp: hps.reduce((a, b) => a + b, 0),
    averageMaxHp: hps.length ? hps.reduce((a, b) => a + b, 0) / hps.length : undefined,
    healingCapacity: cap(["cure wounds", "healing word", "lay on hands"]) ? "high" : "low",
    rangedCapacity: cap(["longbow", "shortbow", "eldritch blast", "fire bolt"]) ? "high" : "medium",
    controlCapacity: cap(["hold person", "web", "entangle"]) ? "high" : "low",
    areaDamageCapacity: cap(["fireball", "burning hands", "shatter"]) ? "high" : "low",
    hasFlight: cap(["fly", "flying speed"]),
    hasDarkvision: cap(["darkvision"]),
    knownDamageTypes: [],
    commonResistances: [],
    sourceCharacterIds: members.flatMap((member) => (member.characterId ? [member.characterId] : [])),
  };
}
export function generateCampaignEncounter(userId: string, input: GenerateEncounterInput) {
  requireDm(input.campaignId, userId);
  const party = getPartyProfile(input.campaignId, userId);
  const library = listCreatures(userId, { campaignId: input.campaignId, limit: 100 }).creatures;
  return generateEncounter(input, party, library, userId);
}

function resolveHp(template: SavedEncounter["combatants"][number], creature?: CreatureLibraryRecord) {
  if (template.startingHpMode === "custom") return template.customStartingHp ?? creature?.hitPoints.average ?? 1;
  if (template.startingHpMode === "roll" && creature?.hitPoints.formula) {
    const parsed = parseDiceFormula(creature.hitPoints.formula);
    const rolled = rollFormula(parsed);
    if (!rolled.error) return Math.max(1, rolled.total);
  }
  return creature?.hitPoints.average ?? template.customStartingHp ?? 1;
}
export function startEncounter(userId: string, id: string) {
  const encounter = getEncounter(userId, id);
  if (!encounter.campaignId) throw new Error("Assign this encounter to a campaign before starting it.");
  const campaignId = encounter.campaignId;
  requireDm(campaignId, userId);
  const active = getDb()
    .prepare("SELECT id FROM encounter_runs WHERE campaign_id=? AND status='active'")
    .get(campaignId);
  if (active) throw new Error("An encounter is already active. End or pause it first.");
  return transaction(() => {
    const combatants: unknown[] = [];
    for (const template of encounter.combatants.filter((item) => !item.waveId)) {
      const creature = template.creatureId ? getCreature(userId, template.creatureId) : undefined;
      const groupInitiative = template.initiativeMode === "group" ? Math.floor(Math.random() * 20) + 1 : undefined;
      for (let index = 0; index < template.quantity; index++) {
        const hp = resolveHp(template, creature);
        combatants.push({
          id: randomUUID(),
          name: template.quantity > 1 ? `${template.name} ${index + 1}` : template.name,
          initiative:
            template.initiativeMode === "fixed"
              ? (template.fixedInitiative ?? 10)
              : (groupInitiative ?? Math.floor(Math.random() * 20) + 1),
          kind: template.kind === "hazard" ? "neutral" : template.kind,
          currentHp: hp,
          maxHp: hp,
          ac: template.armorClassOverride ?? creature?.armorClass ?? 10,
          hidden: template.hidden,
          visibility: template.visibility ?? (template.hidden ? "hidden" : "name-only"),
          conditions: template.startingConditions ?? [],
          privateNote: template.privateNote,
          statBlock: creature
            ? {
                speed: creature.speed,
                saves: creature.savingThrows,
                senses: creature.senses,
                resistances: creature.resistances,
                immunities: creature.immunities,
                vulnerabilities: creature.vulnerabilities,
              }
            : undefined,
        });
      }
    }
    const initiativeRow = getDb()
      .prepare("SELECT version FROM campaign_initiative WHERE campaign_id=?")
      .get(campaignId) as { version: number } | undefined;
    const now = nowIso();
    getDb()
      .prepare(
        "INSERT INTO campaign_initiative(campaign_id,data,version,updated_at)VALUES(?,?,?,?) ON CONFLICT(campaign_id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at",
      )
      .run(campaignId, JSON.stringify({ combatants, turnIndex: 0, round: 1 }), (initiativeRow?.version ?? -1) + 1, now);
    const session = getDb()
      .prepare("SELECT id FROM campaign_sessions WHERE campaign_id=? AND status='active'")
      .get(campaignId) as { id: string } | undefined;
    const run: EncounterRun = {
      id: randomUUID(),
      campaignId,
      encounterId: id,
      ...(session ? { sessionId: session.id } : {}),
      status: "active",
      snapshot: structuredClone(encounter),
      reminders: structuredClone(encounter.reminders),
      readAloudRead: false,
      activatedWaveIds: [],
      startedAt: now,
    };
    getDb()
      .prepare(
        "INSERT INTO encounter_runs(id,campaign_id,encounter_id,session_id,status,snapshot_json,live_json,started_at)VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        run.id,
        campaignId,
        id,
        session?.id ?? null,
        "active",
        JSON.stringify(encounter),
        JSON.stringify({ reminders: run.reminders, readAloudRead: false, activatedWaveIds: [], cancelledWaveIds: [], postponedWaveIds: [] }),
        now,
      );
    getDb().prepare("UPDATE saved_encounters SET last_used_at=? WHERE id=?").run(now, id);
    insertAuditEvent(campaignId, userId, "encounter-started", { encounterId: id, runId: run.id, name: encounter.name });
    return run;
  });
}

function handoutFromRow(row: {
  data: string;
  shared: number;
  first_shared_at: string | null;
  last_shared_at: string | null;
  share_count: number;
  archived: number;
}) {
  const record = parseJson<CampaignHandout>(row.data);
  return {
    ...record,
    shared: Boolean(row.shared),
    ...(row.first_shared_at ? { firstSharedAt: row.first_shared_at } : {}),
    ...(row.last_shared_at ? { lastSharedAt: row.last_shared_at } : {}),
    shareCount: row.share_count,
    archived: Boolean(row.archived),
  };
}
function sanitizeHandout(
  input: unknown,
  identity: { id: string; campaignId: string; ownerUserId: string; createdAt: string },
): CampaignHandout {
  if (!input || typeof input !== "object") throw new Error("Handout payload must be an object.");
  const raw = input as Record<string, unknown>,
    title = safeText(raw.title, 100);
  if (!title) throw new Error("Handout title is required.");
  const type = ["image", "document", "url", "text"].includes(String(raw.assetType))
    ? (raw.assetType as CampaignHandout["assetType"])
    : "image";
  const url = safeText(raw.assetUrl, 500);
  if (url && !/^https:\/\//i.test(url)) throw new Error("Handout URL must use https.");
  return {
    id: identity.id,
    campaignId: identity.campaignId,
    ownerUserId: identity.ownerUserId,
    title,
    category: HANDOUT_CATEGORIES.has(String(raw.category)) ? (raw.category as CampaignHandout["category"]) : "other",
    ...(safeText(raw.description, 500) ? { description: safeText(raw.description, 500) } : {}),
    ...(safeText(raw.privateNotes, 2000) ? { privateNotes: safeText(raw.privateNotes, 2000) } : {}),
    tags: safeStringArray(raw.tags, 20),
    assetType: type,
    ...(url ? { assetUrl: url } : {}),
    ...(safeText(raw.body, 10000) ? { body: safeText(raw.body, 10000) } : {}),
    shared: false,
    shareCount: 0,
    createdAt: identity.createdAt,
    updatedAt: nowIso(),
  };
}
export function listHandouts(campaignId: string, userId: string) {
  requireMember(campaignId, userId);
  const dm = isDm(campaignId, userId);
  const rows = getDb()
    .prepare(
      dm
        ? "SELECT * FROM campaign_handouts WHERE campaign_id=? AND archived=0 ORDER BY updated_at DESC"
        : "SELECT * FROM campaign_handouts WHERE campaign_id=? AND shared=1 AND archived=0 ORDER BY last_shared_at DESC",
    )
    .all(campaignId) as Array<{
    data: string;
    shared: number;
    first_shared_at: string | null;
    last_shared_at: string | null;
    share_count: number;
    archived: number;
  }>;
  return rows.map(handoutFromRow).map((item) => (dm ? item : { ...item, privateNotes: undefined }));
}
export function createHandout(campaignId: string, userId: string, input: unknown) {
  requireDm(campaignId, userId);
  const createdAt = nowIso(),
    record = sanitizeHandout(input, { id: randomUUID(), campaignId, ownerUserId: userId, createdAt });
  getDb()
    .prepare(
      "INSERT INTO campaign_handouts(id,campaign_id,owner_user_id,data,created_at,updated_at)VALUES(?,?,?,?,?,?)",
    )
    .run(record.id, campaignId, userId, JSON.stringify(record), createdAt, record.updatedAt);
  return record;
}
export function updateHandout(campaignId: string, userId: string, id: string, input: unknown) {
  requireDm(campaignId, userId);
  const row = getDb()
    .prepare(
      "SELECT data,created_at,shared,first_shared_at,last_shared_at,share_count,archived FROM campaign_handouts WHERE id=? AND campaign_id=?",
    )
    .get(id, campaignId) as
    | {
        data: string;
        created_at: string;
        shared: number;
        first_shared_at: string | null;
        last_shared_at: string | null;
        share_count: number;
        archived: number;
      }
    | undefined;
  if (!row) throw new Error("Handout not found.");
  const record = sanitizeHandout(
    { ...parseJson<CampaignHandout>(row.data), ...(input && typeof input === "object" ? input : {}) },
    { id, campaignId, ownerUserId: userId, createdAt: row.created_at },
  );
  const archived = (input as Record<string, unknown>)?.archived === true;
  getDb()
    .prepare("UPDATE campaign_handouts SET data=?,archived=?,updated_at=? WHERE id=?")
    .run(JSON.stringify({ ...record, archived }), archived ? 1 : 0, record.updatedAt, id);
  return {
    ...record,
    shared: Boolean(row.shared),
    firstSharedAt: row.first_shared_at ?? undefined,
    lastSharedAt: row.last_shared_at ?? undefined,
    shareCount: row.share_count,
    archived,
  };
}
export function archiveHandout(campaignId: string, userId: string, id: string) {
  return updateHandout(campaignId, userId, id, { archived: true });
}
export function shareHandout(campaignId: string, userId: string, id: string) {
  requireDm(campaignId, userId);
  return transaction(() => {
    const row = getDb()
      .prepare("SELECT * FROM campaign_handouts WHERE id=? AND campaign_id=? AND archived=0")
      .get(id, campaignId) as
      | {
          data: string;
          shared: number;
          first_shared_at: string | null;
          last_shared_at: string | null;
          share_count: number;
          archived: number;
        }
      | undefined;
    if (!row) throw new Error("Handout not found.");
    const record = handoutFromRow(row),
      now = nowIso();
    getDb()
      .prepare(
        "UPDATE campaign_handouts SET shared=1,first_shared_at=COALESCE(first_shared_at,?),last_shared_at=?,share_count=share_count+1,updated_at=? WHERE id=?",
      )
      .run(now, now, now, id);
    insertEvent(campaignId, userId, "handout", {
      handoutId: id,
      title: record.title,
      url: record.assetUrl,
      body: record.body,
      assetType: record.assetType,
    });
    return {
      ...record,
      shared: true,
      firstSharedAt: record.firstSharedAt ?? now,
      lastSharedAt: now,
      shareCount: record.shareCount + 1,
    };
  });
}

function sanitizeJournal(
  input: unknown,
  identity: { id: string; campaignId: string; ownerUserId: string; createdAt: string },
): CampaignJournalEntry {
  if (!input || typeof input !== "object") throw new Error("Journal payload must be an object.");
  const raw = input as Record<string, unknown>,
    title = safeText(raw.title, 120);
  if (!title) throw new Error("Journal title is required.");
  return {
    id: identity.id,
    campaignId: identity.campaignId,
    ownerUserId: identity.ownerUserId,
    title,
    type: JOURNAL_TYPES.has(String(raw.type)) ? (raw.type as CampaignJournalEntry["type"]) : "freeform",
    body: safeText(raw.body, 20000),
    tags: safeStringArray(raw.tags, 20),
    visibility: raw.visibility === "players" ? "players" : "dm-private",
    status: ["active", "completed", "archived"].includes(String(raw.status))
      ? (raw.status as CampaignJournalEntry["status"])
      : "active",
    relatedEntryIds: safeStringArray(raw.relatedEntryIds, 100, 80),
    relatedHandoutIds: safeStringArray(raw.relatedHandoutIds, 100, 80),
    relatedEncounterIds: safeStringArray(raw.relatedEncounterIds, 100, 80),
    relatedSessionIds: safeStringArray(raw.relatedSessionIds, 100, 80),
    createdAt: identity.createdAt,
    updatedAt: nowIso(),
  };
}
export function listJournal(campaignId: string, userId: string) {
  requireMember(campaignId, userId);
  const dm = isDm(campaignId, userId);
  const rows = getDb()
    .prepare(
      dm
        ? "SELECT data FROM campaign_journal_entries WHERE campaign_id=? ORDER BY updated_at DESC"
        : "SELECT data FROM campaign_journal_entries WHERE campaign_id=? AND visibility='players' AND status!='archived' ORDER BY updated_at DESC",
    )
    .all(campaignId) as Array<{ data: string }>;
  return rows.map((row) => parseJson<CampaignJournalEntry>(row.data));
}
export function createJournalEntry(campaignId: string, userId: string, input: unknown) {
  requireDm(campaignId, userId);
  const createdAt = nowIso(),
    record = sanitizeJournal(input, { id: randomUUID(), campaignId, ownerUserId: userId, createdAt });
  getDb()
    .prepare(
      "INSERT INTO campaign_journal_entries(id,campaign_id,owner_user_id,entry_type,visibility,status,data,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .run(
      record.id,
      campaignId,
      userId,
      record.type,
      record.visibility,
      record.status,
      JSON.stringify(record),
      createdAt,
      record.updatedAt,
    );
  return record;
}
export function updateJournalEntry(campaignId: string, userId: string, id: string, input: unknown) {
  requireDm(campaignId, userId);
  const row = getDb()
    .prepare("SELECT data,created_at FROM campaign_journal_entries WHERE id=? AND campaign_id=?")
    .get(id, campaignId) as { data: string; created_at: string } | undefined;
  if (!row) throw new Error("Journal entry not found.");
  const record = sanitizeJournal(
    { ...parseJson<CampaignJournalEntry>(row.data), ...(input && typeof input === "object" ? input : {}) },
    { id, campaignId, ownerUserId: userId, createdAt: row.created_at },
  );
  getDb()
    .prepare("UPDATE campaign_journal_entries SET entry_type=?,visibility=?,status=?,data=?,updated_at=? WHERE id=?")
    .run(record.type, record.visibility, record.status, JSON.stringify(record), record.updatedAt, id);
  return record;
}

function sessionFromRow(row: {
  id: string;
  campaign_id: string;
  session_number: number | null;
  title: string | null;
  started_at: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  ended_at: string | null;
  status: "scheduled" | "active" | "completed";
  dm_notes: string | null;
  summary_json: string | null;
  published_journal_entry_id: string | null;
}): CampaignSession {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ...(row.session_number ? { number: row.session_number } : {}),
    ...(row.title ? { title: row.title } : {}),
    startedAt: row.started_at,
    ...(row.scheduled_at ? { scheduledAt: row.scheduled_at } : {}),
    ...(row.duration_minutes ? { durationMinutes: row.duration_minutes } : {}),
    ...(row.location ? { location: row.location } : {}),
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    status: row.status,
    ...(row.dm_notes ? { dmNotes: row.dm_notes } : {}),
    ...(row.summary_json ? { summaryDraft: parseJson<SessionSummary>(row.summary_json) } : {}),
    ...(row.published_journal_entry_id ? { publishedJournalEntryId: row.published_journal_entry_id } : {}),
  };
}
export function listSessions(campaignId: string, userId: string) {
  requireMember(campaignId, userId);
  const rows = getDb()
    .prepare("SELECT * FROM campaign_sessions WHERE campaign_id=? ORDER BY COALESCE(scheduled_at, started_at) DESC")
    .all(campaignId) as Parameters<typeof sessionFromRow>[0][];
  return rows
    .map(sessionFromRow)
    .map((session) =>
      isDm(campaignId, userId)
        ? session
        : {
            id: session.id,
            campaignId: session.campaignId,
            number: session.number,
            title: session.title,
            startedAt: session.startedAt,
            scheduledAt: session.scheduledAt,
            durationMinutes: session.durationMinutes,
            location: session.location,
            endedAt: session.endedAt,
            status: session.status,
            publishedJournalEntryId: session.publishedJournalEntryId,
          },
    );
}

function parseScheduledAt(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Choose a date and time for the session.");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Choose a valid date and time for the session.");
  if (parsed.getTime() <= Date.now()) throw new Error("A scheduled session must be in the future.");
  return parsed.toISOString();
}

export function scheduleSession(
  campaignId: string,
  userId: string,
  input: { title?: unknown; scheduledAt?: unknown; durationMinutes?: unknown; location?: unknown; dmNotes?: unknown },
) {
  requireDm(campaignId, userId);
  return transaction(() => {
    const scheduledAt = parseScheduledAt(input.scheduledAt);
    const count = (getDb().prepare("SELECT COUNT(*) AS count FROM campaign_sessions WHERE campaign_id=?").get(campaignId) as { count: number }).count;
    return insertScheduledSession(campaignId, count + 1, scheduledAt, input);
  });
}

function insertScheduledSession(
  campaignId: string,
  number: number,
  scheduledAt: string,
  input: { title?: unknown; durationMinutes?: unknown; location?: unknown; dmNotes?: unknown },
  titleOverride?: string,
) {
  const location = safeText(input.location, 160);
  const dmNotes = safeText(input.dmNotes, 4000);
  const session: CampaignSession = {
    id: randomUUID(),
    campaignId,
    number,
    title: titleOverride ?? (safeText(input.title, 100) || `Session ${number}`),
    startedAt: scheduledAt,
    scheduledAt,
    durationMinutes: safeInt(input.durationMinutes, 30, 720, 180),
    ...(location ? { location } : {}),
    status: "scheduled",
    ...(dmNotes ? { dmNotes } : {}),
  };
  getDb()
    .prepare("INSERT INTO campaign_sessions(id,campaign_id,session_number,title,started_at,scheduled_at,duration_minutes,location,status,dm_notes)VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(session.id, campaignId, session.number, session.title, session.startedAt, session.scheduledAt, session.durationMinutes, session.location ?? null, session.status, session.dmNotes ?? null);
  return session;
}

export function scheduleSessions(
  campaignId: string,
  userId: string,
  input: { title?: unknown; scheduledAts?: unknown; durationMinutes?: unknown; location?: unknown; dmNotes?: unknown },
) {
  requireDm(campaignId, userId);
  return transaction(() => {
    if (!Array.isArray(input.scheduledAts) || input.scheduledAts.length < 2) throw new Error("Choose at least two dates for a recurring series.");
    if (input.scheduledAts.length > 24) throw new Error("A recurring series can contain at most 24 sessions.");
    const scheduledAts = input.scheduledAts.map(parseScheduledAt);
    if (new Set(scheduledAts).size !== scheduledAts.length) throw new Error("Each recurring session needs a different date and time.");
    const count = (getDb().prepare("SELECT COUNT(*) AS count FROM campaign_sessions WHERE campaign_id=?").get(campaignId) as { count: number }).count;
    const title = safeText(input.title, 100);
    return scheduledAts.map((scheduledAt, index) =>
      insertScheduledSession(campaignId, count + index + 1, scheduledAt, input, title ? `${title} · Session ${index + 1}`.slice(0, 100) : undefined),
    );
  });
}

export function activateSession(campaignId: string, userId: string, id: string) {
  requireDm(campaignId, userId);
  return transaction(() => {
    if (getDb().prepare("SELECT 1 FROM campaign_sessions WHERE campaign_id=? AND status='active'").get(campaignId))
      throw new Error("A session is already active.");
    const row = getDb().prepare("SELECT * FROM campaign_sessions WHERE id=? AND campaign_id=? AND status='scheduled'").get(id, campaignId) as Parameters<typeof sessionFromRow>[0] | undefined;
    if (!row) throw new Error("Scheduled session not found.");
    const startedAt = nowIso();
    getDb().prepare("UPDATE campaign_sessions SET started_at=?,status='active' WHERE id=?").run(startedAt, id);
    return sessionFromRow({ ...row, started_at: startedAt, status: "active" });
  });
}
export function renameSession(campaignId: string, userId: string, id: string, input: { title?: unknown }) {
  requireDm(campaignId, userId);
  return transaction(() => {
    const row = getDb().prepare("SELECT * FROM campaign_sessions WHERE id=? AND campaign_id=?").get(id, campaignId) as Parameters<typeof sessionFromRow>[0] | undefined;
    if (!row) throw new Error("Session not found.");
    const title = safeText(input.title, 100);
    if (!title) throw new Error("A session title is required.");
    getDb().prepare("UPDATE campaign_sessions SET title=? WHERE id=?").run(title, id);
    insertAuditEvent(campaignId, userId, "session-renamed", { sessionId: id, title });
    return sessionFromRow({ ...row, title });
  });
}

export function startSession(campaignId: string, userId: string, input: { title?: unknown; dmNotes?: unknown }) {
  requireDm(campaignId, userId);
  return transaction(() => {
    if (getDb().prepare("SELECT 1 FROM campaign_sessions WHERE campaign_id=? AND status='active'").get(campaignId))
      throw new Error("A session is already active.");
    const count = (
      getDb().prepare("SELECT COUNT(*) AS count FROM campaign_sessions WHERE campaign_id=?").get(campaignId) as {
        count: number;
      }
    ).count;
    const session: CampaignSession = {
      id: randomUUID(),
      campaignId,
      number: count + 1,
      title: safeText(input.title, 100) || `Session ${count + 1}`,
      startedAt: nowIso(),
      status: "active",
      ...(safeText(input.dmNotes, 4000) ? { dmNotes: safeText(input.dmNotes, 4000) } : {}),
    };
    getDb()
      .prepare(
        "INSERT INTO campaign_sessions(id,campaign_id,session_number,title,started_at,status,dm_notes)VALUES(?,?,?,?,?,'active',?)",
      )
      .run(session.id, campaignId, session.number, session.title, session.startedAt, session.dmNotes ?? null);
    insertAuditEvent(campaignId, userId, "session-started", { sessionId: session.id, title: session.title });
    return session;
  });
}
function buildSummary(campaignId: string, session: CampaignSession): SessionSummary {
  const pins = getDb()
    .prepare("SELECT note,event_id FROM session_pins WHERE session_id=? ORDER BY created_at")
    .all(session.id) as Array<{ note: string | null; event_id: string | null }>;
  const events = getDb()
    .prepare(
      "SELECT type,payload FROM campaign_events WHERE campaign_id=? AND created_at>=? AND created_at<=? ORDER BY created_at",
    )
    .all(campaignId, session.startedAt, session.endedAt ?? nowIso()) as Array<{ type: string; payload: string }>;
  const majorEvents = [
    ...pins.map((pin) => pin.note).filter((note): note is string => Boolean(note)),
    ...events
      .filter((event) =>
        ["announce", "rest-short", "rest-long", "encounter-started", "encounter-ended"].includes(event.type),
      )
      .map((event) => {
        const payload = parseJson<Record<string, unknown>>(event.payload);
        return safeText(payload.message ?? payload.name, 200) || event.type.replaceAll("-", " ");
      }),
  ].slice(0, 30);
  return {
    title: session.title ?? `Session ${session.number ?? ""}`,
    playedAt: session.startedAt,
    recap: majorEvents.length
      ? majorEvents.join(" ")
      : "The table's important events are ready for the DM to edit into a recap.",
    majorEvents,
    discoveries: [],
    npcsEncountered: [],
    combatResults: events
      .filter((event) => event.type === "encounter-ended")
      .map((event) => safeText(parseJson<Record<string, unknown>>(event.payload).name, 100, "Encounter resolved")),
    lootAndRewards: [],
    openQuestions: [],
    nextSessionHooks: [],
  };
}
export function endSession(campaignId: string, userId: string, id: string) {
  requireDm(campaignId, userId);
  return transaction(() => {
    const row = getDb()
      .prepare("SELECT * FROM campaign_sessions WHERE id=? AND campaign_id=? AND status='active'")
      .get(id, campaignId) as Parameters<typeof sessionFromRow>[0] | undefined;
    if (!row) throw new Error("Active session not found.");
    const endedAt = nowIso(),
      base = sessionFromRow({ ...row, ended_at: endedAt, status: "completed" }),
      summary = buildSummary(campaignId, base);
    getDb()
      .prepare("UPDATE campaign_sessions SET ended_at=?,status='completed',summary_json=? WHERE id=?")
      .run(endedAt, JSON.stringify(summary), id);
    insertAuditEvent(campaignId, userId, "session-ended", { sessionId: id, title: base.title });
    return { ...base, summaryDraft: summary };
  });
}
export function saveSessionSummary(campaignId: string, userId: string, id: string, summary: unknown) {
  requireDm(campaignId, userId);
  const row = getDb().prepare("SELECT * FROM campaign_sessions WHERE id=? AND campaign_id=?").get(id, campaignId) as
    Parameters<typeof sessionFromRow>[0] | undefined;
  if (!row) throw new Error("Session not found.");
  const raw = summary && typeof summary === "object" ? (summary as Record<string, unknown>) : {};
  const clean: SessionSummary = {
    title: safeText(raw.title, 120, row.title ?? "Session recap"),
    playedAt: safeText(raw.playedAt, 40, row.started_at),
    recap: safeText(raw.recap, 10000),
    majorEvents: safeStringArray(raw.majorEvents, 50, 500),
    discoveries: safeStringArray(raw.discoveries, 50, 500),
    npcsEncountered: safeStringArray(raw.npcsEncountered, 50, 200),
    combatResults: safeStringArray(raw.combatResults, 50, 500),
    lootAndRewards: safeStringArray(raw.lootAndRewards, 50, 500),
    openQuestions: safeStringArray(raw.openQuestions, 50, 500),
    nextSessionHooks: safeStringArray(raw.nextSessionHooks, 50, 500),
  };
  getDb().prepare("UPDATE campaign_sessions SET summary_json=? WHERE id=?").run(JSON.stringify(clean), id);
  return clean;
}
export function publishSessionSummary(campaignId: string, userId: string, id: string) {
  requireDm(campaignId, userId);
  return transaction(() => {
    const row = getDb().prepare("SELECT * FROM campaign_sessions WHERE id=? AND campaign_id=?").get(id, campaignId) as
      Parameters<typeof sessionFromRow>[0] | undefined;
    if (!row || !row.summary_json) throw new Error("Save a summary draft before publishing.");
    const summary = parseJson<SessionSummary>(row.summary_json),
      entry = createJournalEntry(campaignId, userId, {
        title: summary.title,
        type: "session",
        body: summary.recap,
        tags: ["session-recap"],
        visibility: "players",
        status: "completed",
        relatedSessionIds: [id],
      });
    getDb().prepare("UPDATE campaign_sessions SET published_journal_entry_id=? WHERE id=?").run(entry.id, id);
    insertAuditEvent(campaignId, userId, "summary-published", {
      sessionId: id,
      journalEntryId: entry.id,
      title: entry.title,
    });
    return entry;
  });
}
export function pinSessionItem(
  campaignId: string,
  userId: string,
  sessionId: string,
  input: { eventId?: unknown; note?: unknown },
) {
  requireDm(campaignId, userId);
  if (!getDb().prepare("SELECT 1 FROM campaign_sessions WHERE id=? AND campaign_id=?").get(sessionId, campaignId))
    throw new Error("Session not found.");
  const eventId = safeText(input.eventId, 80),
    note = safeText(input.note, 500);
  if (!eventId && !note) throw new Error("A pin needs an event or note.");
  const pin = { id: randomUUID(), sessionId, eventId: eventId || null, note: note || null, createdAt: nowIso() };
  getDb()
    .prepare("INSERT INTO session_pins(id,session_id,event_id,note,created_at)VALUES(?,?,?,?,?)")
    .run(pin.id, sessionId, pin.eventId, pin.note, pin.createdAt);
  return pin;
}

export function listSessionPins(campaignId: string, userId: string, sessionId: string) {
  requireDm(campaignId, userId);
  if (!getDb().prepare("SELECT 1 FROM campaign_sessions WHERE id=? AND campaign_id=?").get(sessionId, campaignId))
    throw new Error("Session not found.");
  const rows = getDb()
    .prepare("SELECT id,session_id,event_id,note,created_at FROM session_pins WHERE session_id=? ORDER BY created_at")
    .all(sessionId) as Array<{ id: string; session_id: string; event_id: string | null; note: string | null; created_at: string }>;
  return rows.map((row) => ({ id: row.id, sessionId: row.session_id, eventId: row.event_id, note: row.note, createdAt: row.created_at }));
}

export function activeWorkspace(campaignId: string, userId: string) {
  requireMember(campaignId, userId);
  const dm = isDm(campaignId, userId);
  const sessionRow = getDb()
    .prepare("SELECT * FROM campaign_sessions WHERE campaign_id=? AND status='active' ORDER BY started_at DESC LIMIT 1")
    .get(campaignId) as Parameters<typeof sessionFromRow>[0] | undefined;
  const runRow = getDb()
    .prepare("SELECT * FROM encounter_runs WHERE campaign_id=? AND status IN ('active','paused') ORDER BY started_at DESC LIMIT 1")
    .get(campaignId) as
    | {
        id: string;
        campaign_id: string;
        encounter_id: string | null;
        session_id: string | null;
        status: "active" | "paused";
        snapshot_json: string;
        live_json: string;
        started_at: string;
        ended_at: null;
      }
    | undefined;
  const session = sessionRow ? sessionFromRow(sessionRow) : null;
  let run: EncounterRun | null = null;
  if (runRow) {
    const snapshot = parseJson<SavedEncounter>(runRow.snapshot_json),
      live = parseJson<{ reminders: EncounterReminder[]; readAloudRead?: boolean; activatedWaveIds?: string[]; cancelledWaveIds?: string[]; postponedWaveIds?: string[] }>(
        runRow.live_json,
      );
    run = {
      id: runRow.id,
      campaignId,
      ...(runRow.encounter_id ? { encounterId: runRow.encounter_id } : {}),
      ...(runRow.session_id ? { sessionId: runRow.session_id } : {}),
      status: runRow.status,
      snapshot: dm
        ? snapshot
        : {
            ...snapshot,
            privateNotes: undefined,
            tactics: undefined,
            developments: undefined,
            generatedWarnings: undefined,
            reminders: [],
            combatants: [],
          },
      reminders: dm ? live.reminders : [],
      readAloudRead: dm ? live.readAloudRead : undefined,
      activatedWaveIds: dm ? live.activatedWaveIds : undefined,
      cancelledWaveIds: dm ? live.cancelledWaveIds : undefined,
      postponedWaveIds: dm ? live.postponedWaveIds : undefined,
      startedAt: runRow.started_at,
    };
  }
  return {
    activeSession: session
      ? dm
        ? session
        : {
            id: session.id,
            campaignId,
            number: session.number,
            title: session.title,
            startedAt: session.startedAt,
            status: session.status,
          }
      : null,
    activeEncounter: run,
  };
}
function waveCombatants(snapshot: SavedEncounter, waveId: string, userId: string) {
  const result: Record<string, unknown>[] = [];
  for (const template of snapshot.combatants.filter((item) => item.waveId === waveId)) {
    const creature = template.creatureId ? getCreature(userId, template.creatureId) : undefined,
      group = template.initiativeMode === "group" ? Math.floor(Math.random() * 20) + 1 : undefined;
    for (let index = 0; index < template.quantity; index++) {
      const hp = resolveHp(template, creature);
      result.push({
        id: randomUUID(),
        name: template.quantity > 1 ? `${template.name} ${index + 1}` : template.name,
        initiative:
          template.initiativeMode === "fixed"
            ? (template.fixedInitiative ?? 10)
            : (group ?? Math.floor(Math.random() * 20) + 1),
        kind: template.kind === "hazard" ? "neutral" : template.kind,
        currentHp: hp,
        maxHp: hp,
        ac: template.armorClassOverride ?? creature?.armorClass ?? 10,
        hidden: template.hidden,
        visibility: template.visibility ?? (template.hidden ? "hidden" : "name-only"),
        conditions: template.startingConditions ?? [],
        privateNote: template.privateNote,
      });
    }
  }
  return result;
}
export function updateEncounterRun(
  campaignId: string,
  userId: string,
  id: string,
  input: { action?: unknown; waveId?: unknown; reminders?: unknown; readAloudRead?: unknown },
) {
  requireDm(campaignId, userId);
  const row = getDb().prepare("SELECT * FROM encounter_runs WHERE id=? AND campaign_id=?").get(id, campaignId) as
    { snapshot_json: string; live_json: string; status: string } | undefined;
  if (!row) throw new Error("Encounter run not found.");
  if (input.action === "end")
    return transaction(() => {
      const snapshot = parseJson<SavedEncounter>(row.snapshot_json),
        endedAt = nowIso();
      getDb().prepare("UPDATE encounter_runs SET status='completed',ended_at=? WHERE id=?").run(endedAt, id);
      insertAuditEvent(campaignId, userId, "encounter-ended", { runId: id, name: snapshot.name });
      return { ok: true, endedAt };
    });
  if (input.action === "pause" || input.action === "resume") {
    const status = input.action === "pause" ? "paused" : "active";
    getDb().prepare("UPDATE encounter_runs SET status=? WHERE id=?").run(status, id);
    return { ok: true, status };
  }
  const live = parseJson<{ reminders: EncounterReminder[]; readAloudRead?: boolean; activatedWaveIds?: string[]; cancelledWaveIds?: string[]; postponedWaveIds?: string[] }>(
    row.live_json,
  );
  if (input.action === "activate-wave") {
    const waveId = safeText(input.waveId, 80);
    if (!waveId || live.activatedWaveIds?.includes(waveId)) throw new Error("Wave is missing or already active.");
    const snapshot = parseJson<SavedEncounter>(row.snapshot_json),
      wave = snapshot.waves.find((item) => item.id === waveId);
    if (!wave) throw new Error("Wave not found.");
    return transaction(() => {
      const initiative = getDb()
        .prepare("SELECT data,version FROM campaign_initiative WHERE campaign_id=?")
        .get(campaignId) as { data: string; version: number };
      const state = parseJson<{ combatants: unknown[]; turnIndex: number; round: number }>(initiative.data);
      state.combatants.push(...waveCombatants(snapshot, waveId, userId));
      getDb()
        .prepare("UPDATE campaign_initiative SET data=?,version=?,updated_at=? WHERE campaign_id=?")
        .run(JSON.stringify(state), initiative.version + 1, nowIso(), campaignId);
      live.activatedWaveIds = [...(live.activatedWaveIds ?? []), waveId];
      getDb().prepare("UPDATE encounter_runs SET live_json=? WHERE id=?").run(JSON.stringify(live), id);
      insertAuditEvent(campaignId, userId, "encounter-wave", { runId: id, waveId, name: wave.name });
      return { ok: true, activatedWaveIds: live.activatedWaveIds };
    });
  }
  if (input.action === "cancel-wave" || input.action === "postpone-wave") {
    const waveId = safeText(input.waveId, 80);
    const snapshot = parseJson<SavedEncounter>(row.snapshot_json);
    if (!waveId || !snapshot.waves.some((wave) => wave.id === waveId) || live.activatedWaveIds?.includes(waveId)) throw new Error("Wave is missing or already active.");
    if (input.action === "cancel-wave") live.cancelledWaveIds = [...new Set([...(live.cancelledWaveIds ?? []), waveId])];
    else live.postponedWaveIds = [...new Set([...(live.postponedWaveIds ?? []), waveId])];
  }
  if (Array.isArray(input.reminders))
    live.reminders = input.reminders
      .slice(0, 30)
      .map(sanitizeReminder)
      .filter((item): item is EncounterReminder => Boolean(item));
  if (typeof input.readAloudRead === "boolean") live.readAloudRead = input.readAloudRead;
  getDb().prepare("UPDATE encounter_runs SET live_json=? WHERE id=?").run(JSON.stringify(live), id);
  return { ok: true, reminders: live.reminders, readAloudRead: live.readAloudRead, cancelledWaveIds: live.cancelledWaveIds, postponedWaveIds: live.postponedWaveIds };
}

export function getPlayerMemory(campaignId: string, userId: string): PlayerCampaignMemory {
  requireMember(campaignId, userId);
  const active = listSessions(campaignId, userId).find((session) => session.status === "active");
  return {
    activeSession: active
      ? { id: active.id, number: active.number, title: active.title, startedAt: active.startedAt }
      : null,
    handouts: listHandouts(campaignId, userId).map((item) => {
      const { privateNotes, ...shared } = item;
      void privateNotes;
      return shared;
    }),
    journal: listJournal(campaignId, userId),
  };
}

function insertEvent(campaignId: string, userId: string, type: string, payload: unknown) {
  getDb()
    .prepare(
      "INSERT INTO campaign_events(id,campaign_id,target_user_id,type,payload,created_by,created_at)VALUES(?,?,NULL,?,?,?,?)",
    )
    .run(randomUUID(), campaignId, type, JSON.stringify(payload), userId, nowIso());
}
function insertAuditEvent(campaignId: string, userId: string, action: string, payload: unknown) {
  insertEvent(campaignId, userId, "campaign-audit", {
    action,
    ...(payload && typeof payload === "object" ? payload : {}),
  });
}
