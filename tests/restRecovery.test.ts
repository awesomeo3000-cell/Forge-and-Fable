import { describe, expect, it } from "vitest";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import { longRestRecovery, recoverFeatureResources } from "@/lib/restRecovery";
import { characterInput } from "./fixtures/character";
import type { Character } from "@/types/game";

function druid(): Character {
  const base: Character = {
    ...characterInput("Wildshaper"),
    id: "druid-1",
    userId: "user-1",
    createdAt: "2026-07-12T00:00:00.000Z",
    classId: "druid",
    level: 2,
  };
  return { ...base, ...progressionPatchForCharacter(base) };
}

describe("feature resource recovery", () => {
  it("creates spendable Wild Shape uses and restores them on a short rest", () => {
    const character = druid();
    expect(character.featureResources?.["wild-shape-uses"]).toMatchObject({
      current: 2,
      maximum: 2,
      recharge: "short-or-long-rest",
    });

    character.featureResources!["wild-shape-uses"].current = 0;
    const recovery = recoverFeatureResources(character, "short");
    expect(recovery.changed).toBe(true);
    expect(recovery.featureResources["wild-shape-uses"].current).toBe(2);
  });

  it("restores long-rest resources without restoring them on a short rest", () => {
    const character = druid();
    character.featureResources = {
      ...character.featureResources,
      "long-rest-test": { current: 0, maximum: 3, recharge: "long-rest" },
    };
    expect(recoverFeatureResources(character, "short").featureResources["long-rest-test"].current).toBe(0);
    expect(longRestRecovery(character).patch.featureResources?.["long-rest-test"].current).toBe(3);
  });
});
