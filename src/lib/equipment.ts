import type { AbilityKey, AbilityScores, Equipment } from "@/types/game";
import { abilityModifier } from "@/lib/utils";

export type ArmorDef = {
  id: string;
  name: string;
  category: "light" | "medium" | "heavy";
  baseAc: number;
  /** How much DEX applies: "full" (light), "max2" (medium), "none" (heavy). */
  dexBonus: "full" | "max2" | "none";
  stealthDisadvantage: boolean;
  strengthReq: number;
};

export type WeaponDef = {
  id: string;
  name: string;
  damage: string;
  damageType: string;
  /** finesse = STR or DEX (best); ranged = DEX; melee = STR. */
  kind: "melee" | "finesse" | "ranged";
  versatile?: string;
  twoHanded?: boolean;
};

export const ARMORS: ArmorDef[] = [
  { id: "padded", name: "Padded", category: "light", baseAc: 11, dexBonus: "full", stealthDisadvantage: true, strengthReq: 0 },
  { id: "leather", name: "Leather", category: "light", baseAc: 11, dexBonus: "full", stealthDisadvantage: false, strengthReq: 0 },
  { id: "studded-leather", name: "Studded leather", category: "light", baseAc: 12, dexBonus: "full", stealthDisadvantage: false, strengthReq: 0 },
  { id: "hide", name: "Hide", category: "medium", baseAc: 12, dexBonus: "max2", stealthDisadvantage: false, strengthReq: 0 },
  { id: "chain-shirt", name: "Chain shirt", category: "medium", baseAc: 13, dexBonus: "max2", stealthDisadvantage: false, strengthReq: 0 },
  { id: "scale-mail", name: "Scale mail", category: "medium", baseAc: 14, dexBonus: "max2", stealthDisadvantage: true, strengthReq: 0 },
  { id: "breastplate", name: "Breastplate", category: "medium", baseAc: 14, dexBonus: "max2", stealthDisadvantage: false, strengthReq: 0 },
  { id: "half-plate", name: "Half plate", category: "medium", baseAc: 15, dexBonus: "max2", stealthDisadvantage: true, strengthReq: 0 },
  { id: "ring-mail", name: "Ring mail", category: "heavy", baseAc: 14, dexBonus: "none", stealthDisadvantage: true, strengthReq: 0 },
  { id: "chain-mail", name: "Chain mail", category: "heavy", baseAc: 16, dexBonus: "none", stealthDisadvantage: true, strengthReq: 13 },
  { id: "splint", name: "Splint", category: "heavy", baseAc: 17, dexBonus: "none", stealthDisadvantage: true, strengthReq: 15 },
  { id: "plate", name: "Plate", category: "heavy", baseAc: 18, dexBonus: "none", stealthDisadvantage: true, strengthReq: 15 },
];

export const WEAPONS: WeaponDef[] = [
  { id: "unarmed", name: "Unarmed strike", damage: "1", damageType: "bludgeoning", kind: "melee" },
  { id: "dagger", name: "Dagger", damage: "1d4", damageType: "piercing", kind: "finesse" },
  { id: "mace", name: "Mace", damage: "1d6", damageType: "bludgeoning", kind: "melee" },
  { id: "quarterstaff", name: "Quarterstaff", damage: "1d6", damageType: "bludgeoning", kind: "melee", versatile: "1d8" },
  { id: "spear", name: "Spear", damage: "1d6", damageType: "piercing", kind: "melee", versatile: "1d8" },
  { id: "handaxe", name: "Handaxe", damage: "1d6", damageType: "slashing", kind: "melee" },
  { id: "scimitar", name: "Scimitar", damage: "1d6", damageType: "slashing", kind: "finesse" },
  { id: "shortsword", name: "Shortsword", damage: "1d6", damageType: "piercing", kind: "finesse" },
  { id: "rapier", name: "Rapier", damage: "1d8", damageType: "piercing", kind: "finesse" },
  { id: "longsword", name: "Longsword", damage: "1d8", damageType: "slashing", kind: "melee", versatile: "1d10" },
  { id: "warhammer", name: "Warhammer", damage: "1d8", damageType: "bludgeoning", kind: "melee", versatile: "1d10" },
  { id: "battleaxe", name: "Battleaxe", damage: "1d8", damageType: "slashing", kind: "melee", versatile: "1d10" },
  { id: "greataxe", name: "Greataxe", damage: "1d12", damageType: "slashing", kind: "melee", twoHanded: true },
  { id: "greatsword", name: "Greatsword", damage: "2d6", damageType: "slashing", kind: "melee", twoHanded: true },
  { id: "shortbow", name: "Shortbow", damage: "1d6", damageType: "piercing", kind: "ranged", twoHanded: true },
  { id: "longbow", name: "Longbow", damage: "1d8", damageType: "piercing", kind: "ranged", twoHanded: true },
  { id: "light-crossbow", name: "Light crossbow", damage: "1d8", damageType: "piercing", kind: "ranged", twoHanded: true },
];

