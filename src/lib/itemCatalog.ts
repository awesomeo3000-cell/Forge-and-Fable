import rawItems from "@/data/items.json";
import type { CatalogItem, Equipment, InventoryItem } from "@/types/game";

export const ITEM_CATALOG = rawItems as CatalogItem[];

type ItemLike = Pick<InventoryItem, "name"> &
  Partial<
    Pick<
      InventoryItem,
      "category" | "classification" | "description" | "ac" | "damage" | "damageType" | "properties" | "cost" | "attunement"
    >
  >;

export type EquippedItemBonuses = {
  ac: number;
  saves: number;
  spellAttack: number;
  spellSaveDc: number;
  labels: string[];
};

export type ItemPassiveBonuses = EquippedItemBonuses & {
  requiresUnarmoredNoShield: boolean;
};

const emptyBonuses = (): EquippedItemBonuses => ({
  ac: 0,
  saves: 0,
  spellAttack: 0,
  spellSaveDc: 0,
  labels: [],
});

function itemText(item: ItemLike) {
  return [item.name, item.description, item.properties].filter(Boolean).join(" ");
}

function firstBonus(text: string, pattern: RegExp) {
  const match = pattern.exec(text);
  if (!match?.[1]) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

function nameEnhancementBonus(item: ItemLike) {
  const match = item.name.match(/\+([1-3])\b/);
  if (!match?.[1]) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

function lower(value?: string) {
  return (value ?? "").toLowerCase();
}

function formatBonus(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export const ITEM_CATEGORIES = Array.from(
  new Set(ITEM_CATALOG.map((item) => item.category).filter(Boolean)),
).sort();

export const ITEM_RARITIES = Array.from(
  new Set(ITEM_CATALOG.map((item) => item.rarity).filter(Boolean)),
).sort((a, b) => {
  const order = ["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];
  return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
});

export function formatItemCost(cost?: string) {
  if (!cost) return "";
  const copper = Number(cost);
  if (!Number.isFinite(copper) || copper <= 0) return cost;
  if (copper % 100 === 0) return `${(copper / 100).toLocaleString()} gp`;
  if (copper >= 100) return `${(copper / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} gp`;
  if (copper % 10 === 0) return `${copper / 10} sp`;
  return `${copper} cp`;
}

export function itemMetaParts(item: Partial<Pick<CatalogItem, "category" | "classification" | "ac" | "damage" | "damageType" | "properties" | "cost">>) {
  const parts = [item.category, item.classification].filter(Boolean) as string[];
  if (item.ac) parts.push(`AC ${item.ac}`);
  if (item.damage) parts.push(`${item.damage}${item.damageType ? ` ${item.damageType}` : ""}`);
  if (item.properties) parts.push(item.properties);
  const cost = formatItemCost(item.cost);
  if (cost) parts.push(cost);
  return parts;
}

export function isShieldItem(item: ItemLike) {
  return lower(item.category) === "armor" && (lower(item.classification).includes("shield") || /\bshield\b/i.test(item.name));
}

export function isArmorItem(item: ItemLike) {
  return lower(item.category) === "armor" && !isShieldItem(item);
}

export function isWeaponItem(item: ItemLike) {
  const category = lower(item.category);
  const classification = lower(item.classification);
  const text = lower(itemText(item));
  return (
    category === "weapon" ||
    classification.includes("weapon") ||
    (!!item.damage && !isArmorItem(item) && !isShieldItem(item)) ||
    /\b(?:wielded as|functions as)\b[^.]*\b(?:club|dagger|mace|quarterstaff|spear|handaxe|scimitar|shortsword|rapier|longsword|warhammer|battleaxe|greataxe|greatsword|shortbow|longbow|crossbow)\b/.test(text)
  );
}

export function itemPassiveBonuses(item: ItemLike): ItemPassiveBonuses {
  const bonuses: ItemPassiveBonuses = {
    ...emptyBonuses(),
    requiresUnarmoredNoShield: /wearing no armor and using no shield/i.test(itemText(item)),
  };
  const text = itemText(item);
  const acText = text.replace(/\+([1-3])\s+bonus\s+to\s+(?:AC|Armor Class)\s+against[^.]*\.?/gi, "");
  bonuses.ac = firstBonus(acText, /\+([1-3])\s+bonus\s+to\s+[^.]*\b(?:AC|Armor Class)\b/i);
  bonuses.saves = firstBonus(text, /\+([1-3])\s+bonus\s+to\s+[^.]*\bsaving throws\b/i);
  bonuses.spellAttack = firstBonus(text, /\+([1-3])\s+bonus\s+to\s+[^.]*\bspell attack rolls\b/i);
  bonuses.spellSaveDc = firstBonus(text, /\+([1-3])\s+bonus\s+to\s+[^.]*\bspell save DC\b/i);

  if (bonuses.ac) bonuses.labels.push(`${item.name}: ${formatBonus(bonuses.ac)} AC`);
  if (bonuses.saves) bonuses.labels.push(`${item.name}: ${formatBonus(bonuses.saves)} saves`);
  if (bonuses.spellAttack) bonuses.labels.push(`${item.name}: ${formatBonus(bonuses.spellAttack)} spell attacks`);
  if (bonuses.spellSaveDc) bonuses.labels.push(`${item.name}: ${formatBonus(bonuses.spellSaveDc)} spell save DC`);
  return bonuses;
}

export function itemHasPassiveBonus(item: ItemLike) {
  const bonuses = itemPassiveBonuses(item);
  return bonuses.ac !== 0 || bonuses.saves !== 0 || bonuses.spellAttack !== 0 || bonuses.spellSaveDc !== 0;
}

export function itemWeaponBonus(item: ItemLike) {
  const text = itemText(item);
  return firstBonus(text, /\+([1-3])\s+bonus\s+to\s+attack\s+and\s+damage\s+rolls/i) || (isWeaponItem(item) ? nameEnhancementBonus(item) : 0);
}

export function itemArmorAcBonus(item: ItemLike, acAlreadyIncludesBonus = false) {
  if (acAlreadyIncludesBonus) return 0;
  const passive = itemPassiveBonuses(item);
  return passive.ac || ((isArmorItem(item) || isShieldItem(item)) ? nameEnhancementBonus(item) : 0);
}

export function getEquippedItemBonuses(
  inventory: InventoryItem[],
  equipment: Equipment | undefined,
  options: { includeAc?: boolean; hasArmor?: boolean; hasShield?: boolean } = {},
): EquippedItemBonuses {
  const includeAc = options.includeAc ?? true;
  const bonuses = emptyBonuses();
  const byId = new Map(inventory.map((item) => [item.id, item]));
  const ids = new Set<string>();

  if (equipment?.armorItemId) ids.add(equipment.armorItemId);
  if (equipment?.shieldItemId) ids.add(equipment.shieldItemId);
  for (const id of equipment?.weaponItemIds ?? []) ids.add(id);
  for (const id of equipment?.bonusItemIds ?? []) ids.add(id);

  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    const itemBonuses = itemPassiveBonuses(item);
    const acApplies =
      includeAc &&
      itemBonuses.ac !== 0 &&
      (!itemBonuses.requiresUnarmoredNoShield || (!options.hasArmor && !options.hasShield));

    if (acApplies) bonuses.ac += itemBonuses.ac;
    bonuses.saves += itemBonuses.saves;
    bonuses.spellAttack += itemBonuses.spellAttack;
    bonuses.spellSaveDc += itemBonuses.spellSaveDc;
    bonuses.labels.push(...itemBonuses.labels.filter((label) => acApplies || !label.includes(" AC")));
  }

  return bonuses;
}

export function catalogItemToInventory(item: CatalogItem): InventoryItem {
  return {
    id: crypto.randomUUID(),
    sourceItemId: item.id,
    name: item.name,
    rarity: item.rarity,
    attunement: item.attunement,
    notes: itemMetaParts(item).join(" | "),
    category: item.category,
    classification: item.classification,
    description: item.description,
    ac: item.ac,
    damage: item.damage,
    damageType: item.damageType,
    properties: item.properties,
    cost: item.cost,
    image: item.image,
  };
}
