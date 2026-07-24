import { describe, expect, it } from "vitest";
import { combinedSpellSlots } from "@/lib/multiclass";
import { createResolvedRegistry } from "@/lib/homebrew/resolvedRegistry";
import { fullCasterClass, partialCasterClass } from "./fixtures/homebrew";
import { characterInput } from "./fixtures/character";
import type { Character } from "@/types/game";
import type { CharacterClassLevel } from "@/types/homebrew";

const fullRef = {
  source: "homebrew",
  kind: "class",
  definitionId: "runeweaver",
  versionId: "rw-v1",
  ruleset: "2014",
} as const;

const halfRef = {
  source: "homebrew",
  kind: "class",
  definitionId: "spellblade",
  versionId: "sb-v1",
  ruleset: "2014",
} as const;

const registry = createResolvedRegistry([
  { kind: "class", ref: fullRef, payload: fullCasterClass },
  { kind: "class", ref: halfRef, payload: partialCasterClass },
]);

function characterWith(classLevels: CharacterClassLevel[]): Character {
  return {
    ...characterInput("Homebrew Caster"),
    id: "homebrew-caster",
    userId: "user-1",
    classId: "homebrew",
    level: classLevels.reduce((sum, entry) => sum + entry.level, 0),
    classLevels,
    createdAt: new Date(0).toISOString(),
  } as Character;
}

describe("homebrew caster slot resolution", () => {
  it("uses the pinned class packet's native slot table for a single-class caster", () => {
    const character = characterWith([
      { classRef: fullRef, level: 5, acquiredOrder: 0 },
    ]);

    const slots = combinedSpellSlots(character, registry);

    expect(slots.casterLevel).toBe(5);
    expect(slots.slots.slice(0, 4)).toEqual([4, 3, 2, 0]);
    expect(slots.pact).toBeNull();
  });

  it("combines full and half homebrew caster contributions", () => {
    const character = characterWith([
      { classRef: fullRef, level: 3, acquiredOrder: 0 },
      { classRef: halfRef, level: 4, acquiredOrder: 1 },
    ]);

    const slots = combinedSpellSlots(character, registry);

    expect(slots.casterLevel).toBe(5);
    expect(slots.slots.slice(0, 4)).toEqual([4, 3, 2, 0]);
  });

  it("fails closed for homebrew refs when no registry is available", () => {
    const character = characterWith([
      { classRef: fullRef, level: 5, acquiredOrder: 0 },
    ]);

    expect(combinedSpellSlots(character)).toEqual({
      slots: [],
      casterLevel: 0,
      pact: null,
    });
  });
});
