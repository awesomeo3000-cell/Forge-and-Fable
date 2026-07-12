import { describe, expect, it } from "vitest";
import { classActionsAtLevel, ruleset } from "@/lib/ruleset";
import { getClassData, getSubclass, subclassesData } from "@/lib/subclasses";
import { EXPERTISE_COUNTS } from "@/components/LevelUpModal";

describe("2014 class progression audit fixes", () => {
  it("keeps subclass thresholds aligned across the builder and level-up flow", () => {
    const expected = {
      barbarian: 3,
      bard: 3,
      cleric: 1,
      druid: 2,
      fighter: 3,
      monk: 3,
      paladin: 3,
      ranger: 3,
      rogue: 3,
      sorcerer: 1,
      warlock: 1,
      wizard: 2,
      artificer: 3,
    };

    for (const [classId, subclassLevel] of Object.entries(expected)) {
      expect(ruleset.classes.find((heroClass) => heroClass.id === classId)?.subclassLevel).toBe(subclassLevel);
      expect(getClassData(classId)?.subclassLevel).toBe(subclassLevel);
    }
  });

  it("contains the repaired class progression entries", () => {
    const warlock = ruleset.classes.find((heroClass) => heroClass.id === "warlock");
    const artificer = ruleset.classes.find((heroClass) => heroClass.id === "artificer");
    const ranger = ruleset.classes.find((heroClass) => heroClass.id === "ranger");
    const rogue = ruleset.classes.find((heroClass) => heroClass.id === "rogue");
    const wizard = ruleset.classes.find((heroClass) => heroClass.id === "wizard");

    expect(warlock?.levelProgression[11].features.map((feature) => feature.name)).toContain("More invocations");
    expect(artificer?.levelProgression[5].features.map((feature) => feature.name)).toContain("Infuse Item improvement");
    expect(ranger?.proficiencies).toContain("Simple weapons");
    expect(rogue?.proficiencies).toEqual(expect.arrayContaining(["Longswords", "Rapiers", "Shortswords"]));
    expect(wizard?.proficiencies).toEqual(expect.arrayContaining(["Darts", "Slings"]));
  });

  it("grants both Expertise choices at the later 2014 milestones", () => {
    expect(EXPERTISE_COUNTS.rogue[1]).toBe(2);
    expect(EXPERTISE_COUNTS.rogue[6]).toBe(2);
    expect(EXPERTISE_COUNTS.bard[3]).toBe(2);
    expect(EXPERTISE_COUNTS.bard[10]).toBe(2);
  });

  it("resolves Rogue Sneak Attack to the correct level-based dice", () => {
    const rogue = ruleset.classes.find((heroClass) => heroClass.id === "rogue");
    if (!rogue) throw new Error("Rogue class data is missing");

    expect(classActionsAtLevel(rogue, 1).find((action) => action.name === "Sneak strike")?.formula).toContain("1d6");
    expect(classActionsAtLevel(rogue, 6).find((action) => action.name === "Sneak strike")?.formula).toContain("3d6");
    expect(classActionsAtLevel(rogue, 19).find((action) => action.name === "Sneak strike")?.formula).toContain("10d6");
  });

  it("does not combine mutually exclusive Beast Master variants", () => {
    const beastMaster = getSubclass("ranger", "beast-master");
    const featureNames = beastMaster?.features?.filter((feature) => feature.level === 3).map((feature) => feature.name) ?? [];

    expect(featureNames).toContain("Ranger's Companion");
    expect(featureNames).not.toContain("Primal Companion");
  });

  it("provides features for the previously empty Wild Magic and Arcana options", () => {
    expect(getSubclass("barbarian", "wild-soul")?.features?.map((feature) => feature.name)).toEqual([
      "Magic Awareness",
      "Wild Surge",
      "Bolstering Magic",
      "Unstable Backlash",
      "Controlled Surge",
    ]);
    expect(getSubclass("cleric", "arcane-domain")?.features?.map((feature) => feature.name)).toEqual([
      "Arcane Initiate",
      "Channel Divinity: Arcane Abjuration",
      "Spell Breaker",
      "Potent Spellcasting",
      "Arcane Mastery",
    ]);
  });

  it("does not expose any empty subclass choices", () => {
    for (const classData of subclassesData()) {
      for (const subclass of classData.subclasses) {
        expect(subclass.features?.length, `${classData.id}/${subclass.id}`).toBeGreaterThan(0);
      }
    }
  });
});
