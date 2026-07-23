/**
 * Static built-in `RulesContentRegistry` adapter (Phase 0).
 *
 * Wraps the existing global `progressionCatalog` behind the injected-registry
 * interface so later phases can pass a registry into the progression engine
 * instead of importing the catalog directly. It resolves built-in class and
 * subclass references only; species/feat built-in packets do not exist yet and
 * raise a `ContentResolutionError`. Homebrew (database) references are resolved
 * by the server registry added in Phase 1/2, not here.
 */
import { getProgressionPacket, progressionCatalog } from "@/lib/progression/packets";
import type {
  ClassProgressionPacket,
  SubclassProgressionPacket,
} from "@/lib/progression/types";
import {
  ContentResolutionError,
  type FeatProgressionPacket,
  type ResolvedRulesContent,
  type RulesContentRef,
  type RulesContentRegistry,
  type SpeciesProgressionPacket,
} from "@/types/homebrew";

function requireBuiltin(ref: RulesContentRef, expected: RulesContentRef["kind"]): string {
  if (ref.source !== "builtin") {
    throw new ContentResolutionError(
      "the built-in registry only resolves built-in references",
      ref,
    );
  }
  if (ref.kind !== expected) {
    throw new ContentResolutionError(
      `expected a ${expected} reference but received "${ref.kind}"`,
      ref,
    );
  }
  return ref.id;
}

export const builtinRulesContentRegistry: RulesContentRegistry = {
  resolve(ref: RulesContentRef): ResolvedRulesContent {
    switch (ref.kind) {
      case "class":
        return { kind: "class", ref, packet: this.getClassPacket(ref) };
      case "subclass":
        return { kind: "subclass", ref, packet: this.getSubclassPacket(ref) };
      case "species":
        return { kind: "species", ref, packet: this.getSpeciesPacket(ref) };
      case "feat":
        return { kind: "feat", ref, packet: this.getFeatPacket(ref) };
      default:
        throw new ContentResolutionError(`cannot resolve reference of kind "${ref.kind}"`, ref);
    }
  },

  getClassPacket(ref: RulesContentRef): ClassProgressionPacket {
    const classId = requireBuiltin(ref, "class");
    try {
      return getProgressionPacket(ref.ruleset, classId).class;
    } catch (cause) {
      throw new ContentResolutionError(
        cause instanceof Error ? cause.message : `no built-in class "${classId}"`,
        ref,
      );
    }
  },

  getSubclassPacket(ref: RulesContentRef): SubclassProgressionPacket {
    const subclassId = requireBuiltin(ref, "subclass");
    // A bare subclass ref does not carry its parent class id, so scan the catalog
    // for a packet matching this ruleset and subclass id (by catalog id or the
    // original source subclass id).
    for (const packet of progressionCatalog.subclasses.values()) {
      if (
        packet.ruleset === ref.ruleset &&
        (packet.id === subclassId || packet.sourceSubclassId === subclassId)
      ) {
        return packet;
      }
    }
    throw new ContentResolutionError(
      `no built-in ${ref.ruleset} subclass "${subclassId}"`,
      ref,
    );
  },

  getSpeciesPacket(ref: RulesContentRef): SpeciesProgressionPacket {
    throw new ContentResolutionError(
      "built-in species progression packets are not modeled until Phase 7",
      ref,
    );
  },

  getFeatPacket(ref: RulesContentRef): FeatProgressionPacket {
    throw new ContentResolutionError(
      "built-in feat progression packets are not modeled until Phase 7",
      ref,
    );
  },
};
