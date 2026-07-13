export type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export type AbilityScores = Record<AbilityKey, number>;

export type RulesetId = "2014" | "2024";

export type RulesMode = "strict-2014" | "strict-2024" | "2024-with-legacy-options";

export type Race = {
  id: string;
  name: string;
  sourceBook: string;
  sourceLabel?: string;
  summary: string;
  creatureType: string;
  size: string;
  speed: string;
  bonuses: Partial<AbilityScores>;
  traits: FeatureUnlock[];
  /** Number of ability scores the player can choose to receive +1 each (e.g. Half-Elf: 2). */
  bonusChoices?: number;
  /** Groups subspecies variants (e.g. Hill/Mountain Dwarf) under one family
      card in the builder. Races without a familyId render as their own card. */
  familyId?: string;
};

export type HeroClass = {
  id: string;
  name: string;
  sourceBook: string;
  summary: string;
  coreTraits: string[];
  levelProgression: LevelProgression[];
  hitDie: number;
  primary: AbilityKey[];
  proficiencies: string[];
  startingGear: string[];
  actions: CombatAction[];
  spellSuggestions: string[];
  casterType?: CasterType;
  spellcastingAbility?: AbilityKey;
  asiLevels?: number[];
  subclassLevel?: number;
  subclassFeatureLevels?: number[];
};

export type LevelProgression = {
  level: number;
  features: FeatureUnlock[];
};

export type FeatureUnlock = {
  name: string;
  description: string;
};

export type CombatAction = {
  name: string;
  ability: AbilityKey;
  formula: string;
  damageType: string;
};

export type Spell = {
  id: string;
  name: string;
  level: number;
  school: string;
  action: string;
  summary: string;
};

export type SpellComponents = { verbal: boolean; somatic: boolean; material: boolean };

export type SpellData = {
  id: string; name: string; level: number; school: string;
  castingTime: string; duration: string; range: string; area: string;
  attack: string; save: string; damageEffect: string;
  ritual: boolean; concentration: boolean;
  components: SpellComponents; material: string; source: string; description: string;
  classes: string[];
  /** Structured upcast hint. The full scaling registry is in spellScaling.ts;
   * this lightweight field provides a fallback for simple per-level scaling. */
  higherLevel?: {
    dice: string;          // e.g. "1d6" — additional dice per level above the spell's base level
    startLevel?: number;   // defaults to spell.level (e.g. 2 means "above 1st")
    damageType?: string;   // overrides base damageEffect when the upcast damage type differs
  };
};

export type FeatGrantSpells = {
  /** Spells always granted (e.g. Misty Step from Fey Touched). */
  fixed?: string[];
  /** Spells the player chooses from. */
  choose?: {
    count: number;
    level: number;
    /** Optional school filter (e.g. "divination", "enchantment"). */
    schools?: string[];
  };
};

export type Feat = {
  id: string; name: string; description: string;
  abilityBonuses: AbilityKey[]; fixedAbility: boolean; chooseAbility: boolean;
  racialPrereq: string; otherPrereq: string; source: string;
  /** If present, the feat grants spells — the UI must prompt for choices. */
  grantsSpells?: FeatGrantSpells;
};

export type ASIChoice =
  | { type: "asi"; level: number; increases: Partial<AbilityScores> }
  | { type: "feat"; level: number; featId: string; abilityChoice?: AbilityKey };

export type CasterType = "full" | "half" | "third" | "pact" | "none";

export type SpellSlots = Record<number, number>;

export type SpellStatus = {
  source?: string;
  freeUse?: boolean;
  freeUsed?: boolean;
};

export type FeedbackCategory = "bug" | "idea" | "balance" | "content" | "ui" | "other";
export type FeedbackPriority = "low" | "medium" | "high" | "blocking";

export type FeedbackEntry = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  area: string;
  title: string;
  details: string;
  page: string;
  characterName?: string;
  status: "new" | "reviewed" | "planned" | "done";
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  rarity: string;
  attunement: boolean;
  notes: string;
  sourceItemId?: string;
  category?: string;
  classification?: string;
  description?: string;
  ac?: string;
  damage?: string;
  damageType?: string;
  properties?: string;
  cost?: string;
  image?: string;
  /** Weight in pounds, for carrying-capacity math. Only populated for
      manually-added items and the static armor/weapon catalog for now. */
  weight?: number;
};

export type Currency = {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
};

export type CatalogItem = {
  id: string;
  name: string;
  image?: string;
  description: string;
  category: string;
  rarity: string;
  classification?: string;
  ac?: string;
  damage?: string;
  damageType?: string;
  properties?: string;
  cost?: string;
  attunement: boolean;
};

export type Equipment = {
  armorId?: string;
  shield?: boolean;
  weaponIds?: string[];
  armorItemId?: string;
  shieldItemId?: string;
  weaponItemIds?: string[];
  bonusItemIds?: string[];
};

