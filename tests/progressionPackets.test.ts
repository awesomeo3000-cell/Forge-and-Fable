import { describe, expect, it } from "vitest";

import { getProgressionPacket, loadProgressionCatalog, progressionCatalog } from "@/lib/progression/packets";
import subclasses from "@/data/subclasses.json";

describe("production progression packet loader", () => {
  it("loads reviewed packets and fills every production subclass from the descriptive catalog", () => {
    expect(progressionCatalog.classes.size).toBe(25);
    expect(progressionCatalog.subclasses.size).toBeGreaterThan(44);

    const barbarian = progressionCatalog.classes.get("2014:barbarian");
    expect(barbarian).toMatchObject({ id: "barbarian", sourceClassId: "barbarian-2014", ruleset: "2014" });

    const berserker = progressionCatalog.subclasses.get("2014:berserker");
    expect(berserker).toMatchObject({ id: "berserker", sourceSubclassId: "path-of-the-berserker-2014", classId: "barbarian" });
  });

  it("returns a class-only or class-and-subclass production packet", () => {
    expect(getProgressionPacket("2014", "fighter").subclass).toBeUndefined();
    expect(getProgressionPacket("2014", "fighter", "battle-master").subclass?.sourceClassId).toBe("fighter-2014");
  });

  it("provides a safe production packet for every selectable 2014 subclass", () => {
    for (const classEntry of subclasses) {
      for (const subclass of classEntry.subclasses) {
        const packet = getProgressionPacket("2014", classEntry.id, subclass.id).subclass;
        expect(packet, `${classEntry.id}:${subclass.id}`).toMatchObject({
          id: subclass.id,
          classId: classEntry.id,
          selectionLevel: classEntry.subclassLevel,
        });
        expect(packet?.featureLevels.length, `${classEntry.id}:${subclass.id} feature levels`).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to the descriptive catalog for College of Spirits", () => {
    const packet = getProgressionPacket("2014", "bard", "college-of-spirits").subclass;
    expect(packet?.name).toBe("College of Spirits");
    expect(packet?.featureLevels.map((entry) => entry.level)).toEqual([3, 6, 14]);
    expect(packet?.featureLevels[0].automaticFeatures).toContain("guiding-whispers");
  });

  it("rejects wrong-parent, missing, and research-only production lookups", () => {
    expect(() => getProgressionPacket("2014", "wizard", "battle-master")).toThrow(/belongs to class "fighter"/);
    expect(() => getProgressionPacket("2014", "missing")).toThrow(/No 2014 progression packet/);
    expect(() => getProgressionPacket("2024", "barbarian")).toThrow(/research-only/);
  });

  it("fails clearly on duplicate and mismatched packet references", () => {
    const source = { id: "test-source", ruleset: "2014" };
    const baseClass = {
      id: "test-2014", ruleset: "2014", name: "Test", sourceId: "test-source", researchStatus: "reviewed",
      hitDie: 8, primaryAbilities: ["strength"], savingThrowProficiencies: ["strength"], armorTraining: [], weaponProficiencies: [],
      skillProficiencies: { count: 0, options: [] },
      levels: Object.fromEntries(Array.from({ length: 20 }, (_, index) => {
        const level = index + 1;
        return [level, { level, proficiencyBonus: 2, automaticFeatures: [], choices: [], resourceChanges: [], sourceReferences: ["test-source"] }];
      })),
    };
    expect(() => loadProgressionCatalog({ classPackets: [baseClass, baseClass], subclassCollections: [], sources: [source] })).toThrow(/duplicate class/);
    expect(() => loadProgressionCatalog({ classPackets: [{ ...baseClass, id: "test-2024" }], subclassCollections: [], sources: [source] })).toThrow(/not scoped to ruleset 2014/);
    expect(() => loadProgressionCatalog({ classPackets: [{ ...baseClass, sourceId: "missing" }], subclassCollections: [], sources: [source] })).toThrow(/references missing source/);
  });
});
