import { describe, it, expect } from "vitest";
import { abilityModifier, proficiencyBonus } from "@/lib/utils";

describe("abilityModifier", () => {
  it("10 = 0", () => expect(abilityModifier(10)).toBe(0));
  it("11 = 0", () => expect(abilityModifier(11)).toBe(0));
  it("12 = +1", () => expect(abilityModifier(12)).toBe(1));
  it("13 = +1", () => expect(abilityModifier(13)).toBe(1));
  it("14 = +2", () => expect(abilityModifier(14)).toBe(2));
  it("18 = +4", () => expect(abilityModifier(18)).toBe(4));
  it("20 = +5", () => expect(abilityModifier(20)).toBe(5));
  it("9 = -1", () => expect(abilityModifier(9)).toBe(-1));
  it("8 = -1", () => expect(abilityModifier(8)).toBe(-1));
  it("7 = -2", () => expect(abilityModifier(7)).toBe(-2));
  it("3 = -4", () => expect(abilityModifier(3)).toBe(-4));
  it("1 = -5", () => expect(abilityModifier(1)).toBe(-5));
});

describe("proficiencyBonus", () => {
  it("level 1 = +2", () => expect(proficiencyBonus(1)).toBe(2));
  it("level 4 = +2", () => expect(proficiencyBonus(4)).toBe(2));
  it("level 5 = +3", () => expect(proficiencyBonus(5)).toBe(3));
  it("level 8 = +3", () => expect(proficiencyBonus(8)).toBe(3));
  it("level 9 = +4", () => expect(proficiencyBonus(9)).toBe(4));
  it("level 12 = +4", () => expect(proficiencyBonus(12)).toBe(4));
  it("level 13 = +5", () => expect(proficiencyBonus(13)).toBe(5));
  it("level 16 = +5", () => expect(proficiencyBonus(16)).toBe(5));
  it("level 17 = +6", () => expect(proficiencyBonus(17)).toBe(6));
  it("level 20 = +6", () => expect(proficiencyBonus(20)).toBe(6));
});
