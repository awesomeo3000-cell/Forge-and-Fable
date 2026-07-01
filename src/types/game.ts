export type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export type AbilityScores = Record<AbilityKey, number>;

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
};

export type CasterType = "full" | "half" | "third" | "pact" | "none";

export type SpellSlots = Record<number, number>;

export type InventoryItem = {
  id: string;
  name: string;
  rarity: "Common" | "Uncommon" | "Rare";
  attunement: boolean;
  notes: string;
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
  hitPointType: "fixed" | "manual";
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
};

export type SheetSectionId =
  | "identity"
  | "vitals"
  | "abilities"
  | "saves"
  | "skills"
  | "senses"
  | "profs"
  | "attacks"
  | "features"
  | "notes"
  | "background"
  | "console";

export type SheetLayout = {
  columns: SheetSectionId[][];
  collapsed: SheetSectionId[];
  version: number;
};

export type Character = {
  id: string;
  userId: string;
  name: string;
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
  savingThrowProficiencies?: AbilityKey[];
  deathSaves: DeathSaves;
  theme?: CharacterTheme;
  sheetLayout?: SheetLayout;
  spellSlotsUsed?: SpellSlots;
  pactSlotsUsed?: number;
  concentratingOn?: string | null;
  createdAt: string;
}

export type DeathSaves = {
  successes: number;
  failures: number;
};;

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export type Ruleset = {
  races: Race[];
  classes: HeroClass[];
  spells: Spell[];
  items: InventoryItem[];
  backgrounds: string[];
  alignments: string[];
};
