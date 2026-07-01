import raw from "@/data/spells.json";
import type { SpellData } from "@/types/game";

export const ALL_SPELLS: SpellData[] = raw as SpellData[];

export const SPELLS_BY_ID = new Map(ALL_SPELLS.map((s) => [s.id, s]));

export function getSpell(id: string): SpellData | undefined {
  return SPELLS_BY_ID.get(id);
}

export function parseDamageDice(text: string): { sides: number; count: number }[] {
  const dice: { sides: number; count: number }[] = [];
  const seen = new Set<string>();
  const re = /(\d+)d(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = `${m[1]}d${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      dice.push({ count: Number(m[1]), sides: Number(m[2]) });
    }
  }
  return dice;
}
