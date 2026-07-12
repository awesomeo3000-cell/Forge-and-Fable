import { describe, expect, it } from "vitest";

import { progressionPatchForCharacter } from "@/lib/progression/state";
import { validateCharacterProgression } from "@/lib/progression/validate";
import type { Character } from "@/types/game";
import { characterInput } from "./fixtures/character";

function battleMaster(): Character {
  const character: Character = {
    ...characterInput("Progression Hero"),
    id: "character-1",
    userId: "user-1",
    createdAt: new Date(0).toISOString(),
    level: 3,
    subclassId: "battle-master",
    featureChoices: {
      "choose-fighting-style": ["defense"],
      "choose-3-maneuvers": ["parry", "precision-attack", "trip-attack"],
      "choose-artisans-tool": ["smiths-tools"],
    },
  };
  return { ...character, ...progressionPatchForCharacter(character) };
}

describe("server-side progression validation", () => {
  it("accepts a complete progression record and its mechanical resources", () => {
    const character = battleMaster();
    expect(() => validateCharacterProgression(character, true)).not.toThrow();
    expect(character.featureResources?.["superiority-dice"]).toMatchObject({ maximum: 4, die: "d8", recharge: "short-or-long-rest" });
  });

  it("rejects missing, duplicate, and out-of-set required choices", () => {
    const missing = battleMaster();
    delete missing.featureChoices?.["choose-3-maneuvers"];
    expect(() => validateCharacterProgression(missing, true)).toThrow(/choose-3-maneuvers: 3 selections are required/);

    const duplicate = battleMaster();
    duplicate.featureChoices!["choose-3-maneuvers"] = ["parry", "parry", "trip-attack"];
    expect(() => validateCharacterProgression(duplicate, true)).toThrow(/duplicate selections/);

    const invalid = battleMaster();
    invalid.featureChoices!["choose-fighting-style"] = ["not-a-style"];
    expect(() => validateCharacterProgression(invalid, true)).toThrow(/not an allowed option/);
  });

  it("rejects wrong-parent subclasses, impossible resources, and mismatched applied features", () => {
    const wrongSubclass = { ...battleMaster(), classId: "wizard" };
    expect(() => validateCharacterProgression(wrongSubclass, true)).toThrow(/belongs to fighter/);

    const impossible = battleMaster();
    impossible.featureResources = { ...impossible.featureResources, "superiority-dice": { maximum: 99 } };
    expect(() => validateCharacterProgression(impossible, true)).toThrow(/expected maximum/);

    const mismatched = battleMaster();
    mismatched.progressionState = { ...mismatched.progressionState!, featureIds: ["extra-attack"] };
    expect(() => validateCharacterProgression(mismatched, true)).toThrow(/expected feature set/);
  });

  it("permits legacy records without progression metadata until their next progression change", () => {
    const legacy = battleMaster();
    delete legacy.progressionState;
    delete legacy.featureResources;
    expect(() => validateCharacterProgression(legacy, false)).not.toThrow();
    expect(() => validateCharacterProgression(legacy, true)).toThrow(/progressionState is required/);
  });
});
