"use client";

import { GripHorizontal } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { signed } from "@/lib/utils";
import { FONT_STACKS } from "@/lib/skins";
import type { CharacterTheme } from "@/types/game";

export type RollHistoryEntry = {
  id: string;
  label: string;
  detail: string;
  total: number;
  time: string;
};

type DrawerLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100];
const LAYOUT_STORAGE_KEY = "forge-and-fable-roll-drawer-layout";
const TAB_WIDTH = 34;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 320;
const FALLBACK_LAYOUT: DrawerLayout = { x: 902, y: 112, width: 300, height: 520 };

function defaultLayout(): DrawerLayout {
  if (typeof window === "undefined") return FALLBACK_LAYOUT;

  const width = Math.min(320, Math.max(MIN_WIDTH, window.innerWidth - TAB_WIDTH - 24));
  const height = Math.min(560, Math.max(MIN_HEIGHT, window.innerHeight - 32));
  return {
    x: Math.max(8, window.innerWidth - width - TAB_WIDTH),
    y: Math.max(16, Math.round((window.innerHeight - height) / 2)),
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

/**
 * Right-edge drawer: an ad-hoc dice pool builder on top, a log of every roll
 * made this session (sheet clicks included) underneath.
 */
export default memo(function RollDrawer(props: {
  history: RollHistoryEntry[];
  theme?: CharacterTheme | null;
  onRollPool: (groups: { sides: number; count: number }[], modifier: number, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [modifier, setModifier] = useState(0);
  const [layout, setLayout] = useState<DrawerLayout>(FALLBACK_LAYOUT);
  const layoutRef = useRef(layout);

  useEffect(() => {
    const loaded = loadLayout();
    layoutRef.current = loaded;
    setLayout(loaded);
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

  return (
    <div className={`roll-drawer${open ? " open" : ""}`} style={rootStyle}>
      <button type="button" className="roll-drawer-tab" onClick={() => setOpen(!open)} aria-expanded={open}>
        Dice{props.history.length > 0 ? ` (${props.history.length})` : ""}
      </button>
      {open ? (
        <div className="roll-drawer-body" style={bodyStyle}>
          <div className="roll-drawer-titlebar" onPointerDown={startMove} title="Drag dice drawer">
            <span className="roll-drawer-heading">Roll dice</span>
            <GripHorizontal size={16} aria-hidden="true" />
          </div>

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
            <span className="roll-drawer-heading">History</span>
            {props.history.length === 0 ? (
              <p className="roll-history-empty">No rolls yet - click a stat on the sheet or build a pool above.</p>
            ) : (
              <ul className="roll-history-list">
                {props.history.map((entry) => (
                  <li key={entry.id}>
                    <div className="roll-history-top">
                      <span className="roll-history-label">{entry.label}</span>
                      <strong className="roll-history-total">{entry.total}</strong>
                    </div>
                    <div className="roll-history-detail">
                      <span>{entry.detail}</span>
                      <time>{entry.time}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="roll-drawer-resize" onPointerDown={startResize} aria-label="Resize dice drawer" title="Resize dice drawer">
            <GripHorizontal size={13} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
});
