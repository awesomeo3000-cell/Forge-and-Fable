import type { CasterType } from "@/types/game";

export const FULL_CASTER_SLOTS: number[][] = [
  [2], [3], [4,2], [4,3], [4,3,2],
  [4,3,3], [4,3,3,1], [4,3,3,2], [4,3,3,3,1], [4,3,3,3,2],
  [4,3,3,3,2,1], [4,3,3,3,2,1], [4,3,3,3,2,1,1], [4,3,3,3,2,1,1],
  [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1,1],
  [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1],
];

export function maxSlots(casterType: CasterType, level: number, classId?: string): number[] {
  if (casterType === "none") return [];
  if (casterType === "pact") {
    if (level < 1) return [];
    const slotLevel = Math.min(5, Math.ceil(level / 2));
    const count = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1;
    return Array(9).fill(0).map((_, i) => i + 1 === slotLevel ? count : 0);
  }
  // Artificer is the half-caster that rounds UP (Tasha's): 2 first-level
  // slots at level 1. Ranger/paladin get no slots until level 2.
  const halfCasterFloor = classId === "artificer" ? 1 : 2;
  const effectiveLevel = casterType === "half"
    ? (level < halfCasterFloor ? 0 : Math.ceil(level / 2))
    : level;
  if (effectiveLevel < 1) return [];
  const idx = Math.min(effectiveLevel, 20) - 1;
  const base = FULL_CASTER_SLOTS[idx];
  const result = Array(9).fill(0);
  for (let i = 0; i < base.length && (casterType !== "half" || i < 5); i++) {
    result[i] = base[i];
  }
  return result;
}
