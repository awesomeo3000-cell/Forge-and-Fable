"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * Small focused confirmation dialog for campaign actions (leave, switch
 * character). Replaces window.confirm — the handoff (§27) bans browser
 * alerts on the workspace surface.
 */
export default function ConfirmDialog(props: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={props.onCancel}>
      <section
        className="ao-cw-sheet ao-cw-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ao-cw-confirm-title"
        aria-describedby="ao-cw-confirm-body"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="ao-cw-confirm-title">{props.title}</h2>
        <p id="ao-cw-confirm-body">{props.body}</p>
        <div className="ao-cw-sheet-actions">
          <button type="button" className="ao-cw-btn" onClick={props.onCancel} disabled={props.busy}>Cancel</button>
          <button
            type="button"
            className={`ao-cw-btn ${props.danger ? "ao-cw-btn-danger" : "ao-cw-btn-primary"}`}
            onClick={props.onConfirm}
            disabled={props.busy}
            autoFocus
          >
            {props.busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : null} {props.confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
