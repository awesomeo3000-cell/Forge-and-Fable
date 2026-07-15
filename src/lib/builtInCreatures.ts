import rawCreatures from "@/data/creatures.json";
import type { CreatureLibraryRecord } from "@/types/dmTools";

/** Compact SRD-compatible starter library. Built-ins are immutable. */
export const BUILT_IN_CREATURES: CreatureLibraryRecord[] = rawCreatures as CreatureLibraryRecord[];

export function getBuiltInCreature(id: string): CreatureLibraryRecord | undefined {
  return BUILT_IN_CREATURES.find((c) => c.id === id);
}
