import { describe, expect, it } from "vitest";
import { capabilitiesForCharacter, spellActivation } from "@/lib/capabilities";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import type { Character } from "@/types/game";

function character(patch: Partial<Character> = {}): Character {
  return {
    id: "test", userId: "test", name: "Test", ruleset: "2014", level: 1, alignment: "", background: "",
    physicalCharacteristics: "", personalCharacteristics: "", generalNotes: "", raceId: "human", classId: "fighter",
    sourceIds: [], settings: {} as Character["settings"], abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    currentHp: 10, maxHp: 10, tempHp: 0, inventory: [], spellsKnown: [], customRules: [], deathSaves: { successes: 0, failures: 0 }, createdAt: "now",
    ...patch,
  };
}

describe("character capabilities", () => {
  it("includes universal actions and level-gated class capabilities", () => {
    const levelOne = capabilitiesForCharacter(character({ classId: "paladin" }));
    expect(levelOne.some((entry) => entry.id === "universal.dash" && entry.lane === "actions")).toBe(true);
    expect(levelOne.some((entry) => entry.id === "paladin.lay-on-hands")).toBe(true);
    expect(levelOne.some((entry) => entry.id === "paladin.channel-divinity")).toBe(false);
  });

  it("filters subclass and feat capabilities to the character", () => {
    const entries = capabilitiesForCharacter(character({
      classId: "rogue", subclassId: "thief", level: 4,
      asiChoices: [{ type: "feat", level: 4, featId: "shield-master" }],
    }));
    expect(entries.some((entry) => entry.id === "rogue.cunning-action" && entry.lane === "bonus-actions")).toBe(true);
    expect(entries.some((entry) => entry.sourceKind === "subclass" && entry.subclassId !== "thief")).toBe(false);
    expect(entries.some((entry) => entry.sourceKind === "feat" && entry.sourceId === "shield-master")).toBe(true);
  });

  it("includes the monk's individual ki bonus actions", () => {
    const entries = capabilitiesForCharacter(character({ classId: "monk", level: 2 }));
    const kiActions = entries.filter((entry) => ["monk.flurry-of-blows", "monk.patient-defense", "monk.step-of-the-wind"].includes(entry.id));
    expect(kiActions).toHaveLength(3);
    expect(kiActions.every((entry) => entry.lane === "bonus-actions")).toBe(true);
  });

  it("routes spell casting times to the correct activation", () => {
    expect(spellActivation({ castingTime: "1 Action" })).toBe("action");
    expect(spellActivation({ castingTime: "1 Bonus Action" })).toBe("bonus-action");
    expect(spellActivation({ castingTime: "1 Reaction *" })).toBe("reaction");
    expect(spellActivation({ castingTime: "10 Minutes" })).toBe("long-activation");
  });

  it("resolves spendable class resource formulas", () => {
    const paladin = character({ classId: "paladin", level: 3, abilities: { strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 12, charisma: 16 } });
    const patch = progressionPatchForCharacter(paladin);
    expect(patch.featureResources?.["lay-on-hands-pool"]).toMatchObject({ maximum: 15, current: 15, recharge: "long-rest" });
    expect(patch.featureResources?.["divine-sense-uses"]).toMatchObject({ maximum: 4, current: 4, recharge: "long-rest" });
    expect(patch.featureResources?.["channel-divinity-uses"]).toMatchObject({ maximum: 1, current: 1, recharge: "short-or-long-rest" });
    const actions = capabilitiesForCharacter({ ...paladin, featureResources: patch.featureResources });
    expect(actions.find((entry) => entry.id === "paladin.lay-on-hands")?.resource).toMatchObject({ maximum: 15, current: 15 });
  });
});
