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
      // Spellcasting requirement
      if (SPELLCASTER_PREREQ.test(f.otherPrereq) && (!ctx?.casterType || ctx.casterType === "none")) {
        return false;
      }
      // Ability-score requirement (DEX 13+, STR 13+, INT/WIS 13+, …)
      if (!meetsAbilityPrereq(f.otherPrereq, ctx?.abilities)) return false;
      // Chain feat (e.g. "Strike of the Giants")
      if (ctx?.existingFeatIds) {
        const looksLikeFeatChain = /strike|giant|adept/i.test(f.otherPrereq);
        const prereqFeatId = f.otherPrereq.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        if (looksLikeFeatChain && !ctx.existingFeatIds.some((id) => id.toLowerCase() === prereqFeatId)) {
          return false;
        }
      }
    }

    return true;
  });
}
