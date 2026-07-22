import { describe, it, expect } from "vitest";
import { computeArmorClass, totalCarriedWeight } from "@/lib/equipment";
import type { AbilityScores, Equipment, InventoryItem } from "@/types/game";

function makeAbilities(dex: number, extra: Partial<AbilityScores> = {}): AbilityScores {
  return {
    strength: 10,
    dexterity: dex,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    ...extra,
  };
}

describe("computeArmorClass", () => {
  it("unarmored DEX 14 = AC 12", () => {
    const result = computeArmorClass(makeAbilities(14), "fighter", undefined, []);
    expect(result.total).toBe(12);
  });

  it("leather with DEX 14 = AC 13", () => {
    const eq: Equipment = { armorId: "leather" };
    const result = computeArmorClass(makeAbilities(14), "fighter", eq, []);
    expect(result.total).toBe(13);
  });

  it("half plate with DEX 18 applies only +2 DEX", () => {
    const eq: Equipment = { armorId: "half-plate" };
    const result = computeArmorClass(makeAbilities(18), "fighter", eq, []);
    expect(result.total).toBe(17); // 15 base + 2 dex (max 2)
  });

  it("chain mail ignores DEX and reports strength warning below STR 13", () => {
    const eq: Equipment = { armorId: "chain-mail" };
    const result = computeArmorClass(makeAbilities(14, { strength: 10 }), "fighter", eq, []);
    expect(result.total).toBe(16); // 16 base, no dex
    expect(result.strengthWarning).toBe(true);
  });

  it("shield adds 2", () => {
    const eq: Equipment = { armorId: "leather", shield: true };
    const result = computeArmorClass(makeAbilities(14), "fighter", eq, []);
    expect(result.total).toBe(15); // 11 + 2 dex + 2 shield
  });

  it("barbarian unarmored defense uses DEX + CON", () => {
    const result = computeArmorClass(
      makeAbilities(14, { constitution: 14 }),
      "barbarian",
      undefined,
      [],
    );
    expect(result.total).toBe(14); // 10 + 2 dex + 2 con
  });

  it("monk unarmored defense uses DEX + WIS, shield falls back from monk unarmored", () => {
    // Monk with shield loses unarmored defense; falls back to 10 + dex
    const eq: Equipment = { shield: true };
    const result = computeArmorClass(
      makeAbilities(16, { wisdom: 16 }),
      "monk",
      eq,
      [],
    );
    // Shield means monk unarmored defense doesn't apply → 10 + dex(3) + shield(2) = 15
    expect(result.total).toBe(15);
  });

  it("monk unarmored defense without shield uses DEX + WIS", () => {
    const result = computeArmorClass(
      makeAbilities(16, { wisdom: 14 }),
      "monk",
      undefined,
      [],
    );
    expect(result.total).toBe(15); // 10 + 3 dex + 2 wis
  });
});

describe("totalCarriedWeight", () => {
  it("multiplies item weight by its inventory quantity", () => {
    const item: InventoryItem = { id: "torch", name: "Torch", rarity: "Mundane", attunement: false, notes: "", weight: 1, quantity: 6 };
    expect(totalCarriedWeight([item], undefined, undefined, true)).toBe(6);
  });
});
