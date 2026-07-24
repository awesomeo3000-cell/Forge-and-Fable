/**
 * Phase 6b — homebrew class/subclass packet normalization resolves through the
 * existing progression engine via an injected registry (proposal §8.4/§8.5).
 */
import { describe, expect, it } from "vitest";
import {
  homebrewPacketId,
  normalizeHomebrewClassPacket,
  normalizeHomebrewSubclassPacket,
} from "@/lib/homebrew/classPacketNormalization";
import { buildLevelUpPlan } from "@/lib/progression/engine";
import { fullCasterClass, partialCasterClass } from "./fixtures/homebrew";
import type {
  HomebrewSubclassPayload,
  RulesContentRef,
  RulesContentRegistry,
} from "@/types/homebrew";

const classRef: RulesContentRef = { source: "homebrew", kind: "class", definitionId: "runeweaver", versionId: "v1", ruleset: "2014" };
const subclassRef: RulesContentRef = { source: "homebrew", kind: "subclass", definitionId: "order-of-runes", versionId: "v1", ruleset: "2014" };

const emberSubclass: HomebrewSubclassPayload = {
  kind: "subclass",
  name: "Order of Runes",
  summary: "Runeweavers who bind fire.",
  parentClassRef: classRef,
  levels: {
    3: { level: 3, features: [{ id: "rune-ember", name: "Rune of Ember", description: "Fiery mark." }], resources: [{ resourceId: "ember-charges", maximum: 2, recharge: "short-rest" }] },
    6: { level: 6, features: [{ id: "rune-blaze", name: "Rune of Blaze", description: "Bigger fire." }] },
  },
};

function registryFor(classPayload = fullCasterClass): RulesContentRegistry {
  return {
    resolve(ref) {
      if (ref.kind === "subclass") return { kind: "subclass", ref, packet: normalizeHomebrewSubclassPacket(emberSubclass, ref) };
      return { kind: "class", ref, packet: normalizeHomebrewClassPacket(classPayload, ref) };
    },
    getClassPacket: (ref) => normalizeHomebrewClassPacket(classPayload, ref),
    getSubclassPacket: (ref) => normalizeHomebrewSubclassPacket(emberSubclass, ref),
    getSpeciesPacket: () => { throw new Error("no species"); },
    getFeatPacket: () => { throw new Error("no feat"); },
  };
}

describe("packet identity", () => {
  it("derives a stable homebrew packet id from the definition", () => {
    expect(homebrewPacketId(classRef)).toBe("hb:runeweaver");
    const packet = normalizeHomebrewClassPacket(fullCasterClass, classRef);
    expect(packet.id).toBe("hb:runeweaver");
    expect(packet.sourceClassId).toBe("hb:runeweaver");
    expect(Object.keys(packet.levels)).toHaveLength(20);
  });

  it("fills proficiency bonus for every level 1-20", () => {
    const packet = normalizeHomebrewClassPacket(fullCasterClass, classRef);
    expect(packet.levels[1].proficiencyBonus).toBe(2);
    expect(packet.levels[5].proficiencyBonus).toBe(3);
    expect(packet.levels[20].proficiencyBonus).toBe(6);
  });
});

describe("spellcasting normalization", () => {
  it("builds a full-caster slot table", () => {
    const packet = normalizeHomebrewClassPacket(fullCasterClass, classRef);
    expect(packet.spellcasting?.type).toBe("full");
    expect(packet.spellcasting?.spellSlotsByLevel?.["1"]).toEqual([2]);
    expect(packet.spellcasting?.spellSlotsByLevel?.["3"]).toEqual([4, 2]);
    expect(packet.spellcasting?.spellSlotsByLevel?.["20"]).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });

  it("rounds a half-caster up from level 2 and caps at 5th-level slots", () => {
    const packet = normalizeHomebrewClassPacket(partialCasterClass, { ...classRef, definitionId: "spellblade" });
    expect(packet.spellcasting?.type).toBe("half");
    expect(packet.spellcasting?.spellSlotsByLevel?.["1"]).toBeUndefined();
    expect(packet.spellcasting?.spellSlotsByLevel?.["2"]).toEqual([2]);
    expect(packet.spellcasting?.spellSlotsByLevel?.["5"]).toEqual([4, 2]);
    // Half casters never exceed 5th-level slots.
    expect(packet.spellcasting?.spellSlotsByLevel?.["20"]?.length).toBeLessThanOrEqual(5);
  });

  it("emits pact tables for a pact caster", () => {
    const pactClass = { ...fullCasterClass, spellcasting: { ...fullCasterClass.spellcasting, mode: "pact" as const } };
    const packet = normalizeHomebrewClassPacket(pactClass, classRef);
    expect(packet.spellcasting?.pactMagicSlotsByLevel?.[1]).toBe(1);
    expect(packet.spellcasting?.pactMagicSlotsByLevel?.[11]).toBe(3);
    expect(packet.spellcasting?.pactMagicSlotLevelByClassLevel?.[5]).toBe(3);
    expect(packet.spellcasting?.spellSlotsByLevel).toBeUndefined();
  });

  it("has no spellcasting for a non-caster", () => {
    const martial = { ...fullCasterClass, spellcasting: { ...fullCasterClass.spellcasting, mode: "none" as const } };
    expect(normalizeHomebrewClassPacket(martial, classRef).spellcasting).toBeUndefined();
  });
});

describe("resolves through buildLevelUpPlan via the injected registry", () => {
  it("produces class features and spell changes for a homebrew class", () => {
    const plan = buildLevelUpPlan({ ruleset: "2014", classId: "runeweaver", classRef, fromLevel: 0, toLevel: 2, registry: registryFor() });
    const featureIds = plan.automaticFeatures.map((f) => f.featureId);
    expect(featureIds).toContain("rw-spellcasting");
    expect(featureIds).toContain("rw-rune-mark");
    expect(plan.automaticFeatures.every((f) => f.sourcePacketId === "hb:runeweaver")).toBe(true);
    expect(plan.proficiencyBonus).toEqual({ before: 0, after: 2 });
    expect(plan.spellChanges.some((c) => c.kind === "spell-slots")).toBe(true);
  });

  it("grants homebrew subclass features and resources at the selection level", () => {
    const plan = buildLevelUpPlan({ ruleset: "2014", classId: "runeweaver", classRef, subclassId: "order-of-runes", subclassRef, fromLevel: 2, toLevel: 3, registry: registryFor() });
    const subclassFeatures = plan.automaticFeatures.filter((f) => f.source === "subclass");
    expect(subclassFeatures.map((f) => f.featureId)).toContain("rune-ember");
    expect(plan.resourceChanges.some((r) => r.resourceId === "ember-charges" && r.source === "subclass")).toBe(true);
  });

  it("rejects a subclass whose parent is a different class", () => {
    const orphan = registryFor();
    orphan.getSubclassPacket = (ref) => normalizeHomebrewSubclassPacket({ ...emberSubclass, parentClassRef: { source: "homebrew", kind: "class", definitionId: "other", versionId: "v1", ruleset: "2014" } }, ref);
    expect(() => buildLevelUpPlan({ ruleset: "2014", classId: "runeweaver", classRef, subclassId: "order-of-runes", subclassRef, fromLevel: 2, toLevel: 3, registry: orphan }))
      .toThrow(/belongs to class/);
  });

  it("refuses to resolve a homebrew class without a registry", () => {
    expect(() => buildLevelUpPlan({ ruleset: "2014", classId: "runeweaver", classRef, fromLevel: 0, toLevel: 1 }))
      .toThrow(/requires a content registry/);
  });
});
