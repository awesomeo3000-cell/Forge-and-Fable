"use client";

import { Download, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

export default function AccountDataModal(props: { onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      queueMicrotask(() => triggerRef.current?.focus());
    };
  }, [props]);

  async function exportData() {
    setStatus("Preparing export…");
    try {
      const response = await fetch("/api/auth/export");
      if (!response.ok) throw new Error("Export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? "dreamwright-account.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Account export downloaded.");
    } catch {
      setStatus("Could not export account data.");
    }
  }

  async function deleteAccount() {
    if (!password) {
      setStatus("Enter your password to confirm deletion.");
      return;
    }
    if (!window.confirm("Permanently delete your account, characters, campaigns, and uploaded data? This cannot be undone.")) return;

    setDeleting(true);
    setStatus("");
    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not delete account.");
        return;
      }
      props.onDeleted();
    } catch {
      setStatus("Network error — please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-scrim feedback-scrim" onClick={props.onClose}>
      <section
        ref={dialogRef}
        className="feedback-modal"
        data-bg="plain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-data-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button ref={closeButtonRef} type="button" className="glass-icon modal-close" onClick={props.onClose} aria-label="Close account settings">
          <X size={18} />
        </button>
        <header className="feedback-modal-hero">
          <span className="feedback-icon"><Download size={26} /></span>
          <div>
            <span className="feedback-eyebrow">Account</span>
            <h2 id="account-data-title">Your data</h2>
            <p>Export your records or permanently close the account.</p>
          </div>
        </header>
        <div className="feedback-modal-body">
          <div className="feedback-form">
            <p>Download a JSON copy of your account, characters, and personal campaign records.</p>
            <button type="button" className="ao-btn ao-btn-brass" onClick={() => void exportData()}>
              <Download size={16} /> Download my data
            </button>
            <hr />
            <h3>Delete account</h3>
            <p>This permanently removes your characters, owned campaigns, uploads, and account access.</p>
            <label className="control-field">
              <span>Confirm password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {status ? <p role="status">{status}</p> : null}
            <div className="feedback-actions">
              <button type="button" className="ao-btn ao-btn-quiet" onClick={props.onClose}>Cancel</button>
              <button type="button" className="ao-btn ao-btn-danger" disabled={deleting} onClick={() => void deleteAccount()}>
                <Trash2 size={16} /> {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
