import type { AbilityScores, ASIChoice } from "@/types/game";
import { getFeat } from "@/lib/feats";
import { abilityKeys } from "@/lib/utils";

export interface FeatMechanicalBonus {
  /** Additional ability score increases to apply (from both ASIs and feats). */
  abilityIncreases: Partial<AbilityScores>;
  /** Bonus to initiative. */
  initiativeBonus: number;
  /** Bonus to AC. */
  acBonus: number;
  /** Labels explaining where each bonus comes from (for tooltips). */
  sources: string[];
}

/** Parse a feat description for common numeric bonus patterns. */
function parseDescriptionBonuses(description: string): { initiativeBonus: number; acBonus: number } {
  let initiativeBonus = 0;
  let acBonus = 0;

  // "+X to initiative"
  const initMatch = description.match(/\+\s*(\d+)\s+to\s+initiative/i);
  if (initMatch) {
    initiativeBonus = parseInt(initMatch[1], 10);
  }

  // "+X to AC" or "+X bonus to AC"
  const acMatch = description.match(/\+\s*(\d+)\s+(?:bonus\s+)?(?:to\s+)?AC/i);
  if (acMatch) {
    acBonus = parseInt(acMatch[1], 10);
  }

  return { initiativeBonus, acBonus };
}

/** Compute all mechanical bonuses from a character's ASI and feat choices. */
export function computeFeatBonuses(asiChoices: ASIChoice[] | undefined): FeatMechanicalBonus {
  const abilityIncreases: Partial<AbilityScores> = {};
  let initiativeBonus = 0;
  let acBonus = 0;
  const sources: string[] = [];

  if (!asiChoices || asiChoices.length === 0) {
    return { abilityIncreases, initiativeBonus, acBonus, sources };
  }

  for (const choice of asiChoices) {
    if (choice.type === "asi") {
      // Direct ASI ability score increases
      for (const key of abilityKeys) {
        const increase = choice.increases[key] ?? 0;
        if (increase > 0) {
          abilityIncreases[key] = (abilityIncreases[key] ?? 0) + increase;
          sources.push(`ASI (level ${choice.level}): +${increase} ${key.toUpperCase()}`);
        }
      }
    } else if (choice.type === "feat") {
      const feat = getFeat(choice.featId);
      if (!feat) continue;

      // Apply ability bonuses from feat
      if (feat.fixedAbility && feat.abilityBonuses.length > 0) {
        // Fixed feat: all listed abilities get +1
        for (const key of feat.abilityBonuses) {
          abilityIncreases[key] = (abilityIncreases[key] ?? 0) + 1;
          sources.push(`${feat.name}: +1 ${key.toUpperCase()}`);
        }
      } else if (feat.chooseAbility && feat.abilityBonuses.length > 0) {
        // Choose-one feat: apply to the FIRST listed ability as default
        // (the UI would ideally let the player pick; for now default to first)
        const key = feat.abilityBonuses[0];
        abilityIncreases[key] = (abilityIncreases[key] ?? 0) + 1;
        sources.push(`${feat.name}: +1 ${key.toUpperCase()}`);
      }

      // Parse description for additional mechanical bonuses
      const { initiativeBonus: fInit, acBonus: fAc } = parseDescriptionBonuses(feat.description);

      if (fInit > 0) {
        initiativeBonus += fInit;
        sources.push(`${feat.name}: +${fInit} initiative`);
      }
      if (fAc > 0) {
        acBonus += fAc;
        sources.push(`${feat.name}: +${fAc} AC`);
      }
    }
  }

  return { abilityIncreases, initiativeBonus, acBonus, sources };
}
