import type { AbilityKey, RulesetId } from "@/types/game";

export type ProgressionRulesetId = RulesetId;
export type ProgressionMaximum = number | string;
export type ProgressionValue = string | number | boolean | null | ProgressionValue[] | { [key: string]: ProgressionValue };

export type ProgressionChoice = {
  choiceId: string;
  count?: number;
  options?: string[] | string;
  exclude?: string[];
  fixed?: string[];
  lists?: string[];
  maximumSpellLevel?: number | string;
  replaceable?: boolean;
  restrictedCount?: number;
  restrictedSchools?: string[];
  restriction?: string;
  spellLimit?: string;
  when?: string;
};

export type ResourceChange = {
  resourceId: string;
  maximum?: ProgressionMaximum;
  amount?: number;
  appliedWhen?: string;
  chance?: string;
  consumedBy?: string;
  cost?: ProgressionMaximum;
  die?: string;
  grantedWhen?: string;
  ignores?: string[] | string;
  maxSlotLevel?: number;
  recharge?: string;
  restoreBy?: string;
  trigger?: string;
};

export type SpellChange = {
  kind: string;
  choiceId?: string;
  class?: string;
  count?: number;
  duration?: string;
  maximum?: ProgressionMaximum;
  maximumSpellLevel?: number | string;
  recharge?: string;
  replaceableOnBardLevelUp?: boolean;
  restrictedSchools?: string[];
  school?: string;
  source?: string;
  sourceLists?: string[] | string;
  spell?: string;
  spells?: string[];
  when?: string;
  countsAgainstBardSpellsKnown?: boolean;
  countsAsBardSpells?: boolean;
  byChoice?: Record<string, Record<string, string[]>>;
  byClericLevel?: Record<string, string[]>;
  byPaladinLevel?: Record<string, string[]>;
  bySorcererLevel?: Record<string, string[]>;
  bySpellLevel?: Record<string, string[]>;
  byWarlockLevel?: Record<string, string[]>;
};

export type FeatureScaling = {
  levels?: number[];
  amount?: ProgressionMaximum;
  choice?: string;
  effect?: string;
  extraDamage?: string;
  formula?: string;
  "lands-aid-dice"?: string;
  resistance?: string;
};

export type ClassFeatureLevel = {
  level: number;
  proficiencyBonus: number;
  automaticFeatures: string[];
  choices: string[];
  resourceChanges: ResourceChange[];
  sourceReferences: string[];
};

export type SubclassFeatureLevel = {
  level: number;
  automaticFeatures: string[];
  choices: ProgressionChoice[];
  resourceChanges: ResourceChange[];
  spellChanges: SpellChange[];
  scaling: FeatureScaling[];
  parentInteractions: string[];
  sourceReferences: string[];
};

export type SpellcastingProgression = {
  type: string;
  ability: AbilityKey;
  preparedSpellsFormula?: string;
  preparedSpellsByLevel?: number[];
  spellsKnownByLevel?: number[];
  cantripsKnownByLevel?: number[];
  spellbookSpellsByLevel?: number[];
  eldritchInvocationsByLevel?: number[];
  pactMagicSlotsByLevel?: number[];
  pactMagicSlotLevelByClassLevel?: number[];
  spellSlotsByLevel?: Record<string, number[]>;
};

export type ClassProgressionPacket = {
  id: string;
  sourceClassId: string;
  ruleset: ProgressionRulesetId;
  name: string;
  sourceId: string;
  researchStatus: string;
  hitDie: number;
  primaryAbilities: AbilityKey[];
  savingThrowProficiencies: AbilityKey[];
  armorTraining: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[] | { count: number; options: string[] };
  skillProficiencies: { count: number; options: string[] };
  spellcasting?: SpellcastingProgression;
  levels: Record<number, ClassFeatureLevel>;
};

export type SubclassProgressionPacket = {
  id: string;
  sourceSubclassId: string;
  classId: string;
  sourceClassId: string;
  ruleset: ProgressionRulesetId;
  name: string;
  sourceId: string;
  selectionLevel: number;
  reprintRelationship?: string;
  featureLevels: SubclassFeatureLevel[];
};

export type ProgressionPacket = {
  ruleset: ProgressionRulesetId;
  classId: string;
  subclassId?: string;
  class: ClassProgressionPacket;
  subclass?: SubclassProgressionPacket;
};

export type FeatureGrant = {
  featureId: string;
  level: number;
  source: "class" | "subclass";
  sourcePacketId: string;
  parentInteractions?: string[];
  scaling?: FeatureScaling[];
};

export type LevelUpChoice = ProgressionChoice & {
  level: number;
  source: "class" | "subclass";
  sourcePacketId: string;
};

export type PlannedResourceChange = ResourceChange & {
  level: number;
  source: "class" | "subclass";
  sourcePacketId: string;
};

export type PlannedSpellChange = SpellChange & {
  level: number;
  source: "class" | "subclass";
  sourcePacketId: string;
  before?: number | number[];
  after?: number | number[];
  formula?: string;
};

export type ProgressionCatalog = {
  classes: ReadonlyMap<string, ClassProgressionPacket>;
  subclasses: ReadonlyMap<string, SubclassProgressionPacket>;
};

export type LevelUpPlan = {
  fromLevel: number;
  toLevel: number;
  proficiencyBonus: { before: number; after: number };
  automaticFeatures: FeatureGrant[];
  choices: LevelUpChoice[];
  resourceChanges: PlannedResourceChange[];
  spellChanges: PlannedSpellChange[];
  warnings: string[];
};
