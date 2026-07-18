import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import LevelUpModal from "@/components/LevelUpModal";
import { defaultCharacterSettings } from "@/lib/utils";
import { hydrateSpells } from "@/lib/spells";
import rawSpells from "@/data/spells.json";
import { buildCantripSelectionGroups } from "@/lib/cantripProgression";

const abilities = { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };

function render(classId: string, level: number, newLevel: number, overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(LevelUpModal, {
    character: { ruleset: "2014", level, maxHp: 12, currentHp: 12, spellsKnown: [], skillProficiencies: ["athletics"], ...overrides },
    newLevel,
    finalAbilities: abilities,
    classId,
    className: classId,
    hitDie: classId === "barbarian" ? 12 : 10,
    asiLevels: [4, 8, 12, 16, 19],
    subclassLevel: 3,
    casterType: "none",
    skipHp: true,
    hitPointType: defaultCharacterSettings().hitPointType,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  }));
}

beforeAll(() => {
  hydrateSpells(rawSpells);
});

function renderLegacyCharacter() {
  return renderToStaticMarkup(createElement(LevelUpModal, {
    character: { ruleset: "2014", level: 1, maxHp: 12, currentHp: 12, skillProficiencies: ["athletics"] },
    newLevel: 2,
    finalAbilities: abilities,
    classId: "fighter",
    className: "fighter",
    hitDie: 10,
    asiLevels: [4, 8, 12, 16, 19],
    subclassLevel: 3,
    casterType: "none",
    skipHp: true,
    hitPointType: defaultCharacterSettings().hitPointType,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  }));
}

describe("engine-driven level-up modal", () => {
  it("renders required level-one class choices from the progression plan", () => {
    const html = render("fighter", 0, 1);
    expect(html).toContain("Feature choices");
    expect(html).toContain("Choose Fighting Style");
    expect(html).toContain("Defense");
  });

  it("renders only progression-backed subclass selections at the selection level", () => {
    const html = render("barbarian", 2, 3);
    expect(html).toContain("Subclass");
    expect(html).toContain("Berserker");
    expect(html).not.toContain("Wild Soul");
  });

  it("keeps legacy characters without spellsKnown usable", () => {
    expect(() => renderLegacyCharacter()).not.toThrow();
  });

  it("offers Frostbite in the Druid level-one cantrip pool", () => {
    const html = render("druid", 0, 1);
    expect(html).toContain("Druid cantrips");
    expect(html).toContain("0/2");
    expect(html).toContain("Frostbite");
  });

  it("keeps subclass bonus cantrips separate from the class pool", () => {
    const lightDomain = render("cleric", 0, 1, { subclassId: "light-domain" });
    expect(lightDomain).toContain("Cleric cantrips");
    expect(lightDomain).toContain("Light cantrip");
    expect(lightDomain).toContain("0/3");
    expect(lightDomain).toContain("0/1");

    const landGroups = buildCantripSelectionGroups({
      classId: "druid",
      classCantripGain: 0,
      choices: [{ choiceId: "choose-bonus-druid-cantrip", count: 1 }],
    });
    expect(landGroups).toContainEqual(expect.objectContaining({ label: "Bonus Druid cantrip", count: 1, sourceClass: "druid" }));
  });

  it("offers the High Elf wizard cantrip during creation", () => {
    const html = render("barbarian", 0, 1, { raceId: "high-elf-legacy" });
    expect(html).toContain("High Elf wizard cantrip");
    expect(html).toContain("Frostbite");
  });
});
