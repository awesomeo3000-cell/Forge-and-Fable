import { describe, expect, it } from "vitest";
import { computeSlotAvailability, resolveMechanics } from "@/lib/homebrew/mechanicsResolver";
import { homebrewItemInstanceToSource } from "@/lib/homebrew/mechanicSources";
import { sentientWeapon } from "./fixtures/homebrew";
import type { HomebrewItemInstanceState, RulesContentRef } from "@/types/homebrew";

const ref: RulesContentRef = {
  source: "homebrew",
  kind: "item",
  definitionId: "dawnbringer",
  versionId: "dawnbringer-v1",
  ruleset: "2014",
};

function instance(stageId: string): HomebrewItemInstanceState {
  return { contentRef: ref, equipped: true, attuned: true, activeToggleIds: [], currentStageId: stageId };
}

describe("spell-slot bonus from item stages", () => {
  it("grants one 3rd-level slot at stage 3", () => {
    const result = resolveMechanics([homebrewItemInstanceToSource(sentientWeapon, instance("stage-3"), 10)]);
    expect(result.spellSlotDeltas[3]).toBe(1);
  });

  it("grants no slot at an earlier stage", () => {
    const result = resolveMechanics([homebrewItemInstanceToSource(sentientWeapon, instance("stage-1"), 10)]);
    expect(result.spellSlotDeltas[3]).toBeUndefined();
  });

  it("records the Bless ally aura at stage 4", () => {
    const result = resolveMechanics([homebrewItemInstanceToSource(sentientWeapon, instance("stage-4"), 10)]);
    expect(result.auras).toHaveLength(1);
    expect(result.auras[0].recipient).toBe("allies");
  });
});

describe("overdrawn slot presentation", () => {
  it("adds a bonus slot and reports availability", () => {
    expect(computeSlotAvailability(0, 1, 0)).toEqual({ max: 1, used: 0, available: 1, overdrawn: false });
    expect(computeSlotAvailability(0, 1, 1)).toEqual({ max: 1, used: 1, available: 0, overdrawn: false });
  });

  it("reads as overdrawn (not clamped) when the bonus slot is removed after use", () => {
    // Used the bonus slot, then the item granting it is removed (delta -> 0).
    const afterRemoval = computeSlotAvailability(0, 0, 1);
    expect(afterRemoval).toEqual({ max: 0, used: 1, available: 0, overdrawn: true });
    // Base slots also overdraw correctly.
    expect(computeSlotAvailability(3, 0, 4)).toMatchObject({ max: 3, used: 4, overdrawn: true });
  });
});
