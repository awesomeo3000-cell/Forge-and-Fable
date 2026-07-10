import { describe, it, expect } from "vitest";
import {
  firstLevelHp,
  fixedHpGain,
  rolledHpGain,
  buildStartingHp,
  revertHpLevel,
} from "@/lib/hitPoints";

describe("firstLevelHp", () => {
  it("d10 with CON +2 = 12", () => {
    expect(firstLevelHp(10, 2)).toBe(12);
  });

  it("minimum cannot fall below 1", () => {
    expect(firstLevelHp(6, -5)).toBe(1);
  });

  it("d12 with CON 0 = 12", () => {
    expect(firstLevelHp(12, 0)).toBe(12);
  });
});

describe("fixedHpGain", () => {
  it("d10 with CON +2 = 8", () => {
    expect(fixedHpGain(10, 2)).toBe(8);
  });

  it("d6 with CON -3 = 1", () => {
    expect(fixedHpGain(6, -3)).toBe(1);
  });

  it("d8 with CON 0 = 5", () => {
    expect(fixedHpGain(8, 0)).toBe(5);
  });
});

describe("rolledHpGain", () => {
  it("roll 1 with CON -2 = 1", () => {
    expect(rolledHpGain(1, -2)).toBe(1);
  });

  it("roll 6 with CON +3 = 9", () => {
    expect(rolledHpGain(6, 3)).toBe(9);
  });

  it("roll 2 with CON -5 = 1", () => {
    expect(rolledHpGain(2, -5)).toBe(1);
  });
});

describe("buildStartingHp", () => {
  it("level 1 d10 CON +2 starts at 12 HP with empty gains", () => {
    const result = buildStartingHp(1, 10, 2, "fixed");
    expect(result.maxHp).toBe(12);
    expect(result.hpGains).toEqual([]);
  });

  it("fixed level-5 d10 CON +2 = 44 HP with gains [8,8,8,8]", () => {
    const result = buildStartingHp(5, 10, 2, "fixed");
    expect(result.maxHp).toBe(44);
    expect(result.hpGains).toEqual([8, 8, 8, 8]);
  });

  it("rolled level-5 returns final gains, not raw die faces", () => {
    const result = buildStartingHp(5, 10, 2, "rolled", [3, 7, 1, 8]);
    expect(result.hpGains).toEqual([5, 9, 3, 10]);
    expect(result.maxHp).toBe(12 + 5 + 9 + 3 + 10);
  });

  it("fixed level-1 has no hpGains", () => {
    const result = buildStartingHp(1, 8, 1, "fixed");
    expect(result.hpGains).toEqual([]);
  });

  it("incomplete rolls produce gains only for the provided rolls", () => {
    const result = buildStartingHp(5, 10, 2, "rolled", [5, 4]);
    expect(result.hpGains.length).toBe(2);
    expect(result.maxHp).toBe(firstLevelHp(10, 2) + rolledHpGain(5, 2) + rolledHpGain(4, 2));
  });

  it("empty roll list for rolled returns first-level HP only", () => {
    const result = buildStartingHp(5, 10, 2, "rolled", []);
    expect(result.hpGains).toEqual([]);
    expect(result.maxHp).toBe(firstLevelHp(10, 2));
  });

  it("undefined rolls for rolled returns first-level HP only", () => {
    const result = buildStartingHp(5, 10, 2, "rolled");
    expect(result.hpGains).toEqual([]);
    expect(result.maxHp).toBe(firstLevelHp(10, 2));
  });

  it("level-1 rolled with rolls does not consume them", () => {
    const result = buildStartingHp(1, 10, 2, "rolled", [5, 6, 7]);
    expect(result.hpGains).toEqual([]);
    expect(result.maxHp).toBe(firstLevelHp(10, 2));
  });
});

describe("revertHpLevel", () => {
  it("reverting with history removes exactly the last gain", () => {
    const result = revertHpLevel(44, 44, [8, 8, 8, 8], "fixed", 10, 2);
    expect(result.safe).toBe(true);
    if (result.safe) {
      expect(result.newMaxHp).toBe(36);
      expect(result.newHpGains).toEqual([8, 8, 8]);
    }
  });

  it("reverting a full-health character caps current HP to new maximum", () => {
    const result = revertHpLevel(44, 44, [8, 8, 8, 8], "fixed", 10, 2);
    expect(result.safe).toBe(true);
    if (result.safe) {
      expect(result.newCurrentHp).toBe(result.newMaxHp);
    }
  });

  it("reverting a damaged character preserves current HP below new maximum", () => {
    const result = revertHpLevel(44, 20, [8, 8, 8, 8], "fixed", 10, 2);
    expect(result.safe).toBe(true);
    if (result.safe) {
      expect(result.newCurrentHp).toBe(20);
    }
  });

  it("reverting at 0 HP leaves current HP at 0", () => {
    const result = revertHpLevel(44, 0, [8, 8, 8, 8], "fixed", 10, 2);
    expect(result.safe).toBe(true);
    if (result.safe) {
      expect(result.newCurrentHp).toBe(0);
    }
  });

  it("missing-history fixed fallback is safe and deterministic", () => {
    const result = revertHpLevel(44, 44, [], "fixed", 10, 2);
    expect(result.safe).toBe(true);
    if (result.safe) {
      expect(result.newMaxHp).toBe(44 - 8);
      expect(result.newHpGains).toEqual([]);
    }
  });

  it("missing-history rolled reversion is unsafe", () => {
    const result = revertHpLevel(44, 44, [], "rolled", 10, 2);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toBeTruthy();
      expect(result.newMaxHp).toBe(44); // unchanged
    }
  });

  it("missing-history manual reversion is unsafe", () => {
    const result = revertHpLevel(44, 30, [], "manual", 8, 1);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.newMaxHp).toBe(44); // unchanged
      expect(result.newCurrentHp).toBe(30); // unchanged
    }
  });
});
