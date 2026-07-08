"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Users, Swords, Copy, Trash2, Loader2, Eye } from "lucide-react";
import type { CampaignDetail, CampaignSummary } from "@/lib/campaignStore";
import type { Character } from "@/types/game";

// ── Types ──

type PanelView = "list" | "create" | "join" | "detail";

type Props = {
  token: string;
  characters: Character[];
  onOpenSheet?: (character: Character) => void;
  onClose: () => void;
};

// ── Component ──

export default memo(function CampaignPanel({ token, characters, onOpenSheet, onClose }: Props) {
  const [view, setView] = useState<PanelView>("list");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    () => typeof window !== "undefined" ? localStorage.getItem("forge-and-fable-active-campaign") : null
  );
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinCharId, setJoinCharId] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  const triggerRef = useRef<HTMLElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Escape key ──

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        queueMicrotask(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      queueMicrotask(() => triggerRef.current?.focus());
    };
  }, [onClose]);

  // ── Auth header ──

  const authHeaders = useCallback((): Record<string, string> => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Load campaigns ──

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns", { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } catch { /* silent */ }
  }, [authHeaders]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // ── Poll detail ──

  useEffect(() => {
    if (!activeId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/campaigns/${activeId}`, { headers: authHeaders() });
        if (!res.ok) { setActiveId(null); return; }
        const data = await res.json();
        setDetail(data);
      } catch { /* silent */ }
    };
    poll(); // immediate first fetch
    pollRef.current = setInterval(poll, 5000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeId, authHeaders]);

  // ── Actions ──

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed."); return; }
      setCreatedCode(data.campaign.code);
      await loadCampaigns();
      setView("list");
    } catch { setError("Network error."); }
    setBusy(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinCharId) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/campaigns/join", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ code: joinCode.trim().toUpperCase(), characterId: joinCharId }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Failed."); setBusy(false); return; }
      await loadCampaigns();
      setView("list");
    } catch { setError("Network error."); }
    setBusy(false);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    localStorage.setItem("forge-and-fable-active-campaign", id);
    setView("detail");
  };

  const handleLeave = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${activeId}/members/me`, { method: "DELETE", headers: authHeaders() });
      setActiveId(null);
      localStorage.removeItem("forge-and-fable-active-campaign");
      setDetail(null);
      await loadCampaigns();
      setView("list");
    } catch { setError("Failed to leave."); }
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!activeId || !confirm("Delete this campaign? All members will be removed.")) return;
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${activeId}`, { method: "DELETE", headers: authHeaders() });
      setActiveId(null);
      localStorage.removeItem("forge-and-fable-active-campaign");
      setDetail(null);
      await loadCampaigns();
      setView("list");
    } catch { setError("Failed to delete."); }
    setBusy(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
  };

  // ── Render ──

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
      <section
        className="campaign-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="campaign-header">
          <h2 id="campaign-title"><Swords size={20} style={{ marginRight: 8 }} />Campaigns</h2>
          <button className="glass-icon modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {error && <div className="import-error-banner">{error}</div>}

        {/* ── List view ── */}
        {view === "list" && (
          <div className="campaign-body">
            <div className="campaign-actions-bar">
              <button className="dj-btn dj-btn-primary" onClick={() => { setNewName(""); setCreatedCode(""); setError(""); setView("create"); }}>
                <Plus size={16} /> New Campaign
              </button>
              <button className="glass-button" onClick={() => { setJoinCode(""); setJoinCharId(""); setError(""); setView("join"); }}>
                <Users size={16} /> Join
              </button>
            </div>

            {campaigns.length === 0 ? (
              <p className="cs-muted" style={{ textAlign: "center", padding: 24 }}>No campaigns yet — create one or join with a code.</p>
            ) : (
              <div className="campaign-list">
                {campaigns.map((c) => (
                  <button key={c.id} type="button" className="campaign-card" onClick={() => handleSelect(c.id)}>
                    <div className="campaign-card-main">
                      <strong>{c.name}</strong>
                      <small>{c.memberCount} member{c.memberCount !== 1 ? "s" : ""}</small>
                    </div>
                    <span className="campaign-code-badge">Code: {c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Create view ── */}
        {view === "create" && (
          <div className="campaign-body">
            {createdCode ? (
              <div className="campaign-created">
                <h3>Campaign Created!</h3>
                <p>Share this code with your players:</p>
                <div className="campaign-code-display">
                  <strong>{createdCode}</strong>
                  <button className="glass-button" onClick={() => copyCode(createdCode)}><Copy size={14} /> Copy</button>
                </div>
                <button className="dj-btn dj-btn-primary" onClick={() => { loadCampaigns(); setView("list"); }}>Done</button>
              </div>
            ) : (
              <div className="campaign-form">
                <label>
                  <span>Campaign Name</span>
                  <input
                    type="text" maxLength={60} placeholder="e.g. The Dragon's Curse"
                    value={newName} onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                  />
                </label>
                <div className="campaign-form-actions">
                  <button className="glass-button" onClick={() => setView("list")}>Cancel</button>
                  <button className="dj-btn dj-btn-primary" onClick={handleCreate} disabled={busy || !newName.trim()}>
                    {busy ? <Loader2 size={16} className="spin" /> : "Create"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Join view ── */}
        {view === "join" && (
          <div className="campaign-body">
            <div className="campaign-form">
              <label>
                <span>Join Code</span>
                <input
                  type="text" maxLength={6} placeholder="ABC123"
                  value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  autoFocus
                />
              </label>
              <label>
                <span>Your Character</span>
                <select value={joinCharId} onChange={(e) => setJoinCharId(e.target.value)}>
                  <option value="">— Select a character —</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} (Lvl {c.level} {c.classId})</option>
                  ))}
                </select>
              </label>
              <div className="campaign-form-actions">
                <button className="glass-button" onClick={() => setView("list")}>Cancel</button>
                <button className="dj-btn dj-btn-primary" onClick={handleJoin} disabled={busy || !joinCode.trim() || !joinCharId}>
                  {busy ? <Loader2 size={16} className="spin" /> : "Join"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Detail view ── */}
        {view === "detail" && detail && (
          <div className="campaign-body">
            {/* Campaign info bar */}
            <div className="campaign-info-bar">
              <div>
                <strong>{detail.name}</strong>
                <span className="campaign-code-badge">Code: {detail.code} <Copy size={12} style={{ cursor: "pointer" }} onClick={() => copyCode(detail.code)} /></span>
              </div>
              <div className="campaign-info-actions">
                <button className="glass-button" onClick={() => { setView("list"); setDetail(null); }}>← Back</button>
                {detail.dmUserId !== activeId ? (
                  <button className="danger-button" onClick={handleLeave} disabled={busy}>Leave</button>
                ) : (
                  <button className="danger-button" onClick={handleDelete} disabled={busy}><Trash2 size={14} /> Delete</button>
                )}
              </div>
            </div>

            <div className="campaign-detail-grid">
              {/* Members */}
              <div className="campaign-members">
                <h3><Users size={14} /> Members ({detail.members.length})</h3>
                {detail.members.map((m) => (
                  <div key={m.userId} className="campaign-member-row">
                    <div>
                      <strong>{m.userName}</strong>
                      {m.characterName && <small>{m.characterName} — {m.characterClass} Lvl {m.characterLevel}</small>}
                      {!m.characterId && <small className="cs-muted">No character selected</small>}
                    </div>
                    {m.characterId && m.characterJson && onOpenSheet && (
                      <button className="glass-button" onClick={() => onOpenSheet(m.characterJson!)}>
                        <Eye size={12} /> View Sheet
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Roll feed */}
              <div className="campaign-feed">
                <h3>Roll Feed</h3>
                {detail.rolls.length === 0 ? (
                  <p className="cs-muted">No rolls yet — rolls will appear here as players make them.</p>
                ) : (
                  <div className="campaign-roll-list">
                    {detail.rolls.map((r) => (
                      <div key={r.id} className="campaign-roll-row">
                        <div className="campaign-roll-top">
                          <strong>{r.character_name}</strong>
                          <span className="campaign-roll-total">{r.total >= 0 ? r.total : r.total}</span>
                        </div>
                        <small>{r.label}</small>
                        <small className="cs-muted">{r.detail.slice(0, 100)}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {busy && view === "detail" && (
          <div className="import-busy"><Loader2 size={16} className="spin" /><span>Loading…</span></div>
        )}
      </section>
    </div>,
    document.body,
  );
});
