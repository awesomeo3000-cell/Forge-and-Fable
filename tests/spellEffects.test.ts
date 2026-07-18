import { describe, it, expect } from "vitest";
import spellCatalog from "@/data/spells.json";
import {
  parseSimpleDice,
  scaleDicePerSlotLevel,
  resolveSpellEffects,
  rollResolvedEffect,
  formatRollDetail,
  previewDiceForLevel,
} from "@/lib/spellEffects";
import type { SpellData } from "@/types/game";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a minimal SpellData for testing. */
function makeSpell(overrides: Partial<SpellData> = {}): SpellData {
  return {
    id: "test-spell",
    name: "Test Spell",
    level: 1,
    school: "Evocation",
    castingTime: "1 Action",
    duration: "Instantaneous",
    range: "Self",
    area: "cone 15 ft",
    attack: "",
    save: "DEX Save",
    damageEffect: "Fire",
    ritual: false,
    concentration: false,
    components: { verbal: true, somatic: true, material: false },
    material: "",
    source: "Players Handbook",
    description: "Deals 3d6 fire damage on a failed save, or half on a success.",
    classes: ["sorcerer", "wizard"],
    ...overrides,
  };
}

// ── parseSimpleDice ────────────────────────────────────────────────────────

describe("parseSimpleDice", () => {
  it("parses simple NdX", () => {
    expect(parseSimpleDice("3d6")).toEqual({ count: 3, sides: 6, modifier: 0 });
  });

  it("parses NdX with positive modifier", () => {
    expect(parseSimpleDice("1d8+4")).toEqual({ count: 1, sides: 8, modifier: 4 });
  });

  it("parses NdX with negative modifier", () => {
    expect(parseSimpleDice("2d10-1")).toEqual({ count: 2, sides: 10, modifier: -1 });
  });

  it("parses with spaces around operator", () => {
    expect(parseSimpleDice("1d4 + 1")).toEqual({ count: 1, sides: 4, modifier: 1 });
  });

  it("returns null for non-dice text", () => {
    expect(parseSimpleDice("hello")).toBeNull();
    expect(parseSimpleDice("")).toBeNull();
  });

  it("returns null for complex expressions", () => {
    expect(parseSimpleDice("2d6+1d4")).toBeNull();
    expect(parseSimpleDice("4d6kh3")).toBeNull();
  });

  it("parses large dice counts", () => {
    expect(parseSimpleDice("10d6")).toEqual({ count: 10, sides: 6, modifier: 0 });
  });
});

// ── scaleDicePerSlotLevel ──────────────────────────────────────────────────

describe("scaleDicePerSlotLevel", () => {
  it("returns base dice when additionalLevels is 0", () => {
    expect(scaleDicePerSlotLevel("3d6", "1d6", 0)).toBe("3d6");
  });

  it("returns base dice when additionalLevels is negative", () => {
    expect(scaleDicePerSlotLevel("3d6", "1d6", -1)).toBe("3d6");
  });

  it("combines matching dice: 3d6 + 1×1d6 = 4d6", () => {
    expect(scaleDicePerSlotLevel("3d6", "1d6", 1)).toBe("4d6");
  });

  it("combines matching dice: 3d6 + 2×1d6 = 5d6", () => {
    expect(scaleDicePerSlotLevel("3d6", "1d6", 2)).toBe("5d6");
  });

  it("combines matching dice with modifiers: 3d4+3 + 2×1d4+1 = 5d4+5", () => {
    expect(scaleDicePerSlotLevel("3d4 + 3", "1d4 + 1", 2)).toBe("5d4+5");
  });

  it("handles modifier-only on base", () => {
    expect(scaleDicePerSlotLevel("1d8+4", "1d8", 2)).toBe("3d8+4");
  });

  it("returns fallback when dice sides differ", () => {
    const result = scaleDicePerSlotLevel("2d6", "1d8", 1);
    expect(result).toBe("2d6 + 1 × 1d8");
  });

  it("returns fallback when base is unparseable", () => {
    const result = scaleDicePerSlotLevel("special", "1d6", 1);
    expect(result).toBe("special + 1 × 1d6");
  });

  it("returns fallback when added is unparseable", () => {
    const result = scaleDicePerSlotLevel("3d6", "special", 1);
    expect(result).toBe("3d6 + 1 × special");
  });

  it("scales healing dice: 1d8 + 2×1d8 = 3d8", () => {
    expect(scaleDicePerSlotLevel("1d8", "1d8", 2)).toBe("3d8");
  });

  it("scales with many additional levels", () => {
    expect(scaleDicePerSlotLevel("8d6", "1d6", 5)).toBe("13d6");
  });
});

