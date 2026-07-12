import type { Character, SpellStatus } from "@/types/game";

export function recoverFeatureResources(character: Character, rest: "short" | "long") {
  let changed = false;
  const featureResources = Object.fromEntries(Object.entries(character.featureResources ?? {}).map(([resourceId, resource]) => {
    const recharges = resource.recharge === "short-or-long-rest"
      || (rest === "long" && resource.recharge === "long-rest")
      || (rest === "short" && resource.recharge === "short-rest");
    if (!recharges || typeof resource.maximum !== "number" || resource.current === resource.maximum) return [resourceId, resource];
    changed = true;
    return [resourceId, { ...resource, current: resource.maximum }];
  }));
  return { changed, featureResources };
}

export function longRestRecovery(character: Character, statuses: Record<string, SpellStatus> = character.spellStatuses ?? {}) {
  const spent = character.hitDiceSpent ?? 0;
  const recovered = Math.max(1, Math.floor(character.level / 2));
  const spellStatuses = Object.fromEntries(Object.entries(statuses).map(([spellId, status]) => [
    spellId, status.freeUse ? { ...status, freeUsed: false } : status,
  ]));
  const notes = [`HP restored to ${character.maxHp}`, "spell slots restored"];
  const resources = recoverFeatureResources(character, "long");
  if (character.tempHp > 0) notes.push("temp HP cleared");
  if (character.concentratingOn) notes.push("concentration ended");
  if (spent > 0) notes.push(`${Math.min(recovered, spent)} hit dice recovered`);
  if (Object.values(statuses).some((status) => status.freeUse && status.freeUsed)) notes.push("per-rest spell uses restored");
  if (resources.changed) notes.push("class resources restored");
  return {
    patch: { currentHp: character.maxHp, tempHp: 0, spellSlotsUsed: {}, pactSlotsUsed: 0, concentratingOn: null, hitDiceSpent: Math.max(0, spent - recovered), spellStatuses, ...(resources.changed ? { featureResources: resources.featureResources } : {}) },
    summary: notes.join(", "),
  };
}
