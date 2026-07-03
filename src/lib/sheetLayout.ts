import type { SheetLayout, SheetSectionId } from "@/types/game";

export const SECTION_TITLES: Record<SheetSectionId, string> = {
  identity: "Character",
  vitals: "Vitals",
  abilities: "Abilities",
  saves: "Saves",
  skills: "Skills",
  senses: "Senses",
  profs: "Proficiencies & Training",
  equipment: "Equipment",
  effects: "Effects & Conditions",
  attacks: "Attacks",
  features: "Features & Traits",
  notes: "Notes",
  background: "Background",
  console: "Console",
};

// Full-width banner sections that are NOT part of the draggable columns.
// They always render at full width (identity + vitals on top, console on
// the bottom) to match the original sheet, and aren't reorderable.
export const PINNED_TOP: SheetSectionId[] = ["identity", "vitals"];
export const PINNED_BOTTOM: SheetSectionId[] = ["console"];
const PINNED = new Set<SheetSectionId>([...PINNED_TOP, ...PINNED_BOTTOM]);

export const DEFAULT_LAYOUT: SheetLayout = {
  columns: [
    ["abilities", "saves", "senses"],
    ["skills", "background", "notes"],
    ["equipment", "effects", "attacks", "features", "profs"],
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
  "equipment",
  "effects",
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
    col.filter((id) => allKnown.has(id) && !PINNED.has(id)),
  );
  // Old saved layouts (before pinning) put identity/vitals/console in columns;
  // make sure the column count matches the default so rendering stays stable.
  while (mergedColumns.length < DEFAULT_LAYOUT.columns.length) mergedColumns.push([]);

  for (const id of allKnown) {
    if (!savedIds.has(id)) {
      mergedColumns[mergedColumns.length - 1] = [
        ...(mergedColumns[mergedColumns.length - 1] ?? []),
        id as SheetSectionId,
      ];
    }
  }

  const hidden = (saved.hidden ?? []).filter((id) => allKnown.has(id) && !PINNED.has(id));
  const widths = saved.columnWidths;
  const widthsSum = Array.isArray(widths) ? widths.reduce((s, w) => s + (typeof w === "number" ? w : NaN), 0) : NaN;
  const columnWidths =
    Array.isArray(widths) &&
    widths.length === DEFAULT_LAYOUT.columns.length &&
    widths.every((w) => typeof w === "number" && Number.isFinite(w) && w >= 5) &&
    widthsSum >= 90 && widthsSum <= 110
      ? widths
      : undefined;

  return {
    columns: mergedColumns,
    collapsed: saved.collapsed.filter((id) => allKnown.has(id)),
    version: saved.version,
    hidden,
    columnWidths,
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
