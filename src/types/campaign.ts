import type { AbilityKey, Character, CharacterEffect } from "@/types/game";

export type InitiativeCombatant = {
  id: string;
  name: string;
  initiative: number;
  isPlayer?: boolean;
  hidden?: boolean;
  hp?: { current: number; max: number };
  ac?: number;
  note?: string;
};

export type InitiativeState = {
  combatants: InitiativeCombatant[];
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
  | "audio-cue"
  | "handout";

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
  characterId: string | null;
  characterName: string | null;
  characterClass: string | null;
  characterLevel: number | null;
  currentHp: number | null;
  maxHp: number | null;
  ac: number | null;
  passivePerception: number | null;
  conditions: string[];
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

export type CampaignSyncPayload = {
  campaign: {
    id: string;
    name: string;
    code: string;
    dmUserId: string;
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
  audio: CampaignAudioState;
};
