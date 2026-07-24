/**
 * Server-side rules-content registry (Phase 6c).
 *
 * A `RulesContentRegistry` that resolves built-in references through the static
 * built-in adapter and homebrew class/subclass references by reading their
 * immutable pinned payloads from the store and normalizing them into
 * progression packets. This is the server authority that lets a character's
 * pinned homebrew class flow through the same `buildLevelUpPlan` /
 * `validateCharacterProgression` path built-in classes use.
 *
 * Server-only: it imports the store (and therefore the database). Never import
 * it into client code. Resolution is *pinned* (no access re-check) — a
 * character keeps resolving a version it already pins even after campaign access
 * changes (proposal §11.2). Access enforcement for a *newly selected* homebrew
 * class mirrors `validateNewHomebrewItems` and lands with the selection UI.
 */
import { builtinRulesContentRegistry } from "@/lib/homebrew/builtinRegistry";
import { readPinnedVersionPayload } from "@/lib/homebrew/homebrewStore";
import {
  normalizeHomebrewClassPacket,
  normalizeHomebrewSubclassPacket,
} from "@/lib/homebrew/classPacketNormalization";
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

export const serverRulesContentRegistry: RulesContentRegistry = {
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
    if (ref.source === "builtin") return builtinRulesContentRegistry.getClassPacket(ref);
    const payload = readPinnedVersionPayload(ref.definitionId, ref.versionId);
    if (!payload || payload.kind !== "class") {
      throw new ContentResolutionError(`no pinned homebrew class version for "${ref.definitionId}@${ref.versionId}"`, ref);
    }
    return normalizeHomebrewClassPacket(payload, ref);
  },

  getSubclassPacket(ref: RulesContentRef): SubclassProgressionPacket {
    if (ref.source === "builtin") return builtinRulesContentRegistry.getSubclassPacket(ref);
    const payload = readPinnedVersionPayload(ref.definitionId, ref.versionId);
    if (!payload || payload.kind !== "subclass") {
      throw new ContentResolutionError(`no pinned homebrew subclass version for "${ref.definitionId}@${ref.versionId}"`, ref);
    }
    return normalizeHomebrewSubclassPacket(payload, ref);
  },

  getSpeciesPacket(ref: RulesContentRef): SpeciesProgressionPacket {
    return builtinRulesContentRegistry.getSpeciesPacket(ref);
  },

  getFeatPacket(ref: RulesContentRef): FeatProgressionPacket {
    return builtinRulesContentRegistry.getFeatPacket(ref);
  },
};
