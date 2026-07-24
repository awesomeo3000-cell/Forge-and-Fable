/**
 * Phase 5 — multiclass and generalized progression foundation gates
 * (proposal §14 Phase 5 mandatory gates).
 */
import { describe, expect, it } from "vitest";
import {
  addClassLevel,
  builtinClassRef,
  builtinSubclassRef,
  classLevelMirrors,
  combinedSpellSlots,
  getClassLevels,
  hitDicePools,
  multiclassEligibility,
  eligibleMulticlassOptions,
  removeClassLevel,
  totalLevel,
} from "@/lib/multiclass";
import { buildLevelUpPlan } from "@/lib/progression/engine";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import { validateCharacterProgression } from "@/lib/progression/validate";
import { validateCharacterInput } from "@/lib/validateCharacter";
import { builtinRulesContentRegistry } from "@/lib/homebrew/builtinRegistry";
import type { Character } from "@/types/game";
import type { CharacterClassLevel } from "@/types/homebrew";
import { characterInput } from "./fixtures/character";

const ABILITIES = { strength: 16, dexterity: 12, constitution: 14, intelligence: 14, wisdom: 10, charisma: 8 };

function baseCharacter(overrides: Partial<Character> = {}): Character {
  return {
    ...characterInput("Multiclass Hero"),
    id: "character-mc",
    userId: "user-1",
    createdAt: new Date(0).toISOString(),
    abilities: { ...ABILITIES },
    ...overrides,
  } as Character;
}

function fighterWizard(fighterLevels: number, wizardLevels: number): Character {
  const classLevels: CharacterClassLevel[] = [
    { classRef: builtinClassRef("2014", "fighter"), level: fighterLevels, acquiredOrder: 0 },
    { classRef: builtinClassRef("2014", "wizard"), level: wizardLevels, acquiredOrder: 1 },
  ];
  const mirrors = classLevelMirrors(classLevels);
  return baseCharacter({ classLevels, level: mirrors.level, classId: mirrors.classId, subclassId: mirrors.subclassId });
}

describe("compatibility: characters without classLevels", () => {
  it("derives exactly one built-in entry from the legacy mirror fields", () => {
    const character = baseCharacter({ level: 3, classId: "fighter" });
    expect(getClassLevels(character)).toEqual([{
      classRef: { source: "builtin", kind: "class", id: "fighter", ruleset: "2014" },
      level: 3,
      subclassRef: undefined,
      acquiredOrder: 0,
    }]);
    expect(totalLevel(character)).toBe(3);
  });

  it("keeps the single-class progression patch shape unchanged (no classes field)", () => {
    const character = baseCharacter({ level: 3, classId: "fighter", featureChoices: { "choose-fighting-style": ["defense"] } });
    const patch = progressionPatchForCharacter(character);
    expect(patch.progressionState).toBeDefined();
    expect(patch.progressionState!.classes).toBeUndefined();
    expect(patch.progressionState!.classId).toBe("fighter");
  });
});

describe("gate: Fighter 3 / Wizard 1", () => {
  it("gets Wizard level-1 features alongside Fighter grants", () => {
    const character = fighterWizard(3, 1);
    const patch = progressionPatchForCharacter(character);
    const grants = patch.progressionState!.featureGrants!;
    expect(grants.some((grant) => grant.sourcePacketId.includes("wizard") && grant.level === 1)).toBe(true);
    expect(grants.some((grant) => grant.sourcePacketId.includes("fighter") && grant.level === 3)).toBe(true);
    expect(patch.progressionState!.classes).toEqual([
      { classId: "fighter", level: 3 },
      { classId: "wizard", level: 1 },
    ]);
  });

  it("computes combined slots from caster contributions (fighter contributes none)", () => {
    const slots = combinedSpellSlots(fighterWizard(3, 1));
    expect(slots.casterLevel).toBe(1);
    expect(slots.slots.slice(0, 3)).toEqual([2, 0, 0]);
    expect(slots.pact).toBeNull();
  });

  it("tracks per-class hit dice pools", () => {
    const dice = hitDicePools(fighterWizard(3, 1), (ref) => ref.source === "builtin" && ref.id === "fighter" ? 10 : 6);
    expect(dice).toEqual([
      expect.objectContaining({ die: 10, count: 3 }),
      expect.objectContaining({ die: 6, count: 1 }),
    ]);
  });
});

