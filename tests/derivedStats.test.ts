import { describe, expect, it } from "vitest";
import { applyCreationHpBonuses, finalAbilityAfterChoices, levelUpHpGain, passiveSkillScore } from "@/lib/derivedStats";
import type { ASIChoice } from "@/types/game";

describe("derived character rules", () => {
  it("applies a Constitution modifier increase retroactively at level up", () => {
    expect(levelUpHpGain({
      baseGain: 8,
      newLevel: 4,
      currentConstitution: 14,
      nextConstitution: 16,
    })).toBe(12);
  });

  it("applies Tough retroactively when selected and by +2 on later levels", () => {
    const tough: ASIChoice[] = [{ type: "feat", level: 4, featId: "tough" }];
    expect(levelUpHpGain({
      baseGain: 8,
      newLevel: 4,
      currentConstitution: 14,
      nextConstitution: 14,
      currentChoices: [],
      nextChoices: tough,
    })).toBe(16);
    expect(levelUpHpGain({
      baseGain: 8,
      newLevel: 5,
      currentConstitution: 14,
      nextConstitution: 14,
      currentChoices: tough,
      nextChoices: tough,
    })).toBe(10);
  });

  it("records above-level-one retroactive bonuses at the level acquired", () => {
    const choices: ASIChoice[] = [
      { type: "asi", level: 4, increases: { constitution: 2 } },
      { type: "feat", level: 4, featId: "tough" },
    ];
    const result = applyCreationHpBonuses({
      maxHp: 40,
      currentHp: 40,
      hpGains: [7, 7, 7, 7],
      level: 5,
      baseConstitution: 14,
      choices,
    });
    expect(result).toEqual({
      maxHp: 55,
      currentHp: 55,
      hpGains: [7, 7, 19, 10],
    });
  });

  it("derives ability changes from the complete choice history", () => {
    const next: ASIChoice[] = [{ type: "asi", level: 4, increases: { constitution: 2 } }];
    expect(finalAbilityAfterChoices(14, "constitution", [], next)).toBe(16);
  });

  it("keeps temporary roll riders out of passive checks", () => {
    expect(passiveSkillScore({ abilityScore: 16, proficiencyBonus: 3, proficient: true })).toBe(16);
    expect(passiveSkillScore({ abilityScore: 12, proficiencyBonus: 3, jackOfAllTrades: true })).toBe(12);
  });
});
