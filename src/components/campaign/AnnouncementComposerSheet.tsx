"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Send } from "lucide-react";

/**
 * Focused announcement/briefing composer (handoff §16.3): the composer left
 * the campaign Overview and became a sheet the DM opens on demand. Publishing
 * posts a normal "announce" campaign event — the newest one becomes the
 * Campaign Briefing, so no new content system is invented.
 */
export default function AnnouncementComposerSheet(props: {
  campaignName: string;
  onSubmit: (message: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    const ok = await props.onSubmit(trimmed);
    setBusy(false);
    if (ok) props.onClose();
    else setError("The briefing could not be published. Try again.");
  };

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={props.onClose}>
      <section
        className="ao-cw-sheet ao-cw-composer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ao-cw-composer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="ao-dash-eyebrow">{props.campaignName}</span>
        <h2 id="ao-cw-composer-title">Write a Briefing</h2>
        <p className="ao-cw-sheet-hint">
          Give the party a clear starting point. The newest announcement appears as the Campaign Briefing
          and notifies every player at the table.
        </p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
          rows={5}
          maxLength={2000}
          placeholder="Where we left off, what the party should do next…"
          aria-label="Briefing message"
          autoFocus
        />
        {error ? <p className="ao-cw-sheet-error" role="alert">{error}</p> : null}
        <div className="ao-cw-sheet-actions">
          <button type="button" className="ao-cw-btn" onClick={props.onClose} disabled={busy}>Cancel</button>
          <button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => void publish()} disabled={busy || !message.trim()}>
            {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />} Publish
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
