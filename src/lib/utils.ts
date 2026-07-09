import type { AbilityKey, AbilityScores, Character, CharacterEffect, CharacterSettings, Currency, CustomRule, InventoryItem, Ruleset } from "@/types/game";
import { DEFAULT_STARTING_HP } from "@/lib/constants";
import { BACKGROUND_TOOL_GRANTS, CLASS_TOOL_GRANTS } from "@/lib/srd";

export const abilityKeys: AbilityKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

export const abilityLabels: Record<AbilityKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export const abilityNames: Record<AbilityKey, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
};

export const classArtById: Record<string, string> = {
  barbarian: "/class-art/barbarian.jfif",
  bard: "/class-art/bard.jfif",
  cleric: "/class-art/cleric.jfif",
  druid: "/class-art/druid.jfif",
  fighter: "/class-art/fighter.jfif",
  monk: "/class-art/monk.jfif",
  paladin: "/class-art/paladin.jfif",
  ranger: "/class-art/ranger.jfif",
  rogue: "/class-art/rogue.jfif",
  sorcerer: "/class-art/sorcerer.jfif",
  warlock: "/class-art/warlock.jfif",
  wizard: "/class-art/wizard.jfif",
};

export const pointCosts: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const standardArray = [15, 14, 13, 12, 10, 8];

export const emptyAbilities: AbilityScores = {
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
};

export const sourceOptions = [
  {
    id: "homebrew",
    name: "Homebrew",
    summary:
      "Character options designed by other players and uploaded to Forge & Fable. Talk to your DM before including Homebrew content.",
  },
  {
    id: "5-5e-core",
    name: "5.5e Core Rules",
    summary:
      "Character options from the 5.5e Player's Handbook, Dungeon Master's Guide, Monster Manual, and Forge & Fable Basic Rules.",
  },
  {
    id: "5-5e-expanded",
    name: "5.5e Expanded Rules",
    summary: "Character options from supplementary sourcebooks beyond the 5.5e Core Rules.",
  },
  {
    id: "5e-core",
    name: "5e Core Rules",
    summary:
      "Character options from the 5e Player's Handbook, Dungeon Master's Guide, Monster Manual, and Basic Rules.",
  },
  {
    id: "5e-expanded",
    name: "5e Expanded Rules",
    summary:
      "Character options from supplementary sourcebooks such as Tasha's Cauldron of Everything and Xanathar's Guide to Everything, that are beyond the 5e Core Rules.",
  },
];

export function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export function proficiencyBonus(level: number) {
  return 2 + Math.floor((level - 1) / 4);
}

export function rollDie(sides: number) {
  const wholeSides = Math.floor(sides);
  if (!Number.isFinite(wholeSides) || wholeSides < 1) return 1;

  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const max = 0xffffffff;
    const limit = max - (max % wholeSides);
    const buffer = new Uint32Array(1);
    let value = 0;

    do {
      cryptoApi.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);

    return (value % wholeSides) + 1;
  }

  return Math.floor(Math.random() * wholeSides) + 1;
}

export function scoreFrom4d6() {
  const rolls = Array.from({ length: 4 }, () => rollDie(6)).sort((a, b) => b - a);
  return rolls.slice(0, 3).reduce((sum, value) => sum + value, 0);
}

export function inventoryEntry(name: string, index: number): InventoryItem {
  return {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    name,
    rarity: "Common",
    attunement: false,
    notes: "Starting kit item.",
  };
}

export function createInitialDraft(ruleset: Ruleset) {
  return {
    name: "",
    level: 1,
    alignment: ruleset.alignments[4],
    background: "",
    physicalCharacteristics: "",
    personalCharacteristics: "",
    generalNotes: "",
    raceId: "",
    classId: "",
    sourceIds: [] as string[],
    settings: defaultCharacterSettings(),
    abilities: { ...emptyAbilities },
    currentHp: DEFAULT_STARTING_HP,
    maxHp: DEFAULT_STARTING_HP,
    tempHp: 0,
    inventory: [] as InventoryItem[],
    spellsKnown: [] as string[],
    customRules: [] as CustomRule[],
    skillProficiencies: [] as string[],
    toolProficiencies: [] as string[],
    languages: [] as string[],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    startingHpRolls: [] as number[],
    deathSaves: { successes: 0, failures: 0 },
  };
}

export function defaultCharacterSettings() {
  return {
    diceRollingEnabled: false,
    optionalClassFeatures: false,
    customizeOrigin: false,
    advancementType: "milestone" as const,
    hitPointType: "fixed" as const,
    usePrerequisites: false,
    useFeatPrerequisites: true,
    useMulticlassPrerequisites: false,
    showLevelScaledSpells: false,
    encumbranceType: "standard" as const,
    ignoreCoinWeight: false,
    modifiersTop: false,
  };
}

export function defaultAssignments(): Record<AbilityKey, number> {
  return {
    strength: 0,
    dexterity: 1,
    constitution: 2,
    intelligence: 3,
    wisdom: 4,
    charisma: 5,
  };
}

function startingHp(
  level: number,
  hitDie: number,
  constitutionModifier: number,
  hitPointType: CharacterSettings["hitPointType"],
  startingHpRolls: number[],
) {
  const safeLevel = Math.max(1, Math.min(20, Math.trunc(level)));
  const firstLevelHp = Math.max(1, hitDie + constitutionModifier);
  const fixedLevelHp = Math.max(1, Math.floor(hitDie / 2) + 1 + constitutionModifier);
  const extraLevels = safeLevel - 1;

  if (hitPointType === "rolled" && startingHpRolls.length >= extraLevels) {
    const hpRolls = startingHpRolls
      .slice(0, extraLevels)
      .map((roll) => Math.max(1, Math.trunc(roll) + constitutionModifier));

    return {
      maxHp: firstLevelHp + hpRolls.reduce((sum, gain) => sum + gain, 0),
      hpRolls,
    };
  }

  return {
    maxHp: firstLevelHp + extraLevels * fixedLevelHp,
    hpRolls: [] as number[],
  };
}

