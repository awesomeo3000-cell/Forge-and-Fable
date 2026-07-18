import type { SpellData } from "@/types/game";
import type {
  SpellDamageEffect,
  SpellHealingEffect,
  ParsedDice,
  DiceRollResult,
  ResolvedSpellRoll,
} from "@/types/spellEffects";
import { SPELL_SCALING } from "@/data/spellScaling";
import { rollDie } from "@/lib/utils";

// Re-export types for consumers.
export type {
  SpellScaling,
  SpellDamageEffect,
  SpellHealingEffect,
  SpellEffect,
  ParsedDice,
  DiceRollResult,
  ResolvedSpellRoll,
} from "@/types/spellEffects";

/** The output of resolveSpellEffects — dice string with metadata, ready to roll. */
export type ResolvedSpellEffect = SpellDamageEffect | SpellHealingEffect;

// ── Dice Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a simple dice expression like "3d6", "1d8+4", or "2d10-1".
 * Returns null for complex expressions (multiple dice groups, keep-highest, etc.).
 */
export function parseSimpleDice(expression: string): ParsedDice | null {
  const trimmed = expression.trim();
  const match = trimmed.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;

  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifierAmount = match[4] ? Number(match[4]) : 0;
  const modifier = match[3] === "-" ? -modifierAmount : modifierAmount;

  return { count, sides, modifier };
}

// ── Dice Scaling ───────────────────────────────────────────────────────────

/**
 * Scale a base dice expression by adding dice-per-level.
 * When sides match (e.g. 3d6 + 2 × 1d6 → 5d6), combines into a single expression.
 * When they don't, returns a human-readable fallback.
 */
export function scaleDicePerSlotLevel(
  baseDice: string,
  addedDice: string,
  additionalLevels: number,
): string {
  if (additionalLevels <= 0) return baseDice;

  const base = parseSimpleDice(baseDice);
  const added = parseSimpleDice(addedDice);

  if (!base || !added) {
    return `${baseDice} + ${additionalLevels} × ${addedDice}`;
  }

  // Can only cleanly combine when sides match.
  if (base.sides !== added.sides) {
    return `${baseDice} + ${additionalLevels} × ${addedDice}`;
  }

  // Combine counts and modifiers (e.g. 3d4+3 + 2×1d4+1 → 5d4+5 for Magic Missile).
  const totalCount = base.count + added.count * additionalLevels;
  const totalMod = base.modifier + added.modifier * additionalLevels;
  const modStr =
    totalMod === 0 ? "" : totalMod > 0 ? `+${totalMod}` : `${totalMod}`;

  return `${totalCount}d${base.sides}${modStr}`;
}

// ── Effect Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a single damage effect for a given cast level.
 * Applies per-slot-level and slot-level-table scaling.
 */
function resolveDamageEffect(
  effect: SpellDamageEffect,
  _spellLevel: number,
  castLevel: number,
): SpellDamageEffect {
  const scaling = effect.scaling;

  if (!scaling || scaling.type === "none") return effect;

  if (scaling.type === "per-slot-level") {
    const additionalLevels = Math.max(0, castLevel - scaling.startsAboveLevel);
    return {
      ...effect,
      dice: scaleDicePerSlotLevel(effect.dice, scaling.dicePerLevel, additionalLevels),
    };
  }

  if (scaling.type === "slot-level-table") {
    return {
      ...effect,
      dice: scaling.values[castLevel] ?? effect.dice,
    };
  }

  return effect;
}

/**
 * Resolve all effects for a spell at a given cast level.
 *
 * Looks up structured effects from the scaling registry first,
 * then falls back to the spell's `higherLevel` bridge field for simple per-level scaling,
 * and finally falls back to the spell's description dice (no scaling).
 *
 * Cantrips (spell.level === 0) scale by character level, not slot level.
 */
