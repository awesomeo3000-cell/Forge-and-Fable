/**
 * Acceptance fixtures for the Phase 0 homebrew contract freeze.
 *
 * Each fixture is a well-formed payload that MUST validate clean. They double as
 * the canonical worked examples from the proposal's acceptance matrix, and are
 * reused by later phases (resolver, storage, UI) as golden inputs.
 */
import type {
  HomebrewClassPayload,
  HomebrewFeatPayload,
  HomebrewItemPayload,
  HomebrewProgressionLevel,
  HomebrewSpeciesPayload,
  HomebrewSubclassPayload,
  RulesContentRef,
} from "@/types/homebrew";

const builtinClass = (id: string): RulesContentRef => ({
  source: "builtin",
  kind: "class",
  id,
  ruleset: "2024",
});

const proficiencyBonus = (level: number): number => Math.floor((level - 1) / 4) + 2;

/** All 20 rows with correct proficiency bonus; extra content merged by level. */
function fullLevelGuide(
  extra: Partial<Record<number, Omit<HomebrewProgressionLevel, "level" | "proficiencyBonus">>> = {},
): Record<number, HomebrewProgressionLevel> {
  const levels: Record<number, HomebrewProgressionLevel> = {};
  for (let level = 1; level <= 20; level++) {
    levels[level] = {
      level,
      proficiencyBonus: proficiencyBonus(level),
      ...(extra[level] ?? {}),
    };
  }
  return levels;
}

// ── Items ───────────────────────────────────────────────────────────────────

export const plusTwoWeapon: HomebrewItemPayload = {
  kind: "item",
  name: "Moonsteel Blade",
  description: "A longsword etched with lunar runes. +2 to attack and damage rolls.",
  category: "Weapon",
  classification: "Martial Melee",
  rarity: "Rare",
  requiresAttunement: false,
  baseWeight: 3,
  equipmentSlots: ["main-hand"],
  toggles: [],
  stages: [],
  effects: [
    {
      id: "atk",
      type: "numeric-bonus",
      target: "weapon-attack",
      value: 2,
      scope: "source-item",
      gate: { type: "equipped" },
    },
    {
      id: "dmg",
      type: "numeric-bonus",
      target: "weapon-damage",
      value: 2,
      scope: "source-item",
      gate: { type: "equipped" },
    },
  ],
};

export const strengthFloorArmor: HomebrewItemPayload = {
  kind: "item",
  name: "Giant's Girdle Plate",
  description: "While worn, your Strength score becomes 19 if it is not already higher.",
  category: "Armor",
  classification: "Heavy",
  rarity: "Very Rare",
  requiresAttunement: true,
  baseWeight: 65,
  equipmentSlots: ["torso"],
  toggles: [],
  stages: [],
  effects: [
    {
      id: "str-floor",
      type: "ability-floor",
      ability: "strength",
      minimum: 19,
      gate: { type: "equipped" },
    },
  ],
};

export const ringOfInvisibility: HomebrewItemPayload = {
  kind: "item",
  name: "Ring of Invisibility",
  description: "While attuned and worn, you may turn invisible at will.",
  category: "Ring",
  rarity: "Legendary",
  requiresAttunement: true,
  baseWeight: 0,
  equipmentSlots: ["ring"],
  toggles: [{ id: "invisible", label: "Invisible", defaultOn: false }],
  stages: [],
  effects: [
    {
      id: "invis-condition",
      type: "condition",
      conditionId: "invisible",
      label: "Invisible",
      gate: {
        type: "all",
        gates: [{ type: "equipped" }, { type: "attuned" }, { type: "toggle", toggleId: "invisible" }],
      },
    },
  ],
};

