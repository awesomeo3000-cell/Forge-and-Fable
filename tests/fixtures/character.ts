import type { Character } from "@/types/game";
import { defaultCharacterSettings } from "@/lib/utils";

export function characterInput(name = "Foundation Hero"): Omit<Character, "id" | "userId" | "createdAt"> {
  return {
    name,
    ruleset: "2014",
    level: 1,
    alignment: "Neutral",
    background: "Acolyte",
    physicalCharacteristics: "",
    personalCharacteristics: "",
    generalNotes: "",
    raceId: "human",
    classId: "fighter",
    sourceIds: ["srd-5.1"],
    settings: defaultCharacterSettings(),
    abilities: {
      strength: 15,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    },
    currentHp: 12,
    maxHp: 12,
    tempHp: 0,
    inventory: [],
    spellsKnown: [],
    customRules: [],
    deathSaves: { successes: 0, failures: 0 },
  };
}