export function resolveSpellEffects(
  spell: SpellData,
  castLevel: number,
  characterLevel = 1,
): ResolvedSpellEffect[] {
  // Cantrips scale by character level, not slot level.
  if (spell.level === 0) {
    return buildCantripEffects(spell, characterLevel);
  }

  // 1. Try the full structured registry.
  const registryEffects = SPELL_SCALING[spell.id];
  if (registryEffects && registryEffects.length > 0) {
    return registryEffects.map((effect) => {
      if (effect.type === "damage") {
        return resolveDamageEffect(effect, spell.level, castLevel);
      }
      if (effect.type === "healing") {
        const scaling = effect.scaling;
        if (!scaling || scaling.type === "none") return effect;
        if (scaling.type === "per-slot-level") {
          const additionalLevels = Math.max(0, castLevel - scaling.startsAboveLevel);
          return {
            ...effect,
            dice: scaleDicePerSlotLevel(effect.dice, scaling.dicePerLevel, additionalLevels),
          };
        }
        if (scaling.type === "slot-level-table") {
          return { ...effect, dice: scaling.values[castLevel] ?? effect.dice };
        }
        return effect;
      }
      return effect;
    });
  }

  // 2. Fall back to the lightweight higherLevel bridge field.
  if (spell.higherLevel?.dice) {
    const hl = spell.higherLevel;
    const startLevel = hl.startLevel ?? spell.level;
    const additionalLevels = Math.max(0, castLevel - startLevel);

    // Extract base dice from description (best-effort single NdX pattern).
    const baseDice = extractFirstDice(spell.description);
    if (baseDice) {
      const scaledDice = scaleDicePerSlotLevel(baseDice, hl.dice, additionalLevels);
      const effect: SpellDamageEffect = {
        id: `${spell.id}-damage`,
        type: "damage",
        dice: scaledDice,
        damageType: hl.damageType ?? spell.damageEffect ?? "",
        saveResult: spell.save ? "half" : undefined,
      };
      return [effect];
    }
  }

  // 3. Final fallback: return effects built from description dice (no scaling).
  return buildFallbackEffects(spell);
}

/** Build effects from the spell's description and damageEffect fields as a last resort. */
function buildFallbackEffects(spell: SpellData): ResolvedSpellEffect[] {
  const diceList = extractDiceList(spell.description);
  if (diceList.length === 0 && !spell.damageEffect) return [];

  if (diceList.length === 0) {
    // Has a damageEffect label but no dice — non-damage spell (conditions, utility, etc.).
    return [];
  }

  const effects: SpellDamageEffect[] = diceList.map((dice, i) => ({
    id: `${spell.id}-damage-${i}`,
    type: "damage" as const,
    dice,
    damageType: spell.damageEffect || "",
    saveResult: spell.save ? "half" : undefined,
  }));

  return effects;
}

/**
 * Select the active damage tier for a cantrip. Descriptions conventionally
 * list 1/2/3/4-die tiers at character levels 1/5/11/17. Some imported text
 * uses OCR's lowercase "l" for the digit "1", so normalize that before
 * selecting a tier. Alternatives such as Toll the Dead's d8/d12 remain as
 * separate choices at the active tier.
 */
function buildCantripEffects(spell: SpellData, characterLevel: number): ResolvedSpellEffect[] {
  const diceList = extractDiceList(spell.description);
  if (diceList.length === 0 && !spell.damageEffect) return [];
  if (diceList.length === 0) return [];

  const tierCount = characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
  const activeDice = diceList.filter((dice) => parseSimpleDice(dice)?.count === tierCount);
  const selectedDice = activeDice.length > 0 ? activeDice : [diceList[0]];

  return selectedDice.map((dice, i) => ({
    id: `${spell.id}-damage-${i}`,
    type: "damage" as const,
    dice,
    damageType: spell.damageEffect || "",
    saveResult: spell.save ? "half" : undefined,
  }));
}

/** Extract the first NdX pattern from text. */
function extractFirstDice(text: string): string | null {
  const match = normalizeDiceNotation(text).match(/(\d+d\d+)/i);
  return match ? match[1] : null;
}

