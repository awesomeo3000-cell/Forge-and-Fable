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
  artificer: { label: "Artificer", abilities: ["constitution", "intelligence"] },
};

/** Class skill proficiency choices (PHB): pick `count` from `options`. */
export const CLASS_SKILL_CHOICES: Record<string, { count: number; options: string[] }> = {
  barbarian: { count: 2, options: ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"] },
  bard: { count: 3, options: SKILLS.map((s) => s.id) },
  cleric: { count: 2, options: ["history", "insight", "medicine", "persuasion", "religion"] },
  druid: { count: 2, options: ["arcana", "animal-handling", "insight", "medicine", "nature", "perception", "religion", "survival"] },
  fighter: { count: 2, options: ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "perception", "survival"] },
  monk: { count: 2, options: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"] },
  paladin: { count: 2, options: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"] },
  ranger: { count: 3, options: ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"] },
  rogue: { count: 4, options: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight-of-hand", "stealth"] },
  sorcerer: { count: 2, options: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"] },
  warlock: { count: 2, options: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"] },
  wizard: { count: 2, options: ["arcana", "history", "insight", "investigation", "medicine", "religion"] },
  artificer: { count: 2, options: ["arcana", "history", "investigation", "medicine", "nature", "perception", "sleight-of-hand"] },
};
