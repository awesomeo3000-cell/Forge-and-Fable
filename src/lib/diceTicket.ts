/**
 * Roll ticket model (proposal 35, Option B).
 *
 * The dice tray's single source of truth: die buttons, the modifier control
 * and typed formulas all write into one Ticket, so there is never a question
 * of which input wins. Pure and JSX-free; formula parsing delegates to the
 * existing parseDiceFormula — this module never re-implements dice notation.
 */

import { parseDiceFormula, signed } from "@/lib/utils";
import type { RollMode } from "@/types/game";

export type TicketGroup = { sides: number; count: number; keepHighest?: number };

export type Ticket = {
  groups: TicketGroup[];
  modifier: number;
  /** Advantage state carried by the ticket's d20s (5e: d20-only). */
  d20Mode: RollMode;
};

export const EMPTY_TICKET: Ticket = { groups: [], modifier: 0, d20Mode: "normal" };

const MAX_PER_GROUP = 20;
const MAX_MODIFIER = 20;

export function hasD20(ticket: Ticket): boolean {
  return ticket.groups.some((group) => group.sides === 20 && !group.keepHighest);
}

export function totalDice(ticket: Ticket): number {
  return ticket.groups.reduce((sum, group) => sum + group.count, 0);
}

/** Add one die, merging into an existing plain group of the same size. */
export function addDie(ticket: Ticket, sides: number): Ticket {
  const existing = ticket.groups.findIndex((group) => group.sides === sides && !group.keepHighest);
  if (existing >= 0) {
    const groups = ticket.groups.map((group, index) =>
      index === existing ? { ...group, count: Math.min(MAX_PER_GROUP, group.count + 1) } : group,
    );
    return { ...ticket, groups };
  }
  return { ...ticket, groups: [...ticket.groups, { sides, count: 1 }] };
}

/** Remove one whole group (the chip's ✕). d20Mode resets when no d20 remains. */
export function removeGroup(ticket: Ticket, index: number): Ticket {
  const groups = ticket.groups.filter((_, i) => i !== index);
  const next = { ...ticket, groups };
  return hasD20(next) ? next : { ...next, d20Mode: "normal" };
}

export function setTicketModifier(ticket: Ticket, modifier: number): Ticket {
  return { ...ticket, modifier: Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, Math.trunc(modifier))) };
}

/** Tap the d20 chip: normal → advantage → disadvantage → normal. */
export function cycleD20Mode(ticket: Ticket): Ticket {
  if (!hasD20(ticket)) return ticket;
  const next: RollMode =
    ticket.d20Mode === "normal" ? "advantage" : ticket.d20Mode === "advantage" ? "disadvantage" : "normal";
  return { ...ticket, d20Mode: next };
}

function groupNotation(group: TicketGroup): string {
  return `${group.count}d${group.sides}${group.keepHighest ? `kh${group.keepHighest}` : ""}`;
}

/** Canonical formula text: "2d6 + 1d20 + 3" (mode is not formula syntax). */
export function ticketToFormula(ticket: Ticket): string {
  const parts = ticket.groups.map(groupNotation);
  const formula = parts.join(" + ");
  if (ticket.modifier !== 0) return formula ? `${formula} ${signed(ticket.modifier)}` : signed(ticket.modifier);
  return formula;
}

/** History/roll label — includes the d20 mode so the log reads truthfully. */
export function ticketLabel(ticket: Ticket): string {
  const formula = ticketToFormula(ticket);
  if (ticket.d20Mode !== "normal" && hasD20(ticket)) {
    return `${formula} (${ticket.d20Mode === "advantage" ? "adv" : "dis"})`;
  }
  return formula;
}

export type FormulaResult = { ticket: Ticket } | { error: string };

/**
 * A typed formula replaces the ticket wholesale. The current d20 mode is kept
 * when the new ticket still holds a plain d20, dropped otherwise.
 */
export function formulaToTicket(input: string, current: Ticket): FormulaResult {
  const parsed = parseDiceFormula(input.trim());
  if (parsed.error) return { error: parsed.error };
  if (parsed.groups.length === 0 && parsed.modifier === 0) return { error: "Empty formula." };
  const groups: TicketGroup[] = parsed.groups.map((group) => ({
    sides: group.sides,
    count: group.count,
    ...(group.keepHighest ? { keepHighest: group.keepHighest } : {}),
  }));
  const next: Ticket = { groups, modifier: parsed.modifier, d20Mode: current.d20Mode };
  return { ticket: hasD20(next) ? next : { ...next, d20Mode: "normal" } };
}
