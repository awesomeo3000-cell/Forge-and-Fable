import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ruleset } from "@/lib/ruleset";
import { CLASS_ART_IDS, classArtSrc } from "@/lib/classArt";
import {
  CLASS_SELECTOR_COPY,
  classCardDescription,
  classRoleLine,
  classTags,
  classToolSummary,
  mechanicalEssentials,
} from "@/components/commission/class/classPresentation";

describe("class chapter presentation (Orrery Path)", () => {
  it("has a real art file on disk for every mapped class", () => {
    for (const id of CLASS_ART_IDS) {
      const filePath = join(process.cwd(), "public", ...classArtSrc(id).split("/").filter(Boolean));
      expect(existsSync(filePath), `missing class art for ${id}`).toBe(true);
    }
  });

  it("has selector copy for every ruleset class", () => {
    for (const heroClass of ruleset.classes) {
      expect(classCardDescription(heroClass)).toBeTruthy();
      expect(classRoleLine(heroClass)).toBeTruthy();
    }
  });

  it("keeps selector copy keys in sync with the ruleset", () => {
    const ids = new Set(ruleset.classes.map((entry) => entry.id));
    for (const key of Object.keys(CLASS_SELECTOR_COPY)) {
      expect(ids.has(key)).toBe(true);
    }
  });

  it("derives tags only from recorded class fields", () => {
    const wizard = ruleset.classes.find((entry) => entry.id === "wizard")!;
    expect(classTags(wizard)).toEqual(["Full Spellcaster", "Intelligence", "d6 Hit Die"]);
    const fighter = ruleset.classes.find((entry) => entry.id === "fighter")!;
    expect(classTags(fighter)).toContain("Martial");
    const warlock = ruleset.classes.find((entry) => entry.id === "warlock")!;
    expect(classTags(warlock)).toContain("Pact Magic");
  });

  it("builds truthful mechanical essentials without inventing rules", () => {
    for (const heroClass of ruleset.classes) {
      const rows = mechanicalEssentials(heroClass);
      const labels = rows.map((row) => row.label);
      expect(labels).toContain("Hit Die");
      expect(labels).toContain("Spellcasting");
      // Never an invented saving-throw/armor split — the ruleset records one flat list.
      expect(labels).not.toContain("Saving Throw Proficiencies");
      for (const row of rows) {
        expect(row.value).toBeTruthy();
      }
      expect(rows.find((row) => row.label === "Hit Die")!.value).toBe(
        `1d${heroClass.hitDie} per ${heroClass.name} level`,
      );
    }
  });

  it("summarizes tool training as 'None' when a class records none", () => {
    expect(classToolSummary("fighter")).toBe("None");
    expect(classToolSummary("rogue")).toContain("Thieves' tools");
    expect(classToolSummary("bard")).toContain("choose 3");
  });
});
