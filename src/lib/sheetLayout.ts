import type { SheetLayout, SheetModule, SheetSectionId } from "@/types/game";

export const SECTION_TITLES: Record<SheetSectionId, string> = {
  identity: "Character", vitals: "Vitals", abilities: "Abilities", saves: "Saves", skills: "Skills",
  senses: "Senses", profs: "Proficiencies & Training", equipment: "Equipment", effects: "Effects & Conditions",
  attacks: "Attacks", features: "Features & Traits", traits: "Traits", spells: "Spells", spellbook: "Spellbook",
  inventory: "Inventory", notes: "Notes", background: "Background", pages: "Pages", console: "Console",
};

export const PINNED_TOP: SheetSectionId[] = ["identity", "vitals"];
export const PINNED_BOTTOM: SheetSectionId[] = ["console"];
const PINNED = new Set<SheetSectionId>([...PINNED_TOP, ...PINNED_BOTTOM]);
const OPTIONAL_TABS: SheetSectionId[] = ["traits", "spells", "spellbook", "inventory"];
const DEFAULT_COLUMNS: SheetSectionId[][] = [
  ["abilities", "saves", "senses"],
  ["skills", "background", "notes"],
  ["equipment", "effects", "attacks", "features", "profs", "pages"],
];
const DEFAULT_SECTIONS = DEFAULT_COLUMNS.flat();
const KNOWN_SECTIONS = new Set<SheetSectionId>([...DEFAULT_SECTIONS, ...OPTIONAL_TABS]);

function defaultModules(): SheetModule[] {
  return DEFAULT_SECTIONS.map((id) => ({ id, tabs: id === "features" ? ["features", ...OPTIONAL_TABS] : [id] }));
}

export const DEFAULT_LAYOUT: SheetLayout = {
  columns: DEFAULT_COLUMNS.map((column) => [...column]),
  modules: defaultModules(),
  collapsed: [],
  version: 3,
};

function cleanWidths(widths: number[] | undefined) {
  const sum = Array.isArray(widths) ? widths.reduce((total, width) => total + (typeof width === "number" ? width : NaN), 0) : NaN;
  return Array.isArray(widths) && widths.length === DEFAULT_COLUMNS.length
    && widths.every((width) => Number.isFinite(width) && width >= 5) && sum >= 90 && sum <= 110
    ? widths : undefined;
}

function migrateLegacy(saved: SheetLayout): SheetLayout {
  const mergedSources = new Set(Object.values(saved.mergedSections ?? {}).flatMap((ids) => ids ?? []));
  const columns = saved.columns.map((column) => column.filter((id) => KNOWN_SECTIONS.has(id as SheetSectionId) && !PINNED.has(id as SheetSectionId) && !mergedSources.has(id as SheetSectionId)));
  while (columns.length < DEFAULT_COLUMNS.length) columns.push([]);
  const present = new Set(columns.flat());
  const assignedSections = new Set<SheetSectionId>([...columns.flat().map((id) => id as SheetSectionId), ...mergedSources]);
  for (const sectionId of DEFAULT_SECTIONS) if (!assignedSections.has(sectionId)) { columns[columns.length - 1].push(sectionId); present.add(sectionId); assignedSections.add(sectionId); }
  const modules = columns.flat().map((moduleId) => {
    const root = moduleId as SheetSectionId;
    const tabs = Array.from(new Set([root, ...(saved.mergedSections?.[root] ?? []), ...(root === "features" ? OPTIONAL_TABS.filter((id) => !assignedSections.has(id) || id === root) : [])]))
      .filter((id): id is SheetSectionId => KNOWN_SECTIONS.has(id) && !PINNED.has(id));
    return { id: moduleId, tabs, title: saved.customTitles?.[moduleId] };
  });
  return {
    columns,
    modules,
    collapsed: saved.collapsed.filter((id) => present.has(id)),
    hidden: (saved.hidden ?? []).filter((id) => present.has(id)),
    columnWidths: cleanWidths(saved.columnWidths),
    version: 3,
  };
}

export function mergeWithDefaults(saved: SheetLayout | undefined): SheetLayout {
  if (!saved) return { ...DEFAULT_LAYOUT, columns: DEFAULT_LAYOUT.columns.map((column) => [...column]), modules: defaultModules() };
  if (saved.version < 3 || !Array.isArray(saved.modules)) return migrateLegacy(saved);

  const seenTabs = new Set<SheetSectionId>();
  const seenModules = new Set<string>();
  const modules = saved.modules.flatMap((module): SheetModule[] => {
    if (!module || typeof module.id !== "string" || !module.id.trim() || seenModules.has(module.id)) return [];
    const tabs = (Array.isArray(module.tabs) ? module.tabs : []).filter((tab): tab is SheetSectionId => {
      if (!KNOWN_SECTIONS.has(tab) || PINNED.has(tab) || seenTabs.has(tab)) return false;
      seenTabs.add(tab);
      return true;
    });
    if (!tabs.length) return [];
    seenModules.add(module.id);
    const tabTitles = Object.fromEntries(Object.entries(module.tabTitles ?? {}).flatMap(([id, title]) =>
      tabs.includes(id as SheetSectionId) && typeof title === "string" && title.trim() ? [[id, title.trim().slice(0, 60)]] : [],
    )) as SheetModule["tabTitles"];
    return [{ id: module.id, tabs, ...(module.title?.trim() ? { title: module.title.trim().slice(0, 60) } : {}), ...(Object.keys(tabTitles ?? {}).length ? { tabTitles } : {}) }];
  });

  const columns = saved.columns.map((column) => column.filter((id) => seenModules.has(id)));
  while (columns.length < DEFAULT_COLUMNS.length) columns.push([]);
  const placedModules = new Set(columns.flat());
  for (const sheetModule of modules) if (!placedModules.has(sheetModule.id)) columns[columns.length - 1].push(sheetModule.id);

  for (const sectionId of DEFAULT_SECTIONS) {
    if (seenTabs.has(sectionId)) continue;
    const sheetModule: SheetModule = { id: sectionId, tabs: sectionId === "features" ? ["features", ...OPTIONAL_TABS.filter((id) => !seenTabs.has(id))] : [sectionId] };
    modules.push(sheetModule);
    columns[columns.length - 1].push(sheetModule.id);
    sheetModule.tabs.forEach((id) => seenTabs.add(id));
  }

  const moduleIds = new Set(modules.map((module) => module.id));
  return {
    columns,
    modules,
    collapsed: saved.collapsed.filter((id) => moduleIds.has(id)),
    hidden: (saved.hidden ?? []).filter((id) => moduleIds.has(id)),
    columnWidths: cleanWidths(saved.columnWidths),
    version: 3,
  };
}

export function flattenForMobile(layout: SheetLayout): string[] {
  return layout.columns.flat().filter((id, index, all) => all.indexOf(id) === index);
}
