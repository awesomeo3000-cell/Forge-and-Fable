import type { Character, SpellStatus } from "@/types/game";

export function longRestRecovery(character: Character, statuses: Record<string, SpellStatus> = character.spellStatuses ?? {}) {
  const spent = character.hitDiceSpent ?? 0;
  const recovered = Math.max(1, Math.floor(character.level / 2));
  const spellStatuses = Object.fromEntries(Object.entries(statuses).map(([spellId, status]) => [
    spellId, status.freeUse ? { ...status, freeUsed: false } : status,
  ]));
  const notes = [`HP restored to ${character.maxHp}`, "spell slots restored"];
  if (character.tempHp > 0) notes.push("temp HP cleared");
  if (character.concentratingOn) notes.push("concentration ended");
  if (spent > 0) notes.push(`${Math.min(recovered, spent)} hit dice recovered`);
  if (Object.values(statuses).some((status) => status.freeUse && status.freeUsed)) notes.push("per-rest spell uses restored");
  return {
    patch: { currentHp: character.maxHp, tempHp: 0, spellSlotsUsed: {}, pactSlotsUsed: 0, concentratingOn: null, hitDiceSpent: Math.max(0, spent - recovered), spellStatuses },
    summary: notes.join(", "),
  };
}
