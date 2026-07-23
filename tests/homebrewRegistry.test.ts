import { describe, expect, it } from "vitest";
import { builtinRulesContentRegistry } from "@/lib/homebrew/builtinRegistry";
import { getProgressionPacket, progressionCatalog } from "@/lib/progression/packets";
import { ContentResolutionError, type RulesContentRef } from "@/types/homebrew";

const firstClassPacket = [...progressionCatalog.classes.values()][0];
const firstSubclassPacket = [...progressionCatalog.subclasses.values()][0];

describe("builtin RulesContentRegistry adapter", () => {
  it("resolves a built-in class to the same packet as the legacy catalog", () => {
    const ref: RulesContentRef = {
      source: "builtin",
      kind: "class",
      id: firstClassPacket.id,
      ruleset: firstClassPacket.ruleset,
    };
    const viaRegistry = builtinRulesContentRegistry.getClassPacket(ref);
    const viaLegacy = getProgressionPacket(firstClassPacket.ruleset, firstClassPacket.id).class;
    expect(viaRegistry).toBe(viaLegacy);
    expect(builtinRulesContentRegistry.resolve(ref)).toEqual({ kind: "class", ref, packet: viaRegistry });
  });

  it("resolves a built-in subclass by id", () => {
    const ref: RulesContentRef = {
      source: "builtin",
      kind: "subclass",
      id: firstSubclassPacket.sourceSubclassId,
      ruleset: firstSubclassPacket.ruleset,
    };
    expect(builtinRulesContentRegistry.getSubclassPacket(ref)).toBe(firstSubclassPacket);
  });

  it("throws a ContentResolutionError for an unknown class", () => {
    const ref: RulesContentRef = { source: "builtin", kind: "class", id: "not-a-class", ruleset: "2014" };
    expect(() => builtinRulesContentRegistry.getClassPacket(ref)).toThrow(ContentResolutionError);
  });

  it("refuses to resolve a homebrew reference (that is the server registry's job)", () => {
    const ref: RulesContentRef = {
      source: "homebrew",
      kind: "class",
      definitionId: "d",
      versionId: "v",
      ruleset: "2014",
    };
    expect(() => builtinRulesContentRegistry.getClassPacket(ref)).toThrow(ContentResolutionError);
  });

  it("reports species/feat built-in packets as not yet modeled", () => {
    const species: RulesContentRef = { source: "builtin", kind: "species", id: "elf", ruleset: "2014" };
    const feat: RulesContentRef = { source: "builtin", kind: "feat", id: "alert", ruleset: "2014" };
    expect(() => builtinRulesContentRegistry.getSpeciesPacket(species)).toThrow(ContentResolutionError);
    expect(() => builtinRulesContentRegistry.getFeatPacket(feat)).toThrow(ContentResolutionError);
  });
});
