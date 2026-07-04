import raw from "@/data/feats.json";
import type { Feat } from "@/types/game";

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
}

const SPELLCASTER_PREREQ = /spellcasting|pact magic|the ability to cast/i;

/** Return feats the character is eligible for, filtered by prerequisites. */
export function availableFeats(ctx?: FeatFilterContext): Feat[] {
  return ALL_FEATS.filter((f) => {
    // Racial prerequisite: must match the character's race name
    if (f.racialPrereq && ctx?.raceName) {
      if (f.racialPrereq.toLowerCase() !== ctx.raceName.toLowerCase()) return false;
    }
    // If the feat has a racial prereq but we don't know the race, still show it
    // (the UI in the builder may not have race context yet).

    // otherPrereq: spellcasting requirement
    if (f.otherPrereq && SPELLCASTER_PREREQ.test(f.otherPrereq)) {
      if (!ctx?.casterType || ctx.casterType === "none") return false;
    }

    // otherPrereq: chain feat (e.g. "Strike of the Giants")
    if (f.otherPrereq && ctx?.existingFeatIds) {
      const prereqFeatId = f.otherPrereq.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!ctx.existingFeatIds.some((id) => id.toLowerCase() === prereqFeatId)) {
        // Only enforce if it looks like a feat-chain prerequisite (contains a feat name)
        const looksLikeFeatChain = /strike|giant|adept/i.test(f.otherPrereq);
        if (looksLikeFeatChain) return false;
      }
    }

    return true;
  });
}
