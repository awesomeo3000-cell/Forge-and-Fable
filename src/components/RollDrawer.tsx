"use client";

import { memo, useState } from "react";
import { signed } from "@/lib/utils";

export type RollHistoryEntry = {
  id: string;
  label: string;
  detail: string;
  total: number;
  time: string;
};

const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100];

/**
 * Right-edge drawer: an ad-hoc dice pool builder on top, a log of every roll
 * made this session (sheet clicks included) underneath.
 */
export default memo(function RollDrawer(props: {
  history: RollHistoryEntry[];
  onRollPool: (groups: { sides: number; count: number }[], modifier: number, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [modifier, setModifier] = useState(0);

  const bump = (sides: number, delta: number) =>
    setCounts((prev) => {
      const next = { ...prev, [sides]: Math.max(0, Math.min(20, (prev[sides] ?? 0) + delta)) };
      if (next[sides] === 0) delete next[sides];
      return next;
    });

  const groups = DIE_SIZES.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({ sides: s, count: counts[s] }));
  const notation =
    groups.map((g) => `${g.count}d${g.sides}`).join(" + ") + (modifier !== 0 ? ` ${signed(modifier)}` : "");

  const rollPool = () => {
    if (groups.length === 0) return;
    props.onRollPool(groups, modifier, notation);
  };

  return (
    <div className={`roll-drawer${open ? " open" : ""}`}>
      <button type="button" className="roll-drawer-tab" onClick={() => setOpen(!open)} aria-expanded={open}>
        Dice{props.history.length > 0 ? ` (${props.history.length})` : ""}
      </button>
      {open ? (
        <div className="roll-drawer-body">
          <div className="roll-pool">
            <span className="roll-drawer-heading">Roll dice</span>
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
                        −
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="roll-pool-mod">
              <span>Modifier</span>
              <button type="button" onClick={() => setModifier((m) => Math.max(-20, m - 1))}>−</button>
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
              <p className="roll-history-empty">No rolls yet — click a stat on the sheet or build a pool above.</p>
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
        </div>
      ) : null}
    </div>
  );
});
