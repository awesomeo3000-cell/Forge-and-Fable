import { describe, expect, it } from "vitest";
import {
  PORTRAITS,
  PORTRAIT_BY_ID,
  ANCESTRY_LIST,
  suggestPortraitAncestry,
  resolvePortraitSrc,
  isCatalogPortrait,
} from "@/data/portraits";

describe("Portrait catalog", () => {
  it("contains the 20 built-in portraits and any synced drop-ins", () => {
    expect(PORTRAITS.length).toBeGreaterThanOrEqual(20);
  });

  it("has unique opaque IDs", () => {
    const ids = PORTRAITS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses stable opaque IDs for built-in and synced portraits", () => {
    for (const p of PORTRAITS) {
      expect(p.id).toMatch(/^portrait-(?:[a-z-]+-\d{2}|auto-[a-z0-9-]+-[a-f0-9]{8})$/);
    }
  });

  it("covers 10 ancestries", () => {
    expect(ANCESTRY_LIST).toHaveLength(10);
  });

  it("sorts ancestries alphabetically", () => {
    const sorted = [...ANCESTRY_LIST];
    const expected = [...sorted].sort();
    expect(ANCESTRY_LIST).toEqual(expected);
  });

  it("has every ancestry with at least two portrait options", () => {
    for (const ancestry of ANCESTRY_LIST) {
      const options = PORTRAITS.filter((p) => p.suggestedAncestries.includes(ancestry));
      expect(options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("provides O(1) lookup by ID", () => {
    const tiefling = PORTRAIT_BY_ID.get("portrait-tiefling-02");
    expect(tiefling).toBeDefined();
    expect(tiefling!.src).toBe("/portraits/tiefling-female.png");
    expect(tiefling!.suggestedAncestries).toContain("tiefling");
    expect(PORTRAIT_BY_ID.get("nonexistent")).toBeUndefined();
  });

  it("resolves portrait src from ID", () => {
    expect(resolvePortraitSrc("portrait-human-01")).toBe("/portraits/human-male.png");
    expect(resolvePortraitSrc("nonexistent")).toBeUndefined();
    expect(resolvePortraitSrc("")).toBeUndefined();
  });

  it("checks catalog membership", () => {
    expect(isCatalogPortrait("portrait-dwarf-01")).toBe(true);
    expect(isCatalogPortrait("portrait-dwarf-02")).toBe(true);
    expect(isCatalogPortrait("")).toBe(false);
    expect(isCatalogPortrait("/portraits/some-custom.png")).toBe(false);
    expect(isCatalogPortrait("https://example.com/img.jpg")).toBe(false);
  });

  it("stores no player-facing labels", () => {
    for (const p of PORTRAITS) {
      expect(p).not.toHaveProperty("label");
      expect(p).not.toHaveProperty("presentation");
    }
  });
});

describe("suggestPortraitAncestry", () => {
  it("maps 2024 species IDs directly", () => {
    expect(suggestPortraitAncestry("tiefling")).toBe("tiefling");
    expect(suggestPortraitAncestry("elf")).toBe("elf");
    expect(suggestPortraitAncestry("dwarf")).toBe("dwarf");
    expect(suggestPortraitAncestry("human")).toBe("human");
    expect(suggestPortraitAncestry("goliath")).toBe("goliath");
    expect(suggestPortraitAncestry("gnome")).toBe("gnome");
    expect(suggestPortraitAncestry("halfling")).toBe("halfling");
  });

  it("maps legacy subrace IDs to the correct ancestry", () => {
    expect(suggestPortraitAncestry("high-elf-legacy")).toBe("half-elf");
    expect(suggestPortraitAncestry("wood-elf-legacy")).toBe("half-elf");
    expect(suggestPortraitAncestry("drow-legacy")).toBe("half-elf");
    expect(suggestPortraitAncestry("half-elf-legacy")).toBe("half-elf");
    expect(suggestPortraitAncestry("hill-dwarf-legacy")).toBe("dwarf");
    expect(suggestPortraitAncestry("mountain-dwarf-legacy")).toBe("dwarf");
    expect(suggestPortraitAncestry("lightfoot-halfling-legacy")).toBe("halfling");
    expect(suggestPortraitAncestry("stout-halfling-legacy")).toBe("halfling");
    expect(suggestPortraitAncestry("rock-gnome-legacy")).toBe("gnome");
    expect(suggestPortraitAncestry("air-genasi-legacy")).toBe("genasi");
    expect(suggestPortraitAncestry("water-genasi-legacy")).toBe("genasi");
    expect(suggestPortraitAncestry("variant-aasimar")).toBe("aasimar");
    expect(suggestPortraitAncestry("tiefling-legacy")).toBe("tiefling");
    expect(suggestPortraitAncestry("goliath-legacy")).toBe("goliath");
  });

  it("maps races without portraits to a reasonable fallback", () => {
    expect(suggestPortraitAncestry("dragonborn")).toBe("human");
    expect(suggestPortraitAncestry("orc")).toBe("human");
    expect(suggestPortraitAncestry("half-orc-legacy")).toBe("human");
  });

  it("returns undefined for truly unknown race IDs", () => {
    expect(suggestPortraitAncestry("unknown-race")).toBeUndefined();
    expect(suggestPortraitAncestry("")).toBeUndefined();
  });
});
