"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Inbox, KeyRound, LayoutList, Loader2, Plus, Trash2, X } from "lucide-react";
import type { FeedbackEntry } from "@/types/game";
import type { AdminOverview, InviteCode } from "@/lib/adminStore";

type Tab = "feedback" | "invites" | "overview";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed.");
  return res.json() as Promise<T>;
}

export default memo(function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("feedback");
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      if (tab === "feedback") setFeedback((await getJson<{ feedback: FeedbackEntry[] }>("/api/admin/feedback")).feedback);
      else if (tab === "invites") setInvites((await getJson<{ invites: InviteCode[] }>("/api/admin/invites")).invites);
      else setOverview(await getJson<AdminOverview>("/api/admin/overview"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const createInvite = async () => {
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};
      if (newLabel.trim()) body.label = newLabel.trim();
      if (newMaxUses.trim()) body.maxUses = Number(newMaxUses);
      const res = await fetch("/api/admin/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not create code.");
      const { invite } = (await res.json()) as { invite: InviteCode };
      setInvites((current) => [invite, ...current]);
      setNewLabel("");
      setNewMaxUses("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create code.");
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (code: string) => {
    try {
      await fetch(`/api/admin/invites/${encodeURIComponent(code)}`, { method: "DELETE" });
      setInvites((current) => current.map((i) => (i.code === code ? { ...i, revoked: true } : i)));
    } catch {
      setError("Could not revoke code.");
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      window.setTimeout(() => setCopied((c) => (c === text ? "" : c)), 1600);
    }).catch(() => setError("Could not copy."));
  };

  return createPortal(
    <div className="modal-scrim admin-scrim" role="presentation" onMouseDown={onClose}>
      <section className="admin-panel ledger-page" role="dialog" aria-modal="true" aria-label="Admin console" onMouseDown={(e) => e.stopPropagation()}>
        <header className="admin-head">
          <div>
            <span className="ledger-eyebrow">Steward&apos;s console</span>
            <h2>Administration</h2>
          </div>
          <button type="button" className="admin-close" onClick={onClose} aria-label="Close admin console"><X size={18} /></button>
        </header>

        <nav className="admin-tabs" role="tablist">
          {([["feedback", "Feedback", Inbox], ["invites", "Invite codes", KeyRound], ["overview", "Overview", LayoutList]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>

        {error ? <p className="admin-error">{error}</p> : null}

        <div className="admin-body">
          {tab === "feedback" ? (
            feedback.length === 0 ? <p className="admin-empty">No feedback yet.</p> : (
              <div className="admin-feedback-list">
                {feedback.map((f) => (
                  <article key={f.id} className="admin-feedback-item">
                    <div className="admin-feedback-top">
                      <strong>{f.title}</strong>
                      <span className={`admin-chip admin-chip-${f.priority}`}>{f.priority}</span>
                      <span className="admin-chip">{f.category}</span>
                    </div>
                    <p className="admin-feedback-details">{f.details}</p>
                    <div className="admin-feedback-meta">
                      {f.userName} · {f.userEmail} · {f.area}
                      {f.characterName ? ` · ${f.characterName}` : ""} · {new Date(f.createdAt).toLocaleString()}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : null}

          {tab === "invites" ? (
            <div className="admin-invites">
              <div className="admin-invite-form">
                <input placeholder="Label (optional)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={80} />
                <input placeholder="Max uses (blank = unlimited)" type="number" min="1" value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} />
                <button type="button" className="ledger-button ledger-button-primary" onClick={() => void createInvite()} disabled={busy}>
                  {busy ? <Loader2 size={15} className="spin" /> : <><Plus size={15} /> Create code</>}
                </button>
              </div>
              <p className="admin-note">Share a code so a friend can register. Registration stays open while at least one live code exists (or the env code is set).</p>
              {invites.length === 0 ? <p className="admin-empty">No invite codes yet.</p> : (
                <ul className="admin-invite-list">
                  {invites.map((i) => (
                    <li key={i.code} className={i.revoked ? "is-revoked" : ""}>
                      <button type="button" className={`admin-code${copied === i.code ? " is-copied" : ""}`} onClick={() => copy(i.code)} title="Copy code">
                        {i.code} {copied === i.code ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                      <span className="admin-invite-meta">
                        {i.label ? `${i.label} · ` : ""}{i.uses}{i.maxUses !== null ? `/${i.maxUses}` : ""} used
                        {i.revoked ? " · revoked" : i.maxUses !== null && i.uses >= i.maxUses ? " · exhausted" : ""}
                      </span>
                      {!i.revoked ? (
                        <button type="button" className="admin-icon-btn" onClick={() => void revokeInvite(i.code)} aria-label={`Revoke ${i.code}`}><Trash2 size={14} /></button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === "overview" && overview ? (
            <div className="admin-overview">
              <div className="admin-totals">
                {([["Users", overview.totals.users], ["Characters", overview.totals.characters], ["Campaigns", overview.totals.campaigns], ["Feedback", overview.totals.feedback]] as const).map(([label, n]) => (
                  <div key={label} className="admin-total"><b>{n}</b><span>{label}</span></div>
                ))}
              </div>
              <h3>Users</h3>
              <ul className="admin-rows">
                {overview.users.map((u) => (
                  <li key={u.id}>
                    <strong>{u.name}{u.isAdmin ? <em className="admin-tag">admin</em> : null}</strong>
                    <span>{u.email} · {u.characterCount} character{u.characterCount === 1 ? "" : "s"} · {new Date(u.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
              <h3>Campaigns</h3>
              <ul className="admin-rows">
                {overview.campaigns.length === 0 ? <li><span>No campaigns yet.</span></li> : overview.campaigns.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name} <span className="admin-code-inline">{c.code}</span></strong>
                    <span>DM {c.dmName} · {c.memberCount} member{c.memberCount === 1 ? "" : "s"} · {new Date(c.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
});
