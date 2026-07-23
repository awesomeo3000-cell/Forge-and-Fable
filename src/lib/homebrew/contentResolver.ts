/**
 * Server-side content resolution (Phase 2): turn a character's pinned homebrew
 * item refs into resolver sources by reading their immutable version payloads.
 *
 * This is the "resolve built-in and homebrew references through one interface"
 * seam. Built-in item resolution uses the legacy prose adapter in
 * `mechanicSources.ts`; homebrew item resolution reads the pinned payload here.
 * The client-facing minimal-DTO registry (sending only the refs a character uses)
 * is a UI concern delivered with the Phase 3 Item Studio.
 */
import type { HomebrewItemInstanceState, HomebrewItemPayload } from "@/types/homebrew";
import { readPinnedVersionPayload } from "@/lib/homebrew/homebrewStore";
import { homebrewItemInstanceToSource } from "@/lib/homebrew/mechanicSources";
import type { MechanicSource } from "@/lib/homebrew/mechanicsResolver";

/** Resolve one pinned homebrew item instance to a source, or null if the ref is
 *  not a homebrew item or its payload is missing/mismatched. */
export function resolveHomebrewItemSource(
  instance: HomebrewItemInstanceState,
  characterLevel: number,
): MechanicSource | null {
  const ref = instance.contentRef;
  if (ref.source !== "homebrew" || ref.kind !== "item") return null;
  const payload = readPinnedVersionPayload(ref.definitionId, ref.versionId);
  if (!payload || payload.kind !== "item") return null;
  return homebrewItemInstanceToSource(payload as HomebrewItemPayload, instance, characterLevel);
}

/** Resolve every pinned homebrew item instance a character holds. */
export function resolveHomebrewItemSources(
  instances: readonly HomebrewItemInstanceState[],
  characterLevel: number,
): MechanicSource[] {
  const sources: MechanicSource[] = [];
  for (const instance of instances) {
    const source = resolveHomebrewItemSource(instance, characterLevel);
    if (source) sources.push(source);
  }
  return sources;
}
