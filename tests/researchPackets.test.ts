import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ResearchPacket = {
  id: string;
  ruleset: string;
  spellcasting?: {
    type?: string;
    preparedSpellsFormula?: string;
    preparedSpellsByLevel?: number[];
    spellsKnownByLevel?: number[];
  };
  levels: Record<string, { automaticFeatures: string[]; choices: string[]; resourceChanges: Array<{ resourceId: string; maximum: string | number }> }>;
};

type SubclassInventory = {
  records: Array<{ id: string; ruleset: string; classId: string; featureLevels: number[]; coverage: string }>;
};

type DetailedSubclassPacket = {
  id: string;
  classId: string;
  featureLevels: Array<{
    level: number;
    automaticFeatures: string[];
    choices: unknown[];
    resourceChanges: unknown[];
    sourceReferences: string[];
    spellChanges?: unknown[];
    scaling?: unknown[];
  }>;
};

function loadPacket(relativePath: string): ResearchPacket {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8")) as ResearchPacket;
}

function loadSubclassInventory(): SubclassInventory {
  return JSON.parse(readFileSync(resolve(process.cwd(), "rules-research/subclasses/inventory.json"), "utf8")) as SubclassInventory;
}

function loadDetailedSubclassPackets(): DetailedSubclassPacket[] {
  return (JSON.parse(readFileSync(resolve(process.cwd(), "rules-research/subclasses/2024/basic-rules.json"), "utf8")) as { records: DetailedSubclassPacket[] }).records;
}

function loadDetailedSubclassPackets2014(): DetailedSubclassPacket[] {
  const base = (JSON.parse(readFileSync(resolve(process.cwd(), "rules-research/subclasses/2014/basic-rules.json"), "utf8")) as { records: DetailedSubclassPacket[] }).records;
  const remaining = (JSON.parse(readFileSync(resolve(process.cwd(), "rules-research/subclasses/2014/remaining.json"), "utf8")) as { records: DetailedSubclassPacket[] }).records;
  return [...base, ...remaining];
}

