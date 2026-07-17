"use client";

import { GripHorizontal, RotateCcw, Trash2, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { signed } from "@/lib/utils";
import {
  EMPTY_TICKET,
  addDie,
  removeGroup,
  setTicketModifier,
  cycleD20Mode,
  hasD20,
  totalDice,
  ticketLabel,
  formulaToTicket,
  type Ticket,
  type TicketGroup,
} from "@/lib/diceTicket";
import { FONT_STACKS } from "@/lib/skins";
import type { CharacterTheme, RollMode } from "@/types/game";
import type { InitiativeCombatant, InitiativeState } from "@/types/campaign";

export type RollHistoryEntry = {
  id: string;
  label: string;
  detail: string;
  total: number;
  time: string;
  /** Present when the roll used advantage/disadvantage — the two d20 faces and
      which one was kept, so history can highlight the winning die. */
  adv?: { mode: "advantage" | "disadvantage"; dice: number[]; keptIndex: number };
  /** Present when the kept (or only) d20 was a natural 20 or natural 1. */
  nat?: "crit" | "fumble";
  /** Present for pool-built rolls — enough to re-run the same roll. */
  pool?: { groups: TicketGroup[]; modifier: number; mode?: RollMode };
};

type DrawerLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RollPoolOutcome = { rolls: number[]; modifier: number; total: number };

const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100];
const LAYOUT_STORAGE_KEY = "forge-and-fable-roll-drawer-layout";
const INITIATIVE_STORAGE_KEY = "forge-and-fable-initiative";
const TAB_WIDTH = 34;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 320;
const FALLBACK_LAYOUT: DrawerLayout = { x: 902, y: 112, width: 300, height: 520 };
const EMPTY_INITIATIVE: InitiativeState = { combatants: [], turnIndex: 0, round: 1 };

function defaultLayout(): DrawerLayout {
  if (typeof window === "undefined") return FALLBACK_LAYOUT;

  const width = Math.min(320, Math.max(MIN_WIDTH, window.innerWidth - TAB_WIDTH - 24));
  const height = Math.min(560, Math.max(MIN_HEIGHT, window.innerHeight - 32));
  return {
    x: Math.max(8, window.innerWidth - width - TAB_WIDTH),
    y: Math.max(180, Math.round((window.innerHeight - height) / 2)),
    width,
    height,
  };
}

function clampLayout(layout: DrawerLayout): DrawerLayout {
  if (typeof window === "undefined") return layout;

  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - TAB_WIDTH - 16);
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - 24);
  const width = Math.min(maxWidth, Math.max(MIN_WIDTH, layout.width));
  const height = Math.min(maxHeight, Math.max(MIN_HEIGHT, layout.height));
  const x = Math.min(Math.max(8, layout.x), Math.max(8, window.innerWidth - width - TAB_WIDTH - 8));
  const y = Math.min(Math.max(12, layout.y), Math.max(12, window.innerHeight - height - 12));

  return { x, y, width, height };
}

function loadLayout(): DrawerLayout {
  if (typeof window === "undefined") return FALLBACK_LAYOUT;

  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return clampLayout(defaultLayout());
    const parsed = JSON.parse(raw) as Partial<DrawerLayout>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return clampLayout(defaultLayout());
    }
    return clampLayout(parsed as DrawerLayout);
  } catch {
    return clampLayout(defaultLayout());
  }
}

function saveLayout(layout: DrawerLayout) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function clampTurnIndex(state: InitiativeState): InitiativeState {
  if (state.combatants.length === 0) return { ...state, turnIndex: 0, round: Math.max(1, state.round || 1) };
  return {
    ...state,
    round: Math.max(1, state.round || 1),
    turnIndex: Math.min(Math.max(0, state.turnIndex || 0), state.combatants.length - 1),
  };
}

