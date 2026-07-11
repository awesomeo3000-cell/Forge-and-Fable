import { describe, expect, it } from "vitest";
import { availableFeats } from "@/lib/feats";
import type { AbilityScores } from "@/types/game";

const abilities: AbilityScores = { strength: 15, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };
const ids = (context: Parameters<typeof availableFeats>[0]) => new Set(availableFeats(context).map((feat) => feat.id));

describe("feat prerequisites", () => {
  it("requires the named Strike of the Giants feat and fourth level", () => {
    expect(ids({ level: 4, abilities, existingFeatIds: [] }).has("ember-of-the-fire-giant")).toBe(false);
    expect(ids({ level: 3, abilities, existingFeatIds: ["strike-of-the-giants"] }).has("ember-of-the-fire-giant")).toBe(false);
    expect(ids({ level: 4, abilities, existingFeatIds: ["strike-of-the-giants"] }).has("ember-of-the-fire-giant")).toBe(true);
  });

  it("enforces armor and martial-weapon prerequisites with background alternatives", () => {
    expect(ids({ level: 4, abilities, proficiencies: ["Light armor"] }).has("heavily-armored")).toBe(false);
    expect(ids({ level: 4, abilities, proficiencies: ["Medium armor"] }).has("heavily-armored")).toBe(true);
    expect(ids({ level: 4, abilities, proficiencies: [] }).has("strike-of-the-giants")).toBe(false);
    expect(ids({ level: 4, abilities, proficiencies: [], background: "Giant Foundling" }).has("strike-of-the-giants")).toBe(true);
  });

  it("allows a background to satisfy a spellcasting-or-background prerequisite", () => {
    expect(ids({ level: 4, abilities, casterType: "none", background: "Rune Carver" }).has("rune-shaper")).toBe(true);
    expect(ids({ level: 4, abilities, casterType: "none", background: "Acolyte" }).has("rune-shaper")).toBe(false);
  });
});