// ── resolveSpellEffects ────────────────────────────────────────────────────

describe("resolveSpellEffects", () => {
  // Burning Hands is in the registry as: 3d6 fire, +1d6 per level above 1st, DEX half.

  it("resolves Burning Hands at 1st level as 3d6", () => {
    const spell = makeSpell({ id: "burning-hands", name: "Burning Hands" });
    const effects = resolveSpellEffects(spell, 1);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      type: "damage",
      dice: "3d6",
      damageType: "fire",
      saveResult: "half",
    });
  });

  it("resolves Burning Hands at 2nd level as 4d6", () => {
    const spell = makeSpell({ id: "burning-hands", name: "Burning Hands" });
    const effects = resolveSpellEffects(spell, 2);
    expect(effects[0]).toMatchObject({ dice: "4d6" });
  });

  it("resolves Burning Hands at 3rd level as 5d6", () => {
    const spell = makeSpell({ id: "burning-hands", name: "Burning Hands" });
    const effects = resolveSpellEffects(spell, 3);
    expect(effects[0]).toMatchObject({ dice: "5d6" });
  });

  it("resolves Burning Hands at 5th level as 7d6", () => {
    const spell = makeSpell({ id: "burning-hands", name: "Burning Hands" });
    const effects = resolveSpellEffects(spell, 5);
    expect(effects[0]).toMatchObject({ dice: "7d6" });
  });

  // Cure Wounds: 1d8 healing, +1d8 per level above 1st.

  it("resolves Cure Wounds at 1st level as 1d8", () => {
    const spell = makeSpell({
      id: "cure-wounds",
      name: "Cure Wounds",
      damageEffect: "Healing",
      save: "",
    });
    const effects = resolveSpellEffects(spell, 1);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: "healing", dice: "1d8" });
  });

  it("resolves Cure Wounds at 3rd level as 3d8", () => {
    const spell = makeSpell({
      id: "cure-wounds",
      name: "Cure Wounds",
      damageEffect: "Healing",
      save: "",
    });
    const effects = resolveSpellEffects(spell, 3);
    expect(effects[0]).toMatchObject({ dice: "3d8" });
  });

  // Magic Missile: 3d4+3 force, +1d4+1 per level above 1st.

  it("resolves Magic Missile at 1st level as 3d4+3", () => {
    const spell = makeSpell({
      id: "magic-missile",
      name: "Magic Missile",
      damageEffect: "Force",
      save: "",
    });
    const effects = resolveSpellEffects(spell, 1);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ damageType: "force", dice: "3d4+3" });
  });

  it("resolves Magic Missile at 2nd level as 4d4+4", () => {
    const spell = makeSpell({
      id: "magic-missile",
      name: "Magic Missile",
      damageEffect: "Force",
      save: "",
    });
    const effects = resolveSpellEffects(spell, 2);
    expect(effects[0]).toMatchObject({ dice: "4d4+4" });
  });

  it("resolves Magic Missile at 4th level as 6d4+6", () => {
    const spell = makeSpell({
      id: "magic-missile",
      name: "Magic Missile",
      damageEffect: "Force",
      save: "",
    });
    const effects = resolveSpellEffects(spell, 4);
    expect(effects[0]).toMatchObject({ dice: "6d4+6" });
  });

  // Ice Knife: piercing (1d10, no scaling) + cold (2d6, +1d6 per level).

  it("resolves Ice Knife with separate damage components", () => {
    const spell = makeSpell({
      id: "ice-knife",
      name: "Ice Knife",
      damageEffect: "Piercing (...)",
    });
    const effects = resolveSpellEffects(spell, 2);
    expect(effects).toHaveLength(2);
    expect(effects[0]).toMatchObject({ type: "damage", dice: "1d10", damageType: "piercing" });
    expect(effects[1]).toMatchObject({ type: "damage", dice: "3d6", damageType: "cold", saveResult: "half" });
  });

  it("resolves Ice Knife at 1st level (no additional cold scaling)", () => {
    const spell = makeSpell({
      id: "ice-knife",
      name: "Ice Knife",
      damageEffect: "Piercing (...)",
    });
    const effects = resolveSpellEffects(spell, 1);
    expect(effects[1]).toMatchObject({ dice: "2d6" });
  });

  // Cantrips scale by character level, never by spell-slot level.

  it("returns fallback effects for cantrips without slot scaling", () => {
    const spell = makeSpell({
      id: "fire-bolt",
      name: "Fire Bolt",
      level: 0,
      damageEffect: "Fire",
      description: "Deals 1d10 fire damage.",
      save: "",
    });
    const effects = resolveSpellEffects(spell, 0);
    expect(effects.length).toBeGreaterThanOrEqual(0);
    // Cantrips do NOT apply per-slot scaling.
    if (effects.length > 0) {
      expect(effects[0]).toMatchObject({ dice: "1d10" });
    }
  });

  it("resolves Frostbite to the character's cantrip tier instead of every listed tier", () => {
    const frostbite = spellCatalog.find((spell) => spell.id === "frostbite");
    expect(frostbite).toBeDefined();
    expect(resolveSpellEffects(frostbite!, 0, 1)).toMatchObject([{ dice: "1d6", damageType: "Cold" }]);
    expect(resolveSpellEffects(frostbite!, 0, 5)).toMatchObject([{ dice: "2d6" }]);
    expect(resolveSpellEffects(frostbite!, 0, 17)).toMatchObject([{ dice: "4d6" }]);
    expect(resolveSpellEffects(frostbite!, 0, 1)).toHaveLength(1);
  });

  it("normalizes OCR-style cantrip dice notation before scaling", () => {
    const spell = makeSpell({
      id: "sapping-sting",
      name: "Sapping Sting",
      level: 0,
      damageEffect: "Necrotic",
      save: "CON Save",
      description: "The target must make a Constitution saving throw or take ld4 necrotic damage. This spell's damage increases by ld4 when you reach 5th level (2d4), 11th level (3d4), and 17th level (4d4).",
    });
    expect(resolveSpellEffects(spell, 0, 1)).toMatchObject([{ dice: "1d4" }]);
    expect(resolveSpellEffects(spell, 0, 5)).toMatchObject([{ dice: "2d4" }]);
  });

  it("keeps every catalog damaging cantrip at its level-one damage tier", () => {
    const damagingCantrips = spellCatalog.filter((spell) => spell.level === 0 && /(?:\d|l)\s*d\s*\d/i.test(spell.description));
    const overScaled = damagingCantrips.flatMap((spell) => resolveSpellEffects(spell, 0, 1)
      .filter((effect) => effect.type === "damage" && Number(effect.dice.match(/^(\d+)d/)?.[1] ?? 0) > 1)
      .map((effect) => `${spell.name}: ${effect.dice}`));

    expect(damagingCantrips.length).toBeGreaterThan(10);
    expect(overScaled).toEqual([]);
  });

  // Spells with no effects in registry fall back.

  it("returns empty effects for spells with no dice and no damageEffect", () => {
    const spell = makeSpell({
      id: "hold-person",
      name: "Hold Person",
      level: 2,
      damageEffect: "",
      description: "Choose a humanoid that you can see...",
    });
    const effects = resolveSpellEffects(spell, 2);
    // No dice in description, no damageEffect → empty
    expect(effects).toHaveLength(0);
  });

  // higherLevel bridge field fallback.

  it("uses higherLevel bridge field when no registry entry exists", () => {
    const spell = makeSpell({
      id: "some-new-spell",
      name: "Some New Spell",
      description: "Deals 4d6 force damage.",
      damageEffect: "Force",
      higherLevel: { dice: "1d6" },
    });
    const effects = resolveSpellEffects(spell, 2);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ dice: "5d6", damageType: "Force" });
  });

  it("higherLevel bridge field respects custom startLevel", () => {
    const spell = makeSpell({
      id: "some-spell-l2",
      name: "Some Spell",
      level: 2,
      description: "Deals 3d8 thunder damage.",
      damageEffect: "Thunder",
      higherLevel: { dice: "1d8", startLevel: 2 },
    });
    const effects = resolveSpellEffects(spell, 3);
    expect(effects[0]).toMatchObject({ dice: "4d8" });
  });

  // Non-damage spells with saves but no dice.

  it("returns empty effects for non-damage spell even with a save", () => {
    const spell = makeSpell({
      id: "bane",
      name: "Bane",
      level: 1,
      damageEffect: "Debuff",
      description: "Up to three creatures must make a Charisma saving throw...",
    });
    const effects = resolveSpellEffects(spell, 1);
    // No dice in description, damageEffect is a condition label → empty
    expect(effects).toHaveLength(0);
  });
});