export const sentientWeapon: HomebrewItemPayload = {
  kind: "item",
  name: "Dawnbringer",
  description: "A sentient blade that awakens in four stages as it is wielded.",
  category: "Weapon",
  classification: "Martial Melee",
  rarity: "Artifact",
  requiresAttunement: true,
  baseWeight: 4,
  equipmentSlots: ["main-hand"],
  toggles: [],
  stages: [
    {
      id: "stage-1",
      name: "Dormant",
      order: 1,
      description: "A faint hum. +1 to attack and damage.",
      activation: { type: "manual" },
      effects: [
        {
          id: "s1-atk",
          type: "numeric-bonus",
          target: "weapon-attack",
          value: 1,
          scope: "source-item",
          gate: { type: "stage", stageIds: ["stage-1"] },
        },
        {
          id: "s1-dmg",
          type: "numeric-bonus",
          target: "weapon-damage",
          value: 1,
          scope: "source-item",
          gate: { type: "stage", stageIds: ["stage-1"] },
        },
      ],
    },
    {
      id: "stage-2",
      name: "Stirring",
      order: 2,
      description: "The runes brighten. +2 to attack and damage.",
      activation: { type: "counter", counterId: "kills", minimum: 10 },
      effects: [
        {
          id: "s2-atk",
          type: "numeric-bonus",
          target: "weapon-attack",
          value: 2,
          scope: "source-item",
          gate: { type: "stage", stageIds: ["stage-2"] },
        },
        {
          id: "s2-dmg",
          type: "numeric-bonus",
          target: "weapon-damage",
          value: 2,
          scope: "source-item",
          gate: { type: "stage", stageIds: ["stage-2"] },
        },
      ],
    },
    {
      id: "stage-3",
      name: "Awakened",
      order: 3,
      description: "Grants an extra 3rd-level spell slot.",
      activation: { type: "milestone", label: "Survive the Long Night" },
      effects: [
        {
          id: "s3-slot",
          type: "spell-slot-bonus",
          spellLevel: 3,
          amount: 1,
          gate: { type: "stage", stageIds: ["stage-3"] },
        },
      ],
    },
    {
      id: "stage-4",
      name: "Radiant",
      order: 4,
      description: "Projects a Bless aura to nearby allies.",
      activation: { type: "manual" },
      effects: [
        {
          id: "s4-aura",
          type: "aura",
          radiusFeet: 30,
          recipient: "allies",
          gate: { type: "stage", stageIds: ["stage-4"] },
          effects: [
            {
              id: "s4-bless",
              type: "d20-rider",
              dice: "1d4",
              appliesTo: ["attack", "save"],
              gate: { type: "always" },
            },
          ],
        },
      ],
    },
  ],
  effects: [],
};

// ── Classes and subclasses ───────────────────────────────────────────────────

export const fullCasterClass: HomebrewClassPayload = {
  kind: "class",
  name: "Runeweaver",
  summary: "A full spellcaster who binds runes into living magic.",
  hitDie: 6,
  primaryAbilities: ["intelligence"],
  savingThrowProficiencies: ["intelligence", "wisdom"],
  armorTraining: [],
  weaponProficiencies: ["Simple weapons"],
  multiclassProficiencyGrants: ["Simple weapons"],
  skillChoices: [
    { id: "runeweaver-skills", label: "Choose two skills", count: 2, from: { type: "skills" } },
  ],
  spellcasting: {
    mode: "full",
    ability: "intelligence",
    preparation: "prepared",
    spellList: { type: "class-list", classIds: ["wizard"] },
    cantripsKnownByLevel: [3, 3, 3, 4],
    preparedFormula: "class-level-plus-modifier",
  },
  levels: fullLevelGuide({
    1: {
      features: [
        { id: "rw-spellcasting", name: "Spellcasting", description: "You can cast wizard spells." },
      ],
    },
    2: {
      features: [{ id: "rw-rune-mark", name: "Rune Mark", description: "Etch a rune of power." }],
    },
  }),
  subclassSelectionLevels: [3],
  allowedSubclassRefs: [],
};

