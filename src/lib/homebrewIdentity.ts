import type { Character, HeroClass, Race, Ruleset } from "@/types/game";

export const HOMEBREW_CLASS_ID = "homebrew-custom-class";
export const HOMEBREW_RACE_ID = "homebrew-custom-species";

type CharacterIdentity = Pick<Character, "classId" | "raceId" | "customClassName" | "customRaceName" | "customRaceSpeed">;

export function isHomebrewClass(character: Pick<Character, "classId">): boolean {
  return character.classId === HOMEBREW_CLASS_ID;
}

export function isHomebrewRace(character: Pick<Character, "raceId">): boolean {
  return character.raceId === HOMEBREW_RACE_ID;
}

export function characterClassName(character: Pick<Character, "classId" | "customClassName">, activeRuleset: Ruleset): string {
  if (isHomebrewClass(character)) return character.customClassName?.trim() || "Homebrew Class";
  return activeRuleset.classes.find((entry) => entry.id === character.classId)?.name ?? character.classId;
}

export function characterRaceName(character: Pick<Character, "raceId" | "customRaceName">, activeRuleset: Ruleset): string {
  if (isHomebrewRace(character)) return character.customRaceName?.trim() || "Homebrew Species";
  return activeRuleset.races.find((entry) => entry.id === character.raceId)?.name ?? character.raceId;
}

export function resolveCharacterClass(character: CharacterIdentity, activeRuleset: Ruleset): HeroClass {
  const catalogClass = activeRuleset.classes.find((entry) => entry.id === character.classId);
  if (catalogClass) return catalogClass;

  return {
    id: HOMEBREW_CLASS_ID,
    name: character.customClassName?.trim() || "Homebrew Class",
    sourceBook: "Homebrew PDF import",
    summary: "Custom class imported from a character sheet. Progression and class features are managed manually.",
    coreTraits: [],
    levelProgression: [],
    hitDie: 8,
    primary: [],
    proficiencies: [],
    startingGear: [],
    actions: [],
    spellSuggestions: [],
    casterType: "none",
    asiLevels: [],
  };
}

export function resolveCharacterRace(character: CharacterIdentity, activeRuleset: Ruleset): Race {
  const catalogRace = activeRuleset.races.find((entry) => entry.id === character.raceId);
  if (catalogRace) return catalogRace;

  return {
    id: HOMEBREW_RACE_ID,
    name: character.customRaceName?.trim() || "Homebrew Species",
    sourceBook: "Homebrew PDF import",
    summary: "Custom species imported from a character sheet. Its PDF ability scores are preserved as written.",
    creatureType: "Humanoid",
    size: "Medium",
    speed: character.customRaceSpeed?.trim() || "30 ft.",
    bonuses: {},
    traits: [],
  };
}