/** Extract all unique NdX patterns from text. */
function extractDiceList(text: string): string[] {
  const normalized = normalizeDiceNotation(text);
  const dice: string[] = [];
  const seen = new Set<string>();
  const re = /(\d+)d(\d+)/gi;
  let m;
  while ((m = re.exec(normalized)) !== null) {
    const key = `${m[1]}d${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      dice.push(key);
    }
  }
  return dice;
}

function normalizeDiceNotation(text: string): string {
  return text
    .replace(/\bl\s*d\s*(\d)\s*(\d)\b/gi, "1d$1$2")
    .replace(/\bl\s*d\s*(\d+)\b/gi, "1d$1")
    .replace(/\b(\d+)\s*d\s*(\d+)\b/gi, "$1d$2");
}

// ── Dice Rolling ───────────────────────────────────────────────────────────

/**
 * Roll the dice for a resolved effect. Returns the full roll result.
 */
export function rollResolvedEffect(effect: ResolvedSpellEffect): ResolvedSpellRoll {
  const parsed = parseSimpleDice(effect.dice);

  if (!parsed) {
    // Complex expression — return a placeholder so the caller doesn't crash.
    if (effect.type === "damage") {
      return {
        type: "damage",
        damageType: effect.damageType,
        roll: { expression: effect.dice, rolls: [], modifier: 0, total: 0 },
        saveResult: effect.saveResult,
      };
    }
    return {
      type: "healing",
      roll: { expression: effect.dice, rolls: [], modifier: 0, total: 0 },
    };
  }

  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(rollDie(parsed.sides));
  }
  const total = rolls.reduce((sum, v) => sum + v, 0) + parsed.modifier;

  const rollResult: DiceRollResult = {
    expression: effect.dice,
    rolls,
    modifier: parsed.modifier,
    total,
  };

  if (effect.type === "damage") {
    const result: ResolvedSpellRoll = {
      type: "damage",
      damageType: effect.damageType,
      roll: rollResult,
      saveResult: effect.saveResult,
    };
    if (effect.saveResult === "half") {
      result.savedTotal = Math.floor(total / 2);
    }
    return result;
  }

  return { type: "healing", roll: rollResult };
}

/**
 * Resolve effects and roll all dice. Returns the complete result set.
 */
export function resolveAndRollSpell(
  spell: SpellData,
  castLevel: number,
  characterLevel = 1,
): ResolvedSpellRoll[] {
  const effects = resolveSpellEffects(spell, castLevel, characterLevel);
  return effects.map(rollResolvedEffect);
}

// ── Formatting ─────────────────────────────────────────────────────────────

/** Format a single roll's detail (e.g. "4d6: 6 + 4 + 2 + 5 = 17"). */
export function formatRollDetail(roll: DiceRollResult): string {
  const { expression, rolls, modifier, total } = roll;
  if (rolls.length === 0) return `${expression} (could not roll)`;
  const rollStr = rolls.join(" + ");
  const parts = [expression, rollStr];
  if (modifier !== 0) parts.push(modifier > 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`);
  parts.push(`= ${total}`);
  return parts.join(" · ");
}

/** Build a console-log-friendly summary of a spell cast result. */
export function formatSpellCastResult(
  spell: SpellData,
  castLevel: number,
  rolls: ResolvedSpellRoll[],
): string {
  const lines: string[] = [];
  const header =
    castLevel > 0
      ? `${spell.name} (cast at level ${castLevel})`
      : `${spell.name} (cantrip)`;
  lines.push(header);

  for (const r of rolls) {
    if (r.type === "damage") {
      const savedInfo = r.savedTotal != null ? ` · save half: ${r.savedTotal}` : "";
      lines.push(
        `${r.damageType || "Damage"}: ${r.roll.total}${savedInfo} — ${formatRollDetail(r.roll)}`,
      );
    } else if (r.type === "healing") {
      lines.push(`Healing: ${r.roll.total} — ${formatRollDetail(r.roll)}`);
    }
  }

  if (rolls.length === 0 && spell.save) {
    lines.push(`Save: ${spell.save}`);
  }

  return lines.join("\n");
}

/** Build a dice preview string for cast buttons (e.g. "3d6" or "4d6"). */
export function previewDiceForLevel(
  spell: SpellData,
  castLevel: number,
): string | null {
  if (spell.level === 0) return null; // cantrips don't show dice preview on cast buttons
  const effects = resolveSpellEffects(spell, castLevel);
  if (effects.length === 0) return null;
  // Show the first damage/healing effect's dice.
  const first = effects[0];
  if ("dice" in first && first.dice) return first.dice;
  return null;
}

/** Whether a spell has structured scaling data (registry or bridge field). */
export function hasSpellScaling(spell: SpellData): boolean {
  if (spell.level === 0) return false;
  if (SPELL_SCALING[spell.id]) return true;
  if (spell.higherLevel?.dice) return true;
  return false;
}

/** Return a human-readable scaling note (e.g. "+1d6 per slot level"). */
export function getScalingNote(spell: SpellData): string | null {
  // Check registry first.
  const registryEffects = SPELL_SCALING[spell.id];
  if (registryEffects) {
    for (const effect of registryEffects) {
      if (effect.scaling && effect.scaling.type === "per-slot-level") {
        return `+${effect.scaling.dicePerLevel} per slot level above ${effect.scaling.startsAboveLevel}`;
      }
    }
  }
  // Bridge field fallback.
  if (spell.higherLevel?.dice) {
    const start = spell.higherLevel.startLevel ?? spell.level;
    return `+${spell.higherLevel.dice} per slot level above ${start}`;
  }
  return null;
}
