import { describe, expect, it } from "vitest";
import { evaluateGate } from "@/lib/homebrew/effectGate";
import { applyAbilityFloors, resolveMechanics, type MechanicSource } from "@/lib/homebrew/mechanicsResolver";
import { characterEffectToSource } from "@/lib/homebrew/mechanicSources";
import type { MechanicEffect, RulesContentRef } from "@/types/homebrew";
import type { CharacterEffect } from "@/types/game";

const hbRef = (definitionId: string): RulesContentRef => ({
  source: "homebrew",
  kind: "item",
  definitionId,
  versionId: `${definitionId}-v1`,
  ruleset: "2014",
});

function source(id: string, effects: MechanicEffect[], gate: Partial<MechanicSource["gateState"]> = {}, def = id): MechanicSource {
  return {
    sourceInstanceId: id,
    sourceRef: hbRef(def),
    label: id,
    effects,
    gateState: { characterLevel: 1, equipped: true, attuned: true, ...gate },
  };
}

describe("evaluateGate", () => {
  it("fails closed on unmet toggle/stage/level gates", () => {
    const state = { characterLevel: 3, activeToggleIds: ["a"], currentStageId: "s1" };
    expect(evaluateGate({ type: "toggle", toggleId: "a" }, state)).toBe(true);
    expect(evaluateGate({ type: "toggle", toggleId: "b" }, state)).toBe(false);
    expect(evaluateGate({ type: "stage", stageIds: ["s1", "s2"] }, state)).toBe(true);
    expect(evaluateGate({ type: "stage", stageIds: ["s9"] }, state)).toBe(false);
    expect(evaluateGate({ type: "minimum-level", level: 3 }, state)).toBe(true);
    expect(evaluateGate({ type: "minimum-level", level: 4 }, state)).toBe(false);
    expect(evaluateGate({ type: "all", gates: [{ type: "toggle", toggleId: "a" }, { type: "minimum-level", level: 4 }] }, state)).toBe(false);
    expect(evaluateGate({ type: "any", gates: [{ type: "toggle", toggleId: "z" }, { type: "minimum-level", level: 1 }] }, state)).toBe(true);
  });
});

describe("provenance", () => {
  it("attaches source instance and ref to every contribution", () => {
    const result = resolveMechanics([
      source("s1", [{ id: "e1", type: "numeric-bonus", target: "ac", value: 2, gate: { type: "always" } }]),
    ]);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0]).toMatchObject({ sourceInstanceId: "s1", effectId: "e1", target: "ac", value: 2 });
    expect(result.contributions[0].sourceRef).toEqual(hbRef("s1"));
  });
});

describe("idempotency", () => {
  it("applies the same source instance only once even if passed twice", () => {
    const s = source("dup", [{ id: "e1", type: "numeric-bonus", target: "ac", value: 3, gate: { type: "always" } }]);
    const once = resolveMechanics([s]);
    const twice = resolveMechanics([s, s]);
    expect(twice.numericTotals.ac).toBe(once.numericTotals.ac);
    expect(twice.contributions).toHaveLength(1);
  });
});

describe("numeric stacking", () => {
  it("sums bonuses from distinct sources", () => {
    const result = resolveMechanics([
      source("a", [{ id: "x", type: "numeric-bonus", target: "ac", value: 1, gate: { type: "always" } }], {}, "defA"),
      source("b", [{ id: "y", type: "numeric-bonus", target: "ac", value: 2, gate: { type: "always" } }], {}, "defB"),
    ]);
    expect(result.numericTotals.ac).toBe(3);
  });

  it("takes the max among same-source non-stacking bonuses, but sums across sources", () => {
    const nonStack = (id: string, value: number): MechanicEffect => ({
      id,
      type: "numeric-bonus",
      target: "saving-throws",
      value,
      stacking: "same-source-nonstacking",
      gate: { type: "always" },
    });
    const result = resolveMechanics([
      source("a1", [nonStack("x", 1), nonStack("y", 2)], {}, "defA"),
      source("b1", [nonStack("z", 2)], {}, "defB"),
    ]);
    // defA contributes max(1,2)=2; defB contributes 2; total 4.
    expect(result.numericTotals["saving-throws"]).toBe(4);
  });
});

describe("ability floors", () => {
  it("keeps the strongest floor and never lowers a higher score", () => {
    const result = resolveMechanics([
      source("a", [{ id: "f1", type: "ability-floor", ability: "strength", minimum: 17, gate: { type: "always" } }]),
      source("b", [{ id: "f2", type: "ability-floor", ability: "strength", minimum: 19, gate: { type: "always" } }]),
    ]);
    expect(result.abilityFloors.strength).toBe(19);
    expect(applyAbilityFloors({ strength: 18, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, result.abilityFloors).strength).toBe(19);
    expect(applyAbilityFloors({ strength: 20, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, result.abilityFloors).strength).toBe(20);
  });
});

describe("auras", () => {
  it("applies a self aura's inner effects locally and records ally auras for later", () => {
    const selfAura: MechanicEffect = {
      id: "self-aura",
      type: "aura",
      radiusFeet: 10,
      recipient: "self",
      gate: { type: "always" },
      effects: [{ id: "in", type: "numeric-bonus", target: "ac", value: 1, gate: { type: "always" } }],
    };
    const allyAura: MechanicEffect = {
      id: "ally-aura",
      type: "aura",
      radiusFeet: 30,
      recipient: "allies",
      gate: { type: "always" },
      effects: [{ id: "bless", type: "d20-rider", dice: "1d4", appliesTo: ["attack"], gate: { type: "always" } }],
    };
    const result = resolveMechanics([source("s", [selfAura, allyAura])]);
    expect(result.numericTotals.ac).toBe(1); // self aura applied
    expect(result.d20Riders).toHaveLength(0); // ally rider not applied to self
    expect(result.auras).toHaveLength(1);
    expect(result.auras[0].recipient).toBe("allies");
  });
});

describe("legacy CharacterEffect adapter", () => {
  it("maps an active effect's flat bonuses, rider, and sense", () => {
    const effect: CharacterEffect = { id: "bless", label: "Bless", active: true, attack: 0, d20Dice: "1d4", sense: "Darkvision 60 ft." };
    const src = characterEffectToSource(effect, "2014");
    expect(src).not.toBeNull();
    const result = resolveMechanics([src!]);
    expect(result.d20Riders).toHaveLength(1);
    expect(result.senses).toHaveLength(1);
  });

  it("returns null for an inactive effect", () => {
    expect(characterEffectToSource({ id: "x", label: "x", active: false }, "2014")).toBeNull();
  });
});
