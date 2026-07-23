import { describe, expect, it } from "vitest";
import {
  HOMEBREW_LIMITS,
  validateClassPayload,
  validateFeatPayload,
  validateHomebrewPayload,
  validateItemPayload,
} from "@/lib/homebrew/homebrewSchema";
import {
  fullCasterClass,
  ringOfInvisibility,
  validHomebrewFixtures,
} from "./fixtures/homebrew";

describe("valid fixtures", () => {
  it.each(Object.entries(validHomebrewFixtures))("accepts the %s fixture", (_name, payload) => {
    expect(validateHomebrewPayload(payload)).toEqual([]);
  });
});

describe("payload dispatch", () => {
  it("rejects an unknown kind", () => {
    expect(validateHomebrewPayload({ kind: "vehicle" }).map((e) => e.path)).toContain("kind");
  });

  it("rejects non-object payloads without throwing", () => {
    for (const bad of [null, undefined, 42, "item", []]) {
      expect(() => validateHomebrewPayload(bad)).not.toThrow();
      expect(validateHomebrewPayload(bad).length).toBeGreaterThan(0);
    }
  });

  it("rejects a payload whose kind mismatches the typed wrapper", () => {
    expect(validateItemPayload(fullCasterClass).map((e) => e.path)).toContain("kind");
  });
});

describe("item payload validation", () => {
  it("rejects a gate that references a toggle the item does not declare", () => {
    const broken = {
      ...ringOfInvisibility,
      toggles: [],
      effects: [
        {
          id: "invis",
          type: "condition",
          conditionId: "invisible",
          label: "Invisible",
          gate: { type: "toggle", toggleId: "invisible" },
        },
      ],
    };
    const paths = validateItemPayload(broken).map((e) => e.path);
    expect(paths).toContain("effects[0].gate.toggleId");
  });

  it("rejects duplicate effect ids with a field path", () => {
    const broken = {
      ...ringOfInvisibility,
      effects: [
        { id: "dup", type: "numeric-bonus", target: "ac", value: 1, gate: { type: "equipped" } },
        { id: "dup", type: "numeric-bonus", target: "ac", value: 1, gate: { type: "equipped" } },
      ],
    };
    expect(validateItemPayload(broken).map((e) => e.path)).toContain("effects[1].id");
  });

  it("rejects too many stages", () => {
    const stages = Array.from({ length: HOMEBREW_LIMITS.maxStages + 1 }, (_v, i) => ({
      id: `s${i}`,
      name: `Stage ${i}`,
      order: i,
      description: "",
      activation: { type: "manual" },
      effects: [],
    }));
    const broken = { ...ringOfInvisibility, stages };
    expect(validateItemPayload(broken).map((e) => e.path)).toContain("stages");
  });

  it("rejects an over-long name", () => {
    const broken = { ...ringOfInvisibility, name: "x".repeat(HOMEBREW_LIMITS.titleChars + 1) };
    expect(validateItemPayload(broken).map((e) => e.path)).toContain("name");
  });
});

describe("class payload validation", () => {
  it("requires all 20 progression levels", () => {
    const levels = { ...fullCasterClass.levels } as Record<number, unknown>;
    delete levels[20];
    const broken = { ...fullCasterClass, levels };
    expect(validateClassPayload(broken).some((e) => e.path === "levels.20")).toBe(true);
  });

  it("requires custom casters to define all 20 slot rows", () => {
    const broken = {
      ...fullCasterClass,
      spellcasting: { ...fullCasterClass.spellcasting, mode: "custom", spellSlotsByLevel: { 1: [2] } },
    };
    const paths = validateClassPayload(broken).map((e) => e.path);
    expect(paths.some((p) => p.startsWith("spellcasting.spellSlotsByLevel"))).toBe(true);
  });

  it("rejects an invalid hit die", () => {
    expect(validateClassPayload({ ...fullCasterClass, hitDie: 7 }).map((e) => e.path)).toContain("hitDie");
  });

  it("rejects an invalid primary ability", () => {
    expect(
      validateClassPayload({ ...fullCasterClass, primaryAbilities: ["luck"] }).map((e) => e.path),
    ).toContain("primaryAbilities[0]");
  });
});

describe("feat payload validation", () => {
  it("rejects a limited feat without a maximum", () => {
    const broken = { ...validHomebrewFixtures.repeatableFeat, repeatability: { mode: "limited" } };
    expect(validateFeatPayload(broken).map((e) => e.path)).toContain("repeatability.maximum");
  });

  it("rejects an unknown repeatability mode", () => {
    const broken = { ...validHomebrewFixtures.repeatableFeat, repeatability: { mode: "sometimes" } };
    expect(validateFeatPayload(broken).map((e) => e.path)).toContain("repeatability.mode");
  });
});
