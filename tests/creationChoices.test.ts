import { afterEach, describe, expect, it, vi } from "vitest";
import type { HeroClass } from "@/types/game";

// Mock the engine + spell helpers so the test proves the wiring (that the
// ruleset flows through) without depending on catalog internals or on 2024
// being production-enabled.
const buildPlanMock = vi.hoisted(() => vi.fn(() => ({ choices: [] as { level: number }[] })));
const cantripsMock = vi.hoisted(() => vi.fn<(classId: string, level: number) => number>(() => 0));
vi.mock("@/lib/progression/engine", () => ({ buildClassLevelUpPlan: buildPlanMock }));
vi.mock("@/lib/spells", () => ({ cantripsKnownAt: cantripsMock }));

import { creationChoiceLevels } from "@/lib/progression/creationChoices";

const wizard = { id: "wizard" } as HeroClass;

afterEach(() => {
  vi.clearAllMocks();
  buildPlanMock.mockReturnValue({ choices: [] });
  cantripsMock.mockImplementation(() => 0);
});

describe("DW-003 creationChoiceLevels threads the character's ruleset", () => {
  it("forwards the given ruleset to the level-up plan (would regress if re-hardcoded)", () => {
    creationChoiceLevels("2024", wizard, 5);
    expect(buildPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ ruleset: "2024", classId: "wizard", fromLevel: 0, toLevel: 5 }),
    );
  });

  it("passes 2014 through when that is the character's ruleset", () => {
    creationChoiceLevels("2014", wizard, 5);
    expect(buildPlanMock).toHaveBeenCalledWith(expect.objectContaining({ ruleset: "2014" }));
  });

  it("returns a sorted, de-duplicated set of choice levels", () => {
    buildPlanMock.mockReturnValueOnce({ choices: [{ level: 4 }, { level: 2 }, { level: 4 }] });
    // A cantrip gain at level 4 as well — it must be merged, not duplicated.
    cantripsMock.mockImplementation((...args: [string, number]) => (args[1] >= 4 ? 4 : 3));
    expect(creationChoiceLevels("2014", wizard, 5)).toEqual([2, 4]);
  });

  it("adds the high-elf-legacy level-1 cantrip pick", () => {
    expect(creationChoiceLevels("2014", wizard, 5, "high-elf-legacy")).toEqual([1]);
  });
});
