import type { SheetLayout, SheetModule, SheetSectionId } from "@/types/game";

export const SECTION_TITLES: Record<SheetSectionId, string> = {
  identity: "Character", vitals: "Vitals", abilities: "Abilities", saves: "Saves", skills: "Skills",
  senses: "Senses", profs: "Proficiencies & Training", equipment: "Equipment", effects: "Effects & Conditions",
  attacks: "Attacks", actions: "Actions", "bonus-actions": "Bonus Actions", reactions: "Reactions", passives: "Passive & Triggered",
  features: "Features & Gear", traits: "Traits", spells: "Spells", spellbook: "Spellbook",
  inventory: "Inventory", notes: "Notes", background: "Background", pages: "Pages", console: "Console",
};

export const PINNED_TOP: SheetSectionId[] = ["identity", "vitals"];
// The console module was retired from the character sheet — nothing is pinned
// to the bottom now. (SECTION_TITLES keeps the "console" key for type coverage.)
export const PINNED_BOTTOM: SheetSectionId[] = [];
const PINNED = new Set<SheetSectionId>([...PINNED_TOP, ...PINNED_BOTTOM]);
const PREFERRED_TABS: Partial<Record<SheetSectionId, SheetSectionId[]>> = {
  attacks: ["attacks", "actions", "bonus-actions", "reactions"],
  features: ["features", "equipment", "passives", "traits", "spells", "spellbook", "inventory"],
};
const OPTIONAL_TABS: SheetSectionId[] = ["equipment", "actions", "bonus-actions", "reactions", "passives", "traits", "spells", "spellbook", "inventory"];
const DEFAULT_COLUMNS: SheetSectionId[][] = [
  ["abilities", "saves", "senses"],
  ["skills", "background", "notes"],
  ["effects", "attacks", "features", "profs", "pages"],
];
const DEFAULT_SECTIONS = DEFAULT_COLUMNS.flat();
const KNOWN_SECTIONS = new Set<SheetSectionId>([...DEFAULT_SECTIONS, ...OPTIONAL_TABS]);

function tabsForRoot(id: SheetSectionId) {
  return [...(PREFERRED_TABS[id] ?? [id])];
}

function defaultModules(): SheetModule[] {
  return DEFAULT_SECTIONS.map((id) => ({ id, tabs: tabsForRoot(id) }));
}

export const DEFAULT_LAYOUT: SheetLayout = {
  columns: DEFAULT_COLUMNS.map((column) => [...column]),
  modules: defaultModules(),
  collapsed: [],
  version: 5,
};

function cleanWidths(widths: number[] | undefined) {
  const sum = Array.isArray(widths) ? widths.reduce((total, width) => total + (typeof width === "number" ? width : NaN), 0) : NaN;
  return Array.isArray(widths) && widths.length === DEFAULT_COLUMNS.length
    && widths.every((width) => Number.isFinite(width) && width >= 5) && sum >= 90 && sum <= 110
    ? widths : undefined;
}

/** Equipment is a peer tab of the Features module, even when an older saved
 * layout stored it as its own module or in another merged module. */
