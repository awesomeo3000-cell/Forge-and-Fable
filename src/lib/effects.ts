import type { CharacterEffect } from "@/types/game";

/** Fields an effect can add a flat bonus to. */
export const EFFECT_NUMERIC_FIELDS = [
  { key: "ac", label: "AC" },
  { key: "attack", label: "To-hit" },
  { key: "damage", label: "Damage" },
  { key: "saves", label: "Saves" },
  { key: "checks", label: "Checks" },
  { key: "initiative", label: "Init" },
] as const;

export type EffectNumericKey = (typeof EFFECT_NUMERIC_FIELDS)[number]["key"];

export const D20_DICE_RE = /^[1-9]d(4|6|8|10|12|20|100)$/;

/** Quick-picks for the "people who keep forgetting they have Bless" crowd. */
export const EFFECT_PRESETS: Array<Omit<CharacterEffect, "id" | "active">> = [
  { label: "Bless", source: "Spell", d20Dice: "1d4" },
  { label: "Guidance", source: "Spell", d20Dice: "1d4" },
  { label: "Shield of Faith", source: "Spell", ac: 2 },
  { label: "Haste", source: "Spell", ac: 2 },
  { label: "+1 Weapon", source: "Item", attack: 1, damage: 1 },
  { label: "+2 Weapon", source: "Item", attack: 2, damage: 2 },
  { label: "Ring of Protection", source: "Item", ac: 1, saves: 1 },
  { label: "Rage", source: "Feature", damage: 2 },
  { label: "Darkvision 60 ft.", source: "Spell", sense: "Darkvision 60 ft." },
  { label: "Blinded", source: "Condition" },
  { label: "Poisoned", source: "Condition" },
  { label: "Concentrating", source: "Condition" },
];

export function parseD20Dice(dice: string | undefined): { sides: number; count: number } | null {
  if (!dice || !D20_DICE_RE.test(dice)) return null;
  const [count, sides] = dice.split("d").map(Number);
  return { count, sides };
}

/** One-line summary of what an effect mechanically does. */
export function describeEffect(effect: CharacterEffect): string {
  const parts: string[] = [];
  for (const field of EFFECT_NUMERIC_FIELDS) {
    const v = effect[field.key];
    if (v) parts.push(`${v > 0 ? "+" : ""}${v} ${field.label}`);
  }
  if (effect.d20Dice) parts.push(`+${effect.d20Dice} on d20 rolls`);
  if (effect.sense) parts.push(effect.sense);
  if (parts.length === 0) parts.push(effect.source === "Condition" ? "condition" : "note");
  return parts.join(" · ");
}

/** Sum a numeric field across active effects. */
export function effectTotal(effects: CharacterEffect[] | undefined, key: EffectNumericKey): number {
  return (effects ?? []).reduce((sum, e) => sum + (e.active ? e[key] ?? 0 : 0), 0);
}

/** Dice riders (e.g. Bless 1d4) from active effects, parsed for the roll pool. */
export function activeD20Riders(effects: CharacterEffect[] | undefined): { sides: number; count: number }[] {
  return (effects ?? [])
    .filter((e) => e.active)
    .map((e) => parseD20Dice(e.d20Dice))
    .filter((d): d is { sides: number; count: number } => d !== null);
}
