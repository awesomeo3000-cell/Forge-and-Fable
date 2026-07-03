import type { AbilityKey, AbilityScores, Equipment, InventoryItem } from "@/types/game";
import { getEquippedItemBonuses, isArmorItem, isShieldItem, isWeaponItem, itemArmorAcBonus, itemWeaponBonus } from "@/lib/itemCatalog";
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
  bonus?: number;
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

const ARMOR_NAME_MATCHES = [...ARMORS].sort((a, b) => b.name.length - a.name.length);
const WEAPON_NAME_MATCHES = [...WEAPONS].sort((a, b) => b.name.length - a.name.length);

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findArmorByItemName(name: string) {
  const normalized = normalizedName(name);
  return ARMOR_NAME_MATCHES.find((armor) => normalized.includes(normalizedName(armor.name)));
}

function findWeaponByItemName(name: string) {
  const normalized = normalizedName(name);
  return WEAPON_NAME_MATCHES.find((weapon) => normalized.includes(normalizedName(weapon.name)));
}

function findWeaponForItem(item: InventoryItem) {
  const byName = findWeaponByItemName(item.name);
  if (byName) return byName;
  const normalized = normalizedName([item.name, item.description, item.properties].filter(Boolean).join(" "));
  return WEAPON_NAME_MATCHES.find((weapon) => normalized.includes(normalizedName(weapon.name)));
}

function parseAcString(ac?: string) {
  const text = (ac ?? "").trim();
  if (!text) return null;
  const baseMatch = text.match(/\d+/);
  if (!baseMatch) return null;
  const baseAc = Number(baseMatch[0]);
  if (!Number.isFinite(baseAc)) return null;
  const acWithoutDex = text.replace(/dex(?:terity)?/gi, "");
  const inlineBonus = Array.from(acWithoutDex.matchAll(/\+\s*([1-3])\b/g))
    .reduce((sum, match) => sum + Number(match[1] ?? 0), 0);
  return {
    baseAc,
    hasDex: /dex/i.test(text),
    inlineBonus,
  };
}

function armorCategoryFromItem(item: InventoryItem, fallback?: ArmorDef): ArmorDef["category"] {
  const classification = (item.classification ?? "").toLowerCase();
  if (classification.includes("heavy")) return "heavy";
  if (classification.includes("medium")) return "medium";
  if (classification.includes("light")) return "light";
  return fallback?.category ?? "light";
}

function dexRuleForArmor(category: ArmorDef["category"], parsed: ReturnType<typeof parseAcString> | null, fallback?: ArmorDef) {
  if (!parsed?.hasDex) return "none" as const;
  if (fallback?.dexBonus) return fallback.dexBonus;
  if (category === "medium") return "max2" as const;
  if (category === "heavy") return "none" as const;
  return "full" as const;
}

function inventoryArmorBreakdown(item: InventoryItem) {
  if (!isArmorItem(item)) return null;
  const fallback = findArmorByItemName(item.name);
  const parsed = parseAcString(item.ac);
  const category = armorCategoryFromItem(item, fallback);
  const dexBonus = dexRuleForArmor(category, parsed, fallback);
  const baseAc = parsed?.baseAc ?? fallback?.baseAc;
  if (!baseAc) return null;
  const inlineBonus = parsed?.inlineBonus ?? 0;
  const extraBonus = itemArmorAcBonus(item, inlineBonus > 0);
  return {
    name: item.name,
    category,
    baseAc,
    dexBonus,
    bonus: inlineBonus + extraBonus,
    stealthDisadvantage: fallback?.stealthDisadvantage ?? false,
    strengthReq: fallback?.strengthReq ?? 0,
  };
}

export function inventoryArmorProficiencyInfo(item: InventoryItem) {
  if (!isArmorItem(item)) return null;
  const fallback = findArmorByItemName(item.name);
  return {
    name: item.name,
    category: armorCategoryFromItem(item, fallback),
  };
}

function normalizedProficiency(value: string) {
  return normalizedName(value);
}

export function isArmorCategoryProficient(
  proficiencies: string[],
  category: ArmorDef["category"],
) {
  const needed = `${category} armor`;
  return proficiencies.some((proficiency) => {
    const normalized = normalizedProficiency(proficiency);
    return normalized === "all armor" || normalized === needed;
  });
}

export function isShieldProficient(proficiencies: string[]) {
  return proficiencies.some((proficiency) => {
    const normalized = normalizedProficiency(proficiency);
    return normalized === "shields" || normalized === "shield";
  });
}

export type ArmorProficiencyIssue = {
  hasIssue: boolean;
  lacksArmor: boolean;
  lacksShield: boolean;
  armorName?: string;
  armorCategory?: ArmorDef["category"];
  shieldName?: string;
  labels: string[];
  spellcastingBlocked: boolean;
  strengthDexterityDisadvantage: boolean;
};

