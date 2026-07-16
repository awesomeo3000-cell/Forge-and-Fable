import { existsSync } from "node:fs";
import { join } from "node:path";
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
  it("has at least one portrait", () => {
    expect(PORTRAITS.length).toBeGreaterThan(0);
  });

  it("has a real file on disk for every catalog entry (no blank tiles)", () => {
    // The 2026-07-15 blank-tile regression: catalog entries referencing
    // deleted public/portraits/*.png rendered as empty selectable cards.
    for (const p of PORTRAITS) {
      const filePath = join(process.cwd(), "public", ...p.src.split("/").filter(Boolean));
      expect(existsSync(filePath), `missing portrait asset for ${p.id}: ${p.src}`).toBe(true);
    }
  });

  it("has unique opaque IDs", () => {
    const ids = PORTRAITS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses stable opaque IDs", () => {
    for (const p of PORTRAITS) {
      expect(p.id).toMatch(/^portrait-(?:[a-z-]+-\d{2}|auto-[a-z0-9-]+-[a-f0-9]{8})$/);
    }
  });

  it("sorts ancestries alphabetically", () => {
    const sorted = [...ANCESTRY_LIST];
    const expected = [...sorted].sort();
    expect(ANCESTRY_LIST).toEqual(expected);
  });

  it("provides O(1) lookup by ID", () => {
    const first = PORTRAITS[0];
    expect(PORTRAIT_BY_ID.get(first.id)).toBe(first);
    expect(PORTRAIT_BY_ID.get("nonexistent")).toBeUndefined();
  });

  it("resolves portrait src from ID", () => {
    const first = PORTRAITS[0];
    expect(resolvePortraitSrc(first.id)).toBe(first.src);
    expect(resolvePortraitSrc("nonexistent")).toBeUndefined();
    expect(resolvePortraitSrc("")).toBeUndefined();
  });

  it("checks catalog membership", () => {
    expect(isCatalogPortrait(PORTRAITS[0].id)).toBe(true);
    expect(isCatalogPortrait("")).toBe(false);
    expect(isCatalogPortrait("/portraits/some-custom.png")).toBe(false);
    expect(isCatalogPortrait("https://example.com/img.jpg")).toBe(false);
  });

  it("treats retired built-in IDs as non-catalog (safe initials fallback)", () => {
    // Old drafts may still persist these; CharacterPortrait falls back to
    // initials instead of a broken image.
    expect(isCatalogPortrait("portrait-tiefling-02")).toBe(false);
    expect(resolvePortraitSrc("portrait-human-01")).toBeUndefined();
  });

  it("stores no player-facing labels", () => {
    for (const p of PORTRAITS) {
      expect(p).not.toHaveProperty("label");
      expect(p).not.toHaveProperty("presentation");
    }
  });
});

describe("suggestPortraitAncestry", () => {
  it("maps species IDs to a portrait ancestry", () => {
    expect(suggestPortraitAncestry("tiefling")).toBe("tiefling");
    expect(suggestPortraitAncestry("elf")).toBe("elf");
    expect(suggestPortraitAncestry("dwarf")).toBe("dwarf");
    expect(suggestPortraitAncestry("human")).toBe("human");
  });

  it("maps legacy subrace IDs to the correct ancestry", () => {
    expect(suggestPortraitAncestry("high-elf-legacy")).toBe("half-elf");
    expect(suggestPortraitAncestry("hill-dwarf-legacy")).toBe("dwarf");
    expect(suggestPortraitAncestry("air-genasi-legacy")).toBe("genasi");
    expect(suggestPortraitAncestry("variant-aasimar")).toBe("aasimar");
  });

  it("maps races without portraits to a reasonable fallback", () => {
    expect(suggestPortraitAncestry("dragonborn")).toBe("human");
    expect(suggestPortraitAncestry("orc")).toBe("human");
  });

  it("returns undefined for truly unknown race IDs", () => {
    expect(suggestPortraitAncestry("unknown-race")).toBeUndefined();
    expect(suggestPortraitAncestry("")).toBeUndefined();
  });
});
