import { describe, expect, it } from "vitest";
import { deathSavePatch } from "@/lib/deathSaves";
import { characterInput } from "./fixtures/character";

describe("death-save owner patches", () => {
  const hero = { ...characterInput("Rook"), id: "hero", userId: "player", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 0 };

  it("counts a natural one as two failures and marks three failures dead", () => {
    expect(deathSavePatch({ ...hero, currentHp: 0, deathSaves: { successes: 0, failures: 0 } }, "natural-1").deathSaves).toEqual({ successes: 0, failures: 2 });
    const patch = deathSavePatch({ ...hero, currentHp: 0, deathSaves: { successes: 0, failures: 2 } }, "failure");
    expect(patch.deathSaves).toEqual({ successes: 0, failures: 3 });
    expect(patch.effects?.some((effect) => effect.label === "Dead")).toBe(true);
  });

  it("restores one HP on a natural twenty and resets saves when healed", () => {
    expect(deathSavePatch({ ...hero, currentHp: 0, deathSaves: { successes: 1, failures: 1 } }, "natural-20")).toMatchObject({ currentHp: 1, deathSaves: { successes: 0, failures: 0 } });
    expect(deathSavePatch({ ...hero, currentHp: 0 }, "heal", 7)).toMatchObject({ currentHp: 7, deathSaves: { successes: 0, failures: 0 } });
  });
});