const ARMORS_BY_ID = new Map(ARMORS.map((a) => [a.id, a]));
const WEAPONS_BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));

export const getArmor = (id: string) => ARMORS_BY_ID.get(id);
export const getWeapon = (id: string) => WEAPONS_BY_ID.get(id);

export function weaponAbility(weapon: WeaponDef, abilities: AbilityScores): AbilityKey {
  if (weapon.kind === "ranged") return "dexterity";
  if (weapon.kind === "finesse") {
    return abilities.dexterity > abilities.strength ? "dexterity" : "strength";
  }
  return "strength";
}

export type AcBreakdown = {
  total: number;
  label: string;
  stealthDisadvantage: boolean;
  strengthWarning: boolean;
};

/**
 * AC from equipped armor. No armor uses unarmored defense where the class
 * has it (barbarian 10+DEX+CON always; monk 10+DEX+WIS only without a
 * shield), otherwise 10+DEX. Shields add +2 on top of everything.
 */
export function computeArmorClass(
  abilities: AbilityScores,
  classId: string,
  equipment: Equipment | undefined,
): AcBreakdown {
  const dex = abilityModifier(abilities.dexterity);
  const shield = equipment?.shield ? 2 : 0;
  const armor = equipment?.armorId ? getArmor(equipment.armorId) : undefined;

  if (armor) {
    const dexPart = armor.dexBonus === "full" ? dex : armor.dexBonus === "max2" ? Math.min(dex, 2) : 0;
    return {
      total: armor.baseAc + dexPart + shield,
      label: armor.name + (shield ? " + shield" : ""),
      stealthDisadvantage: armor.stealthDisadvantage,
      strengthWarning: armor.strengthReq > 0 && abilities.strength < armor.strengthReq,
    };
  }

  if (classId === "barbarian") {
    return {
      total: 10 + dex + abilityModifier(abilities.constitution) + shield,
      label: "Unarmored Defense" + (shield ? " + shield" : ""),
      stealthDisadvantage: false,
      strengthWarning: false,
    };
  }

  if (classId === "monk" && !equipment?.shield) {
    return {
      total: 10 + dex + abilityModifier(abilities.wisdom),
      label: "Unarmored Defense",
      stealthDisadvantage: false,
      strengthWarning: false,
    };
  }

  return {
    total: 10 + dex + shield,
    label: shield ? "Unarmored + shield" : "Unarmored",
    stealthDisadvantage: false,
    strengthWarning: false,
  };
}

/**
 * How many leveled spells a prepared caster can have prepared:
 * spellcasting ability modifier + caster level (full) or half level (half),
 * minimum 1.
 */
export function preparedSpellLimit(
  casterType: string | undefined,
  level: number,
  abilityMod: number,
): number {
  const casterLevel = casterType === "half" ? Math.floor(level / 2) : level;
  return Math.max(1, casterLevel + abilityMod);
}