export function characterPayload(
  draft: {
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
    skillProficiencies: string[];
    raceBonusChoices?: Partial<AbilityScores>;
    toolProficiencies?: string[];
    languages?: string[];
    currency?: Currency;
    startingHpRolls?: number[];
    deathSaves: { successes: number; failures: number };
  },
  ruleset: Ruleset,
): Omit<Character, "id" | "userId" | "createdAt"> {
  const heroClass = ruleset.classes.find((item) => item.id === draft.classId) ?? ruleset.classes[0];
  const race = ruleset.races.find((item) => item.id === draft.raceId) ?? ruleset.races[0];
  const grantedTools = new Set([
    ...(CLASS_TOOL_GRANTS[draft.classId] ?? []),
    ...(BACKGROUND_TOOL_GRANTS[draft.background] ?? []),
    ...(draft.toolProficiencies ?? []),
  ]);
  const conScore = draft.abilities.constitution + (race.bonuses.constitution ?? 0);
  const { maxHp, hpRolls } = startingHp(
    draft.level,
    heroClass.hitDie,
    abilityModifier(conScore),
    draft.settings.hitPointType,
    draft.startingHpRolls ?? [],
  );
  const classGear = heroClass.startingGear.map((name, index) => inventoryEntry(name, index));
  const characterDraft = { ...draft };
  delete characterDraft.startingHpRolls;

  // Auto-add Darkvision sense effect if the species has a Darkvision trait
  const effects: CharacterEffect[] = [];
  if (race.traits.some((t) => t.name.toLowerCase().includes("darkvision"))) {
    effects.push({ id: "darkvision-60", label: "Darkvision 60 ft.", active: true, source: race.id, sense: "Darkvision 60 ft." });
  }

  return {
    ...characterDraft,
    currentHp: maxHp,
    maxHp,
    tempHp: 0,
    inventory: classGear,
    spellsKnown: heroClass.spellSuggestions.slice(0, 3),
    customRules: [],
    toolProficiencies: [...grantedTools],
    languages: draft.languages ?? [],
    currency: draft.currency ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    hpRolls: hpRolls.length > 0 ? hpRolls : undefined,
    ...(effects.length > 0 ? { effects } : {}),
  };
}

export function applyRaceBonuses(abilities: AbilityScores, raceId: string, ruleset: Ruleset) {
  const race = ruleset.races.find((item) => item.id === raceId) ?? ruleset.races[0];
  return abilityKeys.reduce((scores, key) => {
    scores[key] = abilities[key] + (race.bonuses[key] ?? 0);
    return scores;
  }, {} as AbilityScores);
}

// ── Custom Dice Formula Parser ──

export type DiceGroup = { sides: number; count: number; keepHighest?: number };
export type ParsedFormula = { groups: DiceGroup[]; modifier: number; error?: string };

const DICE_RE = /(\d+)?d(\d+)(?:kh(\d+))?/gi;
const MOD_RE = /([+-]\s*\d+)/g;

export function parseDiceFormula(formula: string): ParsedFormula {
  const cleaned = formula.replace(/\s+/g, "").toLowerCase();
  if (!cleaned) return { groups: [], modifier: 0, error: "Empty formula." };

  const groups: DiceGroup[] = [];
  let match: RegExpExecArray | null;
  DICE_RE.lastIndex = 0;

  while ((match = DICE_RE.exec(cleaned)) !== null) {
    const count = match[1] ? parseInt(match[1], 10) : 1;
    const sides = parseInt(match[2], 10);
    const keepHighest = match[3] ? parseInt(match[3], 10) : undefined;

    if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) {
      return { groups: [], modifier: 0, error: `Invalid die: d${sides}. Use d4, d6, d8, d10, d12, d20, or d100.` };
    }
    if (count < 1 || count > 100) {
      return { groups: [], modifier: 0, error: `Invalid die count: ${count}. Must be 1–100.` };
    }
    if (keepHighest !== undefined && (keepHighest < 1 || keepHighest > count)) {
      return { groups: [], modifier: 0, error: `Keep-highest (${keepHighest}) must be 1–${count}.` };
    }

    groups.push({ sides, count, keepHighest });
  }

  if (groups.length === 0 && !/[+-]\d/.test(cleaned)) {
    return { groups: [], modifier: 0, error: "No dice found. Use format like 2d6+1d4+3 or 4d6kh3." };
  }

  // Parse flat modifier from non-dice parts
  let modifier = 0;
  MOD_RE.lastIndex = 0;
  while ((match = MOD_RE.exec(cleaned)) !== null) {
    modifier += parseInt(match[1].replace(/\s+/g, ""), 10);
  }

  return { groups, modifier };
}

export function rollFormula(parsed: ParsedFormula): { rolls: number[][]; total: number; error?: string } {
  if (parsed.error) return { rolls: [], total: 0, error: parsed.error };
  if (parsed.groups.length === 0) return { rolls: [], total: parsed.modifier };

  const allRolls: number[][] = [];
  let total = 0;

  for (const group of parsed.groups) {
    const rolls: number[] = [];
    for (let i = 0; i < group.count; i++) {
      rolls.push(rollDie(group.sides));
    }
    rolls.sort((a, b) => b - a);

    const kept = group.keepHighest ? rolls.slice(0, group.keepHighest) : rolls;
    allRolls.push(rolls);
    total += kept.reduce((sum, v) => sum + v, 0);
  }

  total += parsed.modifier;
  return { rolls: allRolls, total };
}
