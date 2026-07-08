"use client";

import { GripHorizontal, Trash2, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { signed } from "@/lib/utils";
import { FONT_STACKS } from "@/lib/skins";
import type { CharacterTheme, RollMode } from "@/types/game";

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
};

type DrawerLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RollPoolOutcome = { rolls: number[]; modifier: number; total: number };

type InitiativeCombatant = {
  id: string;
  name: string;
  initiative: number;
  isPlayer?: boolean;
};

type InitiativeState = {
  combatants: InitiativeCombatant[];
  turnIndex: number;
  round: number;
};

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
      .map((item) => ({
        id: item.id,
        name: item.name.slice(0, 80),
        initiative: Math.max(-99, Math.min(99, Math.trunc(item.initiative))),
        ...(item.isPlayer ? { isPlayer: true } : {}),
      }));
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
 * Right-edge drawer: an ad-hoc dice pool builder on top, a log of every roll
 * made this session (sheet clicks included) underneath.
 */
const ROLL_MODES: { id: RollMode; label: string; title: string }[] = [
  { id: "disadvantage", label: "Dis", title: "Disadvantage: next d20 rolls twice, keeps the lower" },
  { id: "normal", label: "Normal", title: "Normal: next d20 rolls once" },
  { id: "advantage", label: "Adv", title: "Advantage: next d20 rolls twice, keeps the higher" },
];

