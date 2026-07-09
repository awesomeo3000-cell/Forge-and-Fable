"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Copy, Eye, Loader2, Plus, Send, Sparkles, Swords, Trash2, Users, X } from "lucide-react";
import { FONT_STACKS } from "@/lib/skins";
import type { CampaignSummary } from "@/lib/campaignStore";
import { SKILLS } from "@/lib/srd";
import type { AbilityKey, Character, CharacterTheme } from "@/types/game";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";

type PanelView = "list" | "create" | "join" | "detail";

type Props = {
  characters: Character[];
  currentUserId?: string;
  activeCampaignId: string | null;
  campaignSync: CampaignSyncPayload | null;
  campaignEvents: CampaignEvent[];
  resolvedEventIds: Set<string>;
  onActiveCampaignChange: (campaignId: string | null) => void;
  onPostEvent: (type: CampaignEvent["type"], payload: Record<string, unknown>, targetUserId?: string | null) => Promise<boolean>;
  onRespondRollRequest: (event: CampaignEvent) => void;
  onAcceptRest: (type: CampaignEvent["type"], eventId?: string) => void;
  onResolveEvent: (eventId: string) => void;
  onOpenSheet?: (character: Character) => void;
  onClose: () => void;
  theme?: CharacterTheme | null;
};

const ABILITY_OPTIONS: { key: AbilityKey; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "dexterity", label: "Dexterity" },
  { key: "constitution", label: "Constitution" },
  { key: "intelligence", label: "Intelligence" },
  { key: "wisdom", label: "Wisdom" },
  { key: "charisma", label: "Charisma" },
];

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

