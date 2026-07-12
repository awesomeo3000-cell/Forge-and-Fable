export type CreatureRecordKind = "built-in" | "custom" | "named-npc" | "template" | "hazard" | "summon";

export type CreatureFeature = {
  name: string;
  description: string;
  attackBonus?: number;
  damage?: string;
  averageDamage?: number;
};

export type CreatureLibraryRecord = {
  id: string;
  ownerUserId?: string;
  campaignId?: string;
  kind: CreatureRecordKind;
  name: string;
  source?: string;
  tags: string[];
  creatureType?: string;
  size?: string;
  alignment?: string;
  challengeRating?: number;
  experienceValue?: number;
  environments?: string[];
  armorClass: number;
  hitPoints: { average: number; formula?: string };
  speed?: string;
  abilities?: Record<"strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma", number>;
  savingThrows?: string;
  skills?: string;
  senses?: string;
  languages?: string;
  passivePerception?: number;
  vulnerabilities?: string;
  resistances?: string;
  immunities?: string;
  conditionImmunities?: string;
  traits?: CreatureFeature[];
  actions?: CreatureFeature[];
  bonusActions?: CreatureFeature[];
  reactions?: CreatureFeature[];
  legendaryActions?: CreatureFeature[];
  lairActions?: CreatureFeature[];
  tacticsNotes?: string;
  privateNotes?: string;
  portraitUrl?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type EncounterConditionTemplate = { id: string; label: string };
export type EncounterCombatantTemplate = {
  id: string;
  creatureId?: string;
  name: string;
  quantity: number;
  kind: "enemy" | "ally" | "neutral" | "hazard";
  startingHpMode: "average" | "roll" | "custom";
  customStartingHp?: number;
  armorClassOverride?: number;
  initiativeMode: "roll" | "fixed" | "group";
  fixedInitiative?: number;
  hidden: boolean;
  visibility?: "hidden" | "name-only" | "name-and-conditions" | "approximate-health" | "exact-hp" | "full-public";
  startingConditions?: EncounterConditionTemplate[];
  waveId?: string;
  privateNote?: string;
};

export type EncounterWave = {
  id: string;
  name: string;
  trigger: { type: "round-start"; round: number } | { type: "combatant-hp"; combatantId: string; belowPercent: number } | { type: "combatant-defeated"; combatantId: string } | { type: "manual" };
  combatantIds: string[];
};

export type EncounterReminderTrigger =
  | { type: "encounter-start" }
  | { type: "round-start"; round?: number }
  | { type: "round-end"; round?: number }
  | { type: "turn-start"; combatantId: string }
  | { type: "turn-end"; combatantId: string }
  | { type: "initiative-count"; count: number }
  | { type: "manual" };

export type EncounterReminder = {
  id: string;
  label: string;
  details?: string;
  trigger: EncounterReminderTrigger;
  repeat: boolean;
  completed: boolean;
  snoozedUntilRound?: number;
};

export type EncounterPartySnapshot = {
  memberCount: number;
  levels: number[];
  averageLevel: number;
  averageArmorClass?: number;
  totalMaxHp?: number;
  averageMaxHp?: number;
  sourceCharacterIds: string[];
};

export type EncounterWarning = { code: string; message: string; severity: "info" | "warning" };
export type SavedEncounter = {
  id: string;
  campaignId?: string;
  ownerUserId: string;
  name: string;
  description?: string;
  status: "draft" | "ready" | "archived";
  origin: "manual" | "generated" | "remixed";
  environment?: string;
  encounterType?: string;
  difficulty?: "easy" | "medium" | "hard" | "deadly" | "custom";
  expectedRounds?: { min: number; max: number };
  objective?: string;
  readAloud?: string;
  tactics?: string;
  environmentNotes?: string;
  developments?: string;
  loot?: string;
  privateNotes?: string;
  combatants: EncounterCombatantTemplate[];
  waves: EncounterWave[];
  reminders: EncounterReminder[];
  handoutIds: string[];
  partySnapshot?: EncounterPartySnapshot;
  generatedWarnings?: EncounterWarning[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type EncounterDifficulty = "easy" | "medium" | "hard" | "deadly";
export type EncounterPartyProfile = EncounterPartySnapshot & {
  healingCapacity: "low" | "medium" | "high";
  rangedCapacity: "low" | "medium" | "high";
  controlCapacity: "low" | "medium" | "high";
  areaDamageCapacity: "low" | "medium" | "high";
  hasFlight: boolean;
  hasDarkvision: boolean;
  knownDamageTypes: string[];
  commonResistances: string[];
};
export type EncounterBudget = { target: number; minimum: number; maximum: number; method: string };

export type HandoutCategory = "location" | "npc" | "item" | "letter" | "clue" | "map" | "lore" | "other";
export type CampaignHandout = {
  id: string;
  campaignId: string;
  ownerUserId: string;
  title: string;
  category: HandoutCategory;
  description?: string;
  privateNotes?: string;
  tags: string[];
  assetType: "image" | "document" | "url" | "text";
  assetUrl?: string;
  body?: string;
  shared: boolean;
  firstSharedAt?: string;
  lastSharedAt?: string;
  shareCount: number;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntryType = "session" | "location" | "npc" | "faction" | "quest" | "lore" | "item" | "freeform";
export type CampaignJournalEntry = {
  id: string;
  campaignId: string;
  ownerUserId: string;
  title: string;
  type: JournalEntryType;
  body: string;
  tags: string[];
  visibility: "dm-private" | "players";
  status: "active" | "completed" | "archived";
  relatedEntryIds: string[];
  relatedHandoutIds: string[];
  relatedEncounterIds: string[];
  relatedSessionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SessionSummary = {
  title: string;
  playedAt: string;
  recap: string;
  majorEvents: string[];
  discoveries: string[];
  npcsEncountered: string[];
  combatResults: string[];
  lootAndRewards: string[];
  openQuestions: string[];
  nextSessionHooks: string[];
};
export type CampaignSession = {
  id: string;
  campaignId: string;
  number?: number;
  title?: string;
  startedAt: string;
  endedAt?: string;
  status: "active" | "completed";
  dmNotes?: string;
  summaryDraft?: SessionSummary;
  publishedJournalEntryId?: string;
};

export type EncounterRun = {
  id: string;
  campaignId: string;
  encounterId?: string;
  sessionId?: string;
  status: "active" | "paused" | "completed";
  snapshot: SavedEncounter;
  reminders: EncounterReminder[];
  readAloudRead?: boolean;
  activatedWaveIds?: string[];
  cancelledWaveIds?: string[];
  postponedWaveIds?: string[];
  startedAt: string;
  endedAt?: string;
};

export type CampaignScene = {
  id: string; campaignId: string; title: string; description?: string; readAloud?: string;
  presentUserIds: string[]; npcIds: string[]; objectives: string[]; completedObjectives: string[];
  clues: string[]; revealedClues: string[]; handoutIds: string[]; privateNotes?: string;
  likelyChecks: string[]; linkedLocation?: string; linkedEncounterId?: string; active: boolean;
  createdAt: string; updatedAt: string;
};

export type CampaignNpc = {
  id: string; campaignId: string; name: string; attitude: string; voice?: string; goal?: string;
  knows?: string; revealCondition?: string; armorClass?: number; currentHp?: number; maxHp?: number;
  insightDc?: number; portraitUrl?: string; status: "alive" | "dead" | "missing";
  disposition: "neutral" | "allied" | "hostile"; lastLocation?: string; relationshipNotes?: string;
  revealedSecrets: string[]; currentSceneId?: string; linkedJournalEntryId?: string;
  createdAt: string; updatedAt: string;
};

export type PlayerCampaignMemory = {
  activeSession: Pick<CampaignSession, "id" | "number" | "title" | "startedAt"> | null;
  handouts: Array<Omit<CampaignHandout, "privateNotes">>;
  journal: CampaignJournalEntry[];
};