// ── rollResolvedEffect ─────────────────────────────────────────────────────

describe("rollResolvedEffect", () => {
  it("rolls damage dice and computes total", () => {
    const effect = {
      id: "test-damage",
      type: "damage" as const,
      dice: "3d6",
      damageType: "fire",
      saveResult: "half" as const,
    };
    const result = rollResolvedEffect(effect);
    expect(result.type).toBe("damage");
    if (result.type === "damage") {
      expect(result.roll.rolls).toHaveLength(3);
      expect(result.roll.expression).toBe("3d6");
      expect(result.roll.modifier).toBe(0);
      const manualTotal = result.roll.rolls.reduce((s, v) => s + v, 0);
      expect(result.roll.total).toBe(manualTotal);
      expect(result.saveResult).toBe("half");
      expect(result.savedTotal).toBe(Math.floor(manualTotal / 2));
    }
  });

  it("rolls damage dice with modifier", () => {
    const effect = {
      id: "test-mod",
      type: "damage" as const,
      dice: "1d8+4",
      damageType: "piercing",
    };
    const result = rollResolvedEffect(effect);
    if (result.type === "damage") {
      expect(result.roll.rolls).toHaveLength(1);
      expect(result.roll.modifier).toBe(4);
      expect(result.roll.total).toBe(result.roll.rolls[0] + 4);
    }
  });

  it("rolls healing dice", () => {
    const effect = {
      id: "test-healing",
      type: "healing" as const,
      dice: "2d8",
    };
    const result = rollResolvedEffect(effect);
    expect(result.type).toBe("healing");
    if (result.type === "healing") {
      expect(result.roll.rolls).toHaveLength(2);
    }
  });

  it("handles complex expression gracefully", () => {
    const effect = {
      id: "complex",
      type: "damage" as const,
      dice: "2d6 + 1d4",
      damageType: "varies",
    };
    const result = rollResolvedEffect(effect);
    expect(result.type).toBe("damage");
    if (result.type === "damage") {
      expect(result.roll.rolls).toHaveLength(0); // Couldn't parse
    }
  });

  it("savedTotal is Math.floor(total/2)", () => {
    const effect = {
      id: "test",
      type: "damage" as const,
      dice: "4d6",
      damageType: "fire",
      saveResult: "half" as const,
    };
    const result = rollResolvedEffect(effect);
    if (result.type === "damage" && result.savedTotal != null) {
      expect(result.savedTotal).toBe(Math.floor(result.roll.total / 2));
    }
  });

  it("does not set savedTotal when saveResult is none", () => {
    const effect = {
      id: "test",
      type: "damage" as const,
      dice: "2d6",
      damageType: "slashing",
      saveResult: "none" as const,
    };
    const result = rollResolvedEffect(effect);
    if (result.type === "damage") {
      expect(result.savedTotal).toBeUndefined();
    }
  });

  it("does not set savedTotal when no saveResult", () => {
    const effect = {
      id: "test",
      type: "damage" as const,
      dice: "2d6",
      damageType: "slashing",
    };
    const result = rollResolvedEffect(effect);
    if (result.type === "damage") {
      expect(result.savedTotal).toBeUndefined();
    }
  });
});