export const partialCasterClass: HomebrewClassPayload = {
  kind: "class",
  name: "Spellblade",
  summary: "A martial half-caster blending steel and sorcery.",
  hitDie: 10,
  primaryAbilities: ["strength", "intelligence"],
  savingThrowProficiencies: ["strength", "constitution"],
  armorTraining: ["Light", "Medium", "Shields"],
  weaponProficiencies: ["Simple weapons", "Martial weapons"],
  multiclassProficiencyGrants: ["Light armor", "Medium armor"],
  spellcasting: {
    mode: "half",
    ability: "intelligence",
    preparation: "prepared",
    spellList: { type: "class-list", classIds: ["fighter"] },
    preparedFormula: "half-level-plus-modifier",
  },
  levels: fullLevelGuide({
    1: {
      features: [{ id: "sb-dueling", name: "Martial Focus", description: "A fighting style." }],
    },
    2: {
      features: [{ id: "sb-spellcasting", name: "Spellcasting", description: "You begin to cast." }],
    },
  }),
  subclassSelectionLevels: [3],
};

export const subclassTemplate: HomebrewSubclassPayload = {
  kind: "subclass",
  name: "Order of the Ember",
  summary: "Runeweavers who bind fire into their marks.",
  parentClassRef: builtinClass("wizard"),
  levels: {
    3: { level: 3, features: [{ id: "ember-3", name: "Ember Bond", description: "Fiery affinity." }] },
    6: { level: 6, features: [{ id: "ember-6", name: "Cinderstep", description: "Teleport in flame." }] },
    10: { level: 10, features: [{ id: "ember-10", name: "Wildfire", description: "Spread the burn." }] },
    14: { level: 14, features: [{ id: "ember-14", name: "Inferno", description: "Become fire." }] },
  },
};

// ── Species ───────────────────────────────────────────────────────────────────

export const speciesWithLevelFive: HomebrewSpeciesPayload = {
  kind: "species",
  name: "Emberborn",
  summary: "Ash-skinned folk born from dormant volcanoes.",
  creatureType: "Humanoid",
  sizes: ["Medium", "Small"],
  speed: "30 ft.",
  abilityScoreMode: { type: "choice", pattern: "plus-two-plus-one" },
  languages: [{ id: "emberborn-langs", label: "Choose a language", count: 1, from: { type: "languages" } }],
  proficiencies: [],
  levels: {
    1: {
      level: 1,
      features: [
        { id: "ember-resistance", name: "Fire Resistance", description: "Resistance to fire damage." },
        { id: "ember-darkvision", name: "Darkvision", description: "See 60 ft. in the dark." },
      ],
    },
    5: {
      level: 5,
      features: [
        { id: "ember-flare", name: "Emberflare", description: "Once per long rest, erupt in flame." },
      ],
      resources: [{ resourceId: "emberflare", maximum: 1, recharge: "long-rest" }],
    },
  },
};

// ── Feats ───────────────────────────────────────────────────────────────────

export const repeatableFeat: HomebrewFeatPayload = {
  kind: "feat",
  name: "Elemental Adept",
  description: "You master an element, ignoring its resistance. May be taken multiple times.",
  category: "General",
  prerequisites: {
    rules: { op: "spellcasting", mode: "any" },
    displayText: "Prerequisite: the ability to cast at least one spell.",
  },
  repeatability: { mode: "unlimited", requiresDistinctChoices: true },
  choices: [
    {
      id: "element",
      label: "Choose a damage type",
      count: 1,
      distinct: true,
      from: { type: "list", options: ["acid", "cold", "fire", "lightning", "thunder"] },
    },
  ],
  effects: [
    {
      id: "adept-note",
      type: "sense",
      text: "Your spells ignore resistance to the chosen damage type.",
      gate: { type: "always" },
    },
  ],
};

/** Every valid fixture, for iteration in the schema test. */
export const validHomebrewFixtures = {
  plusTwoWeapon,
  strengthFloorArmor,
  ringOfInvisibility,
  sentientWeapon,
  fullCasterClass,
  partialCasterClass,
  subclassTemplate,
  speciesWithLevelFive,
  repeatableFeat,
} as const;
