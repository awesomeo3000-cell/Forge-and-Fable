import type { AbilityKey, AbilityScores, DraftCharacter, Ruleset } from "@/types/game";
import { abilityKeys, emptyAbilities } from "@/lib/utils";

// ──── Quickbuilder question flow ────

export type FightStyle = "weapons" | "magic" | "sneaky" | "faith";

export const FIGHT_STYLES: { id: FightStyle; label: string; summary: string }[] = [
  { id: "weapons", label: "Weapons & Armor", summary: "You lead the charge with steel and muscle." },
  { id: "magic", label: "Magic", summary: "Arcane power flows through you — blasts, illusions, or control." },
  { id: "sneaky", label: "Sneaky & Skills", summary: "Precision strikes, cunning plans, and a silver tongue." },
  { id: "faith", label: "Faith & Support", summary: "Divine or primal magic to heal, protect, or smite." },
];

export const STYLE_TO_CLASSES: Record<FightStyle, string[]> = {
  weapons: ["barbarian", "fighter", "monk", "paladin"],
  magic: ["sorcerer", "warlock", "wizard"],
  sneaky: ["bard", "ranger", "rogue"],
  faith: ["cleric", "druid"],
};

// ──── Premade archetypes ────

export type PremadeArchetype = {
  id: string;
  label: string;
  summary: string;
  classId: string;
  raceId: string;
};

export const PREMADE_ARCHETYPES: PremadeArchetype[] = [
  { id: "tank", label: "Tank", summary: "Goliath Fighter — unstoppable front line.", classId: "fighter", raceId: "goliath" },
  { id: "healer", label: "Healer", summary: "Human Cleric — divine restoration.", classId: "cleric", raceId: "human" },
  { id: "face", label: "Face", summary: "Half-Elf Bard — charm and wit.", classId: "bard", raceId: "half-elf-legacy" },
  { id: "blaster", label: "Blaster", summary: "Tiefling Sorcerer — raw arcane firepower.", classId: "sorcerer", raceId: "tiefling" },
  { id: "sneak", label: "Sneak", summary: "Halfling Rogue — unseen and deadly.", classId: "rogue", raceId: "halfling" },
  { id: "natures-wrath", label: "Nature's Wrath", summary: "Elf Druid — fury of the wild.", classId: "druid", raceId: "elf" },
];

// ──── Draft builder ────

/**
 * Allocate point-buy ability scores for a class's primary abilities.
 * Deterministic mapping: 15/14 in primaries, 13 CON or next best, rest 12/10/8.
 */
function allocateStats(primary: AbilityKey[]): AbilityScores {
  const scores = { ...emptyAbilities } as AbilityScores;
  const values = [15, 14, 13, 12, 10, 8];
  let vi = 0;

  // First primary gets 15, second gets 14
  for (const p of primary) {
    if (vi < values.length) scores[p] = values[vi++];
  }

  // If CON not already assigned, it gets the next value
  if (vi < values.length && !primary.includes("constitution")) {
    scores.constitution = values[vi++];
  }

  // Remaining abilities get the rest of the values in alphabetical order
  const remaining = abilityKeys.filter((k) => scores[k] === 8 && vi < values.length);
  remaining.sort().forEach((k) => {
    if (vi < values.length) scores[k] = values[vi++];
  });

  return scores;
}

export function buildQuickDraft(ruleset: Ruleset, classId: string, raceId: string, name: string): DraftCharacter {
  const heroClass = ruleset.classes.find((c) => c.id === classId);
  if (!heroClass) throw new Error(`Class "${classId}" not found in ruleset.`);

  const race = ruleset.races.find((r) => r.id === raceId);
  if (!race) throw new Error(`Race "${raceId}" not found in ruleset.`);

  const abilities = allocateStats(heroClass.primary);
  const background = ruleset.backgrounds[0] ?? "";
  const alignment = ruleset.alignments[0] ?? "";

  const draft: DraftCharacter = {
    name,
    level: 1,
    alignment,
    background,
    physicalCharacteristics: "",
    personalCharacteristics: "",
    generalNotes: "",
    raceId,
    classId,
    sourceIds: ["5e-core"],
    settings: {
      diceRollingEnabled: false,
      optionalClassFeatures: false,
      customizeOrigin: false,
      advancementType: "milestone",
      hitPointType: "fixed",
      usePrerequisites: false,
      useFeatPrerequisites: false,
      useMulticlassPrerequisites: false,
      showLevelScaledSpells: false,
      encumbranceType: "none",
      ignoreCoinWeight: false,
      modifiersTop: false,
    },
    abilities,
    currentHp: 8,
    maxHp: 8,
    tempHp: 0,
    inventory: [],
    spellsKnown: heroClass.spellSuggestions.slice(0, 3),
    customRules: [],
    skillProficiencies: [],
    deathSaves: { successes: 0, failures: 0 },
  };

  return draft;
}