function sortCombatants(combatants: InitiativeCombatant[]) {
  return combatants
    .map((combatant, index) => ({ combatant, index }))
    .sort((a, b) => b.combatant.initiative - a.combatant.initiative || a.index - b.index)
    .map((item) => item.combatant);
}

function loadInitiative(): InitiativeState {
  if (typeof window === "undefined") return EMPTY_INITIATIVE;

  try {
    const raw = window.localStorage.getItem(INITIATIVE_STORAGE_KEY);
    if (!raw) return EMPTY_INITIATIVE;
    const parsed = JSON.parse(raw) as Partial<InitiativeState>;
    if (!Array.isArray(parsed.combatants)) return EMPTY_INITIATIVE;
    const combatants = parsed.combatants
      .filter((item): item is InitiativeCombatant =>
        !!item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.initiative === "number",
      )
      .map((item) => {
        const isPC = item.kind === "player" || (item as Record<string, unknown>).isPlayer === true;
        return {
          id: item.id,
          name: item.name.slice(0, 80),
          initiative: Math.max(-99, Math.min(99, Math.trunc(item.initiative))),
          kind: isPC ? "player" as const : "enemy" as const,
        };
      })
    return clampTurnIndex({
      combatants,
      turnIndex: typeof parsed.turnIndex === "number" ? parsed.turnIndex : 0,
      round: typeof parsed.round === "number" ? parsed.round : 1,
    });
  } catch {
    return EMPTY_INITIATIVE;
  }
}

function saveInitiative(state: InitiativeState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INITIATIVE_STORAGE_KEY, JSON.stringify(clampTurnIndex(state)));
}

/**
 * Right-edge drawer (AO-17 / proposal 35 Option B): a result strip, one roll
 * ticket as the single source of truth, and a log of every roll made this
 * session (sheet clicks included) underneath. Advantage lives on the ticket's
 * d20 chip; sheet-triggered rolls keep their own armed mode (toggled from the
 * sheet), which this drawer only displays via the tab dot.
 */

/* Categorise a roll from its label so the history can colour-code by type —
   saves, attacks, damage, skills, ability checks all read at a glance instead
   of blurring into one column. Each category maps to an accent in CSS via the
   data-roll-cat attribute. */
const SKILL_WORDS = /perception|insight|investigation|stealth|athletics|acrobatics|arcana|history|nature|religion|survival|medicine|persuasion|deception|intimidation|performance|sleight|animal handling/;
function rollCategory(label: string): string {
  const l = label.toLowerCase();
  if (/death\s*save/.test(l)) return "death";
  if (/initiative/.test(l)) return "initiative";
  if (/sav(e|ing)/.test(l)) return "save";
  if (/attack|to hit/.test(l)) return "attack";
  if (/damage|heal|hit die|hit dice/.test(l)) return "damage";
  if (SKILL_WORDS.test(l)) return "skill";
  if (/strength|dexterity|constitution|intelligence|wisdom|charisma|\bcheck\b/.test(l)) return "check";
  return "other";
}

