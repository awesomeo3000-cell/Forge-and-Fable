import type { Race } from "@/types/game";

/** Display copy for the family cards (complete-commission handoff §7). */
export const FAMILY_LABELS: Record<string, { name: string; summary: string }> = {
  "dwarf-legacy": { name: "Dwarf (Legacy)", summary: "Hill or Mountain dwarf traditions." },
  "elf-legacy": { name: "Elf (Legacy)", summary: "High, Wood, or Drow elf traditions." },
  "halfling-legacy": { name: "Halfling (Legacy)", summary: "Lightfoot or Stout halfling families." },
  "gnome-legacy": { name: "Gnome (Legacy)", summary: "Rock, Deep, or Forest gnome traditions." },
  "genasi-legacy": { name: "Genasi (Legacy)", summary: "Air, Earth, Fire, or Water elemental heritage." },
};

export type SpeciesGroup =
  | { kind: "single"; race: Race }
  | { kind: "family"; familyId: string; members: Race[] };

/** Groups races sharing a familyId into one family entry (first-seen order);
    races without a familyId pass through as their own single-race entry. */
export function groupSpeciesByFamily(races: Race[]): SpeciesGroup[] {
  const items: SpeciesGroup[] = [];
  const familyIndex = new Map<string, number>();

  for (const race of races) {
    if (!race.familyId) {
      items.push({ kind: "single", race });
      continue;
    }
    const existingIndex = familyIndex.get(race.familyId);
    if (existingIndex !== undefined) {
      const entry = items[existingIndex];
      if (entry.kind === "family") entry.members.push(race);
      continue;
    }
    familyIndex.set(race.familyId, items.length);
    items.push({ kind: "family", familyId: race.familyId, members: [race] });
  }

  return items;
}

export function speciesDetailLine(race: Race) {
  return `${race.creatureType} / ${race.size} / ${race.speed}`;
}

export function parseSpeciesName(name: string): { displayName: string; subspeciesLabel: string | null } {
  const match = name.match(/^(.+)\s+\((\d+)\)$/);
  if (match) {
    const count = parseInt(match[2], 10);
    return { displayName: match[1], subspeciesLabel: `${count} subspecies` };
  }
  return { displayName: name, subspeciesLabel: null };
}

/** Trait grouping for the lineage feature panel: senses and languages read
    differently from heritage abilities (handoff §7 trait hierarchy). */
export function groupTraits(race: Race): { senses: Race["traits"]; languages: Race["traits"]; heritage: Race["traits"] } {
  const senses: Race["traits"] = [];
  const languages: Race["traits"] = [];
  const heritage: Race["traits"] = [];
  for (const trait of race.traits) {
    if (/language/i.test(trait.name)) languages.push(trait);
    else if (/darkvision|blindsight|tremorsense|keen senses|sunlight sensitivity/i.test(trait.name)) senses.push(trait);
    else heritage.push(trait);
  }
  return { senses, languages, heritage };
}
