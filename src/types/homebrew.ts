/**
 * Homebrew Studio content contracts (Phase 0 — contract freeze).
 *
 * These are the immutable-versioned rules-content shapes shared by the authoring
 * UI, the server data-access layer, and the runtime resolver. Phase 0 defines the
 * types and pure validators only: no database tables, API routes, UI, or character
 * persistence depend on this module yet.
 *
 * See `docs/ai-project-proposal-homebrew-studio.md` sections 4-10 and
 * `docs/CHANGES-HB-0.md` for the rationale and any deviations from the proposal.
 */
import type { AbilityKey, AbilityScores, RulesetId } from "@/types/game";
import type {
  ClassProgressionPacket,
  SubclassProgressionPacket,
} from "@/lib/progression/types";

// ──────────────────────────────────────────────────────────────────────────
// 4.1 Content identity
// ──────────────────────────────────────────────────────────────────────────

export type HomebrewKind = "item" | "class" | "subclass" | "species" | "feat";

/** A reference to a rules-content payload. Built-ins point at the static catalog
 *  by id; homebrew always pins an immutable `versionId`. */
export type RulesContentRef =
  | {
      source: "builtin";
      kind: HomebrewKind | "spell";
      id: string;
      ruleset: RulesetId;
    }
  | {
      source: "homebrew";
      kind: HomebrewKind;
      definitionId: string;
      versionId: string;
      ruleset: RulesetId;
    };

// ──────────────────────────────────────────────────────────────────────────
// 4.2 / 4.3 Definition, immutable version, baseline provenance
// ──────────────────────────────────────────────────────────────────────────

export type ContentVisibility = "private" | "campaign";
export type VersionStatus = "draft" | "published" | "deprecated";

export type ContentBaseline = {
  sourceRef: RulesContentRef;
  copiedAt: string;
  sourceTitle: string;
  sourceVersionLabel?: string;
};