// ── formatRollDetail ───────────────────────────────────────────────────────

describe("formatRollDetail", () => {
  it("formats a simple roll", () => {
    const detail = formatRollDetail({
      expression: "3d6",
      rolls: [6, 4, 2],
      modifier: 0,
      total: 12,
    });
    expect(detail).toContain("3d6");
    expect(detail).toContain("6 + 4 + 2");
    expect(detail).toContain("12");
  });

  it("includes modifier in format", () => {
    const detail = formatRollDetail({
      expression: "1d8+4",
      rolls: [5],
      modifier: 4,
      total: 9,
    });
    expect(detail).toContain("+ 4");
    expect(detail).toContain("9");
  });
});

// ── previewDiceForLevel ────────────────────────────────────────────────────

describe("previewDiceForLevel", () => {
  it("shows 3d6 for Burning Hands at level 1", () => {
    const spell = makeSpell({ id: "burning-hands", name: "Burning Hands" });
    expect(previewDiceForLevel(spell, 1)).toBe("3d6");
  });

  it("shows 4d6 for Burning Hands at level 2", () => {
    const spell = makeSpell({ id: "burning-hands", name: "Burning Hands" });
    expect(previewDiceForLevel(spell, 2)).toBe("4d6");
  });

  it("returns null for cantrips", () => {
    const spell = makeSpell({ id: "fire-bolt", name: "Fire Bolt", level: 0 });
    expect(previewDiceForLevel(spell, 0)).toBeNull();
  });

  it("returns null for spells with no effects", () => {
    const spell = makeSpell({
      id: "hold-person",
      name: "Hold Person",
      level: 2,
      damageEffect: "",
      description: "No dice here.",
    });
    expect(previewDiceForLevel(spell, 2)).toBeNull();
  });
});
