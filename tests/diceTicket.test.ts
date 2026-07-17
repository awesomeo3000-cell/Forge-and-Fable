import { describe, expect, it } from "vitest";
import {
  EMPTY_TICKET,
  addDie,
  removeGroup,
  setTicketModifier,
  cycleD20Mode,
  hasD20,
  totalDice,
  ticketToFormula,
  ticketLabel,
  formulaToTicket,
  type Ticket,
} from "@/lib/diceTicket";

const build = (...steps: Array<(t: Ticket) => Ticket>) => steps.reduce((t, step) => step(t), EMPTY_TICKET);

describe("ticket building", () => {
  it("merges repeated dice into one group and counts totals", () => {
    const ticket = build((t) => addDie(t, 6), (t) => addDie(t, 6), (t) => addDie(t, 20));
    expect(ticket.groups).toEqual([{ sides: 6, count: 2 }, { sides: 20, count: 1 }]);
    expect(totalDice(ticket)).toBe(3);
  });

  it("removes whole groups and resets d20 mode when the d20 leaves", () => {
    let ticket = build((t) => addDie(t, 20), (t) => addDie(t, 6));
    ticket = cycleD20Mode(ticket);
    expect(ticket.d20Mode).toBe("advantage");
    ticket = removeGroup(ticket, 0);
    expect(ticket.groups).toEqual([{ sides: 6, count: 1 }]);
    expect(ticket.d20Mode).toBe("normal");
  });

  it("clamps the modifier", () => {
    expect(setTicketModifier(EMPTY_TICKET, 99).modifier).toBe(20);
    expect(setTicketModifier(EMPTY_TICKET, -99).modifier).toBe(-20);
  });

  it("cycles d20 mode only when a plain d20 is present", () => {
    expect(cycleD20Mode(EMPTY_TICKET).d20Mode).toBe("normal");
    let ticket = addDie(EMPTY_TICKET, 20);
    ticket = cycleD20Mode(ticket);
    expect(ticket.d20Mode).toBe("advantage");
    ticket = cycleD20Mode(ticket);
    expect(ticket.d20Mode).toBe("disadvantage");
    ticket = cycleD20Mode(ticket);
    expect(ticket.d20Mode).toBe("normal");
  });
});

describe("formula round-trip", () => {
  it("serialises groups, kh and modifier", () => {
    const ticket: Ticket = { groups: [{ sides: 6, count: 4, keepHighest: 3 }, { sides: 8, count: 1 }], modifier: 2, d20Mode: "normal" };
    expect(ticketToFormula(ticket)).toBe("4d6kh3 + 1d8 +2");
  });

  it("parses a formula into a replacement ticket", () => {
    const result = formulaToTicket("2d6+1d20+3", EMPTY_TICKET);
    if ("error" in result) throw new Error(result.error);
    expect(result.ticket.groups).toEqual([{ sides: 6, count: 2 }, { sides: 20, count: 1 }]);
    expect(result.ticket.modifier).toBe(3);
  });

  it("round-trips through its own serialisation", () => {
    const original = formulaToTicket("4d6kh3 + 2d8 -1", EMPTY_TICKET);
    if ("error" in original) throw new Error(original.error);
    const again = formulaToTicket(ticketToFormula(original.ticket), EMPTY_TICKET);
    if ("error" in again) throw new Error(again.error);
    expect(again.ticket.groups).toEqual(original.ticket.groups);
    expect(again.ticket.modifier).toBe(original.ticket.modifier);
  });

  it("keeps the d20 mode across a formula replacement that still has a d20", () => {
    const armed = cycleD20Mode(addDie(EMPTY_TICKET, 20));
    const kept = formulaToTicket("1d20+5", armed);
    if ("error" in kept) throw new Error(kept.error);
    expect(kept.ticket.d20Mode).toBe("advantage");
    const dropped = formulaToTicket("3d6", armed);
    if ("error" in dropped) throw new Error(dropped.error);
    expect(dropped.ticket.d20Mode).toBe("normal");
  });

  it("does not read a later group's count as a modifier (parser regression)", () => {
    // "2d6+1d4+3" used to yield modifier 4: the "+1" of "+1d4" was double-
    // counted as a flat modifier alongside the real "+3".
    const result = formulaToTicket("2d6+1d4+3", EMPTY_TICKET);
    if ("error" in result) throw new Error(result.error);
    expect(result.ticket.modifier).toBe(3);
    expect(result.ticket.groups).toEqual([{ sides: 6, count: 2 }, { sides: 4, count: 1 }]);
  });

  it("labels adv/dis truthfully and rejects garbage", () => {
    const armed = cycleD20Mode(addDie(addDie(EMPTY_TICKET, 20), 6));
    expect(ticketLabel(armed)).toBe("1d20 + 1d6 (adv)");
    expect(hasD20(armed)).toBe(true);
    expect("error" in formulaToTicket("not dice", EMPTY_TICKET)).toBe(true);
  });
});
