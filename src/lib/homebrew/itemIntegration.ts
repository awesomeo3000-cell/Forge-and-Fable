import type { CatalogItem, InventoryItem, RulesetId } from "@/types/game";
import type {
  ContentBaseline,
  HomebrewItemInstanceState,
  HomebrewItemPayload,
  RulesContentRef,
} from "@/types/homebrew";

export function blankHomebrewItem(name = "Untitled item"): HomebrewItemPayload {
  return {
    kind: "item",
    name,
    description: "",
    category: "Wondrous Item",
    rarity: "Uncommon",
    requiresAttunement: false,
    equipmentSlots: [],
    effects: [],
    toggles: [],
    stages: [],
  };
}

export function catalogItemToHomebrewPayload(item: CatalogItem): HomebrewItemPayload {
  return {
    ...blankHomebrewItem(item.name),
    description: item.description,
    category: item.category,
    classification: item.classification,
    rarity: item.rarity,
    imageUrl: item.image,
    ac: item.ac,
    damage: item.damage,
    damageType: item.damageType,
    properties: item.properties,
    cost: item.cost,
    requiresAttunement: item.attunement,
    equipmentSlots: item.category.toLowerCase() === "armor"
      ? [item.classification?.toLowerCase().includes("shield") ? "off-hand" : "body"]
      : item.category.toLowerCase() === "weapon" ? ["hand"] : [],
  };
}

export function catalogItemBaseline(item: CatalogItem, ruleset: RulesetId): ContentBaseline {
  return {
    sourceRef: { source: "builtin", kind: "item", id: item.id, ruleset },
    copiedAt: new Date().toISOString(),
    sourceTitle: item.name,
  };
}

export function defaultItemInstance(ref: RulesContentRef, payload: HomebrewItemPayload): HomebrewItemInstanceState {
  return {
    contentRef: ref,
    equipped: false,
    attuned: false,
    activeToggleIds: payload.toggles.filter((toggle) => toggle.defaultOn).map((toggle) => toggle.id),
  };
}

export function homebrewPayloadToInventory(
  definitionId: string,
  versionId: string,
  ruleset: RulesetId,
  payload: HomebrewItemPayload,
): InventoryItem {
  const ref: RulesContentRef = { source: "homebrew", kind: "item", definitionId, versionId, ruleset };
  return {
    id: crypto.randomUUID(),
    name: payload.name,
    quantity: 1,
    rarity: payload.rarity,
    attunement: payload.requiresAttunement,
    notes: "",
    category: payload.category,
    classification: payload.classification,
    description: payload.description,
    ac: payload.ac,
    damage: payload.damage,
    damageType: payload.damageType,
    properties: payload.properties,
    cost: payload.cost,
    image: payload.imageUrl,
    weight: payload.baseWeight,
    homebrew: defaultItemInstance(ref, payload),
  };
}

export function upgradeHomebrewInventoryItem(
  item: InventoryItem,
  definitionId: string,
  versionId: string,
  ruleset: RulesetId,
  payload: HomebrewItemPayload,
): InventoryItem {
  if (!item.homebrew) return item;
  const validToggleIds = new Set(payload.toggles.map((toggle) => toggle.id));
  return {
    ...item,
    name: payload.name,
    rarity: payload.rarity,
    attunement: payload.requiresAttunement,
    category: payload.category,
    classification: payload.classification,
    description: payload.description,
    ac: payload.ac,
    damage: payload.damage,
    damageType: payload.damageType,
    properties: payload.properties,
    cost: payload.cost,
    image: payload.imageUrl,
    weight: item.homebrew.weightOverride ?? payload.baseWeight,
    homebrew: {
      ...item.homebrew,
      contentRef: { source: "homebrew", kind: "item", definitionId, versionId, ruleset },
      activeToggleIds: item.homebrew.activeToggleIds.filter((id) => validToggleIds.has(id)),
      currentStageId: undefined,
    },
  };
}

export function describeItemUpgrade(from: HomebrewItemPayload, to: HomebrewItemPayload): string[] {
  const changes: string[] = [];
  for (const [label, before, after] of [
    ["Name", from.name, to.name],
    ["Rarity", from.rarity, to.rarity],
    ["Weight", from.baseWeight, to.baseWeight],
    ["Damage", from.damage, to.damage],
    ["Armor Class", from.ac, to.ac],
  ] as const) {
    if (before !== after) changes.push(`${label}: ${before ?? "none"} → ${after ?? "none"}`);
  }
  if (from.effects.length !== to.effects.length) changes.push(`Effects: ${from.effects.length} → ${to.effects.length}`);
  if (from.toggles.length !== to.toggles.length) changes.push(`Toggles: ${from.toggles.length} → ${to.toggles.length}`);
  return changes.length > 0 ? changes : ["Metadata or effect configuration changed."];
}