describe("class research pilot packets", () => {
  it("keeps all four pilot packets edition-scoped and complete", () => {
    for (const [relativePath, id, ruleset] of [
      ["rules-research/2014/classes/barbarian.json", "barbarian-2014", "2014"],
      ["rules-research/2014/classes/bard.json", "bard-2014", "2014"],
      ["rules-research/2014/classes/cleric.json", "cleric-2014", "2014"],
      ["rules-research/2014/classes/druid.json", "druid-2014", "2014"],
      ["rules-research/2014/classes/fighter.json", "fighter-2014", "2014"],
      ["rules-research/2014/classes/paladin.json", "paladin-2014", "2014"],
      ["rules-research/2014/classes/ranger.json", "ranger-2014", "2014"],
      ["rules-research/2014/classes/monk.json", "monk-2014", "2014"],
      ["rules-research/2014/classes/rogue.json", "rogue-2014", "2014"],
      ["rules-research/2014/classes/sorcerer.json", "sorcerer-2014", "2014"],
      ["rules-research/2014/classes/warlock.json", "warlock-2014", "2014"],
      ["rules-research/2014/classes/wizard.json", "wizard-2014", "2014"],
      ["rules-research/2014/classes/artificer.json", "artificer-2014", "2014"],
      ["rules-research/2024/classes/barbarian.json", "barbarian-2024", "2024"],
      ["rules-research/2024/classes/bard.json", "bard-2024", "2024"],
      ["rules-research/2024/classes/cleric.json", "cleric-2024", "2024"],
      ["rules-research/2024/classes/druid.json", "druid-2024", "2024"],
      ["rules-research/2024/classes/fighter.json", "fighter-2024", "2024"],
      ["rules-research/2024/classes/paladin.json", "paladin-2024", "2024"],
      ["rules-research/2024/classes/ranger.json", "ranger-2024", "2024"],
      ["rules-research/2024/classes/monk.json", "monk-2024", "2024"],
      ["rules-research/2024/classes/rogue.json", "rogue-2024", "2024"],
      ["rules-research/2024/classes/sorcerer.json", "sorcerer-2024", "2024"],
      ["rules-research/2024/classes/warlock.json", "warlock-2024", "2024"],
      ["rules-research/2024/classes/wizard.json", "wizard-2024", "2024"],
    ] as const) {
      const packet = loadPacket(relativePath);
      expect(packet.id).toBe(id);
      expect(packet.ruleset).toBe(ruleset);
      expect(Object.keys(packet.levels)).toHaveLength(20);
    }
  });

  it("preserves the Bard edition differences that affect level-up choices", () => {
    const bard2014 = loadPacket("rules-research/2014/classes/bard.json");
    const bard2024 = loadPacket("rules-research/2024/classes/bard.json");

    expect(bard2014.spellcasting?.type).toBe("known-spells");
    expect(bard2014.spellcasting?.spellsKnownByLevel?.[10]).toBe(14);
    expect(bard2014.levels[2].automaticFeatures).toContain("song-of-rest");
    expect(bard2014.levels[14].automaticFeatures).toContain("magical-secrets");

    expect(bard2024.spellcasting?.type).toBe("prepared-spells");
    expect(bard2024.spellcasting?.preparedSpellsByLevel?.[10]).toBe(15);
    expect(bard2024.levels[7].automaticFeatures).toContain("countercharm");
    expect(bard2024.levels[19].automaticFeatures).toContain("epic-boon");
    expect(bard2024.levels[20].automaticFeatures).toContain("words-of-creation");
  });

  it("preserves the Cleric edition differences that affect level-up choices", () => {
    const cleric2014 = loadPacket("rules-research/2014/classes/cleric.json");
    const cleric2024 = loadPacket("rules-research/2024/classes/cleric.json");

    expect(cleric2014.levels[1].automaticFeatures).toContain("divine-domain");
    expect(cleric2014.levels[1].choices).toContain("choose-subclass");
    expect(cleric2014.levels[20].automaticFeatures).toContain("divine-intervention-improvement");
    expect(cleric2014.spellcasting?.preparedSpellsByLevel).toBeUndefined();

    expect(cleric2024.levels[1].automaticFeatures).toContain("divine-order");
    expect(cleric2024.levels[3].automaticFeatures).toContain("cleric-subclass");
    expect(cleric2024.levels[19].automaticFeatures).toContain("epic-boon");
    expect(cleric2024.levels[20].automaticFeatures).toContain("greater-divine-intervention");
    expect(cleric2024.spellcasting?.preparedSpellsByLevel?.[20]).toBe(22);
  });

  it("preserves the Druid and Fighter edition differences", () => {
    const druid2014 = loadPacket("rules-research/2014/classes/druid.json");
    const druid2024 = loadPacket("rules-research/2024/classes/druid.json");
    const fighter2014 = loadPacket("rules-research/2014/classes/fighter.json");
    const fighter2024 = loadPacket("rules-research/2024/classes/fighter.json");

    expect(druid2014.levels[2].automaticFeatures).toContain("druid-circle");
    expect(druid2014.levels[18].automaticFeatures).toContain("timeless-body");
    expect(druid2014.spellcasting?.preparedSpellsByLevel).toBeUndefined();
    expect(druid2024.levels[1].automaticFeatures).toContain("primal-order");
    expect(druid2024.levels[3].automaticFeatures).toContain("druid-subclass");
    expect(druid2024.levels[19].automaticFeatures).toContain("epic-boon");
    expect(druid2024.spellcasting?.preparedSpellsByLevel?.[20]).toBe(22);

    expect(fighter2014.levels[3].automaticFeatures).toContain("martial-archetype");
    expect(fighter2014.levels[20].resourceChanges).toContainEqual({ resourceId: "extra-attacks", maximum: 4 });
    expect(fighter2024.levels[1].automaticFeatures).toContain("weapon-mastery");
    expect(fighter2024.levels[9].automaticFeatures).toContain("tactical-master");
    expect(fighter2024.levels[19].automaticFeatures).toContain("epic-boon");
  });

  it("preserves the Paladin and Ranger edition differences", () => {
    const paladin2014 = loadPacket("rules-research/2014/classes/paladin.json");
    const paladin2024 = loadPacket("rules-research/2024/classes/paladin.json");
    const ranger2014 = loadPacket("rules-research/2014/classes/ranger.json");
    const ranger2024 = loadPacket("rules-research/2024/classes/ranger.json");

    expect(paladin2014.levels[2].automaticFeatures).toContain("divine-smite");
    expect(paladin2014.levels[3].automaticFeatures).toContain("sacred-oath");
    expect(paladin2014.spellcasting?.preparedSpellsFormula).toMatch(/charismaModifier/);
    expect(paladin2024.levels[1].automaticFeatures).toContain("weapon-mastery");
    expect(paladin2024.levels[9].automaticFeatures).toContain("abjure-foes");
    expect(paladin2024.levels[19].automaticFeatures).toContain("epic-boon");
    expect(paladin2024.spellcasting?.preparedSpellsByLevel?.[20]).toBe(15);

    expect(ranger2014.spellcasting?.type).toBe("known-spells");
    expect(ranger2014.levels[3].automaticFeatures).toContain("ranger-archetype");
    expect(ranger2014.levels[20].automaticFeatures).toContain("foe-slayer");
    expect(ranger2024.spellcasting?.type).toBe("prepared-spells");
    expect(ranger2024.levels[2].automaticFeatures).toContain("deft-explorer");
    expect(ranger2024.levels[19].automaticFeatures).toContain("epic-boon");
    expect(ranger2024.levels[17].resourceChanges).toContainEqual({ resourceId: "hunters-mark-free-casts", maximum: 6 });
  });

  it("preserves the Rogue and Monk edition differences", () => {
    const rogue2014 = loadPacket("rules-research/2014/classes/rogue.json");
    const rogue2024 = loadPacket("rules-research/2024/classes/rogue.json");
    const monk2014 = loadPacket("rules-research/2014/classes/monk.json");
    const monk2024 = loadPacket("rules-research/2024/classes/monk.json");

    expect(rogue2014.levels[3].automaticFeatures).toContain("roguish-archetype");
    expect(rogue2014.levels[14].automaticFeatures).toContain("blindsense");
    expect(rogue2024.levels[1].automaticFeatures).toContain("weapon-mastery");
    expect(rogue2024.levels[5].automaticFeatures).toContain("cunning-strike");
    expect(rogue2024.levels[14].automaticFeatures).toContain("devious-strikes");
    expect(rogue2024.levels[19].automaticFeatures).toContain("epic-boon");

    expect(monk2014.levels[2].automaticFeatures).toContain("ki");
    expect(monk2014.levels[20].automaticFeatures).toContain("perfect-self");
    expect(monk2024.levels[2].automaticFeatures).toContain("monks-focus");
    expect(monk2024.levels[3].automaticFeatures).toContain("deflect-attacks");
    expect(monk2024.levels[19].automaticFeatures).toContain("epic-boon");
    expect(monk2024.levels[20].automaticFeatures).toContain("body-and-mind");
  });

  it("preserves the Sorcerer, Warlock, and Wizard edition differences", () => {
    const sorcerer2014 = loadPacket("rules-research/2014/classes/sorcerer.json");
    const sorcerer2024 = loadPacket("rules-research/2024/classes/sorcerer.json");
    const warlock2014 = loadPacket("rules-research/2014/classes/warlock.json");
    const warlock2024 = loadPacket("rules-research/2024/classes/warlock.json");
    const wizard2014 = loadPacket("rules-research/2014/classes/wizard.json");
    const wizard2024 = loadPacket("rules-research/2024/classes/wizard.json");

    expect(sorcerer2014.spellcasting?.type).toBe("known-spells");
    expect(sorcerer2014.levels[1].automaticFeatures).toContain("sorcerous-origin");
    expect(sorcerer2024.spellcasting?.type).toBe("prepared-spells");
    expect(sorcerer2024.levels[1].automaticFeatures).toContain("innate-sorcery");
    expect(sorcerer2024.levels[19].automaticFeatures).toContain("epic-boon");

    expect(warlock2014.spellcasting?.type).toBe("pact-magic-known-spells");
    expect(warlock2014.levels[3].automaticFeatures).toContain("pact-boon");
    expect(warlock2024.spellcasting?.type).toBe("pact-magic-prepared-spells");
    expect(warlock2024.levels[1].automaticFeatures).toContain("eldritch-invocations");
    expect(warlock2024.levels[9].automaticFeatures).toContain("contact-patron");

    expect(wizard2014.spellcasting?.type).toBe("spellbook-prepared-spells");
    expect(wizard2014.levels[2].automaticFeatures).toContain("arcane-tradition");
    expect(wizard2014.spellcasting?.preparedSpellsFormula).toMatch(/intelligenceModifier/);
    expect(wizard2024.levels[2].automaticFeatures).toContain("scholar");
    expect(wizard2024.levels[3].automaticFeatures).toContain("wizard-subclass");
    expect(wizard2024.levels[19].automaticFeatures).toContain("epic-boon");
  });

  it("keeps the licensed 2014 Artificer separate from deferred 2024 Artificer material", () => {
    const artificer2014 = loadPacket("rules-research/2014/classes/artificer.json");
    expect(artificer2014.id).toBe("artificer-2014");
    expect(artificer2014.ruleset).toBe("2014");
    expect(artificer2014.levels[2].automaticFeatures).toContain("infuse-item");
    expect(artificer2014.levels[20].automaticFeatures).toContain("soul-of-artifice");
    expect(artificer2014.spellcasting?.preparedSpellsFormula).toMatch(/artificerLevel/);
  });

  it("keeps subclass IDs edition-scoped and preserves the Basic Rules coverage boundary", () => {
    const inventory = loadSubclassInventory();
    const records2014 = inventory.records.filter((record) => record.ruleset === "2014");
    const records2024 = inventory.records.filter((record) => record.ruleset === "2024");

    expect(records2014).toHaveLength(32);
    expect(records2024).toHaveLength(12);
    expect(new Set(inventory.records.map((record) => record.id)).size).toBe(inventory.records.length);
    expect(records2024.every((record) => record.coverage === "basic-rules")).toBe(true);
    expect(records2024.every((record) => record.id.endsWith("-2024"))).toBe(true);
    expect(records2014.every((record) => record.id.endsWith("-2014"))).toBe(true);
    expect(inventory.records.find((record) => record.id === "life-domain-2014")?.featureLevels).toEqual([1, 2, 6, 8, 17]);
    expect(inventory.records.find((record) => record.id === "life-domain-2024")?.featureLevels).toEqual([3, 6, 17]);
  });

  it("has a detailed packet for every inventory record", () => {
    const inventory = loadSubclassInventory();
    const detailed2014 = loadDetailedSubclassPackets2014();
    const detailed2024 = loadDetailedSubclassPackets();
    const detailedIds = new Set([...detailed2014, ...detailed2024].map((packet) => packet.id));
    expect(detailedIds.size).toBe(44);
    expect(inventory.records.every((record) => detailedIds.has(record.id))).toBe(true);
  });

  it("captures structured 2024 level-up behavior for the first subclass extraction batch", () => {
    const packets = loadDetailedSubclassPackets();
    expect(packets.map((packet) => packet.id)).toEqual([
      "path-of-the-berserker-2024",
      "college-of-lore-2024",
      "life-domain-2024",
      "circle-of-the-land-2024",
      "champion-2024",
      "warrior-of-the-open-hand-2024",
      "oath-of-devotion-2024",
      "hunter-2024",
      "thief-2024",
      "draconic-sorcery-2024",
      "fiend-2024",
      "evoker-2024",
    ]);
    expect(packets.every((packet) => packet.featureLevels.every((feature) => feature.sourceReferences.includes("2024-basic-rules")))).toBe(true);

    const berserker = packets.find((packet) => packet.id === "path-of-the-berserker-2024")!;
    expect(berserker.featureLevels[3].resourceChanges).toContainEqual(expect.objectContaining({ restoreBy: "expend-rage-use" }));

    const lore = packets.find((packet) => packet.id === "college-of-lore-2024")!;
    expect(lore.featureLevels[1].spellChanges).toContainEqual(expect.objectContaining({ kind: "always-prepared", count: 2 }));

    const life = packets.find((packet) => packet.id === "life-domain-2024")!;
    expect(life.featureLevels[0].spellChanges).toContainEqual(expect.objectContaining({ kind: "always-prepared" }));

    const land = packets.find((packet) => packet.id === "circle-of-the-land-2024")!;
    expect(land.featureLevels[0].choices).toContainEqual(expect.objectContaining({ choiceId: "choose-land-type" }));
    expect(land.featureLevels[2].scaling).toContainEqual(expect.objectContaining({ choice: "temperate", resistance: "lightning" }));

    const hunter = packets.find((packet) => packet.id === "hunter-2024")!;
    expect(hunter.featureLevels[0].choices).toContainEqual(expect.objectContaining({ choiceId: "choose-hunters-prey" }));

    const devotion = packets.find((packet) => packet.id === "oath-of-devotion-2024")!;
    expect(devotion.featureLevels[3].resourceChanges).toContainEqual(expect.objectContaining({ restoreBy: "expend-level-5-spell-slot" }));

    const draconic = packets.find((packet) => packet.id === "draconic-sorcery-2024")!;
    expect(draconic.featureLevels[1].choices).toContainEqual(expect.objectContaining({ choiceId: "choose-draconic-damage-type" }));

    const evoker = packets.find((packet) => packet.id === "evoker-2024")!;
    expect(evoker.featureLevels[3].resourceChanges).toContainEqual(expect.objectContaining({ resourceId: "overchannel-free-use" }));
  });

  it("keeps 2014 subclass behavior separate from the 2024 redesign", () => {
    const packets = loadDetailedSubclassPackets2014();
    expect(packets.map((packet) => packet.id)).toEqual([
      "path-of-the-berserker-2014",
      "college-of-lore-2014",
      "life-domain-2014",
      "circle-of-the-land-2014",
      "champion-2014",
      "battle-master-2014",
      "eldritch-knight-2014",
      "way-of-the-open-hand-2014",
      "way-of-shadow-2014",
      "way-of-the-four-elements-2014",
      "oath-of-devotion-2014",
      "oath-of-the-ancients-2014",
      "oath-of-vengeance-2014",
      "hunter-2014",
      "beast-master-2014",
      "knowledge-domain-2014",
      "light-domain-2014",
      "nature-domain-2014",
      "tempest-domain-2014",
      "trickery-domain-2014",
      "war-domain-2014",
      "circle-of-the-moon-2014",
      "thief-2014",
      "draconic-bloodline-2014",
      "archfey-2014",
      "fiend-2014",
      "great-old-one-2014",
      "school-of-evocation-2014",
      "alchemist-2014",
      "armorer-2014",
      "artillerist-2014",
      "battle-smith-2014",
    ]);

    const berserker = packets.find((packet) => packet.id === "path-of-the-berserker-2014")!;
    expect(berserker.featureLevels[0].resourceChanges).toContainEqual(expect.objectContaining({ resourceId: "exhaustion" }));

    const life = packets.find((packet) => packet.id === "life-domain-2014")!;
    expect(life.featureLevels[0].automaticFeatures).toContain("bonus-proficiency-heavy-armor");
    expect(life.featureLevels[3].automaticFeatures).toContain("divine-strike");

    const land = packets.find((packet) => packet.id === "circle-of-the-land-2014")!;
    expect(land.featureLevels[0].choices).toContainEqual(expect.objectContaining({ choiceId: "choose-land" }));
    expect(land.featureLevels[0].spellChanges).toContainEqual(expect.objectContaining({ kind: "always-prepared-by-choice" }));

    const battleMaster = packets.find((packet) => packet.id === "battle-master-2014")!;
    expect(battleMaster.featureLevels[0].resourceChanges).toContainEqual(expect.objectContaining({ resourceId: "superiority-dice", maximum: 4 }));

    const eldritchKnight = packets.find((packet) => packet.id === "eldritch-knight-2014")!;
    expect(eldritchKnight.featureLevels[0].choices).toContainEqual(expect.objectContaining({ choiceId: "choose-3-first-level-wizard-spells", restrictedCount: 2 }));

    const hunter = packets.find((packet) => packet.id === "hunter-2014")!;
    expect(hunter.featureLevels[0].choices).toContainEqual(expect.objectContaining({ choiceId: "choose-hunters-prey" }));

    const beastMaster = packets.find((packet) => packet.id === "beast-master-2014")!;
    expect(beastMaster.featureLevels[0].choices).toContainEqual(expect.objectContaining({ choiceId: "choose-companion-beast" }));
  });
});