export default memo(function RollDrawer(props: {
  history: RollHistoryEntry[];
  theme?: CharacterTheme | null;
  rollMode: RollMode;
  rollModeIsFromEffect?: boolean;
  activeCharacterName?: string;
  activeCharacterInitiative?: number;
  currentUserId?: string;
  campaignInitiative?: { data: InitiativeState; version: number };
  campaignIsDm?: boolean;
  onRollPool: (
    groups: { sides: number; count: number; keepHighest?: number }[],
    modifier: number,
    label: string,
    onResult?: (outcome: RollPoolOutcome) => void,
    forcedMode?: RollMode,
  ) => void;
  onCampaignInitiativeUpdate?: (data: InitiativeState, version: number) => void;
  onCampaignInitiativeRoll?: (initiative: number) => void;
  onClearHistory?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dice" | "combat">("dice");
  const [ticket, setTicket] = useState<Ticket>(EMPTY_TICKET);
  const [formulaInput, setFormulaInput] = useState("");
  const [formulaError, setFormulaError] = useState("");
  const [layout, setLayout] = useState<DrawerLayout>(FALLBACK_LAYOUT);
  const [initiativeState, setInitiativeState] = useState<InitiativeState>(EMPTY_INITIATIVE);
  const [combatantName, setCombatantName] = useState("");
  const [combatantInitiative, setCombatantInitiative] = useState(0);
  const layoutRef = useRef(layout);
  const dragMovedRef = useRef(false);
  const sharedInitiative = props.campaignInitiative;
  const isSharedInitiative = Boolean(sharedInitiative);
  const canManageInitiative = !isSharedInitiative || props.campaignIsDm;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const loaded = loadLayout();
    layoutRef.current = loaded;
    setLayout(loaded);
    setInitiativeState(loadInitiative());
  }, []);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const onResize = () => {
      setLayout((current) => {
        const next = clampLayout(current);
        layoutRef.current = next;
        saveLayout(next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** Add a die to the ticket. The first d20 inherits the sheet-armed mode so
      the chip shows the truth of what would roll (the user can cycle it off). */
  const addDieToTicket = (sides: number) =>
    setTicket((current) => {
      const next = addDie(current, sides);
      if (sides === 20 && !hasD20(current) && props.rollMode !== "normal") {
        return { ...next, d20Mode: props.rollMode };
      }
      return next;
    });

  const ticketNotation = ticketLabel(ticket);
  const ticketDiceCount = totalDice(ticket);

  const drawerVars = useMemo(() => {
    const theme = props.theme;
    // Unskinned default is the Observatory shell palette; a character skin
    // still overrides it (same containment rule as toasts/sheet).
    const paper = theme?.paper ?? "#0d1724";
    const ink = theme?.ink ?? "#edf1f4";
    const accent = theme?.accent ?? "#b3924a";
    return {
      "--roll-paper": paper,
      "--roll-ink": ink,
      "--roll-accent": accent,
      "--roll-font": theme ? FONT_STACKS[theme.fontKey] : "var(--font-body, Georgia, serif)",
    } as CSSProperties;
  }, [props.theme]);

  const rootStyle = {
    ...drawerVars,
    left: `${open ? layout.x : layout.x + layout.width}px`,
    top: `${layout.y}px`,
  } as CSSProperties;

  const bodyStyle = {
    width: `${layout.width}px`,
    height: `${layout.height}px`,
  } as CSSProperties;

  const startMove = useCallback((event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = layoutRef.current;
    dragMovedRef.current = false;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Older synthetic pointer implementations may not expose capture.
    }

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMovedRef.current = true;
      const next = clampLayout({
        ...origin,
        x: origin.x + dx,
        y: origin.y + dy,
      });
      layoutRef.current = next;
      setLayout(next);
    };

    const onDone = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onDone);
      handle.removeEventListener("pointercancel", onDone);
      saveLayout(layoutRef.current);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onDone);
    handle.addEventListener("pointercancel", onDone);
  }, []);

  const startResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = layoutRef.current;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Older synthetic pointer implementations may not expose capture.
    }

    const onMove = (moveEvent: PointerEvent) => {
      const next = clampLayout({
        ...origin,
        width: origin.width + moveEvent.clientX - startX,
        height: origin.height + moveEvent.clientY - startY,
      });
      layoutRef.current = next;
      setLayout(next);
    };

    const onDone = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onDone);
      handle.removeEventListener("pointercancel", onDone);
      saveLayout(layoutRef.current);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onDone);
    handle.addEventListener("pointercancel", onDone);
  }, []);

  const rollTicket = () => {
    if (ticketDiceCount === 0) return;
    // Advantage doubles each d20; the app's roll executor caps at 40 dice.
    const advExtra = ticket.d20Mode !== "normal" && hasD20(ticket)
      ? ticket.groups.reduce((sum, group) => sum + (group.sides === 20 && !group.keepHighest ? group.count : 0), 0)
      : 0;
    if (ticketDiceCount + advExtra > 40) {
      setFormulaError("Too many dice for one roll — 40 at most.");
      return;
    }
    setFormulaError("");
    // The ticket is the whole truth: its mode is always passed explicitly so
    // a sheet-armed advantage can never silently apply to a "normal" chip.
    const mode = hasD20(ticket) ? ticket.d20Mode : undefined;
    props.onRollPool(ticket.groups, ticket.modifier, ticketNotation, undefined, mode);
    setTicket(EMPTY_TICKET);
  };

  /** A typed formula replaces the ticket; the Roll button then reads it back. */
  const applyFormula = () => {
    if (!formulaInput.trim()) return;
    const result = formulaToTicket(formulaInput, ticket);
    if ("error" in result) {
      setFormulaError(result.error);
      return;
    }
    setFormulaError("");
    setTicket(result.ticket);
    setFormulaInput("");
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFormula();
    }
  };

  const rerollEntry = (entry: RollHistoryEntry) => {
    if (!entry.pool) return;
    props.onRollPool(entry.pool.groups, entry.pool.modifier, entry.label, undefined, entry.pool.mode);
  };

  const latest = props.history[0];

  const displayedInitiative = sharedInitiative?.data ?? initiativeState;

  const updateInitiative = (updater: (current: InitiativeState) => InitiativeState) => {
    if (sharedInitiative) {
      if (!props.campaignIsDm) return;
      const next = clampTurnIndex(updater(sharedInitiative.data));
      props.onCampaignInitiativeUpdate?.(next, sharedInitiative.version);
      return;
    }
    setInitiativeState((current) => {
      const next = clampTurnIndex(updater(current));
      saveInitiative(next);
      return next;
    });
  };

  const addCombatant = (name: string, initiative: number, isPlayer = false) => {
    const cleanName = name.trim().slice(0, 80);
    if (!cleanName || !Number.isFinite(initiative)) return;

    updateInitiative((current) => {
      const sortedCurrent = sortCombatants(current.combatants);
      const currentId = sortedCurrent[current.turnIndex]?.id;
      const combatants = [
        ...current.combatants,
        {
          id: crypto.randomUUID(),
          name: cleanName,
          initiative: Math.max(-99, Math.min(99, Math.trunc(initiative))),
          kind: isPlayer ? "player" as const : "enemy" as const,
        },
      ];
      const sortedNext = sortCombatants(combatants);
      return {
        ...current,
        combatants,
        turnIndex: currentId ? Math.max(0, sortedNext.findIndex((item) => item.id === currentId)) : 0,
      };
    });
  };

  const submitCombatant = () => {
    addCombatant(combatantName, combatantInitiative);
    setCombatantName("");
    setCombatantInitiative(0);
  };

  const addActiveCharacter = () => {
    if (!props.activeCharacterName || props.activeCharacterInitiative == null) return;
    const name = props.activeCharacterName;
    props.onRollPool(
      [{ sides: 20, count: 1 }],
      props.activeCharacterInitiative,
      `${name} Initiative`,
      (outcome) => {
        if (sharedInitiative) {
          props.onCampaignInitiativeRoll?.(outcome.total);
        } else {
          addCombatant(name, outcome.total, true);
        }
      },
    );
  };

  const removeCombatant = (id: string) => {
    updateInitiative((current) => {
      const sortedCurrent = sortCombatants(current.combatants);
      const currentId = sortedCurrent[current.turnIndex]?.id;
      const combatants = current.combatants.filter((item) => item.id !== id);
      const sortedNext = sortCombatants(combatants);
      const nextTurnIndex = currentId && currentId !== id
        ? Math.max(0, sortedNext.findIndex((item) => item.id === currentId))
        : Math.min(current.turnIndex, Math.max(0, combatants.length - 1));
      return { ...current, combatants, turnIndex: nextTurnIndex };
    });
  };

  const nextTurn = () => {
    updateInitiative((current) => {
      if (current.combatants.length === 0) return current;
      const nextIndex = current.turnIndex + 1;
      if (nextIndex >= current.combatants.length) {
        return { ...current, turnIndex: 0, round: current.round + 1 };
      }
      return { ...current, turnIndex: nextIndex };
    });
  };

  const clearCombat = () => {
    if (displayedInitiative.combatants.length === 0) return;
    if (!window.confirm("Clear the current combat order?")) return;
    updateInitiative(() => EMPTY_INITIATIVE);
  };

  const sortedCombatants = sortCombatants(displayedInitiative.combatants);
  const currentCombatantId = sortedCombatants[displayedInitiative.turnIndex]?.id;
  const isMyTurn = Boolean(props.currentUserId && currentCombatantId === `player:${props.currentUserId}`);

  return (
    <div className={`roll-drawer${open ? " open" : ""}`} style={rootStyle}>
      <button
        type="button"
        className={`roll-drawer-tab${props.rollMode !== "normal" ? " armed" : ""}`}
        onClick={() => { if (!dragMovedRef.current) setOpen(!open); }}
        onPointerDown={startMove}
        aria-expanded={open}
      >
        Dice{props.history.length > 0 ? ` (${props.history.length})` : ""}
        {props.rollMode !== "normal" ? <span className={`roll-tab-dot ${props.rollMode}`} title={`${props.rollMode} armed`} aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="roll-drawer-body" style={bodyStyle}>
          <div className="roll-drawer-titlebar" onPointerDown={startMove} title="Drag dice drawer">
            <span className="roll-drawer-heading">Dice Tray</span>
            <span className="roll-drawer-titlebar-tools">
              <GripHorizontal size={16} aria-hidden="true" />
              <button
                type="button"
                className="roll-drawer-close"
                aria-label="Close dice drawer"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setOpen(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </span>
          </div>

          <div className="roll-drawer-tabs" role="tablist" aria-label="Roll drawer tabs">
            <button type="button" role="tab" aria-selected={activeTab === "dice"} className={activeTab === "dice" ? "active" : ""} onClick={() => setActiveTab("dice")}>
              Dice
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "combat"} className={activeTab === "combat" ? "active" : ""} onClick={() => setActiveTab("combat")}>
              Combat
            </button>
          </div>

          {activeTab === "dice" ? (
            <>
              <div className="roll-pool">
                {/* Result strip: the latest roll from anywhere — tray or sheet. */}
                <div className="ao-dice-result" aria-live="polite">
                  {latest ? (
                    <>
                      <span className="ao-dice-result-total">{latest.total}</span>
                      <div className="ao-dice-result-line">
                        <span>{latest.label}</span>
                        {latest.adv ? (
                          <span aria-label={`d20 rolls ${latest.adv.dice.join(", ")}, kept ${latest.adv.dice[latest.adv.keptIndex]}`}>
                            {latest.adv.dice.map((d, i) => (
                              <span key={i} className={`roll-history-die${i === latest.adv!.keptIndex ? " kept" : " dropped"}`}>{d}</span>
                            ))}
                          </span>
                        ) : null}
                        {latest.pool ? (
                          <button type="button" className="ao-dice-reroll" onClick={() => rerollEntry(latest)}>
                            <RotateCcw size={11} aria-hidden="true" /> Reroll
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="ao-dice-result-empty">Ready — build a roll or tap a stat on your sheet.</p>
                  )}
                </div>

                <div className="ao-dice-dice" role="group" aria-label="Add dice">
                  {DIE_SIZES.map((sides) => (
                    <button type="button" className="ao-dice-die" key={sides} onClick={() => addDieToTicket(sides)} title={`Add a d${sides}`}>
                      d{sides}
                    </button>
                  ))}
                </div>

                {/* The roll ticket: chips, the d20's advantage state, and the
                    modifier — one visible source of truth for the next roll. */}
                <div className="ao-dice-ticket" aria-label="Roll ticket">
                  {ticket.groups.length === 0 ? (
                    <p className="ao-dice-ticket-empty">Tap dice to build a roll…</p>
                  ) : (
                    ticket.groups.map((group, index) => {
                      const isPlainD20 = group.sides === 20 && !group.keepHighest;
                      const modeLabel = ticket.d20Mode === "advantage" ? "adv" : ticket.d20Mode === "disadvantage" ? "dis" : null;
                      return (
                        <span className={`ao-dice-chip${isPlainD20 ? "" : " is-static"}`} key={`${group.sides}-${index}`}>
                          {isPlainD20 ? (
                            <button
                              type="button"
                              onClick={() => setTicket(cycleD20Mode(ticket))}
                              title="Advantage cycles: normal, advantage, disadvantage"
                              aria-label={`${group.count}d20, ${ticket.d20Mode} — change advantage`}
                            >
                              {group.count}d20{modeLabel ? <> · <span className="ao-dice-chip-mode">{modeLabel}</span></> : null}
                            </button>
                          ) : (
                            <button type="button" tabIndex={-1} aria-hidden="true" style={{ cursor: "default" }}>
                              {group.count}d{group.sides}{group.keepHighest ? `kh${group.keepHighest}` : ""}
                            </button>
                          )}
                          <button
                            type="button"
                            className="ao-dice-chip-x"
                            onClick={() => setTicket(removeGroup(ticket, index))}
                            aria-label={`Remove ${group.count}d${group.sides} from the roll`}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </span>
                      );
                    })
                  )}
                  <span className="ao-dice-mod">
                    <button type="button" onClick={() => setTicket(setTicketModifier(ticket, ticket.modifier - 1))} aria-label="Decrease modifier">−</button>
                    <strong aria-label={`Modifier ${signed(ticket.modifier)}`}>{signed(ticket.modifier)}</strong>
                    <button type="button" onClick={() => setTicket(setTicketModifier(ticket, ticket.modifier + 1))} aria-label="Increase modifier">+</button>
                  </span>
                </div>

                <div className="ao-dice-formula">
                  <input
                    type="text"
                    placeholder="Type a formula: 2d6+3, 4d6kh3…"
                    value={formulaInput}
                    onChange={(e) => { setFormulaInput(e.target.value); setFormulaError(""); }}
                    onKeyDown={handleFormulaKeyDown}
                    onBlur={() => { if (formulaInput.trim()) applyFormula(); }}
                    aria-label="Dice formula — replaces the roll ticket"
                  />
                </div>
                {formulaError ? <p className="ao-dice-error">{formulaError}</p> : null}

                <button type="button" className="ao-dice-roll" disabled={ticketDiceCount === 0} onClick={rollTicket}>
                  {ticketDiceCount > 0 ? `Roll ${ticketNotation}` : "Roll"}
                </button>
              </div>

              <div className="roll-history">
                <div className="roll-history-header">
                  <span className="roll-drawer-heading">History</span>
                  {props.history.length > 0 && props.onClearHistory ? (
                    <button type="button" className="ao-dice-reroll roll-clear-btn" onClick={props.onClearHistory} title="Clear all rolls">
                      Clear
                    </button>
                  ) : null}
                </div>
                {props.history.length === 0 ? (
                  <p className="roll-history-empty">No rolls yet — tap a stat on your sheet or build a roll above.</p>
                ) : (
                  <ul className="roll-history-list">
                    {props.history.map((entry) => (
                      <li key={entry.id} data-roll-cat={rollCategory(entry.label)}>
                        <div className="roll-history-top">
                          <span className="roll-history-label">
                            <span className="roll-cat-dot" aria-hidden="true" />
                            {entry.label}
                            {entry.adv ? <em className={`roll-history-badge ${entry.adv.mode}`}>{entry.adv.mode === "advantage" ? "ADV" : "DIS"}</em> : null}
                            {entry.nat ? <em className={`roll-history-badge nat ${entry.nat}`}>{entry.nat === "crit" ? "NAT 20" : "NAT 1"}</em> : null}
                          </span>
                          <strong className="roll-history-total">{entry.total}</strong>
                        </div>
                        {entry.adv ? (
                          <div className="roll-history-dice" aria-label={`d20 rolls ${entry.adv.dice.join(", ")}, kept ${entry.adv.dice[entry.adv.keptIndex]}`}>
                            {entry.adv.dice.map((d, i) => (
                              <span key={i} className={`roll-history-die${i === entry.adv!.keptIndex ? " kept" : " dropped"}`}>{d}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="roll-history-detail">
                          <span>{entry.detail}</span>
                          {entry.pool ? (
                            <button type="button" className="ao-dice-reroll" onClick={() => rerollEntry(entry)} aria-label={`Reroll ${entry.label}`}>
                              <RotateCcw size={11} aria-hidden="true" />
                            </button>
                          ) : null}
                          <time>{entry.time}</time>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="initiative-panel">
              {isSharedInitiative ? (
                <div className="initiative-shared-banner">
                  <strong>Campaign initiative</strong>
                  {isMyTurn ? <span>Your turn</span> : null}
                </div>
              ) : null}
              {canManageInitiative ? (
                <div className="initiative-add-row">
                  <input
                    type="text"
                    value={combatantName}
                    onChange={(event) => setCombatantName(event.currentTarget.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") submitCombatant(); }}
                    placeholder="Combatant"
                    maxLength={80}
                  />
                  <input
                    type="number"
                    value={combatantInitiative}
                    onChange={(event) => setCombatantInitiative(Number(event.currentTarget.value))}
                    onKeyDown={(event) => { if (event.key === "Enter") submitCombatant(); }}
                    aria-label="Initiative"
                  />
                  <button type="button" className="gold-button" onClick={submitCombatant} disabled={!combatantName.trim()}>
                    Add
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className="glass-button initiative-roll-current"
                onClick={addActiveCharacter}
                disabled={!props.activeCharacterName || props.activeCharacterInitiative == null}
              >
                Add {props.activeCharacterName ?? "current character"} (roll)
              </button>
              {canManageInitiative ? (
                <div className="initiative-controls">
                  <button type="button" className="gold-button" onClick={nextTurn} disabled={sortedCombatants.length === 0}>
                    Next turn
                  </button>
                  <strong>Round {displayedInitiative.round}</strong>
                  <button type="button" className="glass-button" onClick={clearCombat} disabled={sortedCombatants.length === 0}>
                    <Trash2 size={13} />
                    Clear combat
                  </button>
                </div>
              ) : (
                <div className="initiative-controls">
                  <strong>Round {displayedInitiative.round}</strong>
                </div>
              )}
              <div className="initiative-list">
                {sortedCombatants.length === 0 ? (
                  <p className="roll-history-empty">No combatants yet.</p>
                ) : (
                  sortedCombatants.map((combatant) => (
                    <div key={combatant.id} className={`initiative-row${combatant.id === currentCombatantId ? " active" : ""}`}>
                      <span>
                        <strong>{combatant.name}</strong>
                        {combatant.kind === "player" ? <em>PC</em> : null}
                      </span>
                      <b>{combatant.initiative}</b>
                      {canManageInitiative ? (
                        <button type="button" onClick={() => removeCombatant(combatant.id)} aria-label={`Remove ${combatant.name}`}>
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <button type="button" className="roll-drawer-resize" onPointerDown={startResize} aria-label="Resize dice drawer" title="Resize dice drawer">
            <GripHorizontal size={13} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
});
