import { describe, expect, it } from "vitest";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import { validateCharacterProgression } from "@/lib/progression/validate";
import { HOMEBREW_CLASS_ID } from "@/lib/homebrewIdentity";
import { characterInput } from "./fixtures/character";
import type { Character } from "@/types/game";

describe("manual homebrew class progression", () => {
  it("returns an empty patch instead of throwing for a homebrew class", () => {
    // Regression: creating/rendering a manual custom-class character used to throw
    // "No 2014 progression packet exists for class \"homebrew-custom-class\"".
    expect(() =>
      progressionPatchForCharacter({
        ruleset: "2014",
        classId: HOMEBREW_CLASS_ID,
        subclassId: undefined,
        level: 5,
        featureChoices: {},
        featureResources: {},
        progressionState: undefined,
      }),
    ).not.toThrow();

    const patch = progressionPatchForCharacter({
      ruleset: "2014",
      classId: HOMEBREW_CLASS_ID,
      level: 5,
    });
    // A homebrew class must never carry catalog progression state.
    expect(patch.progressionState).toBeUndefined();
  });

  it("validates a homebrew-class character with no progression state", () => {
    const character = {
      ...characterInput(),
      id: "hb-1",
      userId: "u1",
      createdAt: new Date().toISOString(),
      classId: HOMEBREW_CLASS_ID,
      customClassName: "Runescarred Warden",
      subclassId: undefined,
      progressionState: undefined,
    } as Character;
    expect(() => validateCharacterProgression(character, false)).not.toThrow();
  });
});
