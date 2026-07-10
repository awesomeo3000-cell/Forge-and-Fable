import { describe, it, expect } from "vitest";
import { maxSlots } from "@/lib/spellSlots";

describe("maxSlots", () => {
  it("level 1 full caster: 2×1st", () => {
    const slots = maxSlots("full", 1, "wizard");
    expect(slots[0]).toBe(2); // 1st level
    expect(slots[1]).toBe(0); // 2nd level
  });

  it("level 5 full caster: 4/3/2", () => {
    const slots = maxSlots("full", 5, "wizard");
    expect(slots[0]).toBe(4);
    expect(slots[1]).toBe(3);
    expect(slots[2]).toBe(2);
  });

  it("level 20 full caster: 4/3/3/3/3/2/2/1/1", () => {
    const slots = maxSlots("full", 20, "wizard");
    expect(slots[8]).toBe(1); // 9th level
  });

  it("level 1 half caster (paladin): no slots yet", () => {
    const slots = maxSlots("half", 1, "paladin");
    expect(slots[0] ?? 0).toBe(0);
  });

  it("level 5 half caster: 4/2", () => {
    const slots = maxSlots("half", 5, "paladin");
    expect(slots[0]).toBe(4);
    expect(slots[1]).toBe(2);
  });

  it("level 1 Artificer (rounds up): 2×1st", () => {
    const slots = maxSlots("half", 1, "artificer");
    expect(slots[0]).toBe(2); // Artificer rounds up: ceil(1/2)=1 → 2 slots
  });

  it("level 1 Warlock (pact): 1×1st", () => {
    const slots = maxSlots("pact", 1, "warlock");
    expect(slots[0]).toBe(1);
  });

  it("level 11 Warlock: 3×5th", () => {
    const slots = maxSlots("pact", 11, "warlock");
    expect(slots[4]).toBe(3); // 5th level pact slots
  });

  it("non-caster always returns all zeros", () => {
    const slots = maxSlots("none", 10, "fighter");
    for (let i = 0; i < 9; i++) expect(slots[i] ?? 0).toBe(0);
  });
});
