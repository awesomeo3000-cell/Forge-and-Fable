import type { Character, CharacterPatch } from "@/types/game";

export type DeathSaveAction = "success" | "failure" | "natural-20" | "natural-1" | "stabilize" | "heal" | "reset" | "dead";

/** Character-owner recovery rules used by targeted DM events. Three successes
 * stabilize; three failures mark death; a natural 1 is two failures; a natural
 * 20 restores 1 HP. Healing or regaining HP resets the track. */
export function deathSavePatch(character: Character, action: DeathSaveAction, amount = 0): CharacterPatch {
  const current = character.deathSaves ?? { successes: 0, failures: 0 };
  if (action === "natural-20") return { currentHp: Math.max(1, character.currentHp), deathSaves: { successes: 0, failures: 0 }, effects: (character.effects ?? []).filter((effect) => effect.label !== "Stable" && effect.label !== "Dead") };
  if (action === "heal") return { currentHp: Math.min(character.maxHp, Math.max(0, character.currentHp) + Math.max(1, amount)), deathSaves: { successes: 0, failures: 0 }, effects: (character.effects ?? []).filter((effect) => effect.label !== "Stable" && effect.label !== "Dead") };
  if (action === "reset") return { deathSaves: { successes: 0, failures: 0 }, effects: (character.effects ?? []).filter((effect) => effect.label !== "Stable" && effect.label !== "Dead") };
  if (action === "stabilize") return { deathSaves: { successes: 3, failures: current.failures }, effects: [...(character.effects ?? []).filter((effect) => effect.label !== "Dead" && effect.label !== "Stable"), { id: "campaign-stable", label: "Stable", source: "DM", active: true }] };
  if (action === "dead") return { deathSaves: { successes: current.successes, failures: 3 }, effects: [...(character.effects ?? []).filter((effect) => effect.label !== "Stable" && effect.label !== "Dead"), { id: "campaign-dead", label: "Dead", source: "DM", active: true }] };
  const successes = Math.min(3, current.successes + (action === "success" ? 1 : 0));
  const failures = Math.min(3, current.failures + (action === "natural-1" ? 2 : action === "failure" ? 1 : 0));
  if (failures >= 3) return deathSavePatch({ ...character, deathSaves: { successes, failures } }, "dead");
  if (successes >= 3) return deathSavePatch({ ...character, deathSaves: { successes, failures } }, "stabilize");
  return { deathSaves: { successes, failures } };
}
