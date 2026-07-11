import type { CreatureLibraryRecord } from "@/types/dmTools";

const createdAt = "2026-01-01T00:00:00.000Z";
const make = (record: Omit<CreatureLibraryRecord, "kind" | "createdAt" | "updatedAt">): CreatureLibraryRecord => ({
  ...record,
  kind: "built-in",
  createdAt,
  updatedAt: createdAt,
});

/** Compact SRD-compatible starter library. Built-ins are immutable. */
export const BUILT_IN_CREATURES: CreatureLibraryRecord[] = [
  make({ id: "builtin:goblin", name: "Goblin", source: "SRD 5.1", tags: ["humanoid", "skirmisher"], creatureType: "humanoid", size: "Small", challengeRating: 0.25, experienceValue: 50, environments: ["forest", "dungeon", "urban"], armorClass: 15, hitPoints: { average: 7, formula: "2d6" }, speed: "30 ft.", passivePerception: 9, actions: [{ name: "Scimitar", description: "Melee weapon attack.", attackBonus: 4, damage: "1d6+2", averageDamage: 5 }, { name: "Shortbow", description: "Ranged weapon attack.", attackBonus: 4, damage: "1d6+2", averageDamage: 5 }] }),
  make({ id: "builtin:wolf", name: "Wolf", source: "SRD 5.1", tags: ["beast", "pack-tactics"], creatureType: "beast", size: "Medium", challengeRating: 0.25, experienceValue: 50, environments: ["forest", "grassland", "arctic"], armorClass: 13, hitPoints: { average: 11, formula: "2d8+2" }, speed: "40 ft.", passivePerception: 13, traits: [{ name: "Pack Tactics", description: "Has advantage when an ally is beside the target." }], actions: [{ name: "Bite", description: "Melee attack; may knock the target prone.", attackBonus: 4, damage: "2d4+2", averageDamage: 7 }] }),
  make({ id: "builtin:skeleton", name: "Skeleton", source: "SRD 5.1", tags: ["undead", "ranged"], creatureType: "undead", size: "Medium", challengeRating: 0.25, experienceValue: 50, environments: ["dungeon", "urban"], armorClass: 13, hitPoints: { average: 13, formula: "2d8+4" }, speed: "30 ft.", passivePerception: 9, vulnerabilities: "bludgeoning", immunities: "poison", actions: [{ name: "Shortsword", description: "Melee weapon attack.", attackBonus: 4, damage: "1d6+2", averageDamage: 5 }, { name: "Shortbow", description: "Ranged weapon attack.", attackBonus: 4, damage: "1d6+2", averageDamage: 5 }] }),
  make({ id: "builtin:orc", name: "Orc", source: "SRD 5.1", tags: ["humanoid", "bruiser"], creatureType: "humanoid", size: "Medium", challengeRating: 0.5, experienceValue: 100, environments: ["forest", "grassland", "mountain", "dungeon"], armorClass: 13, hitPoints: { average: 15, formula: "2d8+6" }, speed: "30 ft.", passivePerception: 10, actions: [{ name: "Greataxe", description: "Melee weapon attack.", attackBonus: 5, damage: "1d12+3", averageDamage: 9 }, { name: "Javelin", description: "Melee or ranged weapon attack.", attackBonus: 5, damage: "1d6+3", averageDamage: 6 }] }),
  make({ id: "builtin:bugbear", name: "Bugbear", source: "SRD 5.1", tags: ["humanoid", "ambusher"], creatureType: "humanoid", size: "Medium", challengeRating: 1, experienceValue: 200, environments: ["forest", "dungeon"], armorClass: 16, hitPoints: { average: 27, formula: "5d8+5" }, speed: "30 ft.", passivePerception: 10, actions: [{ name: "Morningstar", description: "Melee weapon attack.", attackBonus: 4, damage: "2d8+2", averageDamage: 11 }] }),
  make({ id: "builtin:ogre", name: "Ogre", source: "SRD 5.1", tags: ["giant", "bruiser"], creatureType: "giant", size: "Large", challengeRating: 2, experienceValue: 450, environments: ["forest", "hill", "swamp", "dungeon"], armorClass: 11, hitPoints: { average: 59, formula: "7d10+21" }, speed: "40 ft.", passivePerception: 8, actions: [{ name: "Greatclub", description: "Heavy melee weapon attack.", attackBonus: 6, damage: "2d8+4", averageDamage: 13 }] }),
  make({ id: "builtin:troll", name: "Troll", source: "SRD 5.1", tags: ["giant", "regeneration", "bruiser"], creatureType: "giant", size: "Large", challengeRating: 5, experienceValue: 1800, environments: ["forest", "swamp", "mountain"], armorClass: 15, hitPoints: { average: 84, formula: "8d10+40" }, speed: "30 ft.", passivePerception: 12, traits: [{ name: "Regeneration", description: "Regains hit points unless damaged by fire or acid." }], actions: [{ name: "Multiattack", description: "Makes three attacks.", averageDamage: 29 }] }),
  make({ id: "builtin:air-elemental", name: "Air Elemental", source: "SRD 5.1", tags: ["elemental", "flying", "area-damage"], creatureType: "elemental", size: "Large", challengeRating: 5, experienceValue: 1800, environments: ["planar", "mountain"], armorClass: 15, hitPoints: { average: 90, formula: "12d10+24" }, speed: "0 ft., fly 90 ft.", passivePerception: 10, actions: [{ name: "Multiattack", description: "Makes two slam attacks.", averageDamage: 28 }, { name: "Whirlwind", description: "Area effect that can fling creatures.", averageDamage: 15 }] }),
];

export function getBuiltInCreature(id: string) {
  return BUILT_IN_CREATURES.find((creature) => creature.id === id);
}