function eventPayload(event: CampaignEvent): Record<string, unknown> {
  try {
    const parsed = JSON.parse(event.payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function eventTitle(event: CampaignEvent) {
  const payload = eventPayload(event);
  if (event.type === "roll-request") return typeof payload.prompt === "string" ? payload.prompt : "Roll requested";
  if (event.type === "rest-short") return "Short rest called";
  if (event.type === "rest-long") return "Long rest called";
  if (event.type === "announce") return typeof payload.message === "string" ? payload.message : "Campaign announcement";
  if (event.type === "condition-apply") return `Condition applied: ${typeof payload.label === "string" ? payload.label : "Effect"}`;
  if (event.type === "condition-remove") return `Condition removed: ${typeof payload.label === "string" ? payload.label : "Effect"}`;
  return "Campaign event";
}

export default memo(function CampaignPanel({
  characters,
  currentUserId,
  activeCampaignId,
  campaignSync,
  campaignEvents,
  resolvedEventIds,
  onActiveCampaignChange,
  onPostEvent,
  onRespondRollRequest,
  onAcceptRest,
  onResolveEvent,
  onOpenSheet,
  onClose,
  theme,
}: Props) {
  const [view, setView] = useState<PanelView>(activeCampaignId ? "detail" : "list");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(activeCampaignId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinCharId, setJoinCharId] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [rollPrompt, setRollPrompt] = useState("Initiative");
  const [rollKind, setRollKind] = useState<"initiative" | "save" | "check" | "skill">("initiative");
  const [rollKey, setRollKey] = useState("dexterity");
  const [rollDc, setRollDc] = useState("");
  const [conditionLabel, setConditionLabel] = useState("Poisoned");
  const [conditionTarget, setConditionTarget] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);

  const detail = activeId && campaignSync?.campaign.id === activeId ? campaignSync : null;
  const isDm = Boolean(detail && currentUserId && detail.campaign.dmUserId === currentUserId);
  // Same paper-surface technique as the sheet/feedback modal: paint the
  // chosen background texture over the themed paper so the panel matches.
  const backgroundKey = theme?.backgroundImageUrl ? "custom" : theme?.backgroundKey ?? "parchment";
  const visibleEvents = useMemo(
    () => campaignEvents
      .filter((event) =>
        !resolvedEventIds.has(event.id) &&
        (event.type === "roll-request" || event.type === "rest-short" || event.type === "rest-long" || event.type === "announce"),
      )
      .slice()
      .reverse(),
    [campaignEvents, resolvedEventIds],
  );

  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch("/api/campaigns", { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json() as { campaigns?: CampaignSummary[] };
      setCampaigns(data.campaigns ?? []);
    } catch {
      // Campaigns refresh on the next panel open.
    }
  }, []);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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

  useEffect(() => {
    setActiveId(activeCampaignId);
    if (activeCampaignId) setView("detail");
  }, [activeCampaignId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await response.json() as { campaign?: { id: string; code: string }; error?: string };
      if (!response.ok || !data.campaign) {
        setError(data.error ?? "Campaign could not be created.");
        return;
      }
      setCreatedCode(data.campaign.code);
      setActiveId(data.campaign.id);
      onActiveCampaignChange(data.campaign.id);
      await loadCampaigns();
    } catch {
      setError("Campaign could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinCharId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/campaigns/join", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ code: joinCode.trim().toUpperCase(), characterId: joinCharId }),
      });
      const data = await response.json().catch(() => ({})) as { campaign?: { id: string }; error?: string };
      if (!response.ok || !data.campaign) {
        setError(data.error ?? "Campaign could not be joined.");
        return;
      }
      setActiveId(data.campaign.id);
      onActiveCampaignChange(data.campaign.id);
      setView("detail");
      await loadCampaigns();
    } catch {
      setError("Campaign could not be joined.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    onActiveCampaignChange(id);
    setView("detail");
  };

  const handleLeave = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${activeId}/members/me`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        setError("Campaign could not be left.");
        return;
      }
      setActiveId(null);
      onActiveCampaignChange(null);
      setView("list");
      await loadCampaigns();
    } catch {
      setError("Campaign could not be left.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!activeId || !window.confirm("Delete this campaign for everyone?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${activeId}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        setError("Campaign could not be deleted.");
        return;
      }
      setActiveId(null);
      onActiveCampaignChange(null);
      setView("list");
      await loadCampaigns();
    } catch {
      setError("Campaign could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
  };

  const sendAnnouncement = async () => {
    const message = announcement.trim();
    if (!message) return;
    if (await onPostEvent("announce", { message })) setAnnouncement("");
  };

  const sendRollRequest = async () => {
    const prompt = rollPrompt.trim();
    if (!prompt) return;
    const dc = rollDc.trim() ? Number(rollDc) : undefined;
    const key = rollKind === "initiative" ? "dexterity" : rollKey;
    const payload: Record<string, unknown> = { prompt, kind: rollKind, key };
    if (Number.isFinite(dc)) payload.dc = dc;
    await onPostEvent("roll-request", payload);
  };

  const sendRest = async (type: "rest-short" | "rest-long") => {
    await onPostEvent(type, {});
  };

  const sendCondition = async (type: "condition-apply" | "condition-remove") => {
    const label = conditionLabel.trim();
    if (!label || !conditionTarget) return;
    await onPostEvent(type, { label }, conditionTarget);
  };

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
      <section
        className="campaign-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-title"
        onMouseDown={(event) => event.stopPropagation()}
        data-bg={backgroundKey}
        style={theme ? ({
          // Full paper-surface token set — mirrors HeroSheet/FeedbackModal so
          // the panel inherits the active character's skin (paper, ink, accent,
          // fonts, scale, background texture) instead of a fixed dark chrome.
          "--paper": theme.paper,
          "--paper-raised": `color-mix(in srgb, ${theme.paper} 94%, #000)`,
          "--ink": theme.ink,
          "--ink-2": `color-mix(in srgb, ${theme.ink} 65%, ${theme.paper})`,
          "--ink-3": `color-mix(in srgb, ${theme.ink} 42%, ${theme.paper})`,
          "--doc-accent": theme.accent,
          "--doc-accent-deep": `color-mix(in srgb, ${theme.accent} 78%, #000)`,
          "--doc-rule": `color-mix(in srgb, ${theme.ink} 32%, ${theme.paper})`,
          "--doc-rule-soft": `color-mix(in srgb, ${theme.ink} 16%, ${theme.paper})`,
          "--font-body": FONT_STACKS[theme.fontKey],
          "--font-display": FONT_STACKS[theme.fontKey],
          "--sheet-scale": `${theme.fontScale ?? 1}`,
          "--bg-opacity": `${theme.backgroundOpacity ?? 0.5}`,
          ...(theme.backgroundImageUrl ? { "--skin-bg-image": `url("${theme.backgroundImageUrl.replace(/["\\)]/g, "")}")` } : {}),
          // Legacy bridge vars retained so any older selectors still resolve.
          "--accent": theme.accent,
          "--ground": theme.paper,
          "--ground-2": `color-mix(in srgb, ${theme.paper} 94%, #000)`,
          "--parchment": theme.ink,
          "--muted": `color-mix(in srgb, ${theme.ink} 55%, ${theme.paper})`,
          "--rule": `color-mix(in srgb, ${theme.ink} 32%, ${theme.paper})`,
          "--rule-soft": `color-mix(in srgb, ${theme.ink} 16%, ${theme.paper})`,
          "--campaign-accent": theme.accent,
          "--campaign-ink": theme.ink,
          "--campaign-paper": theme.paper,
        } as React.CSSProperties) : undefined}
      >
        <div className="campaign-header">
          <h2 id="campaign-title"><Swords size={20} /> Campaigns</h2>
          <button className="glass-icon modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {error ? <div className="import-error-banner">{error}</div> : null}

        {view === "list" ? (
          <div className="campaign-body">
            <div className="campaign-actions-bar">
              <button className="dj-btn dj-btn-primary" type="button" onClick={() => { setNewName(""); setCreatedCode(""); setError(""); setView("create"); }}>
                <Plus size={16} /> New Campaign
              </button>
              <button className="glass-button" type="button" onClick={() => { setJoinCode(""); setJoinCharId(""); setError(""); setView("join"); }}>
                <Users size={16} /> Join
              </button>
            </div>
            {campaigns.length === 0 ? (
              <p className="cs-muted campaign-empty">No campaigns yet. Create one or join with a code.</p>
            ) : (
              <div className="campaign-list">
                {campaigns.map((campaign) => (
                  <button key={campaign.id} type="button" className="campaign-card" onClick={() => handleSelect(campaign.id)}>
                    <div className="campaign-card-main">
                      <strong>{campaign.name}</strong>
                      <small>{campaign.memberCount} member{campaign.memberCount === 1 ? "" : "s"}</small>
                    </div>
                    <span className="campaign-code-badge">Code: {campaign.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {view === "create" ? (
          <div className="campaign-body">
            {createdCode ? (
              <div className="campaign-created">
                <h3>Campaign created</h3>
                <p>Share this code with your players.</p>
                <div className="campaign-code-display">
                  <strong>{createdCode}</strong>
                  <button className="glass-button" type="button" onClick={() => copyCode(createdCode)}><Copy size={14} /> Copy</button>
                </div>
                <button className="dj-btn dj-btn-primary" type="button" onClick={() => setView("detail")}>Open Campaign</button>
              </div>
            ) : (
              <div className="campaign-form">
                <label>
                  <span>Campaign Name</span>
                  <input type="text" maxLength={60} value={newName} onChange={(event) => setNewName(event.currentTarget.value)} autoFocus />
                </label>
                <div className="campaign-form-actions">
                  <button className="glass-button" type="button" onClick={() => setView("list")}>Cancel</button>
                  <button className="dj-btn dj-btn-primary" type="button" onClick={handleCreate} disabled={busy || !newName.trim()}>
                    {busy ? <Loader2 size={16} className="spin" /> : "Create"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {view === "join" ? (
          <div className="campaign-body">
            <div className="campaign-form">
              <label>
                <span>Join Code</span>
                <input type="text" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.currentTarget.value.toUpperCase())} autoFocus />
              </label>
              <label>
                <span>Your Character</span>
                <select value={joinCharId} onChange={(event) => setJoinCharId(event.currentTarget.value)}>
                  <option value="">Select a character</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>{character.name} (Level {character.level} {character.classId})</option>
                  ))}
                </select>
                {characters.length === 0 ? <p className="cs-muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>You have no characters yet. Create one first from the Vault.</p> : null}
              </label>
              <div className="campaign-form-actions">
                <button className="glass-button" type="button" onClick={() => setView("list")}>Cancel</button>
                <button className="dj-btn dj-btn-primary" type="button" onClick={handleJoin} disabled={busy || !joinCode.trim() || !joinCharId}>
                  {busy ? <Loader2 size={16} className="spin" /> : "Join"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {view === "detail" ? (
          <div className="campaign-body">
            <div className="campaign-info-bar">
              <div>
                <strong>{detail?.campaign.name ?? "Loading campaign..."}</strong>
                {detail ? (
                  <button className="campaign-code-badge campaign-code-button" type="button" onClick={() => copyCode(detail.campaign.code)}>
                    Code: {detail.campaign.code} <Copy size={12} />
                  </button>
                ) : null}
              </div>
              <div className="campaign-info-actions">
                <button className="glass-button" type="button" onClick={() => setView("list")}>Back</button>
                {detail && !isDm && characters.length > 1 ? (
                  <select
                    className="glass-button"
                    style={{ padding: "4px 8px" }}
                    disabled={busy}
                    onChange={async (e) => {
                      if (!e.target.value || !activeId) return;
                      if (!window.confirm(`Switch to ${characters.find((c) => c.id === e.target.value)?.name ?? "this character"}?`)) { e.target.value = ""; return; }
                      setBusy(true);
                      try {
                        const response = await fetch(`/api/campaigns/${activeId}/members/me`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ characterId: e.target.value }) });
                        if (!response.ok) { setError("Could not switch character."); return; }
                        onActiveCampaignChange(activeId);
                        setError(null);
                      } catch { setError("Could not switch character."); } finally { setBusy(false); }
                      e.target.value = "";
                    }}
                    aria-label="Switch enrolled character"
                  >
                    <option value="">Switch character…</option>
                    {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : null}
                {detail && (isDm ? (
                  <button className="danger-button" type="button" onClick={handleDelete} disabled={busy}><Trash2 size={14} /> Delete</button>
                ) : (
                  <button className="danger-button" type="button" onClick={handleLeave} disabled={busy}>Leave</button>
                ))}
              </div>
            </div>

            {detail ? (
              <>
                <div className="campaign-party-strip">
                  {detail.members.map((member) => (
                    <div key={member.userId} className="campaign-party-card">
                      <strong>{member.characterName ?? member.userName}</strong>
                      <small>{member.characterClass ? `Level ${member.characterLevel} ${member.characterClass}` : "No character selected"}</small>
                      <div className="campaign-party-stats">
                        <span>HP {member.currentHp ?? "-"} / {member.maxHp ?? "-"}</span>
                        <span>AC {member.ac ?? "-"}</span>
                        <span>PP {member.passivePerception ?? "-"}</span>
                      </div>
                      {member.characterJson && onOpenSheet ? (
                        <button className="glass-button" type="button" onClick={() => onOpenSheet(member.characterJson!)}>
                          <Eye size={12} /> Sheet
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                {visibleEvents.length > 0 ? (
                  <div className="campaign-events">
                    <h3><Bell size={14} /> Pending</h3>
                    {visibleEvents.map((event) => (
                      <div key={event.id} className="campaign-event-card">
                        <strong>{eventTitle(event)}</strong>
                        <small>{new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                        <div className="campaign-event-actions">
                          {event.type === "roll-request" ? (
                            <button className="dj-btn dj-btn-primary" type="button" onClick={() => onRespondRollRequest(event)}>Roll</button>
                          ) : null}
                          {event.type === "rest-short" || event.type === "rest-long" ? (
                            <button className="dj-btn dj-btn-primary" type="button" onClick={() => onAcceptRest(event.type, event.id)}>Apply</button>
                          ) : null}
                          <button className="glass-button" type="button" onClick={() => onResolveEvent(event.id)}>Dismiss</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isDm ? (
                  <div className="campaign-dm-tools">
                    <h3><Sparkles size={14} /> DM Tools</h3>
                    <div className="campaign-tool-row">
                      <input type="text" value={announcement} onChange={(event) => setAnnouncement(event.currentTarget.value)} placeholder="Send a table announcement" />
                      <button className="gold-button" type="button" onClick={sendAnnouncement}><Send size={13} /> Send</button>
                    </div>
                    <div className="campaign-tool-grid">
                      <label>
                        <span>Roll Prompt</span>
                        <input type="text" value={rollPrompt} onChange={(event) => setRollPrompt(event.currentTarget.value)} />
                      </label>
                      <label>
                        <span>Type</span>
                        <select value={rollKind} onChange={(event) => {
                          const next = event.currentTarget.value as typeof rollKind;
                          setRollKind(next);
                          setRollKey(next === "skill" ? SKILLS[0]?.id ?? "acrobatics" : "dexterity");
                        }}>
                          <option value="initiative">Initiative</option>
                          <option value="save">Saving Throw</option>
                          <option value="check">Ability Check</option>
                          <option value="skill">Skill Check</option>
                        </select>
                      </label>
                      {rollKind !== "initiative" ? (
                        <label>
                          <span>{rollKind === "skill" ? "Skill" : "Ability"}</span>
                          <select value={rollKey} onChange={(event) => setRollKey(event.currentTarget.value)}>
                            {rollKind === "skill"
                              ? SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)
                              : ABILITY_OPTIONS.map((ability) => <option key={ability.key} value={ability.key}>{ability.label}</option>)}
                          </select>
                        </label>
                      ) : null}
                      <label>
                        <span>DC</span>
                        <input type="number" min={1} max={40} value={rollDc} onChange={(event) => setRollDc(event.currentTarget.value)} placeholder="Optional" />
                      </label>
                    </div>
                    <button className="dj-btn dj-btn-primary" type="button" onClick={sendRollRequest}>Request Roll</button>
                    <div className="campaign-tool-row">
                      <button className="glass-button" type="button" onClick={() => sendRest("rest-short")}>Call Short Rest</button>
                      <button className="glass-button" type="button" onClick={() => sendRest("rest-long")}>Call Long Rest</button>
                    </div>
                    <div className="campaign-tool-grid">
                      <label>
                        <span>Condition</span>
                        <input type="text" value={conditionLabel} onChange={(event) => setConditionLabel(event.currentTarget.value)} />
                      </label>
                      <label>
                        <span>Target</span>
                        <select value={conditionTarget} onChange={(event) => setConditionTarget(event.currentTarget.value)}>
                          <option value="">Select player</option>
                          {detail.members.map((member) => (
                            <option key={member.userId} value={member.userId}>{member.characterName ?? member.userName}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="campaign-tool-row">
                      <button className="glass-button" type="button" onClick={() => sendCondition("condition-apply")} disabled={!conditionTarget || !conditionLabel.trim()}>Apply Condition</button>
                      <button className="glass-button" type="button" onClick={() => sendCondition("condition-remove")} disabled={!conditionTarget || !conditionLabel.trim()}>Remove Condition</button>
                    </div>
                  </div>
                ) : null}

                <div className="campaign-detail-grid">
                  <div className="campaign-members">
                    <h3><Users size={14} /> Members ({detail.members.length})</h3>
                    {detail.members.map((member) => (
                      <div key={member.userId} className="campaign-member-row">
                        <div>
                          <strong>{member.userName}</strong>
                          <small>{member.characterName ? `${member.characterName} - ${member.characterClass} Level ${member.characterLevel}` : "No character selected"}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="campaign-feed">
                    <h3>Roll Feed</h3>
                    {detail.rolls.length === 0 ? (
                      <p className="cs-muted">No rolls yet.</p>
                    ) : (
                      <div className="campaign-roll-list">
                        {detail.rolls.slice().reverse().map((roll) => (
                          <div key={roll.id} className="campaign-roll-row">
                            <div className="campaign-roll-top">
                              <strong>{roll.character_name}</strong>
                              <span className="campaign-roll-total">{roll.total}</span>
                            </div>
                            <small>{roll.label}</small>
                            <small className="cs-muted">{roll.detail.slice(0, 120)}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="import-busy"><Loader2 size={16} className="spin" /><span>Loading campaign...</span></div>
            )}
          </div>
        ) : null}

        {busy ? <div className="import-busy"><Loader2 size={16} className="spin" /><span>Working...</span></div> : null}
      </section>
    </div>,
    document.body,
  );
});
