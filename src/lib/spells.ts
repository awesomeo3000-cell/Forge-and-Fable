import raw from "@/data/spells.json";
import type { SpellData } from "@/types/game";

export const ALL_SPELLS: SpellData[] = raw as SpellData[];

export const SPELLS_BY_ID = new Map(ALL_SPELLS.map((s) => [s.id, s]));

export function getSpell(id: string): SpellData | undefined {
  return SPELLS_BY_ID.get(id);
}

export function spellsForClass(className: string): SpellData[] {
  return ALL_SPELLS.filter((s) => s.classes?.includes(className));
}

/* Prepared casters (Cleric, Druid, Paladin, Artificer) don't LEARN a fixed
   list — they always have their whole class list available and prepare from
   it. So they never get a "choose spells to learn" step, and their sheet
   shows the full class list up to their accessible spell level. Known casters
   (Bard, Ranger, Sorcerer, Warlock) and the Wizard's spellbook DO learn. */
export const PREPARED_CASTERS = new Set(["cleric", "druid", "paladin", "artificer"]);

export function learnsIndividualSpells(classId: string, casterType?: string): boolean {
  return !!casterType && casterType !== "none" && !PREPARED_CASTERS.has(classId);
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