function mergeEquipmentIntoFeatures(columns: string[][], modules: SheetModule[]) {
  const featureModule = modules.find((module) => module.tabs.includes("features"));
  if (!featureModule) return { columns, modules };

  const equipmentTitleSource = modules.find((module) => module.id !== featureModule.id && module.tabs.includes("equipment"));
  const equipmentTitle = equipmentTitleSource?.tabTitles?.equipment
    ?? (equipmentTitleSource?.tabs.length === 1 ? equipmentTitleSource.title : undefined);
  const nextModules = modules
    .map((module) => {
      if (module.id === featureModule.id) {
        const tabs: SheetSectionId[] = module.tabs.filter((id) => id !== "equipment");
        const featuresIndex = tabs.indexOf("features");
        tabs.splice(featuresIndex < 0 ? 0 : featuresIndex + 1, 0, "equipment");
        return {
          ...module,
          tabs,
          ...(equipmentTitle && !module.tabTitles?.equipment
            ? { tabTitles: { ...(module.tabTitles ?? {}), equipment: equipmentTitle } }
            : {}),
        };
      }
      return { ...module, tabs: module.tabs.filter((id) => id !== "equipment") };
    })
    .filter((module) => module.tabs.length > 0);
  const removedModuleIds = new Set(modules.filter((module) => !nextModules.some((next) => next.id === module.id)).map((module) => module.id));
  return {
    columns: columns.map((column) => column.filter((id) => !removedModuleIds.has(id))),
    modules: nextModules,
  };
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
    const tabs = Array.from(new Set([root, ...(saved.mergedSections?.[root] ?? []), ...tabsForRoot(root).filter((id) => !assignedSections.has(id) || id === root)]))
      .filter((id): id is SheetSectionId => KNOWN_SECTIONS.has(id) && !PINNED.has(id));
    return { id: moduleId, tabs, title: saved.customTitles?.[moduleId] };
  });
  const normalized = mergeEquipmentIntoFeatures(columns, modules);
  const finalModuleIds = new Set(normalized.modules.map((module) => module.id));
  return {
    columns: normalized.columns,
    modules: normalized.modules,
    collapsed: saved.collapsed.filter((id) => finalModuleIds.has(id)),
    hidden: (saved.hidden ?? []).filter((id) => finalModuleIds.has(id)),
    columnWidths: cleanWidths(saved.columnWidths),
    version: 5,
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

  for (const [preferredRoot, preferredTabs] of Object.entries(PREFERRED_TABS) as Array<[SheetSectionId, SheetSectionId[]]>) {
    const host = modules.find((module) => module.tabs.includes(preferredRoot));
    if (!host) continue;
    for (const tab of preferredTabs) {
      if (!seenTabs.has(tab)) {
        host.tabs.push(tab);
        seenTabs.add(tab);
      }
    }
  }

  const columns: string[][] = saved.columns.map((column) => column.filter((id) => seenModules.has(id)));
  while (columns.length < DEFAULT_COLUMNS.length) columns.push([]);
  const placedModules = new Set(columns.flat());
  for (const sheetModule of modules) if (!placedModules.has(sheetModule.id)) columns[columns.length - 1].push(sheetModule.id);

  for (const sectionId of DEFAULT_SECTIONS) {
    if (seenTabs.has(sectionId)) continue;
    const sheetModule: SheetModule = { id: sectionId, tabs: tabsForRoot(sectionId).filter((id) => !seenTabs.has(id)) };
    modules.push(sheetModule);
    columns[columns.length - 1].push(sheetModule.id);
    sheetModule.tabs.forEach((id) => seenTabs.add(id));
  }

  const normalized = mergeEquipmentIntoFeatures(columns, modules);
  const normalizedModuleIds = new Set(normalized.modules.map((module) => module.id));
  return {
    columns: normalized.columns,
    modules: normalized.modules,
    collapsed: saved.collapsed.filter((id) => normalizedModuleIds.has(id)),
    hidden: (saved.hidden ?? []).filter((id) => normalizedModuleIds.has(id)),
    columnWidths: cleanWidths(saved.columnWidths),
    version: 5,
  };
}

export function flattenForMobile(layout: SheetLayout): string[] {
  return layout.columns.flat().filter((id, index, all) => all.indexOf(id) === index);
}

export function moveSheetTab(
  layout: SheetLayout,
  sourceId: string,
  sectionId: SheetSectionId,
  targetId: string | null,
  options: { columnIndex?: number; beforeTab?: SheetSectionId; newModuleId?: string } = {},
): SheetLayout {
  const source = layout.modules?.find((module) => module.id === sourceId);
  if (!source || !source.tabs.includes(sectionId)) return layout;

  if (sourceId === targetId) {
    if (!options.beforeTab || options.beforeTab === sectionId || !source.tabs.includes(options.beforeTab)) return layout;
    const modules = (layout.modules ?? []).map((module) => {
      if (module.id !== sourceId) return module;
      const tabs = module.tabs.filter((id) => id !== sectionId);
      tabs.splice(tabs.indexOf(options.beforeTab!), 0, sectionId);
      return { ...module, tabs };
    });
    return { ...layout, modules };
  }

  if (targetId && !(layout.modules ?? []).some((module) => module.id === targetId)) return layout;

  const sourceTitle = source.tabTitles?.[sectionId] || (source.tabs[0] === sectionId ? source.title : undefined);
  let modules = (layout.modules ?? []).map((module) => module.id === sourceId
    ? { ...module, tabs: module.tabs.filter((id) => id !== sectionId) }
    : module);
  let columns = layout.columns.map((column) => [...column]);
  if (source.tabs.length === 1) {
    modules = modules.filter((module) => module.id !== sourceId);
    columns = columns.map((column) => column.filter((id) => id !== sourceId));
  }

  if (targetId) {
    modules = modules.map((module) => {
      if (module.id !== targetId) return module;
      const tabs = [...module.tabs];
      const targetIndex = options.beforeTab ? tabs.indexOf(options.beforeTab) : -1;
      tabs.splice(targetIndex < 0 ? tabs.length : targetIndex, 0, sectionId);
      return { ...module, tabs, tabTitles: { ...(module.tabTitles ?? {}), ...(sourceTitle ? { [sectionId]: sourceTitle } : {}) } };
    });
  } else {
    const id = options.newModuleId ?? `module-${sectionId}`;
    if (modules.some((module) => module.id === id)) return layout;
    modules.push({ id, tabs: [sectionId], ...(sourceTitle ? { title: sourceTitle } : {}) });
    const targetColumn = Math.max(0, Math.min(options.columnIndex ?? columns.length - 1, columns.length - 1));
    columns[targetColumn].push(id);
  }

  return { ...layout, columns, modules };
}
