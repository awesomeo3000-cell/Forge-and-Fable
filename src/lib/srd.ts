import type { AbilityKey } from "@/types/game";

export type SkillDef = {
  id: string;
  name: string;
  ability: AbilityKey;
};

export const SKILLS: SkillDef[] = [
  { id: "acrobatics", name: "Acrobatics", ability: "dexterity" },
  { id: "animal-handling", name: "Animal Handling", ability: "wisdom" },
  { id: "arcana", name: "Arcana", ability: "intelligence" },
  { id: "athletics", name: "Athletics", ability: "strength" },
  { id: "deception", name: "Deception", ability: "charisma" },
  { id: "history", name: "History", ability: "intelligence" },
  { id: "insight", name: "Insight", ability: "wisdom" },
  { id: "intimidation", name: "Intimidation", ability: "charisma" },
  { id: "investigation", name: "Investigation", ability: "intelligence" },
  { id: "medicine", name: "Medicine", ability: "wisdom" },
  { id: "nature", name: "Nature", ability: "intelligence" },
  { id: "perception", name: "Perception", ability: "wisdom" },
  { id: "performance", name: "Performance", ability: "charisma" },
  { id: "persuasion", name: "Persuasion", ability: "charisma" },
  { id: "religion", name: "Religion", ability: "intelligence" },
  { id: "sleight-of-hand", name: "Sleight of Hand", ability: "dexterity" },
  { id: "stealth", name: "Stealth", ability: "dexterity" },
  { id: "survival", name: "Survival", ability: "wisdom" },
];

export const SAVE_PROFICIENCIES: Record<string, { label: string; abilities: [AbilityKey, AbilityKey] }> = {
  barbarian: { label: "Barbarian", abilities: ["strength", "constitution"] },
  bard: { label: "Bard", abilities: ["dexterity", "charisma"] },
  cleric: { label: "Cleric", abilities: ["wisdom", "charisma"] },
  druid: { label: "Druid", abilities: ["intelligence", "wisdom"] },
  fighter: { label: "Fighter", abilities: ["strength", "constitution"] },
  monk: { label: "Monk", abilities: ["strength", "dexterity"] },
  paladin: { label: "Paladin", abilities: ["wisdom", "charisma"] },
  ranger: { label: "Ranger", abilities: ["strength", "dexterity"] },
  rogue: { label: "Rogue", abilities: ["dexterity", "intelligence"] },
  sorcerer: { label: "Sorcerer", abilities: ["constitution", "charisma"] },
  warlock: { label: "Warlock", abilities: ["wisdom", "charisma"] },
  wizard: { label: "Wizard", abilities: ["intelligence", "wisdom"] },
};
