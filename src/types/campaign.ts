import type { AbilityKey, Character, CharacterEffect } from "@/types/game";

export type CampaignThemeId = "observatory" | "forge" | "wilds";

/** Per-combatant condition marker (DM-editable on NPCs; display-only — not the full effects engine). */
export type CampaignCombatantCondition = {
  id: string;
  label: string;
  advantageMode?: "advantage" | "disadvantage";
  /** Exhaustion level, 1-6. */
  stack?: number;
};

/** A single entry in the shared initiative order. Replaces the older InitiativeCombatant. */
export type CampaignCombatant = {
  id: string;
  name: string;
  initiative: number;
  kind: "player" | "ally" | "enemy" | "neutral";

  /** Player linkage — HP/AC/conditions are derived from the member summary at sync time. */
  memberUserId?: string;
  characterId?: string;

  /** NPC/enemy state lives in the encounter (DM-editable, persists on refresh). */
  currentHp?: number;
  maxHp?: number;
  tempHp?: number;
  ac?: number;

  hidden?: boolean;
  visibility?: "hidden" | "name-only" | "name-and-conditions" | "approximate-health" | "exact-hp" | "full-public";
  healthLabel?: "Unhurt" | "Wounded" | "Bloodied" | "Near death" | "Defeated";
  defeated?: boolean;
  concentratingOn?: string;
  reactionUsed?: boolean;
  turnStatus?: "delayed" | "readied";

  /** NPC conditions (DM-managed — display only, no mechanical effect on the owning client). */
  conditions?: CampaignCombatantCondition[];
  /** DM-only note (replaces the old `note` field). */
  privateNote?: string;

  statBlock?: {
    speed?: string;
    saves?: string;
    senses?: string;
    resistances?: string;
    immunities?: string;
    vulnerabilities?: string;
  };
};

/** @deprecated Use CampaignCombatant instead. */
export type InitiativeCombatant = CampaignCombatant;

export type InitiativeState = {
  combatants: CampaignCombatant[];
  turnIndex: number;
  round: number;
};

export type CampaignEventType =
  | "condition-apply"
  | "condition-remove"
  | "announce"
  | "roll-request"
  | "rest-short"
  | "rest-long"
  | "death-save-update"
  | "concentration-end"
  | "loot-offer"
  | "audio-cue"
  | "handout"
  | "campaign-audit";

export type CampaignEventPayload =
  | ({ type?: never } & Partial<CharacterEffect>)
  | { label: string }
  | { message: string }
  | {
      prompt: string;
      kind: "initiative" | "save" | "check" | "skill";
      key: AbilityKey | string;
      dc?: number;
    }
  | { url: string; title: string };

export type CampaignEvent = {
  id: string;
  campaign_id: string;
  target_user_id: string | null;
  type: CampaignEventType;
  payload: string;
  created_by: string;
  created_at: string;
};

export type CampaignMemberSummary = {
  userId: string;
  userName: string;
  /** DM-only rehearsal member; omitted from player-facing projections. */
  isGhost?: boolean;
  characterId: string | null;
  characterName: string | null;
  characterClass: string | null;
  characterLevel: number | null;
  currentHp: number | null;
  maxHp: number | null;
  tempHp: number | null;
  ac: number | null;
  speed: string | null;
  passivePerception: number | null;
  passiveInsight: number | null;
  passiveInvestigation: number | null;
  spellSaveDc: number | null;
  conditions: string[];
  concentratingOn: string | null;
  deathSaves: { successes: number; failures: number } | null;
  heroicInspiration: boolean;
  hitDice: { remaining: number; maximum: number } | null;
  spellSlots: Array<{ level: number; remaining: number; max: number }>;
  characterJson?: Character | null;
};

export type CampaignTrack = {
  id: string;
  campaignId: string;
  title: string;
  url: string;
  kind: "music" | "cue";
  sort: number;
  createdAt: string;
};

export type CampaignAudioState = {
  trackId: string | null;
  url: string | null;
  title: string | null;
  loop: boolean;
  startedAt: string | null;
  version: number;
};

export type CampaignPresenceState = "connected" | "background" | "away" | "disconnected";

export type CampaignPresence = {
  userId: string;
  characterId: string | null;
  state: CampaignPresenceState;
  lastSeenAt: string | null;
};

export type CampaignCharacterNoteCategory = "secret" | "personal-hook" | "relationship" | "curse" | "unidentified-item" | "planned-beat" | "reward" | "general";

export type CampaignCharacterNote = {
  id: string;
  campaignId: string;
  characterId: string;
  category: CampaignCharacterNoteCategory;
  title: string;
  body: string;
  reminderId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignRequestResponse = {
  userId: string;
  status: "completed" | "dismissed" | "unavailable";
  total?: number;
  passed?: boolean;
  summary: string;
  respondedAt: string;
};

export type CampaignRequest = {
  id: string;
  campaignId: string;
  kind: "roll" | "rest-short" | "rest-long";
  status: "open" | "completed" | "dismissed";
  resolution: "individual" | "group" | "best";
  targetUserIds: string[];
  payload: Record<string, unknown>;
  responses: CampaignRequestResponse[];
  createdAt: string;
  resolvedAt?: string;
};

export type CampaignSyncPayload = {
  campaign: {
    id: string;
    name: string;
    code: string;
    dmUserId: string;
    themeKey: CampaignThemeId;
  };
  events: CampaignEvent[];
  rolls: Array<{
    id: string;
    campaign_id: string;
    user_id: string;
    character_name: string;
    label: string;
    detail: string;
    total: number;
    created_at: string;
  }>;
  initiative: {
    data: InitiativeState;
    version: number;
    updatedAt: string | null;
  };
  members: CampaignMemberSummary[];
  presence: CampaignPresence[];
  requests: CampaignRequest[];
  audio: CampaignAudioState;
};