describe("gate: Paladin / Warlock pact separation", () => {
  it("keeps pact slots out of the shared table", () => {
    const classLevels: CharacterClassLevel[] = [
      { classRef: builtinClassRef("2014", "paladin"), level: 5, acquiredOrder: 0 },
      { classRef: builtinClassRef("2014", "warlock"), level: 3, acquiredOrder: 1 },
    ];
    const mirrors = classLevelMirrors(classLevels);
    const character = baseCharacter({ classLevels, level: mirrors.level, classId: mirrors.classId });
    const slots = combinedSpellSlots(character);
    // Paladin 5 contributes floor(5/2) = 2 shared caster levels → [3] at level 2.
    expect(slots.casterLevel).toBe(2);
    expect(slots.slots.slice(0, 2)).toEqual([3, 0]);
    // Warlock 3: two pact slots at slot level 2, separate from the table.
    expect(slots.pact).toEqual({ count: 2, slotLevel: 2 });
  });
});

describe("gate: multiclass prerequisites", () => {
  it("a prerequisite toggle changes the eligible options", () => {
    const character = baseCharacter({ level: 3, classId: "fighter" });
    const lowInt = { ...ABILITIES, intelligence: 12 };
    const enforced = eligibleMulticlassOptions(character, ["wizard", "barbarian"], lowInt, true);
    expect(enforced.find((option) => option.classId === "wizard")!.eligibility.eligible).toBe(false);
    expect(enforced.find((option) => option.classId === "barbarian")!.eligibility.eligible).toBe(true);
    const relaxed = eligibleMulticlassOptions(character, ["wizard"], lowInt, false);
    expect(relaxed[0].eligibility.eligible).toBe(true);
  });

  it("applies both leaving and entering requirements", () => {
    // Wizard (INT 14) wants barbarian levels but has STR 8: leaving wizard is
    // fine, entering barbarian is not.
    const result = multiclassEligibility("barbarian", ["wizard"], { ...ABILITIES, strength: 8 });
    expect(result.eligible).toBe(false);
    expect(result.unmet[0]).toContain("barbarian");
  });

  it("honors either-or requirements (fighter: STR 13 or DEX 13)", () => {
    expect(multiclassEligibility("fighter", [], { ...ABILITIES, strength: 8, dexterity: 14 }).eligible).toBe(true);
    expect(multiclassEligibility("fighter", [], { ...ABILITIES, strength: 8, dexterity: 8 }).eligible).toBe(false);
  });
});

describe("gate: level-down unwinds the correct class", () => {
  it("adds and removes levels per class, dropping an emptied secondary class", () => {
    const character = fighterWizard(3, 1);
    const grown = addClassLevel(character, builtinClassRef("2014", "wizard"));
    expect(grown.find((entry) => entry.classRef.source === "builtin" && entry.classRef.id === "wizard")!.level).toBe(2);

    const shrunk = removeClassLevel({ ...character, classLevels: grown }, builtinClassRef("2014", "wizard"));
    expect(shrunk.find((entry) => entry.classRef.source === "builtin" && entry.classRef.id === "wizard")!.level).toBe(1);

    const gone = removeClassLevel({ ...character, classLevels: shrunk }, builtinClassRef("2014", "wizard"));
    expect(gone).toHaveLength(1);
    expect(gone[0].classRef).toMatchObject({ id: "fighter" });
  });

  it("never removes the first class while other classes remain", () => {
    const character = fighterWizard(1, 1);
    expect(() => removeClassLevel(character, builtinClassRef("2014", "fighter"))).toThrow(/first class/);
  });
});