export function getArmorProficiencyIssue(
  proficiencies: string[],
  equipment: Equipment | undefined,
  inventory: InventoryItem[] = [],
): ArmorProficiencyIssue {
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const armorItem = equipment?.armorItemId ? inventoryById.get(equipment.armorItemId) : undefined;
  const inventoryArmor = armorItem ? inventoryArmorProficiencyInfo(armorItem) : null;
  const staticArmor = equipment?.armorId ? getArmor(equipment.armorId) : undefined;
  const armor = inventoryArmor ?? staticArmor;
  const shieldItem = equipment?.shieldItemId ? inventoryById.get(equipment.shieldItemId) : undefined;
  const shieldName = shieldItem && isShieldItem(shieldItem) ? shieldItem.name : equipment?.shield ? "Shield" : undefined;

  const lacksArmor = !!armor && !isArmorCategoryProficient(proficiencies, armor.category);
  const lacksShield = !!shieldName && !isShieldProficient(proficiencies);
  const labels = [
    lacksArmor && armor ? `${armor.name} (${armor.category} armor)` : "",
    lacksShield && shieldName ? shieldName : "",
  ].filter(Boolean);
  const hasIssue = labels.length > 0;

  return {
    hasIssue,
    lacksArmor,
    lacksShield,
    armorName: armor?.name,
    armorCategory: armor?.category,
    shieldName,
    labels,
    spellcastingBlocked: hasIssue,
    strengthDexterityDisadvantage: hasIssue,
  };
}

function shieldBonusFromItem(item: InventoryItem | undefined) {
  if (!item || !isShieldItem(item)) return 0;
  const parsed = parseAcString(item.ac);
  const base = parsed?.baseAc ?? 2;
  return base + itemArmorAcBonus(item, (parsed?.inlineBonus ?? 0) > 0);
}

export function inventoryWeaponToDef(item: InventoryItem): WeaponDef | null {
  if (!isWeaponItem(item)) return null;
  const fallback = findWeaponForItem(item);
  const classification = (item.classification ?? "").toLowerCase();
  const properties = (item.properties ?? "").toLowerCase();
  const isRanged = classification.includes("ranged") || properties.includes("ammunition");
  const versatile = item.properties?.match(/versatile\s*\(([^)]+)\)/i)?.[1] ?? fallback?.versatile;
  const kind: WeaponDef["kind"] = properties.includes("finesse")
    ? "finesse"
    : isRanged
      ? "ranged"
      : fallback?.kind ?? "melee";

  return {
    id: `inventory:${item.id}`,
    name: item.name,
    damage: item.damage || fallback?.damage || "1d4",
    damageType: item.damageType || fallback?.damageType || "",
    kind,
    versatile,
    twoHanded: properties.includes("two-handed") || fallback?.twoHanded,
    bonus: itemWeaponBonus(item),
  };
}

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
  strengthRequirement?: number;
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
  inventory: InventoryItem[] = [],
): AcBreakdown {
  const dex = abilityModifier(abilities.dexterity);
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const armorItem = equipment?.armorItemId ? inventoryById.get(equipment.armorItemId) : undefined;
  const inventoryArmor = armorItem ? inventoryArmorBreakdown(armorItem) : null;
  const staticArmor = equipment?.armorId ? getArmor(equipment.armorId) : undefined;
  const armor = inventoryArmor ?? staticArmor;
  const shieldItem = equipment?.shieldItemId ? inventoryById.get(equipment.shieldItemId) : undefined;
  const shield = shieldItem ? shieldBonusFromItem(shieldItem) : equipment?.shield ? 2 : 0;
  const itemAcBonuses = getEquippedItemBonuses(inventory, { bonusItemIds: equipment?.bonusItemIds }, {
    includeAc: true,
    hasArmor: !!armor,
    hasShield: shield > 0,
  }).ac;

  if (armor) {
    const dexPart = armor.dexBonus === "full" ? dex : armor.dexBonus === "max2" ? Math.min(dex, 2) : 0;
    const armorBonus = "bonus" in armor ? armor.bonus : 0;
    const itemBonusLabel = itemAcBonuses ? ` + ${itemAcBonuses} item` : "";
    return {
      total: armor.baseAc + dexPart + armorBonus + shield + itemAcBonuses,
      label: armor.name + (shield ? " + shield" : "") + itemBonusLabel,
      stealthDisadvantage: armor.stealthDisadvantage,
      strengthWarning: armor.strengthReq > 0 && abilities.strength < armor.strengthReq,
      strengthRequirement: armor.strengthReq > 0 ? armor.strengthReq : undefined,
    };
  }

  if (classId === "barbarian") {
    const itemBonusLabel = itemAcBonuses ? ` + ${itemAcBonuses} item` : "";
    return {
      total: 10 + dex + abilityModifier(abilities.constitution) + shield + itemAcBonuses,
      label: "Unarmored Defense" + (shield ? " + shield" : "") + itemBonusLabel,
      stealthDisadvantage: false,
      strengthWarning: false,
    };
  }

  if (classId === "monk" && shield === 0) {
    const itemBonusLabel = itemAcBonuses ? ` + ${itemAcBonuses} item` : "";
    return {
      total: 10 + dex + abilityModifier(abilities.wisdom) + itemAcBonuses,
      label: "Unarmored Defense" + itemBonusLabel,
      stealthDisadvantage: false,
      strengthWarning: false,
    };
  }

  const itemBonusLabel = itemAcBonuses ? ` + ${itemAcBonuses} item` : "";
  return {
    total: 10 + dex + shield + itemAcBonuses,
    label: (shield ? "Unarmored + shield" : "Unarmored") + itemBonusLabel,
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
