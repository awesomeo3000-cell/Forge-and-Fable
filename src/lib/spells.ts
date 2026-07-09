import type { SpellData } from "@/types/game";
import { fetchSpellCatalog } from "@/lib/spellsClient";

export const ALL_SPELLS: SpellData[] = [];

export const SPELLS_BY_ID = new Map<string, SpellData>();

let loaded = false;

export function hydrateSpells(spells: SpellData[]) {
  ALL_SPELLS.splice(0, ALL_SPELLS.length, ...spells);
  SPELLS_BY_ID.clear();
  for (const spell of ALL_SPELLS) {
    SPELLS_BY_ID.set(spell.id, spell);
  }
  loaded = true;
}

export async function loadSpells(): Promise<SpellData[]> {
  if (loaded) return ALL_SPELLS;
  const spells = await fetchSpellCatalog();
  hydrateSpells(spells);
  return ALL_SPELLS;
}

export function getSpell(id: string): SpellData | undefined {
  return SPELLS_BY_ID.get(id);
}

export function spellsForClass(classId: string): SpellData[] {
  return ALL_SPELLS.filter((s) => s.classes?.includes(classId));
}

/* Prepared casters (Cleric, Druid, Paladin, Artificer) don't LEARN a fixed
   list — they always have their whole class list available and prepare from
   it. So they never get a "choose spells to learn" step, and their sheet
   shows the full class list up to their accessible spell level. Known casters
   (Bard, Ranger, Sorcerer, Warlock) and the Wizard's spellbook DO learn. */
export const PREPARED_CASTERS = new Set(["cleric", "druid", "paladin", "artificer", "wizard"]);

export function learnsIndividualSpells(classId: string, casterType?: string): boolean {
  if (!casterType || casterType === "none") return false;
  // Wizards are prepared casters but still learn spells individually into their spellbook.
  if (classId === "wizard") return true;
  return !PREPARED_CASTERS.has(classId);
}

/** Only Wizards get the freeform spellbook Learn/Forget manager on the HeroSheet. */
export function isWizardSpellbook(classId: string): boolean {
  return classId === "wizard";
}

/**
 * Leveled (non-cantrip) spells a known caster / wizard learns when REACHING a
 * given level. Indexed by level (index 0 is unused); levels 1–20. Prepared
 * casters aren't listed — they prepare freely and never get a "learn" step.
 * Wizard adds 2 spellbook spells per level after the 6 it starts with at L1.
 * Source: 2014 5e SRD class tables ("new known" column).
 */
export const SPELLS_LEARNED_PER_LEVEL: Record<string, number[]> = {
  //         L: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
  bard:     [0, 4, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 0, 0],
  sorcerer: [0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
  warlock:  [0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  ranger:   [0, 0, 2, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  wizard:   [0, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
};

/**
 * Cantrips known by class level — thresholds of [level, total]. 2014 SRD
 * tables; artificer per Tasha's. Classes absent never know cantrips
 * (ranger, paladin, non-casters). Unlike leveled spells, EVERY caster with
 * cantrips picks them individually — including prepared casters.
 */
export const CANTRIPS_KNOWN: Record<string, [level: number, total: number][]> = {
  bard:      [[1, 2], [4, 3], [10, 4]],
  cleric:    [[1, 3], [4, 4], [10, 5]],
  druid:     [[1, 2], [4, 3], [10, 4]],
  sorcerer:  [[1, 4], [4, 5], [10, 6]],
  warlock:   [[1, 2], [4, 3], [10, 4]],
  wizard:    [[1, 3], [4, 4], [10, 5]],
  artificer: [[1, 2], [10, 3], [14, 4]],
};

/** Total cantrips a class knows at `level` (0 for classes without cantrips). */
export function cantripsKnownAt(classId: string, level: number): number {
  const rows = CANTRIPS_KNOWN[classId];
  if (!rows || level < 1) return 0;
  let total = 0;
  for (const [lvl, count] of rows) {
    if (level >= lvl) total = count;
  }
  return total;
}

/** Number of leveled spells a class learns when reaching `level` (0 if none / prepared). */
export function spellsLearnedReachingLevel(classId: string, level: number): number {
  const table = SPELLS_LEARNED_PER_LEVEL[classId];
  if (!table) return 0;
  const idx = Math.max(0, Math.min(20, Math.trunc(level)));
  return table[idx] ?? 0;
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