describe("gate: server progression validation", () => {
  function multiclassCharacter(classLevels: CharacterClassLevel[], overrides: Partial<Character> = {}): Character {
    const mirrors = classLevelMirrors(classLevels);
    const character = baseCharacter({ classLevels, level: mirrors.level, classId: mirrors.classId, subclassId: mirrors.subclassId, ...overrides });
    return { ...character, ...progressionPatchForCharacter(character) };
  }

  it("accepts a valid Fighter 3 / Wizard 1 with aggregated progression state", () => {
    const character = multiclassCharacter([
      { classRef: builtinClassRef("2014", "fighter"), level: 3, subclassRef: builtinSubclassRef("2014", "battle-master"), acquiredOrder: 0 },
      { classRef: builtinClassRef("2014", "wizard"), level: 1, acquiredOrder: 1 },
    ]);
    expect(() => validateCharacterProgression(character, false)).not.toThrow();
  });

  it("rejects duplicate classes, total mismatches, ruleset mismatches, and homebrew refs", () => {
    const fighter = { classRef: builtinClassRef("2014", "fighter"), level: 2, acquiredOrder: 0 };
    const duplicate = multiclassCharacter([fighter, { ...fighter, acquiredOrder: 1 }]);
    expect(() => validateCharacterProgression(duplicate, false)).toThrow(/duplicate class/);

    const mismatch = multiclassCharacter([fighter, { classRef: builtinClassRef("2014", "wizard"), level: 1, acquiredOrder: 1 }], {});
    expect(() => validateCharacterProgression({ ...mismatch, level: 20 }, false)).toThrow(/total/);

    const wrongRuleset = multiclassCharacter([fighter, { classRef: builtinClassRef("2024", "wizard"), level: 1, acquiredOrder: 1 }]);
    expect(() => validateCharacterProgression(wrongRuleset, false)).toThrow(/ruleset/);

    const homebrewRef: CharacterClassLevel = {
      classRef: { source: "homebrew", kind: "class", definitionId: "d1", versionId: "v1", ruleset: "2014" },
      level: 1,
      acquiredOrder: 1,
    };
    const character = baseCharacter({ classLevels: [fighter, homebrewRef], level: 3, classId: "fighter" });
    expect(() => validateCharacterProgression(character, false)).toThrow(/Phase 6/);
  });

  it("rejects a subclass belonging to another class", () => {
    // Built without the aggregated patch: the mismatch must be caught by the
    // validator itself, not only by plan construction.
    const classLevels: CharacterClassLevel[] = [
      { classRef: builtinClassRef("2014", "fighter"), level: 3, subclassRef: builtinSubclassRef("2014", "school-of-evocation"), acquiredOrder: 0 },
      { classRef: builtinClassRef("2014", "wizard"), level: 1, acquiredOrder: 1 },
    ];
    const mirrors = classLevelMirrors(classLevels);
    const wrongParent = baseCharacter({ classLevels, level: mirrors.level, classId: mirrors.classId, subclassId: mirrors.subclassId });
    expect(() => validateCharacterProgression(wrongParent, false)).toThrow(/belongs to/);
  });

  it("validates the classLevels patch field shape server-side", () => {
    expect(() => validateCharacterInput({ classLevels: [{ level: 1, acquiredOrder: 0, classRef: { source: "builtin", kind: "class", id: "fighter", ruleset: "2014" } }] }, true)).not.toThrow();
    expect(() => validateCharacterInput({ classLevels: [{ level: 0, acquiredOrder: 0, classRef: { source: "builtin", kind: "class", id: "fighter", ruleset: "2014" } }] }, true)).toThrow(/level/);
    expect(() => validateCharacterInput({ classLevels: [{ level: 1, acquiredOrder: 0, classRef: { source: "builtin", kind: "spell", id: "bless", ruleset: "2014" } }] }, true)).toThrow(/kind/);
    expect(() => validateCharacterInput({ classLevels: "fighter" }, true)).toThrow(/array/i);
  });
});

describe("registry injection", () => {
  it("builds identical plans through the injected built-in registry", () => {
    const direct = buildLevelUpPlan({ ruleset: "2014", classId: "fighter", fromLevel: 0, toLevel: 3 });
    const injected = buildLevelUpPlan({ ruleset: "2014", classId: "fighter", fromLevel: 0, toLevel: 3, registry: builtinRulesContentRegistry });
    expect(injected).toEqual(direct);
  });

  it("surfaces registry resolution failures as missing packets", () => {
    const failing = {
      ...builtinRulesContentRegistry,
      getClassPacket: () => { throw new Error("nope"); },
    };
    expect(() => buildLevelUpPlan({ ruleset: "2014", classId: "fighter", fromLevel: 0, toLevel: 1, registry: failing }))
      .toThrow(/No 2014 progression packet/);
  });
});