/** A custom sheet page: freeform journal/backstory/map content the player adds. */
export type PageBlock =
  | { id: string; type: "text"; content: string }
  | { id: string; type: "image"; url: string; caption?: string };

export type CharacterPage = {
  id: string;
  title: string;
  blocks: PageBlock[];
};

/**
 * A toggleable effect: an item, spell, feature, or condition the player
 * switches on/off. Flat bonuses feed derived stats; d20Dice adds rider dice
 * (e.g. Bless's 1d4) to every d20 roll while active; sense text mirrors into
 * the Senses section (e.g. darkvision gained from a spell).
 */
export type CharacterEffect = {
  id: string;
  label: string;
  active: boolean;
  source?: string;
  ac?: number;
  attack?: number;
  damage?: number;
  saves?: number;
  checks?: number;
  initiative?: number;
  d20Dice?: string;
  sense?: string;
  /** While active, the character's d20 rolls default to this mode (see
      effectiveAdvantageMode in lib/effects.ts for the cancellation rule when
      multiple effects disagree). An explicit user override in the roll
      drawer wins for one roll, then reverts to this. */
  advantageMode?: "advantage" | "disadvantage";
  /** Exhaustion level, 1-6 (2014-RAW simplified: stack >= 1 imposes
      disadvantage via advantageMode; stack >= 3 is informational only this
      round, no automated speed/HP penalties). */
  stack?: number;
};

export type CustomRule = {
  id: string;
  label: string;
  type: "ac" | "initiative" | "attack" | "save";
  value: number;
  source: string;
};

export type CharacterSettings = {
  diceRollingEnabled: boolean;
  optionalClassFeatures: boolean;
  customizeOrigin: boolean;
  advancementType: "milestone" | "xp";
  hitPointType: "fixed" | "rolled" | "manual";
  usePrerequisites: boolean;
  useFeatPrerequisites: boolean;
  useMulticlassPrerequisites: boolean;
  showLevelScaledSpells: boolean;
  encumbranceType: "standard" | "none" | "variant";
  ignoreCoinWeight: boolean;
  modifiersTop: boolean;
};

export type ThemeFontKey =
  | "tome"
  | "storybook"
  | "bubble"
  | "script"
  | "blackletter"
  | "typewriter";

export type ThemeBackgroundKey =
  | "parchment"
  | "plain"
  | "linen"
  | "stars"
  | "sparkle"
  | "forest"
  | "dungeon";

export type CharacterTheme = {
  presetId?: string;
  paper: string;
  ink: string;
  accent: string;
  fontKey: ThemeFontKey;
  backgroundKey: ThemeBackgroundKey;
  backgroundOpacity?: number;
  /** Sheet text scale multiplier, 0.85–1.25. Default 1. */
  fontScale?: number;
  /** https URL painted as the section background (overrides backgroundKey). */
  backgroundImageUrl?: string;
};

export type SheetSectionId =
  | "identity"
  | "vitals"
  | "abilities"
  | "saves"
  | "skills"
  | "senses"
  | "profs"
  | "equipment"
  | "effects"
  | "attacks"
  | "actions"
  | "bonus-actions"
  | "reactions"
  | "passives"
  | "features"
  | "traits"
  | "spells"
  | "spellbook"
  | "inventory"
  | "notes"
  | "background"
  | "pages"
  | "console";

export type SheetLayout = {
  /** Stable module container IDs arranged into sheet columns. */
  columns: string[][];
  /** Stable containers; tabs may be reordered or moved without changing the container ID. */
  modules?: SheetModule[];
  collapsed: string[];
  version: number;
  /** Module container IDs hidden from the sheet. */
  hidden?: string[];
  /** Column widths as percentages (one per column, ~summing to 100). Unset = CSS defaults. */
  columnWidths?: number[];
  /** Player-defined labels for individual modules. */
  customTitles?: Record<string, string>;
  /** Legacy v2 merge representation, retained only for migration. */
  mergedSections?: Partial<Record<SheetSectionId, SheetSectionId[]>>;
};

export type SheetModule = {
  id: string;
  tabs: SheetSectionId[];
  title?: string;
  tabTitles?: Partial<Record<SheetSectionId, string>>;
};

