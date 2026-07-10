/**
 * Pure HP calculation functions — no React, browser globals, random, fetch,
 * database, or mutable module state.
 */

// ── Types ──

export type HitPointMethod = "fixed" | "rolled" | "manual";

export type StartingHpResult = {
  maxHp: number;
  hpGains: number[]; // final gains (one per level beyond 1)
};

export type RevertResult = {
  newMaxHp: number;
  newCurrentHp: number;
  newHpGains: number[];
  safe: true;
} | {
  newMaxHp: number;
  newCurrentHp: number;
  newHpGains: number[];
  safe: false;
  reason: string;
};

// ── First-level HP ──

/** Level-1 maximum HP: hit-die max + CON mod, minimum 1. */
export function firstLevelHp(hitDie: number, constitutionModifier: number): number {
  return Math.max(1, Math.trunc(hitDie) + constitutionModifier);
}

// ── Per-level gain ──

/** Fixed (average) HP gain after level 1: floor(hitDie / 2) + 1 + CON mod, minimum 1. */
export function fixedHpGain(hitDie: number, constitutionModifier: number): number {
  return Math.max(1, Math.floor(Math.trunc(hitDie) / 2) + 1 + constitutionModifier);
}

/** Convert a raw die roll to a final HP gain: max(1, rawRoll + CON mod). */
export function rolledHpGain(rawRoll: number, constitutionModifier: number): number {
  return Math.max(1, Math.trunc(rawRoll) + constitutionModifier);
}

// ── Build starting HP (levels 1-20) ──

/**
 * Build starting HP for a character of any level.
 *
 * @returns maxHp and hpGains (final per-level gains, length = level - 1 when complete).
 *          For rolled mode with incomplete raw rolls, hpGains contains only the
 *          gains derived so far — callers must check length before deeming it complete.
 */
export function buildStartingHp(
  level: number,
  hitDie: number,
  constitutionModifier: number,
  method: HitPointMethod,
  rawRolls?: number[],
): StartingHpResult {
  const safeLevel = Math.max(1, Math.min(20, Math.trunc(level)));
  const base = firstLevelHp(hitDie, constitutionModifier);
  const extraLevels = safeLevel - 1;

  if (extraLevels <= 0) {
    return { maxHp: base, hpGains: [] };
  }

  if (method === "rolled") {
    if (rawRolls && rawRolls.length > 0) {
      const cappedRolls = rawRolls.slice(0, extraLevels);
      const hpGains = cappedRolls.map((r) => rolledHpGain(r, constitutionModifier));
      const total = base + hpGains.reduce((sum, g) => sum + g, 0);
      return { maxHp: total, hpGains };
    }
    // Empty or omitted roll list — incomplete result. Caller must supply the
    // missing rolls before treating this as final HP.
    return { maxHp: base, hpGains: [] };
  }

  // Fixed and manual both use the deterministic fixed gain per level.
  const fixedGain = fixedHpGain(hitDie, constitutionModifier);
  const hpGains: number[] = [];
  let total = base;
  for (let i = 0; i < extraLevels; i++) {
    hpGains.push(fixedGain);
    total += fixedGain;
  }
  return { maxHp: total, hpGains };
}

// ── Revert one level ──

/**
 * Compute the HP state after removing one level.
 *
 * Policy:
 * - If a recorded gain exists for the removed level, use it.
 * - If no gain exists and the method is fixed, use the fixed-gain formula as legacy fallback.
 * - If no gain exists and the method is rolled/manual, return unsafe with a reason.
 * - Preserve current HP: min(oldCurrentHp, newMaxHp). Zero stays zero.
 */
export function revertHpLevel(
  currentMaxHp: number,
  currentHp: number,
  hpGains: number[],
  method: HitPointMethod,
  hitDie: number,
  constitutionModifier: number,
): RevertResult {
  if (hpGains.length > 0) {
    const lastGain = hpGains[hpGains.length - 1];
    const newHpGains = hpGains.slice(0, -1);
    const newMaxHp = Math.max(1, currentMaxHp - lastGain);
    const newCurrentHp = Math.min(currentHp, newMaxHp);
    return { newMaxHp, newCurrentHp, newHpGains, safe: true };
  }

  // No recorded history — apply legacy fallback
  if (method === "fixed") {
    const fixedGain = fixedHpGain(hitDie, constitutionModifier);
    const newHpGains: number[] = [];
    const newMaxHp = Math.max(1, currentMaxHp - fixedGain);
    const newCurrentHp = Math.min(currentHp, newMaxHp);
    return { newMaxHp, newCurrentHp, newHpGains, safe: true };
  }

  // Rolled or manual with no history — unsafe
  const newMaxHp = Math.max(1, currentMaxHp);
  const newCurrentHp = Math.min(currentHp, newMaxHp);
  return {
    newMaxHp,
    newCurrentHp,
    newHpGains: hpGains,
    safe: false,
    reason: `Cannot safely level down: no recorded HP gains for this ${method} character. HP was not changed.`,
  };
}
