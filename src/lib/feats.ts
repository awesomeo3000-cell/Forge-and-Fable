import raw from "@/data/feats.json";
import type { Feat } from "@/types/game";

export const ALL_FEATS: Feat[] = raw as Feat[];

export const FEATS_BY_ID = new Map(ALL_FEATS.map((f) => [f.id, f]));

export function getFeat(id: string): Feat | undefined {
  return FEATS_BY_ID.get(id);
}

export function availableFeats(race?: string): Feat[] {
  return ALL_FEATS.filter((f) => {
    if (f.racialPrereq && race && f.racialPrereq !== race) return false;
    return true;
  });
}