export type Character = {
  id: string;
  userId: string;
  /** Server-managed optimistic concurrency token. Never included in update patches. */
  revision?: number;
  name: string;
  /** Edition is persisted so characters never silently change rules systems. */
  ruleset: RulesetId;
  level: number;
  alignment: string;
  background: string;
  physicalCharacteristics: string;
  personalCharacteristics: string;
  generalNotes: string;
  raceId: string;
  classId: string;
  sourceIds: string[];
  settings: CharacterSettings;
  abilities: AbilityScores;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  inventory: InventoryItem[];
  spellsKnown: string[];
  customRules: CustomRule[];
  skillProficiencies?: string[];
  /** Skills with expertise (2× proficiency bonus). Must also be proficient. */
  skillExpertise?: string[];
  /** Player-chosen ability score bonuses from racial traits (e.g. Half-Elf's +1 to two abilities). */
  raceBonusChoices?: Partial<AbilityScores>;
  savingThrowProficiencies?: AbilityKey[];
  toolProficiencies?: string[];
  languages?: string[];
  currency?: Currency;
  deathSaves: DeathSaves;
  /** null = explicitly cleared (JSON drops undefined, so reset PUTs null). */
  theme?: CharacterTheme | null;
  sheetLayout?: SheetLayout;
  spellSlotsUsed?: SpellSlots;
  pactSlotsUsed?: number;
  concentratingOn?: string | null;
  subclassId?: string;
  /** Edition-scoped mechanical choices keyed by packet choice ID. */
  featureChoices?: Record<string, FeatureChoiceValue>;
  /** Persisted class/subclass resources used by the sheet and combat systems. */
  featureResources?: Record<string, FeatureResourceState>;
  /** Spells granted outside the normal known/prepared limit. */
  alwaysPreparedSpells?: string[];
  /** Spell-list expansions, grouped by the feature that granted them. */
  expandedSpellLists?: Record<string, string[]>;
  /** Wizard-style spellbook contents remain distinct from known spells. */
  spellbookSpells?: string[];
  /** Auditable, idempotent record of progression applied to the character. */
  progressionState?: CharacterProgressionState;
  asiChoices?: ASIChoice[];
  hpRolls?: number[];
  equipment?: Equipment;
  preparedSpells?: string[];
  spellStatuses?: Record<string, SpellStatus>;
  hitDiceSpent?: number;
  heroicInspiration?: boolean;
  effects?: CharacterEffect[];
  pages?: CharacterPage[];
  snapshots?: CharacterSnapshot[];
  createdAt: string;
}

export type FeatureChoiceScalar = string | number | boolean;
export type FeatureChoiceValue = FeatureChoiceScalar | FeatureChoiceScalar[] | Record<string, FeatureChoiceScalar>;

export type FeatureResourceState = {
  maximum?: number | string;
  current?: number;
  recharge?: string;
  die?: string;
  sourceFeatureId?: string;
};

export type CharacterProgressionState = {
  ruleset: RulesetId;
  classId: string;
  subclassId?: string;
  appliedThroughLevel: number;
  featureIds: string[];
  featureGrants?: Array<{ featureId: string; level: number; source: "class" | "subclass"; sourcePacketId: string }>;
  warnings?: string[];
  choiceHistory?: Array<{ choiceId: string; level: number; selections: string[] }>;
  spellHistory?: Array<{ level: number; spellIds: string[] }>;
};

export type CharacterSnapshot = {
  id: string;
  label: string;
  character: Character;
  createdAt: string;
};

export type CharacterPatch = Partial<Omit<Character, "id" | "userId" | "createdAt" | "revision">>;

export type DeathSaves = {
  successes: number;
  failures: number;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  /** Server-derived from ADMIN_EMAILS. A UI hint only — never trusted for
      access; every admin endpoint re-checks server-side. */
  isAdmin?: boolean;
};

export type Ruleset = {
  id: RulesetId;
  label: string;
  races: Race[];
  classes: HeroClass[];
  spells: Spell[];
  items: InventoryItem[];
  backgrounds: string[];
  alignments: string[];
};

// ──── App-level shared types ────

/** In-progress character being built in the creator wizard. */
export type DraftCharacter = {
  name: string;
  ruleset: RulesetId;
  level: number;
  alignment: string;
  background: string;
  physicalCharacteristics: string;
  personalCharacteristics: string;
  generalNotes: string;
  raceId: string;
  classId: string;
  sourceIds: string[];
  settings: CharacterSettings;
  abilities: AbilityScores;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  inventory: InventoryItem[];
  spellsKnown: string[];
  customRules: CustomRule[];
  skillProficiencies: string[];
  raceBonusChoices?: Partial<AbilityScores>;
  toolProficiencies: string[];
  languages: string[];
  currency: Currency;
  startingHpRolls: number[];
  deathSaves: DeathSaves;
};

export type StatMethod = "point-buy" | "standard-array" | "roll" | "manual";
export type AuthMode = "login" | "register";
export type BuildMode = "standard" | "quickbuilder" | "premade";

export type RollOutcome = {
  rolls: number[];
  modifier: number;
  total: number;
};

/** How a d20 check/attack/save is rolled. Advantage/disadvantage roll 2d20
    and keep the higher/lower die; normal rolls a single d20. */
export type RollMode = "normal" | "advantage" | "disadvantage";
