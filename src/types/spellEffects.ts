// Shared spell effect types used by both spellEffects.ts and spellScaling.ts.
// Separated to avoid circular imports.

/** How a spell effect scales when upcast. */
export type SpellScaling =
  | { type: "per-slot-level"; startsAboveLevel: number; dicePerLevel: string }
  | { type: "slot-level-table"; values: Record<number, string> }
  | { type: "none" };

/** A damage-dealing spell effect. */
export type SpellDamageEffect = {
  id: string;
  type: "damage";
  dice: string;
  damageType: string;
  scaling?: SpellScaling;
  /** What happens on a successful save: "half" damage, or "none". */
  saveResult?: "half" | "none";
};

/** A healing spell effect. */
export type SpellHealingEffect = {
  id: string;
  type: "healing";
  dice: string;
  scaling?: SpellScaling;
};

export type SpellEffect = SpellDamageEffect | SpellHealingEffect;

/** The result of rolling a single resolved effect's dice. */
export type DiceRollResult = {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
};

/** A fully rolled spell effect — ready for display. */
export type ResolvedSpellRoll =
  | {
      type: "damage";
      damageType: string;
      roll: DiceRollResult;
      saveResult?: "half" | "none";
      savedTotal?: number;
    }
  | {
      type: "healing";
      roll: DiceRollResult;
    };

/** Parsed simple dice notation: NdX ± M */
export type ParsedDice = {
  count: number;
  sides: number;
  modifier: number;
};
