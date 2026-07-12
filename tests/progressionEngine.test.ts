import { describe, expect, it } from "vitest";

import { buildClassLevelUpPlan, buildLevelUpPlan } from "@/lib/progression/engine";
import { progressionCatalog } from "@/lib/progression/packets";
import { ruleset } from "@/lib/ruleset";

describe("class progression engine", () => {
  it("returns the exact one-level class delta", () => {
    const plan = buildClassLevelUpPlan({ ruleset: "2014", classId: "barbarian", fromLevel: 2, toLevel: 3 });
    expect(plan).toMatchObject({ fromLevel: 2, toLevel: 3, proficiencyBonus: { before: 2, after: 2 } });
    expect(plan.automaticFeatures.map((feature) => [feature.level, feature.featureId])).toEqual([[3, "primal-path"]]);
    expect(plan.choices).toEqual([expect.objectContaining({ choiceId: "choose-subclass", level: 3, source: "class" })]);
    expect(plan.resourceChanges).toEqual([expect.objectContaining({ resourceId: "rage-uses", maximum: 3, level: 3 })]);
  });

  it("returns every crossed feature and choice for a multi-level advancement", () => {
    const plan = buildClassLevelUpPlan({ ruleset: "2014", classId: "fighter", fromLevel: 3, toLevel: 6 });
    expect(plan.automaticFeatures.map((feature) => [feature.level, feature.featureId])).toEqual([
      [4, "ability-score-improvement"], [5, "extra-attack"], [6, "ability-score-improvement"],
    ]);
    expect(plan.choices.map((choice) => [choice.level, choice.choiceId])).toEqual([
      [4, "choose-asi-or-feat"], [6, "choose-asi-or-feat"],
    ]);
    expect(plan.proficiencyBonus).toEqual({ before: 2, after: 3 });
  });

  it("calculates endpoint spell-table changes without mixing casting models", () => {
    const wizard = buildClassLevelUpPlan({ ruleset: "2014", classId: "wizard", fromLevel: 2, toLevel: 5 });
    expect(wizard.spellChanges).toContainEqual(expect.objectContaining({ kind: "cantrips-known", before: 3, after: 4, count: 1 }));
    expect(wizard.spellChanges).toContainEqual(expect.objectContaining({ kind: "spellbook-spells", before: 8, after: 14, count: 6 }));
    expect(wizard.spellChanges).toContainEqual(expect.objectContaining({ kind: "spell-slots", before: [3], after: [4, 3, 2] }));
    expect(wizard.spellChanges.some((change) => change.kind === "spells-known")).toBe(false);

    const warlock = buildClassLevelUpPlan({ ruleset: "2014", classId: "warlock", fromLevel: 1, toLevel: 5 });
    expect(warlock.spellChanges).toContainEqual(expect.objectContaining({ kind: "pact-magic-slots", before: 1, after: 2 }));
    expect(warlock.spellChanges).toContainEqual(expect.objectContaining({ kind: "pact-magic-slot-level", before: 1, after: 3 }));
    expect(warlock.spellChanges.some((change) => change.kind === "spell-slots")).toBe(false);
  });

  it("is deterministic, supports no-op retries, and explicitly gates research rules", () => {
    const input = { ruleset: "2014" as const, classId: "rogue", fromLevel: 4, toLevel: 9 };
    expect(buildClassLevelUpPlan(input)).toEqual(buildClassLevelUpPlan(input));
    const noOp = buildClassLevelUpPlan({ ...input, fromLevel: 9 });
    expect(noOp.automaticFeatures).toEqual([]);
    expect(noOp.choices).toEqual([]);
    expect(noOp.spellChanges).toEqual([]);
    expect(() => buildClassLevelUpPlan({ ruleset: "2024", classId: "rogue", fromLevel: 1, toLevel: 2 })).toThrow(/research-only/);
    expect(buildClassLevelUpPlan({ ruleset: "2024", classId: "rogue", fromLevel: 1, toLevel: 2, mode: "research" }).automaticFeatures).toEqual([
      expect.objectContaining({ featureId: "cunning-action" }),
    ]);
  });

  it("matches the stable anchors in the existing strict-2014 production catalog", () => {
    expect(progressionCatalog.classes.size).toBeGreaterThanOrEqual(ruleset.classes.length);
    for (const heroClass of ruleset.classes) {
      const packet = progressionCatalog.classes.get(`2014:${heroClass.id}`);
      expect(packet, heroClass.id).toBeDefined();
      expect(packet?.hitDie, `${heroClass.id} hit die`).toBe(heroClass.hitDie);
      const subclassLevel = Object.values(packet?.levels ?? {}).find((level) => level.choices.includes("choose-subclass"))?.level;
      expect(subclassLevel, `${heroClass.id} subclass level`).toBe(heroClass.subclassLevel);
      const packetAsiLevels = Object.values(packet?.levels ?? {}).filter((level) => level.choices.includes("choose-asi-or-feat")).map((level) => level.level);
      expect(packetAsiLevels, `${heroClass.id} ASI levels`).toEqual(heroClass.asiLevels);
    }
  });

  it("builds starting and one-level plans for every reviewed class packet", () => {
    for (const packet of progressionCatalog.classes.values()) {
      const mode = packet.ruleset === "2024" ? "research" : "production";
      const startingPlan = buildClassLevelUpPlan({ ruleset: packet.ruleset, classId: packet.id, fromLevel: 0, toLevel: 5, mode });
      expect(startingPlan.automaticFeatures, packet.sourceClassId).not.toHaveLength(0);
      expect(startingPlan.proficiencyBonus.after, packet.sourceClassId).toBe(packet.levels[5].proficiencyBonus);

      for (let level = 1; level <= 20; level += 1) {
        const plan = buildClassLevelUpPlan({ ruleset: packet.ruleset, classId: packet.id, fromLevel: level - 1, toLevel: level, mode });
        expect(plan.automaticFeatures.map((feature) => feature.featureId), `${packet.sourceClassId} level ${level}`).toEqual(packet.levels[level].automaticFeatures);
        expect(plan.choices.map((choice) => choice.choiceId), `${packet.sourceClassId} level ${level} choices`).toEqual(packet.levels[level].choices);
      }
    }
  });

  it("rejects invalid ranges and missing class packets clearly", () => {
    expect(() => buildClassLevelUpPlan({ ruleset: "2014", classId: "fighter", fromLevel: 5, toLevel: 4 })).toThrow(/cannot be lower/);
    expect(() => buildClassLevelUpPlan({ ruleset: "2014", classId: "fighter", fromLevel: 1.5, toLevel: 2 })).toThrow(/fromLevel must be an integer/);
    expect(() => buildClassLevelUpPlan({ ruleset: "2014", classId: "missing", fromLevel: 1, toLevel: 2 })).toThrow(/No 2014 progression packet/);
  });

  it("merges subclass grants, choices, resources, and parent interactions", () => {
    const plan = buildLevelUpPlan({ ruleset: "2014", classId: "fighter", subclassId: "battle-master", fromLevel: 2, toLevel: 3 });
    expect(plan.automaticFeatures.some((feature) => feature.featureId === "archetype-feature")).toBe(false);
    expect(plan.automaticFeatures).toContainEqual(expect.objectContaining({ featureId: "combat-superiority", source: "subclass", level: 3 }));
    expect(plan.choices).toContainEqual(expect.objectContaining({ choiceId: "choose-3-maneuvers", count: 3 }));
    expect(plan.resourceChanges).toContainEqual(expect.objectContaining({ resourceId: "superiority-dice", maximum: 4, die: "d8" }));
    expect(plan.automaticFeatures.find((feature) => feature.featureId === "combat-superiority")?.parentInteractions).toContain("maneuver-uses-superiority-die");
  });

  it("resolves automatic and choice-dependent subclass spells across level ranges", () => {
    const life = buildLevelUpPlan({ ruleset: "2014", classId: "cleric", subclassId: "life-domain", fromLevel: 2, toLevel: 5 });
    expect(life.spellChanges.flatMap((change) => change.spells ?? [])).toEqual(expect.arrayContaining(["lesser-restoration", "spiritual-weapon", "beacon-of-hope", "revivify"]));

    const land = buildLevelUpPlan({
      ruleset: "2014", classId: "druid", subclassId: "circle-of-the-land", fromLevel: 2, toLevel: 5,
      featureChoices: { "choose-land": "coast" },
    });
    expect(land.spellChanges.flatMap((change) => change.spells ?? [])).toEqual(expect.arrayContaining(["mirror-image", "misty-step", "water-breathing", "water-walk"]));
  });

  it("covers every subclass feature level without granting mutually exclusive options", () => {
    for (const packet of progressionCatalog.subclasses.values()) {
      const mode = packet.ruleset === "2024" ? "research" : "production";
      for (const featureLevel of packet.featureLevels) {
        const plan = buildLevelUpPlan({
          ruleset: packet.ruleset,
          classId: packet.classId,
          subclassId: packet.id,
          fromLevel: featureLevel.level - 1,
          toLevel: featureLevel.level,
          mode,
        });
        expect(plan.automaticFeatures.filter((feature) => feature.source === "subclass").map((feature) => feature.featureId), `${packet.sourceSubclassId} level ${featureLevel.level}`).toEqual(featureLevel.automaticFeatures);
        expect(plan.choices.filter((choice) => choice.source === "subclass").map((choice) => choice.choiceId), `${packet.sourceSubclassId} level ${featureLevel.level} choices`).toEqual(featureLevel.choices.map((choice) => choice.choiceId));
      }
    }

    const hunter = buildLevelUpPlan({ ruleset: "2014", classId: "ranger", subclassId: "hunter", fromLevel: 2, toLevel: 3 });
    expect(hunter.automaticFeatures.map((feature) => feature.featureId)).not.toEqual(expect.arrayContaining(["colossus-slayer", "giant-killer", "horde-breaker"]));
    expect(hunter.choices).toContainEqual(expect.objectContaining({ choiceId: "choose-hunters-prey", options: ["colossus-slayer", "giant-killer", "horde-breaker"] }));
  });
});
