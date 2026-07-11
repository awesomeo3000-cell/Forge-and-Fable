import raw from "@/data/feats.json";
import type { AbilityKey, AbilityScores, Feat } from "@/types/game";

export const ALL_FEATS: Feat[] = raw as Feat[];

export const FEATS_BY_ID = new Map(ALL_FEATS.map((f) => [f.id, f]));

export function getFeat(id: string): Feat | undefined {
  return FEATS_BY_ID.get(id);
}

export interface FeatFilterContext {
  /** The character's race name (e.g. "Elf", "Dwarf"). */
  raceName?: string;
  /** The character's caster type ("full", "half", "pact", etc.) or undefined if non-caster. */
  casterType?: string;
  /** IDs of feats the character already has (for chain prerequisites). */
  existingFeatIds?: string[];
  /** The character's current level (for level-gated feats). */
  level?: number;
  /** The character's final ability scores, for ability-score prerequisites. */
  abilities?: AbilityScores;
  /** Class and ancestry proficiencies used by armor/weapon prerequisites. */
  proficiencies?: string[];
  /** Background name, used by prerequisites that offer a background alternative. */
  background?: string;
  /** When false (from CharacterSettings.useFeatPrerequisites), skip all
      prerequisite filtering and return every feat. Defaults to true. */
  enforcePrereqs?: boolean;
}

const SPELLCASTER_PREREQ = /spellcasting|pact magic|the ability to cast/i;

const ABILITY_WORDS: Record<string, AbilityKey> = {
  strength: "strength",
  dexterity: "dexterity",
  constitution: "constitution",
  intelligence: "intelligence",
  wisdom: "wisdom",
  charisma: "charisma",
};

/** Whether the character's race satisfies a feat's racial prerequisite.
    Token-based so "Elf" matches "Elf (drow)" and "Elf or half-elf", but a pure
    "Elf" does NOT match "Half-elf, half-orc, or human" (those stay one token). */
function raceMatchesPrereq(raceName: string, prereq: string): boolean {
  const target = raceName.trim().toLowerCase();
  const first = target.split(/[\s-]/)[0];
  const tokens = prereq.toLowerCase().split(/[\s,()]+/).filter(Boolean);
  return tokens.some((t) => t === target || t === first);
}

/** Ability-score prerequisites like "Dexterity 13 or higher" or "Intelligence
    or Wisdom 13 or higher". Prereqs without an ability threshold pass through;
    if scores are unknown we don't block. */
function meetsAbilityPrereq(prereq: string, abilities?: AbilityScores): boolean {
  const threshold = prereq.match(/(\d+)\s*or higher/i);
  if (!threshold) return true;
  const min = parseInt(threshold[1], 10);
  const needed = Object.keys(ABILITY_WORDS).filter((w) => new RegExp(`\\b${w}\\b`, "i").test(prereq));
  if (needed.length === 0 || !abilities) return true;
  // "X or Y 13+" — meeting the threshold in any listed ability qualifies.
  return needed.some((w) => (abilities[ABILITY_WORDS[w]] ?? 0) >= min);
}

function backgroundAlternativeMatches(prereq: string, background?: string): boolean {
  if (!background || !/background/i.test(prereq)) return false;
  return prereq.toLowerCase().includes(background.trim().toLowerCase());
}

function meetsProficiencyPrereq(prereq: string, proficiencies?: string[]): boolean {
  const match = prereq.match(/proficiency with (?:a |an )?([^,]+?)(?:\s+or\s+|$)/i);
  if (!match) return true;
  if (!proficiencies) return true;
  const required = match[1].trim().toLowerCase();
  const known = proficiencies.map((item) => item.toLowerCase());
  if (required === "martial weapon") return known.some((item) => item.includes("martial weapon"));
  if (required.endsWith(" armor")) {
    const armor = required.replace(/^a /, "");
    return known.some((item) => item.includes(armor) || item.includes("all armor"));
  }
  return known.some((item) => item.includes(required));
}

/** Return feats the character is eligible for, filtered by prerequisites.
    A prereq is only enforced when the relevant context is known — so the
    builder still shows everything before a race/abilities are chosen. */
export function availableFeats(ctx?: FeatFilterContext): Feat[] {
  if (ctx?.enforcePrereqs === false) return ALL_FEATS;

  return ALL_FEATS.filter((f) => {
    // Racial prerequisite
    if (f.racialPrereq && ctx?.raceName) {
      if (!raceMatchesPrereq(ctx.raceName, f.racialPrereq)) return false;
    }

    if (f.otherPrereq) {
      const backgroundMatches = backgroundAlternativeMatches(f.otherPrereq, ctx?.background);
      const levelMatch = f.otherPrereq.match(/(\d+)(?:st|nd|rd|th)?\s+Level/i);
      if (levelMatch && ctx?.level !== undefined && ctx.level < Number(levelMatch[1])) return false;
      // Spellcasting requirement
      if (SPELLCASTER_PREREQ.test(f.otherPrereq) && !backgroundMatches && (!ctx?.casterType || ctx.casterType === "none")) {
        return false;
      }
      // Ability-score requirement (DEX 13+, STR 13+, INT/WIS 13+, …)
      if (!meetsAbilityPrereq(f.otherPrereq, ctx?.abilities)) return false;
      if (!backgroundMatches && !meetsProficiencyPrereq(f.otherPrereq, ctx?.proficiencies)) return false;
      // Named feat prerequisite (e.g. "Strike of the Giants (Fire Strike) feat").
      const requiredFeat = ALL_FEATS.find((candidate) =>
        candidate.id !== f.id && f.otherPrereq!.toLowerCase().includes(candidate.name.toLowerCase()),
      );
      if (requiredFeat && ctx?.existingFeatIds && !ctx.existingFeatIds.includes(requiredFeat.id)) {
        return false;
      }
    }

    return true;
  });
}
