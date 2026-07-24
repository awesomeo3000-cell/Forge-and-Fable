/**
 * Client-safe resolved-content registry (Phase 6d, proposal §8.5).
 *
 * The client cannot reach the database, so it builds a `RulesContentRegistry`
 * from the minimal set of homebrew class/subclass payloads the server sends for
 * a character's referenced classes and its eligible picker options. Built-in
 * refs delegate to the static adapter; homebrew refs normalize the provided
 * payload with the same function the server uses (`classPacketNormalization`),
 * so client and server compute identical packets — and therefore identical
 * progression — for the same content.
 *
 * This module imports no server-only code (no store, no DB).
 */
import { builtinRulesContentRegistry } from "@/lib/homebrew/builtinRegistry";
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
  type HomebrewClassPayload,
  type HomebrewSubclassPayload,
  type ResolvedRulesContent,
  type RulesContentRef,
  type RulesContentRegistry,
  type SpeciesProgressionPacket,
} from "@/types/homebrew";

export type ResolvedContentEntry =
  | { kind: "class"; ref: RulesContentRef; payload: HomebrewClassPayload }
  | { kind: "subclass"; ref: RulesContentRef; payload: HomebrewSubclassPayload };

/**
 * Build a registry from resolved homebrew payloads. Keyed by `definitionId`,
 * since a character pins one version per class definition; the provided ref
 * carries the exact pinned version used for normalization.
 */
export function createResolvedRegistry(entries: readonly ResolvedContentEntry[]): RulesContentRegistry {
  const classes = new Map<string, { ref: RulesContentRef; payload: HomebrewClassPayload }>();
  const subclasses = new Map<string, { ref: RulesContentRef; payload: HomebrewSubclassPayload }>();
  for (const entry of entries) {
    if (entry.ref.source !== "homebrew") continue;
    if (entry.kind === "class") classes.set(entry.ref.definitionId, { ref: entry.ref, payload: entry.payload });
    else subclasses.set(entry.ref.definitionId, { ref: entry.ref, payload: entry.payload });
  }

  const registry: RulesContentRegistry = {
    resolve(ref: RulesContentRef): ResolvedRulesContent {
      switch (ref.kind) {
        case "class":
          return { kind: "class", ref, packet: registry.getClassPacket(ref) };
        case "subclass":
          return { kind: "subclass", ref, packet: registry.getSubclassPacket(ref) };
        case "species":
          return { kind: "species", ref, packet: registry.getSpeciesPacket(ref) };
        case "feat":
          return { kind: "feat", ref, packet: registry.getFeatPacket(ref) };
        default:
          throw new ContentResolutionError(`cannot resolve reference of kind "${ref.kind}"`, ref);
      }
    },
    getClassPacket(ref: RulesContentRef): ClassProgressionPacket {
      if (ref.source === "builtin") return builtinRulesContentRegistry.getClassPacket(ref);
      const hit = classes.get(ref.definitionId);
      if (!hit) throw new ContentResolutionError(`no resolved homebrew class for "${ref.definitionId}"`, ref);
      return normalizeHomebrewClassPacket(hit.payload, hit.ref);
    },
    getSubclassPacket(ref: RulesContentRef): SubclassProgressionPacket {
      if (ref.source === "builtin") return builtinRulesContentRegistry.getSubclassPacket(ref);
      const hit = subclasses.get(ref.definitionId);
      if (!hit) throw new ContentResolutionError(`no resolved homebrew subclass for "${ref.definitionId}"`, ref);
      return normalizeHomebrewSubclassPacket(hit.payload, hit.ref);
    },
    getSpeciesPacket(ref: RulesContentRef): SpeciesProgressionPacket {
      return builtinRulesContentRegistry.getSpeciesPacket(ref);
    },
    getFeatPacket(ref: RulesContentRef): FeatProgressionPacket {
      return builtinRulesContentRegistry.getFeatPacket(ref);
    },
  };
  return registry;
}
