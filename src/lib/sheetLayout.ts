import type { SheetLayout, SheetSectionId } from "@/types/game";

export const SECTION_TITLES: Record<SheetSectionId, string> = {
  identity: "Character",
  vitals: "Vitals",
  abilities: "Abilities",
  saves: "Saving Throws",
  skills: "Skills",
  senses: "Senses",
  profs: "Proficiencies & Training",
  attacks: "Attacks",
  features: "Features & Traits",
  notes: "Notes",
  background: "Background",
  console: "Console",
};

export const DEFAULT_LAYOUT: SheetLayout = {
  columns: [
    ["identity", "abilities", "senses", "profs"],
    ["vitals", "saves", "skills"],
    ["attacks", "features", "notes", "background", "console"],
  ],
  collapsed: [],
  version: 1,
};

export const MOBILE_ORDER: SheetSectionId[] = [
  "identity",
  "vitals",
  "abilities",
  "saves",
  "skills",
  "senses",
  "profs",
  "attacks",
  "features",
  "notes",
  "background",
  "console",
];

export function mergeWithDefaults(saved: SheetLayout | undefined): SheetLayout {
  if (!saved) return { ...DEFAULT_LAYOUT, columns: DEFAULT_LAYOUT.columns.map((c) => [...c]) };

  const allKnown: Set<string> = new Set(DEFAULT_LAYOUT.columns.flat());
  const savedIds: Set<string> = new Set(saved.columns.flat());

  const mergedColumns = saved.columns.map((col) =>
    col.filter((id) => allKnown.has(id)),
  );

  for (const id of allKnown) {
    if (!savedIds.has(id)) {
      mergedColumns[mergedColumns.length - 1] = [
        ...(mergedColumns[mergedColumns.length - 1] ?? []),
        id as SheetSectionId,
      ];
    }
  }

  return {
    columns: mergedColumns,
    collapsed: saved.collapsed.filter((id) => allKnown.has(id)),
    version: saved.version,
  };
}

export function flattenForMobile(layout: SheetLayout): SheetSectionId[] {
  const order: SheetSectionId[] = [];
  for (const col of layout.columns) {
    for (const id of col) {
      if (!order.includes(id)) order.push(id);
    }
  }
  return order;
}
