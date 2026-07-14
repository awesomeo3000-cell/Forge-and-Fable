/** Presentation-density rules for the DM Table initiative list (Round Four A1). */

export type InitiativeDensity = "standard" | "compact";

/** 9+ combatants auto-compact the initiative rows regardless of the user's Compact toggle. */
export const INITIATIVE_AUTO_COMPACT_THRESHOLD = 9;

/**
 * The single density decision: the user's global Compact choice wins, and a
 * crowded list compacts itself. Auto-compacting never toggles or activates
 * the Compact button — the button reflects only the user's own choice.
 */
export function initiativeDensity(combatantCount: number, userCompact: boolean): InitiativeDensity {
  return userCompact || combatantCount >= INITIATIVE_AUTO_COMPACT_THRESHOLD ? "compact" : "standard";
}

/**
 * Duplicate-name badges for combatant rows: every name that appears more than
 * once gets a real-digit badge (1, 2, 3…) assigned by order of appearance
 * among identical visible names. Unique names get null.
 */
export function duplicateNameBadges(names: string[]): Array<number | null> {
  const totals = new Map<string, number>();
  for (const name of names) totals.set(name, (totals.get(name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return names.map((name) => {
    if ((totals.get(name) ?? 0) < 2) return null;
    const next = (seen.get(name) ?? 0) + 1;
    seen.set(name, next);
    return next;
  });
}
