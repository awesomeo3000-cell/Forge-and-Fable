import { describe, expect, it } from "vitest";
import { applyAbilityFloors, resolveMechanics } from "@/lib/homebrew/mechanicsResolver";
import { homebrewItemInstanceToSource } from "@/lib/homebrew/mechanicSources";
import { plusTwoWeapon, ringOfInvisibility, strengthFloorArmor } from "./fixtures/homebrew";
import type { HomebrewItemInstanceState, HomebrewItemPayload, RulesContentRef } from "@/types/homebrew";

const ref = (definitionId: string): RulesContentRef => ({
  source: "homebrew",
  kind: "item",
  definitionId,
  versionId: `${definitionId}-v1`,
  ruleset: "2014",
});

function instance(definitionId: string, over: Partial<HomebrewItemInstanceState> = {}): HomebrewItemInstanceState {
  return {
    contentRef: ref(definitionId),
    equipped: true,
    attuned: false,
    activeToggleIds: [],
    ...over,
  };
}

function resolveItem(payload: HomebrewItemPayload, inst: HomebrewItemInstanceState, level = 5) {
  return resolveMechanics([homebrewItemInstanceToSource(payload, inst, level)]);
}

describe("+2 weapon (source-item scope)", () => {
  it("bonuses land only on the source item, not character-wide", () => {
    const result = resolveItem(plusTwoWeapon, instance("moonsteel"));
    // character totals gain nothing
    expect(result.numericTotals["weapon-attack"]).toBeUndefined();
    expect(result.numericTotals["weapon-damage"]).toBeUndefined();
    // the item's own bucket carries +2/+2
    const bucket = Object.values(result.sourceItemBonuses)[0];
    expect(bucket).toMatchObject({ "weapon-attack": 2, "weapon-damage": 2 });
  });

  it("contributes nothing while unequipped", () => {
    const result = resolveItem(plusTwoWeapon, instance("moonsteel", { equipped: false }));
    expect(result.contributions).toHaveLength(0);
    expect(Object.keys(result.sourceItemBonuses)).toHaveLength(0);
  });
});

describe("Strength-floor armor", () => {
  const base = { strength: 18, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };

  it("raises 18 to 19 when equipped", () => {
    const result = resolveItem(strengthFloorArmor, instance("plate", { attuned: true }));
    expect(applyAbilityFloors(base, result.abilityFloors).strength).toBe(19);
  });

  it("leaves 20 unchanged", () => {
    const result = resolveItem(strengthFloorArmor, instance("plate", { attuned: true }));
    expect(applyAbilityFloors({ ...base, strength: 20 }, result.abilityFloors).strength).toBe(20);
  });

  it("does not apply while unequipped", () => {
    const result = resolveItem(strengthFloorArmor, instance("plate", { equipped: false }));
    expect(result.abilityFloors.strength).toBeUndefined();
  });
});

describe("Ring of Invisibility (equip + attune + toggle)", () => {
  const on = { equipped: true, attuned: true, activeToggleIds: ["invisible"] };

  it("applies the condition only when all three gates are satisfied", () => {
    const result = resolveItem(ringOfInvisibility, instance("ring", on));
    expect(result.conditions.map((c) => c.conditionId)).toContain("invisible");
  });

  it.each([
    ["not equipped", { ...on, equipped: false }],
    ["not attuned", { ...on, attuned: false }],
    ["toggle off", { ...on, activeToggleIds: [] }],
  ])("suppresses the condition when %s", (_label, over) => {
    const result = resolveItem(ringOfInvisibility, instance("ring", over));
    expect(result.conditions).toHaveLength(0);
  });
});

describe("provenance guarantee", () => {
  it("every applied contribution carries a source ref", () => {
    const result = resolveItem(plusTwoWeapon, instance("moonsteel"));
    expect(result.contributions.length).toBeGreaterThan(0);
    for (const c of result.contributions) {
      expect(c.sourceRef).toBeTruthy();
      expect(c.sourceInstanceId).toBeTruthy();
    }
  });
});
