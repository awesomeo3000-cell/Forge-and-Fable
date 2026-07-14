import { describe, expect, it } from "vitest";
import { duplicateNameBadges, initiativeDensity, INITIATIVE_AUTO_COMPACT_THRESHOLD } from "@/lib/dmTable/initiative";

describe("initiative density", () => {
  it("stays standard for small encounters without the user toggle", () => {
    expect(initiativeDensity(0, false)).toBe("standard");
    expect(initiativeDensity(8, false)).toBe("standard");
  });

  it("auto-compacts at the 9-combatant threshold regardless of the toggle", () => {
    expect(initiativeDensity(INITIATIVE_AUTO_COMPACT_THRESHOLD, false)).toBe("compact");
    expect(initiativeDensity(16, false)).toBe("compact");
  });

  it("honors the user's global Compact choice at any count", () => {
    expect(initiativeDensity(2, true)).toBe("compact");
    expect(initiativeDensity(16, true)).toBe("compact");
  });
});

describe("duplicate-name badges", () => {
  it("badges only names that appear more than once, in order of appearance", () => {
    expect(duplicateNameBadges(["Goblin", "Elowen", "Goblin", "Wolf", "Goblin"]))
      .toEqual([1, null, 2, null, 3]);
  });

  it("returns null for every unique name", () => {
    expect(duplicateNameBadges(["A", "B", "C"])).toEqual([null, null, null]);
  });

  it("handles several duplicated groups independently", () => {
    expect(duplicateNameBadges(["Wolf", "Wolf", "Goblin", "Goblin", "Wolf"]))
      .toEqual([1, 2, 1, 2, 3]);
  });
});
