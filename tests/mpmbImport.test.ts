import { describe, expect, it } from "vitest";
import { isMpmbSheet, mapMpmbFieldsToDraft } from "@/lib/import/mpmbSheet";
import { mapFormFieldsToDraft } from "@/lib/import/importMapper";
import type { ImportSource } from "@/lib/import/pdfTypes";

const source: ImportSource = { kind: "fillable-pdf", pages: 7, fileName: "mpmb.pdf" };

/** Field subset mirroring a real MPMB export: visible stat boxes are EMPTY
    (Acrobat-JS computed) — data lives in component/checkbox/row fields. */
function mpmbFields(): Record<string, string> {
  return {
    "PC Name": "",
    "Class and Levels": "Wizard (Bladesinger) 2",
    "Character Level": "2",
    "Race": "Tabaxi",
    "Background": "Entertainer",
    // Visible ability boxes empty; Remember = base,racial,extra,override.
    "Str": "", "Str Remember": "8,0,0,0", "Str ST Prof": "Off",
    "Dex": "", "Dex Remember": "8,2,0,0", "Dex ST Prof": "Off",
    "Con": "", "Con Remember": "8,0,0,0", "Con ST Prof": "Off",
    "Int": "", "Int Remember": "8,0,0,15", "Int ST Prof": "True",
    "Wis": "", "Wis Remember": "8,0,0,0", "Wis ST Prof": "True",
    "Cha": "", "Cha Remember": "8,1,0,0", "Cha ST Prof": "Off",
    "HP Max": "", "HP Current": "", "HP Temp": "",
    "AC": "10",
    "Init Bonus": "0",
    "Speed": "30 ft\r20 ft climb",
    "Acr Prof": "True", "Acr Exp": "Off",
    "Ste Prof": "True", "Ste Exp": "True",
    "Perc Prof": "Off", "Perc Exp": "Off",
    "Language 1": "Common", "Language 2": "Elvish",
    "Tool 1": "Disguise kit",
    "Proficiency Armor Light": "True",
    "Proficiency Weapon Other": "True",
    "Proficiency Weapon Other Description": "Dagger, Dart, Sling",
    "Attack.1.Weapon": "Cat's Claws", "Attack.1.To Hit": "+2", "Attack.1.Damage": "1d4", "Attack.1.Damage Type": "Slashing",
    "Attack.3.Weapon": "Spiked Chain",
    "Adventuring Gear Row 1": "Costume", "Adventuring Gear Amount 1": "1", "Adventuring Gear Weight 1": "4",
    "Adventuring Gear Row 2": "- Lute", "Adventuring Gear Amount 2": "1",
    // Spell page: literal "SPELL" rows are per-level section headers.
    "P5.SSfront.spells.name.0": "SPELL",
    "P5.SSfront.spells.name.1": "Fire Bolt", "P5.SSfront.spells.book.1": "P",
    "P5.SSfront.spells.name.6": "SPELL",
    "P5.SSfront.spells.name.7": "Shield", "P5.SSfront.spells.book.7": "S",
    "Limited Feature 1": "Feline Agility",
  };
}

describe("MPMB sheet detection", () => {
  it("detects MPMB by component ability fields", () => {
    expect(isMpmbSheet(mpmbFields())).toBe(true);
  });

  it("does not claim D&D Beyond style field sets", () => {
    expect(isMpmbSheet({ CharacterName: "Rhea", STR: "12", ClassLevel: "Ranger 5" })).toBe(false);
  });

  it("mapFormFieldsToDraft routes MPMB sheets to the dedicated mapper", () => {
    const draft = mapFormFieldsToDraft(mpmbFields(), source);
    expect(draft.identity.className.value).toBe("Wizard (Bladesinger)");
  });
});

describe("MPMB mapping", () => {
  const draft = mapMpmbFieldsToDraft(mpmbFields(), source);

  it("parses identity, trailing level, and character level", () => {
    expect(draft.identity.name.confidence).toBe("missing"); // truly empty on the sheet
    expect(draft.identity.className.value).toBe("Wizard (Bladesinger)");
    expect(draft.identity.level.value).toBe(2);
    expect(draft.identity.species.value).toBe("Tabaxi");
    expect(draft.identity.background.value).toBe("Entertainer");
  });

  it("derives abilities from Remember components with review confidence, honoring overrides", () => {
    expect(draft.abilities.strength).toMatchObject({ value: 8, confidence: "review" });
    expect(draft.abilities.dexterity.value).toBe(10); // 8 + 2 racial
    expect(draft.abilities.intelligence.value).toBe(15); // override component wins
    expect(draft.abilities.charisma.value).toBe(9);
  });

  it("reads vitals and takes the first speed line", () => {
    expect(draft.vitals.armorClass.value).toBe(10);
    expect(draft.vitals.initiative.value).toBe(0);
    expect(draft.vitals.speed.value).toBe("30 ft");
    expect(draft.vitals.maxHp.confidence).toBe("missing");
  });

  it("collects save/skill proficiencies with expertise markers", () => {
    expect(draft.proficiencies.savingThrows.value).toEqual(["Intelligence", "Wisdom"]);
    expect(draft.proficiencies.skills.value).toEqual(["Acrobatics", "Stealth (Expertise)"]);
  });

  it("collects languages, tools, armor and weapon proficiencies", () => {
    expect(draft.proficiencies.languages.value).toEqual(["Common", "Elvish"]);
    expect(draft.proficiencies.tools.value).toEqual(["Disguise kit"]);
    expect(draft.proficiencies.armor.value).toEqual(["Light armor"]);
    expect(draft.proficiencies.weapons.value).toEqual(["Dagger", "Dart", "Sling"]);
  });

  it("imports attack and gear rows, stripping container dashes", () => {
    expect(draft.attacks.map((a) => a.value?.name)).toEqual(["Cat's Claws", "Spiked Chain"]);
    expect(draft.attacks[0].value?.damage).toBe("1d4 Slashing");
    expect(draft.inventory.map((i) => i.value?.name)).toEqual(["Costume", "Lute"]);
    expect(draft.inventory[0].value?.quantity).toBe(1);
  });

  it("imports spells with levels inferred from section headers", () => {
    expect(draft.spells.map((s) => s.value?.name)).toEqual(["Fire Bolt", "Shield"]);
    expect(draft.spells[0].value?.level).toBe(0); // cantrip section
    expect(draft.spells[0].value?.prepared).toBe(true);
    expect(draft.spells[1].value?.level).toBe(1);
  });

  it("summarizes limited-use features", () => {
    expect(draft.notes.features.value).toBe("Feline Agility");
  });
});