export default memo(function RollDrawer(props: {
  history: RollHistoryEntry[];
  theme?: CharacterTheme | null;
  rollMode: RollMode;
  rollModeIsFromEffect?: boolean;
  activeCharacterName?: string;
  activeCharacterInitiative?: number;
  onRollModeChange: (mode: RollMode) => void;
  onRollPool: (
    groups: { sides: number; count: number }[],
    modifier: number,
    label: string,
    onResult?: (outcome: RollPoolOutcome) => void,
  ) => void;
  onClearHistory?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dice" | "combat">("dice");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [modifier, setModifier] = useState(0);
  const [layout, setLayout] = useState<DrawerLayout>(FALLBACK_LAYOUT);
  const [initiativeState, setInitiativeState] = useState<InitiativeState>(EMPTY_INITIATIVE);
  const [combatantName, setCombatantName] = useState("");
  const [combatantInitiative, setCombatantInitiative] = useState(0);
  const layoutRef = useRef(layout);

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

  const bump = (sides: number, delta: number) =>
    setCounts((prev) => {
      const next = { ...prev, [sides]: Math.max(0, Math.min(20, (prev[sides] ?? 0) + delta)) };
      if (next[sides] === 0) delete next[sides];
      return next;
    });

  const groups = DIE_SIZES.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({ sides: s, count: counts[s] }));
  const notation =
    groups.map((g) => `${g.count}d${g.sides}`).join(" + ") + (modifier !== 0 ? ` ${signed(modifier)}` : "");

  const drawerVars = useMemo(() => {
    const theme = props.theme;
    const paper = theme?.paper ?? "#15110d";
    const ink = theme?.ink ?? "#e8dcc2";
    const accent = theme?.accent ?? "#c9a25a";
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

  const startMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

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
        x: origin.x + moveEvent.clientX - startX,
        y: origin.y + moveEvent.clientY - startY,
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

  const rollPool = () => {
    if (groups.length === 0) return;
    props.onRollPool(groups, modifier, notation);
  };

  const updateInitiative = (updater: (current: InitiativeState) => InitiativeState) => {
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
          ...(isPlayer ? { isPlayer: true } : {}),
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
      (outcome) => addCombatant(name, outcome.total, true),
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
    if (initiativeState.combatants.length === 0) return;
    if (!window.confirm("Clear the current combat order?")) return;
    updateInitiative(() => EMPTY_INITIATIVE);
  };

  const sortedCombatants = sortCombatants(initiativeState.combatants);
  const currentCombatantId = sortedCombatants[initiativeState.turnIndex]?.id;

  return (
    <div className={`roll-drawer${open ? " open" : ""}`} style={rootStyle}>
      <button type="button" className={`roll-drawer-tab${props.rollMode !== "normal" ? " armed" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        Dice{props.history.length > 0 ? ` (${props.history.length})` : ""}
        {props.rollMode !== "normal" ? <span className={`roll-tab-dot ${props.rollMode}`} title={`${props.rollMode} armed`} aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="roll-drawer-body" style={bodyStyle}>
          <div className="roll-drawer-titlebar" onPointerDown={startMove} title="Drag dice drawer">
            <span className="roll-drawer-heading">Dice & Combat</span>
            <GripHorizontal size={16} aria-hidden="true" />
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
                <div className="roll-pool-grid">
                  {DIE_SIZES.map((sides) => {
                    const n = counts[sides] ?? 0;
                    return (
                      <div className={`roll-pool-die${n > 0 ? " has-dice" : ""}`} key={sides}>
                        <button type="button" className="roll-pool-add" onClick={() => bump(sides, 1)} title={`Add a d${sides}`}>
                          d{sides}
                          {n > 0 ? <em>{n}</em> : null}
                        </button>
                        {n > 0 ? (
                          <button type="button" className="roll-pool-minus" onClick={() => bump(sides, -1)} aria-label={`Remove a d${sides}`}>
                            -
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="roll-mode" role="group" aria-label="d20 roll mode">
                  {ROLL_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`roll-mode-btn${props.rollMode === m.id ? " active" : ""}${m.id !== "normal" ? ` ${m.id}` : ""}`}
                      aria-pressed={props.rollMode === m.id}
                      title={m.title}
                      onClick={() => props.onRollModeChange(m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {props.rollMode !== "normal" ? (
                  <p className="roll-mode-hint">
                    Next d20 roll uses <strong>{props.rollMode}</strong>.
                    {props.rollModeIsFromEffect ? " (from effects)" : ""}
                  </p>
                ) : null}
                <div className="roll-pool-mod">
                  <span>Modifier</span>
                  <button type="button" onClick={() => setModifier((m) => Math.max(-20, m - 1))}>-</button>
                  <strong>{signed(modifier)}</strong>
                  <button type="button" onClick={() => setModifier((m) => Math.min(20, m + 1))}>+</button>
                </div>
                <div className="roll-pool-actions">
                  <button type="button" className="gold-button roll-pool-roll" disabled={groups.length === 0} onClick={rollPool}>
                    Roll {groups.length > 0 ? notation : "dice"}
                  </button>
                  {groups.length > 0 || modifier !== 0 ? (
                    <button type="button" className="glass-button" onClick={() => { setCounts({}); setModifier(0); }}>
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="roll-history">
                <div className="roll-history-header">
                  <span className="roll-drawer-heading">History</span>
                  {props.history.length > 0 && props.onClearHistory ? (
                    <button type="button" className="glass-button roll-clear-btn" onClick={props.onClearHistory} title="Clear all rolls">
                      Clear
                    </button>
                  ) : null}
                </div>
                {props.history.length === 0 ? (
                  <p className="roll-history-empty">No rolls yet - click a stat on the sheet or build a pool above.</p>
                ) : (
                  <ul className="roll-history-list">
                    {props.history.map((entry) => (
                      <li key={entry.id}>
                        <div className="roll-history-top">
                          <span className="roll-history-label">
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
              <button
                type="button"
                className="glass-button initiative-roll-current"
                onClick={addActiveCharacter}
                disabled={!props.activeCharacterName || props.activeCharacterInitiative == null}
              >
                Add {props.activeCharacterName ?? "current character"} (roll)
              </button>
              <div className="initiative-controls">
                <button type="button" className="gold-button" onClick={nextTurn} disabled={sortedCombatants.length === 0}>
                  Next turn
                </button>
                <strong>Round {initiativeState.round}</strong>
                <button type="button" className="glass-button" onClick={clearCombat} disabled={sortedCombatants.length === 0}>
                  <Trash2 size={13} />
                  Clear combat
                </button>
              </div>
              <div className="initiative-list">
                {sortedCombatants.length === 0 ? (
                  <p className="roll-history-empty">No combatants yet.</p>
                ) : (
                  sortedCombatants.map((combatant) => (
                    <div key={combatant.id} className={`initiative-row${combatant.id === currentCombatantId ? " active" : ""}`}>
                      <span>
                        <strong>{combatant.name}</strong>
                        {combatant.isPlayer ? <em>PC</em> : null}
                      </span>
                      <b>{combatant.initiative}</b>
                      <button type="button" onClick={() => removeCombatant(combatant.id)} aria-label={`Remove ${combatant.name}`}>
                        <X size={14} />
                      </button>
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
