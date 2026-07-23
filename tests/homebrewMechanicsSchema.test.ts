import { describe, expect, it } from "vitest";
import {
  HOMEBREW_LIMITS,
  validateEffectGate,
  validateMechanicEffect,
} from "@/lib/homebrew/homebrewSchema";
import type { EffectGate, MechanicEffect } from "@/types/homebrew";

const gateOk = (gate: unknown, ctx?: Parameters<typeof validateEffectGate>[1]) =>
  validateEffectGate(gate, ctx).length === 0;
const effectPaths = (effect: unknown, ctx?: Parameters<typeof validateMechanicEffect>[1]) =>
  validateMechanicEffect(effect, ctx).map((e) => e.path);
const effectOk = (effect: unknown, ctx?: Parameters<typeof validateMechanicEffect>[1]) =>
  validateMechanicEffect(effect, ctx).length === 0;

describe("effect gates", () => {
  it("accepts simple gates", () => {
    for (const gate of [
      { type: "always" },
      { type: "equipped" },
      { type: "attuned" },
      { type: "minimum-level", level: 5 },
    ]) {
      expect(gateOk(gate)).toBe(true);
    }
  });

  it("rejects a toggle gate referencing an unknown toggle", () => {
    const ctx = { toggleIds: new Set<string>(), stageIds: new Set<string>() };
    expect(validateEffectGate({ type: "toggle", toggleId: "ghost" }, ctx).map((e) => e.path)).toContain(
      "gate.toggleId",
    );
  });

  it("accepts a toggle gate when the toggle exists in context", () => {
    const ctx = { toggleIds: new Set(["invisible"]), stageIds: new Set<string>() };
    expect(gateOk({ type: "toggle", toggleId: "invisible" }, ctx)).toBe(true);
  });

  it("caps gate nesting depth", () => {
    let gate: EffectGate = { type: "always" };
    for (let i = 0; i < HOMEBREW_LIMITS.maxNestingDepth + 2; i++) {
      gate = { type: "all", gates: [gate] };
    }
    expect(validateEffectGate(gate).length).toBeGreaterThan(0);
  });
});

describe("mechanic effects", () => {
  it("accepts each supported effect type", () => {
    const effects: MechanicEffect[] = [
      { id: "a", type: "numeric-bonus", target: "ac", value: 2, gate: { type: "always" } },
      { id: "b", type: "ability-floor", ability: "strength", minimum: 19, gate: { type: "equipped" } },
      { id: "c", type: "condition", conditionId: "invisible", label: "Invisible", gate: { type: "always" } },
      { id: "d", type: "d20-rider", dice: "1d4", appliesTo: ["attack", "save"], gate: { type: "always" } },
      { id: "e", type: "spell-slot-bonus", spellLevel: 3, amount: 1, gate: { type: "always" } },
      {
        id: "f",
        type: "resource-grant",
        resourceId: "ki",
        maximum: 5,
        recharge: "short-rest",
        gate: { type: "always" },
      },
      {
        id: "g",
        type: "spell-grant",
        spellRef: { source: "builtin", kind: "spell", id: "bless", ruleset: "2014" },
        gate: { type: "always" },
      },
      { id: "h", type: "sense", text: "darkvision 60 ft.", gate: { type: "always" } },
    ];
    for (const effect of effects) expect(effectOk(effect)).toBe(true);
  });

  it("enforces the numeric-bonus range", () => {
    expect(effectPaths({ id: "x", type: "numeric-bonus", target: "ac", value: 99, gate: { type: "always" } })).toContain(
      "effect.value",
    );
  });

  it("enforces the ability-floor range", () => {
    expect(
      effectPaths({ id: "x", type: "ability-floor", ability: "strength", minimum: 99, gate: { type: "equipped" } }),
    ).toContain("effect.minimum");
  });

  it("enforces spell-slot bounds", () => {
    expect(effectPaths({ id: "x", type: "spell-slot-bonus", spellLevel: 12, amount: 1, gate: { type: "always" } })).toContain(
      "effect.spellLevel",
    );
  });

  it("rejects a d20 rider with a formula instead of dice", () => {
    expect(
      effectPaths({ id: "x", type: "d20-rider", dice: "1d4 + level", appliesTo: ["attack"], gate: { type: "always" } }),
    ).toContain("effect.dice");
  });

  it("rejects an unknown effect type", () => {
    expect(effectPaths({ id: "x", type: "teleport", gate: { type: "always" } })).toContain("effect.type");
  });

  it("validates a self-contained aura and its inner effects", () => {
    const aura: MechanicEffect = {
      id: "aura",
      type: "aura",
      radiusFeet: 30,
      recipient: "allies",
      gate: { type: "always" },
      effects: [{ id: "inner", type: "d20-rider", dice: "1d4", appliesTo: ["attack"], gate: { type: "always" } }],
    };
    expect(effectOk(aura)).toBe(true);
  });

  it("rejects an aura nested inside an aura", () => {
    const nested = {
      id: "aura",
      type: "aura",
      radiusFeet: 30,
      recipient: "allies",
      gate: { type: "always" },
      effects: [
        { id: "inner", type: "aura", radiusFeet: 10, recipient: "self", gate: { type: "always" }, effects: [] },
      ],
    };
    expect(effectPaths(nested)).toContain("effect.effects[0].type");
  });

  it("requires a gate object", () => {
    expect(effectPaths({ id: "x", type: "numeric-bonus", target: "ac", value: 1 })).toContain("effect.gate");
  });

  it("does not throw on hostile input", () => {
    expect(() => validateMechanicEffect(null)).not.toThrow();
    expect(() => validateMechanicEffect([])).not.toThrow();
    expect(() => validateMechanicEffect({ type: 5 })).not.toThrow();
    expect(effectOk(null)).toBe(false);
  });
});
