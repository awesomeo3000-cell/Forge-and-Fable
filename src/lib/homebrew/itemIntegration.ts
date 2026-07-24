import type { CatalogItem, InventoryItem, RulesetId } from "@/types/game";
import type {
  ContentBaseline,
  HomebrewItemInstanceState,
  HomebrewItemPayload,
  ItemStage,
  MechanicEffect,
  RulesContentRef,
} from "@/types/homebrew";

/** Stages in authoritative order (proposal §7.5: `order` is the sequence). */
export function sortedStages(payload: HomebrewItemPayload): ItemStage[] {
  return [...payload.stages].sort((a, b) => a.order - b.order);
}

/** The stage a fresh copy of this item starts in (lowest order), if any. */
export function firstStageId(payload: HomebrewItemPayload): string | undefined {
  return sortedStages(payload)[0]?.id;
}

/** Unique counter ids referenced by counter-activated stages, in stage order. */
export function stageCounterIds(payload: HomebrewItemPayload): string[] {
  const ids: string[] = [];
  for (const stage of sortedStages(payload)) {
    if (stage.activation.type === "counter" && !ids.includes(stage.activation.counterId)) {
      ids.push(stage.activation.counterId);
    }
  }
  return ids;
}

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
    // A staged item begins in its first stage (§7.5 gate: "a four-stage weapon
    // begins with +1"), not in an undefined pre-stage state.
    currentStageId: firstStageId(payload),
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
  // Stage mapping across versions: keep the same stage id when the new version
  // still defines it; otherwise fall back to the new version's first stage.
  const stageIds = new Set(payload.stages.map((stage) => stage.id));
  const mappedStageId = item.homebrew.currentStageId && stageIds.has(item.homebrew.currentStageId)
    ? item.homebrew.currentStageId
    : firstStageId(payload);
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
      currentStageId: mappedStageId,
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
  if (from.stages.length !== to.stages.length) changes.push(`Stages: ${from.stages.length} → ${to.stages.length}`);
  const toStageIds = new Set(to.stages.map((stage) => stage.id));
  const droppedStages = from.stages.filter((stage) => !toStageIds.has(stage.id));
  if (droppedStages.length > 0) {
    changes.push(`Removed stages remap to the first stage: ${droppedStages.map((stage) => stage.name).join(", ")}`);
  }
  return changes.length > 0 ? changes : ["Metadata or effect configuration changed."];
}

/** One human line per mechanic, for stage/upgrade previews. */
export function summarizeEffect(effect: MechanicEffect): string {
  switch (effect.type) {
    case "numeric-bonus":
      return `${effect.value >= 0 ? "+" : ""}${effect.value} ${effect.target}${effect.scope === "source-item" ? " (this item)" : ""}`;
    case "ability-floor":
      return `${effect.ability} becomes at least ${effect.minimum}`;
    case "condition":
      return `condition: ${effect.label}`;
    case "d20-rider":
      return `${effect.dice} on ${effect.appliesTo.join("/")}`;
    case "spell-slot-bonus":
      return `+${effect.amount} level-${effect.spellLevel} spell slot${effect.amount === 1 ? "" : "s"}`;
    case "resource-grant":
      return `resource ${effect.resourceId} (${effect.maximum}, ${effect.recharge})`;
    case "spell-grant":
      return `grants spell ${effect.spellRef.source === "builtin" ? effect.spellRef.id : "homebrew"}`;
    case "sense":
      return `sense: ${effect.text}`;
    case "aura":
      return `${effect.radiusFeet} ft. aura (${effect.recipient}): ${effect.effects.map(summarizeEffect).join("; ")}`;
  }
}

/**
 * Diff preview for a manual stage change (§7.5): which mechanics the character
 * loses and gains by moving from one stage to another. Payload-level effects are
 * unaffected by stage changes and are deliberately not listed.
 */
export function describeStageChange(
  payload: HomebrewItemPayload,
  fromStageId: string | undefined,
  toStageId: string,
): { removed: string[]; added: string[] } {
  const fromStage = payload.stages.find((stage) => stage.id === fromStageId);
  const toStage = payload.stages.find((stage) => stage.id === toStageId);
  return {
    removed: (fromStage?.effects ?? []).map(summarizeEffect),
    added: (toStage?.effects ?? []).map(summarizeEffect),
  };
}