export type HomebrewDefinition = {
  id: string;
  ownerUserId: string | null;
  kind: HomebrewKind;
  ruleset: RulesetId;
  slug: string;
  title: string;
  visibility: ContentVisibility;
  currentVersionId?: string;
  latestPublishedVersionId?: string;
  archivedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type HomebrewVersion<TPayload = HomebrewPayload> = {
  id: string;
  definitionId: string;
  ordinal: number;
  label?: string;
  status: VersionStatus;
  schemaVersion: number;
  payload: TPayload;
  parentVersionId?: string;
  baseline?: ContentBaseline;
  changeSummary: string;
  contentHash: string;
  createdByUserId: string | null;
  createdAt: string;
  publishedAt?: string;
};

/** Payload schema version. Bump when a stored payload shape changes so that
 *  upgrade/migration code can branch on it. */
export const HOMEBREW_SCHEMA_VERSION = 1;

// ──────────────────────────────────────────────────────────────────────────
// 5. Declarative prerequisite model
// ──────────────────────────────────────────────────────────────────────────

export type SpellcastingMode = "any" | "full" | "partial" | "pact";

export type Prerequisite =
  | { op: "all"; rules: Prerequisite[] }
  | { op: "any"; rules: Prerequisite[] }
  | { op: "not"; rule: Prerequisite }
  | { op: "ability"; ability: AbilityKey; minimum: number }
  | { op: "character-level"; minimum: number }
  | { op: "class-level"; classRef: RulesContentRef; minimum: number }
  | { op: "class"; classRef: RulesContentRef }
  | { op: "species"; speciesRef: RulesContentRef }
  | { op: "feat"; featRef: RulesContentRef }
  | { op: "spellcasting"; mode: SpellcastingMode }
  | { op: "proficiency"; category: string; value: string }
  | { op: "feature"; featureId: string }
  | { op: "attunement"; required: boolean };

export type PrerequisiteBlock = {
  rules?: Prerequisite;
  displayText?: string;
  manualApprovalText?: string;
};

/** Three-state prerequisite evaluation. Missing context is `unknown`, never a
 *  silent pass (proposal §5). */
export type PrerequisiteResult = "eligible" | "ineligible" | "unknown";

// ──────────────────────────────────────────────────────────────────────────
// 6. Declarative mechanics model
// ──────────────────────────────────────────────────────────────────────────

export type EffectGate =
  | { type: "always" }
  | { type: "equipped" }
  | { type: "attuned" }
  | { type: "toggle"; toggleId: string }
  | { type: "stage"; stageIds: string[] }
  | { type: "minimum-level"; level: number }
  | { type: "all"; gates: EffectGate[] }
  | { type: "any"; gates: EffectGate[] };

export type NumericBonusTarget =
  | "ac"
  | "saving-throws"
  | "ability-checks"
  | "initiative"
  | "spell-attack"
  | "spell-save-dc"
  | "weapon-attack"
  | "weapon-damage";

export type MechanicScope = "character" | "source-item";
export type MechanicStacking = "stack" | "same-source-nonstacking";
export type RechargeMode = "short-rest" | "long-rest" | "dawn" | "manual";
export type SpellRechargeMode = "short-rest" | "long-rest" | "dawn";

export type MechanicEffect =
  | {
      id: string;
      type: "numeric-bonus";
      target: NumericBonusTarget;
      value: number;
      scope?: MechanicScope;
      gate: EffectGate;
      stacking?: MechanicStacking;
    }
  | {
      id: string;
      type: "ability-floor";
      ability: AbilityKey;
      minimum: number;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "condition";
      conditionId: string;
      label: string;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "d20-rider";
      dice: string;
      appliesTo: Array<"attack" | "save" | "check">;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "spell-slot-bonus";
      spellLevel: number;
      amount: number;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "resource-grant";
      resourceId: string;
      maximum: number;
      recharge: RechargeMode;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "spell-grant";
      spellRef: RulesContentRef;
      freeUses?: number;
      recharge?: SpellRechargeMode;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "sense";
      text: string;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "aura";
      radiusFeet: number;
      recipient: "self" | "allies" | "all-creatures";
      effects: Array<Exclude<MechanicEffect, { type: "aura" }>>;
      gate: EffectGate;
    };

export type MechanicEffectType = MechanicEffect["type"];

/** Validated scaling table used in place of a string expression evaluator
 *  (proposal §6.3). Never introduce an arbitrary formula string. */
export type LevelTableValue = {
  kind: "level-table";
  rows: Array<{ minimumLevel: number; value: number }>;
};

/** Resolver output carries provenance so the sheet never shows an unexplained
 *  bonus (proposal §6.4). */
export type ResolvedContribution = {
  sourceInstanceId: string;
  sourceRef: RulesContentRef;
  effectId: string;
  label: string;
  target: string;
  value?: number;
};

// ──────────────────────────────────────────────────────────────────────────
// Shared authoring building blocks
// ──────────────────────────────────────────────────────────────────────────

/** A structured pick (skills, tools, languages, spells, a feat, or a fixed list).
 *  Kept deliberately small for the contract freeze; extended in later phases. */
export type ChoiceSource =
  | { type: "skills"; options?: string[] }
  | { type: "tools"; options?: string[] }
  | { type: "languages"; options?: string[] }
  | { type: "list"; options: string[] }
  | { type: "feat" }
  | { type: "spell"; spellRefs?: RulesContentRef[] };

export type ChoiceDefinition = {
  id: string;
  label: string;
  count: number;
  from: ChoiceSource;
  /** When true, repeated selections of this choice must differ. */
  distinct?: boolean;
};

export type HomebrewFeatureGrant = {
  id: string;
  name: string;
  description: string;
  kind?: "passive" | "action" | "bonus-action" | "reaction";
};

export type ProgressionResourceGrant = {
  resourceId: string;
  maximum: number;
  recharge: RechargeMode;
};

/** One row of a class/subclass/species 1-20 progression guide (proposal §8.4). */
export type HomebrewProgressionLevel = {
  level: number;
  proficiencyBonus?: number;
  features?: HomebrewFeatureGrant[];
  choices?: ChoiceDefinition[];
  effects?: MechanicEffect[];
  resources?: ProgressionResourceGrant[];
  spellcastingNote?: string;
};

export type SpellGrantDefinition = {
  id: string;
  spellRef: RulesContentRef;
  freeUses?: number;
  recharge?: SpellRechargeMode;
};

// ──────────────────────────────────────────────────────────────────────────
// 7. Item model
// ──────────────────────────────────────────────────────────────────────────

export type ItemStage = {
  id: string;
  name: string;
  order: number;
  description: string;
  activation:
    | { type: "manual" }
    | { type: "counter"; counterId: string; minimum: number }
    | { type: "milestone"; label: string };
  effects: MechanicEffect[];
};

export type ItemToggle = { id: string; label: string; defaultOn: boolean };

export type HomebrewItemPayload = {
  kind: "item";
  name: string;
  description: string;
  creatorNotes?: string;
  category: string;
  classification?: string;
  rarity: string;
  imageUrl?: string;
  /** Rules-facing equipment data copied from the built-in catalog when an item
   *  is used as a baseline. These fields are intentionally structured rather
   *  than inferred from creator prose at runtime. */
  ac?: string;
  damage?: string;
  damageType?: string;
  properties?: string;
  baseWeight?: number;
  cost?: string;
  requiresAttunement: boolean;
  attunementPrerequisites?: PrerequisiteBlock;
  equipmentSlots: string[];
  effects: MechanicEffect[];
  toggles: ItemToggle[];
  stages: ItemStage[];
};

/** Per-character, per-copy item state. Extends `InventoryItem` compatibly; it is
 *  not stored inside the versioned payload. */
export type HomebrewItemInstanceState = {
  contentRef: RulesContentRef;
  instanceNotes?: string;
  weightOverride?: number;
  equipped: boolean;
  attuned: boolean;
  bodyLocation?: string;
  activeToggleIds: string[];
  currentStageId?: string;
  counters?: Record<string, number>;
  stageHistory?: Array<{
    stageId: string;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
};

// ──────────────────────────────────────────────────────────────────────────
// 8. Class and subclass model
// ──────────────────────────────────────────────────────────────────────────

/** Multiclass-aware per-class record (proposal §8.1). Not wired into `Character`
 *  until Phase 5; declared here so the contract is frozen. */
export type CharacterClassLevel = {
  classRef: RulesContentRef;
  level: number;
  subclassRef?: RulesContentRef;
  acquiredOrder: number;
};

export type SpellcastingCasterMode =
  | "none"
  | "full"
  | "half"
  | "third"
  | "pact"
  | "custom";
export type SpellPreparation = "none" | "known" | "prepared" | "spellbook";

export type HomebrewSpellcasting = {
  mode: SpellcastingCasterMode;
  ability?: AbilityKey;
  preparation: SpellPreparation;
  spellList:
    | { type: "class-list"; classIds: string[] }
    | { type: "explicit"; spellIds: string[] };
  cantripsKnownByLevel?: number[];
  spellsKnownByLevel?: number[];
  preparedFormula?: "class-level-plus-modifier" | "half-level-plus-modifier";
  spellSlotsByLevel?: Record<number, number[]>;
  pactSlotsByLevel?: Record<number, { count: number; slotLevel: number }>;
};

export type HomebrewClassPayload = {
  kind: "class";
  name: string;
  summary: string;
  hitDie: number;
  primaryAbilities: AbilityKey[];
  savingThrowProficiencies: AbilityKey[];
  armorTraining: string[];
  weaponProficiencies: string[];
  toolChoices?: ChoiceDefinition[];
  skillChoices?: ChoiceDefinition[];
  startingEquipment?: ChoiceDefinition[];
  multiclassPrerequisites?: PrerequisiteBlock;
  multiclassProficiencyGrants: string[];
  spellcasting: HomebrewSpellcasting;
  levels: Record<number, HomebrewProgressionLevel>;
  subclassSelectionLevels: number[];
  allowedSubclassRefs?: RulesContentRef[];
};

export type HomebrewSubclassPayload = {
  kind: "subclass";
  name: string;
  summary: string;
  parentClassRef: RulesContentRef;
  prerequisites?: PrerequisiteBlock;
  levels: Record<number, HomebrewProgressionLevel>;
};

// ──────────────────────────────────────────────────────────────────────────
// 9. Species model
// ──────────────────────────────────────────────────────────────────────────

export type HomebrewSpeciesPayload = {
  kind: "species";
  name: string;
  summary: string;
  creatureType: string;
  sizes: string[];
  speed: string;
  prerequisites?: PrerequisiteBlock;
  abilityScoreMode:
    | { type: "fixed"; bonuses: Partial<AbilityScores> }
    | { type: "choice"; pattern: "plus-two-plus-one" | "three-plus-one" };
  languages: ChoiceDefinition[];
  proficiencies: ChoiceDefinition[];
  levels: Record<number, HomebrewProgressionLevel>;
};

// ──────────────────────────────────────────────────────────────────────────
// 10. Feat model
// ──────────────────────────────────────────────────────────────────────────

export type FeatRepeatability =
  | { mode: "once" }
  | { mode: "unlimited"; requiresDistinctChoices?: boolean }
  | { mode: "limited"; maximum: number; requiresDistinctChoices?: boolean };

export type HomebrewFeatPayload = {
  kind: "feat";
  name: string;
  description: string;
  category?: string;
  prerequisites?: PrerequisiteBlock;
  repeatability: FeatRepeatability;
  choices: ChoiceDefinition[];
  effects: MechanicEffect[];
  spellGrants?: SpellGrantDefinition[];
};

export type FeatureChoiceScalar = string | number | boolean;
export type FeatureChoiceValue =
  | FeatureChoiceScalar
  | FeatureChoiceScalar[]
  | Record<string, FeatureChoiceScalar>;

/** Instance-based feat selection (proposal §10). Replaces the single-id
 *  `ASIChoice` feat record in Phase 7; declared here for the frozen contract. */
export type CharacterFeatSelection = {
  instanceId: string;
  contentRef: RulesContentRef;
  acquiredAtCharacterLevel: number;
  acquiredFrom: "asi" | "species" | "class" | "campaign" | "manual";
  choices: Record<string, FeatureChoiceValue>;
};

// ──────────────────────────────────────────────────────────────────────────
// Payload union + narrowing
// ──────────────────────────────────────────────────────────────────────────

export type HomebrewPayload =
  | HomebrewItemPayload
  | HomebrewClassPayload
  | HomebrewSubclassPayload
  | HomebrewSpeciesPayload
  | HomebrewFeatPayload;

export type HomebrewPayloadOf<K extends HomebrewKind> = Extract<
  HomebrewPayload,
  { kind: K }
>;

// ──────────────────────────────────────────────────────────────────────────
// 8.5 Runtime content registry
// ──────────────────────────────────────────────────────────────────────────

/** Minimal packet placeholders for species/feat progression. The full shapes are
 *  designed in Phases 6-7; the registry interface is frozen now so downstream
 *  progression code can accept an injected registry instead of a global import. */
export type SpeciesProgressionPacket = {
  id: string;
  ruleset: RulesetId;
  name: string;
  levels: Record<number, HomebrewProgressionLevel>;
};

export type FeatProgressionPacket = {
  id: string;
  ruleset: RulesetId;
  name: string;
  effects: MechanicEffect[];
};

export type ResolvedRulesContent =
  | { kind: "class"; ref: RulesContentRef; packet: ClassProgressionPacket }
  | { kind: "subclass"; ref: RulesContentRef; packet: SubclassProgressionPacket }
  | { kind: "species"; ref: RulesContentRef; packet: SpeciesProgressionPacket }
  | { kind: "feat"; ref: RulesContentRef; packet: FeatProgressionPacket };

export interface RulesContentRegistry {
  resolve(ref: RulesContentRef): ResolvedRulesContent;
  getClassPacket(ref: RulesContentRef): ClassProgressionPacket;
  getSubclassPacket(ref: RulesContentRef): SubclassProgressionPacket;
  getSpeciesPacket(ref: RulesContentRef): SpeciesProgressionPacket;
  getFeatPacket(ref: RulesContentRef): FeatProgressionPacket;
}

/** Thrown when a registry cannot resolve a reference (unknown id, wrong kind,
 *  or a kind not yet backed by built-in packets). */
export class ContentResolutionError extends Error {
  constructor(
    message: string,
    public readonly ref: RulesContentRef,
  ) {
    super(message);
    this.name = "ContentResolutionError";
  }
}
