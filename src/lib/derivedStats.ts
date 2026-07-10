import type { AbilityScores, ASIChoice } from "@/types/game";
import { computeFeatBonuses } from "@/lib/featBonuses";
import { abilityModifier } from "@/lib/utils";

export function hasFeat(choices: ASIChoice[] | undefined, featId: string) {
  return (choices ?? []).some((choice) => choice.type === "feat" && choice.featId === featId);
}

export function finalAbilityAfterChoices(
  currentFinalScore: number,
  ability: keyof AbilityScores,
  currentChoices: ASIChoice[] | undefined,
  nextChoices: ASIChoice[] | undefined,
) {
  const currentIncrease = computeFeatBonuses(currentChoices).abilityIncreases[ability] ?? 0;
  const nextIncrease = computeFeatBonuses(nextChoices).abilityIncreases[ability] ?? 0;
  return currentFinalScore + nextIncrease - currentIncrease;
}

/** Final HP gain for a level, including retroactive CON and Tough changes. */
export function levelUpHpGain(input: {
  baseGain: number;
  newLevel: number;
  currentConstitution: number;
  nextConstitution: number;
  currentChoices?: ASIChoice[];
  nextChoices?: ASIChoice[];
}) {
  const oldLevel = Math.max(0, input.newLevel - 1);
  const conDelta = abilityModifier(input.nextConstitution) - abilityModifier(input.currentConstitution);
  const oldToughPerLevel = hasFeat(input.currentChoices, "tough") ? 2 : 0;
  const nextToughPerLevel = hasFeat(input.nextChoices, "tough") ? 2 : 0;
  const toughDelta = nextToughPerLevel * input.newLevel - oldToughPerLevel * oldLevel;
  return input.baseGain + conDelta * input.newLevel + toughDelta;
}

/**
 * Apply per-level bonuses selected during above-level-one creation. Level-one
 * keeps one share in the base HP; each recorded later-level gain gets one.
 */
export function applyCreationHpBonuses(input: {
  maxHp: number;
  currentHp: number;
  hpGains: number[];
  level: number;
  baseConstitution: number;
  choices?: ASIChoice[];
}) {
  const bonusAtLevel = (level: number) => {
    const choices = (input.choices ?? []).filter((choice) => choice.level <= level);
    const constitutionIncrease = computeFeatBonuses(choices).abilityIncreases.constitution ?? 0;
    const conPerLevel = abilityModifier(input.baseConstitution + constitutionIncrease) - abilityModifier(input.baseConstitution);
    return conPerLevel + (hasFeat(choices, "tough") ? 2 : 0);
  };
  const finalPerLevelBonus = bonusAtLevel(input.level);
  const totalBonus = finalPerLevelBonus * input.level;
  return {
    maxHp: input.maxHp + totalBonus,
    currentHp: input.currentHp + totalBonus,
    hpGains: input.hpGains.map((gain, index) => {
      const level = index + 2;
      const levelBonus = bonusAtLevel(level);
      const priorBonus = bonusAtLevel(level - 1);
      return gain + levelBonus * level - priorBonus * (level - 1);
    }),
  };
}

/** Passive checks intentionally exclude temporary roll-only riders. */
export function passiveSkillScore(input: {
  abilityScore: number;
  proficiencyBonus: number;
  proficient?: boolean;
  expertise?: boolean;
  jackOfAllTrades?: boolean;
  staticBonus?: number;
}) {
  const proficiency = input.expertise
    ? input.proficiencyBonus * 2
    : input.proficient
      ? input.proficiencyBonus
      : input.jackOfAllTrades
        ? Math.max(1, Math.floor(input.proficiencyBonus / 2))
        : 0;
  return 10 + abilityModifier(input.abilityScore) + proficiency + (input.staticBonus ?? 0);
}
