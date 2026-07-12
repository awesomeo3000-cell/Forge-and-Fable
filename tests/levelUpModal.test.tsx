import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LevelUpModal from "@/components/LevelUpModal";
import { defaultCharacterSettings } from "@/lib/utils";

const abilities = { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };

function render(classId: string, level: number, newLevel: number) {
  return renderToStaticMarkup(createElement(LevelUpModal, {
    character: { ruleset: "2014", level, maxHp: 12, currentHp: 12, spellsKnown: [], skillProficiencies: ["athletics"] },
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
});
