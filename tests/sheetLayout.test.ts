import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, mergeWithDefaults, moveSheetTab } from "@/lib/sheetLayout";
import type { SheetLayout } from "@/types/game";

describe("stable modular sheet layouts", () => {
  it("migrates legacy merged sections into ordered tabs", () => {
    const legacy: SheetLayout = {
      columns: [
        ["abilities", "saves", "senses"],
        ["skills", "background", "notes"],
        ["equipment", "effects", "features", "inventory", "profs", "pages"],
      ],
      collapsed: [],
      version: 2,
      customTitles: { features: "Adventuring", inventory: "My Pack" },
      mergedSections: { features: ["attacks"] },
    };

    const layout = mergeWithDefaults(legacy);
    const features = layout.modules?.find((module) => module.id === "features");

    expect(layout.version).toBe(4);
    expect(layout.columns.flat()).not.toContain("attacks");
    expect(features?.tabs).toContain("attacks");
    expect(features?.title).toBe("Adventuring");
    expect(layout.modules?.find((module) => module.id === "inventory")?.title).toBe("My Pack");
  });

  it("keeps default reference tabs inside the Features module", () => {
    const layout = mergeWithDefaults(undefined);
    expect(layout.columns).toEqual(DEFAULT_LAYOUT.columns);
    expect(layout.modules?.find((module) => module.id === "features")?.tabs).toEqual(["features", "passives", "traits", "spells", "spellbook", "inventory"]);
    expect(layout.modules?.find((module) => module.id === "attacks")?.tabs).toEqual(["attacks", "actions", "bonus-actions", "reactions"]);
    expect(layout.columns.flat()).not.toContain("inventory");
  });

  it("preserves arbitrary tab order while dropping invalid and duplicate tabs", () => {
    const saved: SheetLayout = {
      columns: [["combat"], ["skills"], []],
      modules: [
        { id: "combat", title: "Battle Station", tabs: ["effects", "attacks", "equipment", "attacks"] },
        { id: "skills", tabs: ["skills", "made-up" as "skills"] },
      ],
      collapsed: [],
      hidden: ["combat", "missing"],
      version: 3,
    };

    const layout = mergeWithDefaults(saved);
    expect(layout.modules?.find((module) => module.id === "combat")).toMatchObject({
      title: "Battle Station",
      tabs: ["effects", "attacks", "equipment", "actions", "bonus-actions", "reactions"],
    });
    expect(layout.hidden).toEqual(["combat"]);
  });

  it("extracts a tab into a standalone module in the chosen column", () => {
    const layout = mergeWithDefaults(undefined);
    const next = moveSheetTab(layout, "attacks", "bonus-actions", null, { columnIndex: 1, newModuleId: "bonus-module" });
    expect(next.modules?.find((module) => module.id === "attacks")?.tabs).toEqual(["attacks", "actions", "reactions"]);
    expect(next.modules?.find((module) => module.id === "bonus-module")).toMatchObject({ tabs: ["bonus-actions"] });
    expect(next.columns[1]).toContain("bonus-module");
  });

  it("does not orphan a tab when the drop target is not a real module", () => {
    const layout = mergeWithDefaults(undefined);
    expect(moveSheetTab(layout, "attacks", "actions", "extract:1")).toBe(layout);
  });
});
