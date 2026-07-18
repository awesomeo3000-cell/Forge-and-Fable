"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Loader2, Plus, Swords, Users, X } from "lucide-react";
import { FONT_STACKS } from "@/lib/skins";
import { CAMPAIGN_THEMES, getCampaignTheme } from "@/lib/campaignThemes";
import type { CampaignSummary } from "@/lib/campaignStore";
import type { Character, CharacterTheme } from "@/types/game";

type PanelView = "list" | "create" | "join";

type Props = {
  characters: Character[];
  activeCampaignId: string | null;
  /** Selecting, creating or joining a campaign hands the id to the app shell,
      which closes this picker and opens the campaign workspace page. */
  onActiveCampaignChange: (campaignId: string | null) => void;
  onCreateCharacter?: () => void;
  onClose: () => void;
  /** "modal" = scrim + portal (legacy); "page" = inline full-stage surface. */
  presentation?: "modal" | "page";
  theme?: CharacterTheme | null;
};

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

/**
 * Compact campaign picker (campaign workspace handoff §2.1, phase 8): the
 * full campaign experience moved to the CampaignWorkspacePage route surface.
 * This modal only lists campaigns and hosts the focused create/join flows.
 */
export default memo(function CampaignPanel({
  characters,
  activeCampaignId,
  onActiveCampaignChange,
  onCreateCharacter,
  onClose,
  theme,
  presentation = "modal",
}: Props) {
  const [view, setView] = useState<PanelView>("list");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newThemeKey, setNewThemeKey] = useState("forge");
  const [joinCode, setJoinCode] = useState("");
  const [joinCharId, setJoinCharId] = useState("");
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState("");
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Same paper-surface technique as the sheet/feedback modal: paint the
  // chosen background texture over the themed paper so the panel matches.
  const backgroundKey = theme?.backgroundImageUrl ? "custom" : theme?.backgroundKey ?? "parchment";

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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

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
        body: JSON.stringify({ name: newName.trim(), themeKey: newThemeKey }),
      });
      const data = await response.json() as { campaign?: { id: string; code: string }; error?: string };
      if (!response.ok || !data.campaign) {
        setError(data.error ?? "Campaign could not be created.");
        return;
      }
      // Hold the code screen open — the workspace opens on "Open Campaign".
      setCreated({ id: data.campaign.id, code: data.campaign.code });
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
      onActiveCampaignChange(data.campaign.id);
    } catch {
      setError("Campaign could not be joined.");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedCode(code);
        window.setTimeout(() => setCopiedCode((current) => (current === code ? "" : current)), 1600);
      })
      .catch(() => setError("Could not copy the code — copy it by hand."));
  };

  const panelSurface = (
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
              <button className="dj-btn" type="button" onClick={() => { setNewName(""); setCreated(null); setError(""); setView("create"); }}>
                <Plus size={16} /> New Campaign
              </button>
              <button className="dj-btn" type="button" onClick={() => { setJoinCode(""); setJoinCharId(""); setError(""); setView("join"); }}>
                <Users size={16} /> Join a Campaign
              </button>
            </div>
            {campaigns.length === 0 ? (
              <div className="ao-dash-empty campaign-empty">
                <strong>No campaigns in the ledger</strong>
                <p>Create a campaign to run as DM, or join a table with a code from your Dungeon Master.</p>
              </div>
            ) : (
              <div className="campaign-list">
                {(() => {
                  // Dashboard hierarchy (AO-5): the current campaign gets the
                  // dominant treatment + the resume action; everything else
                  // stays a supporting card. Falls back to the first campaign
                  // when none is active. Same select handler for all.
                  const featured = campaigns.find((c) => c.id === activeCampaignId) ?? campaigns[0];
                  const running = campaigns.filter((c) => c.myRole === "dm" && c.id !== featured.id);
                  const playing = campaigns.filter((c) => c.myRole === "player" && c.id !== featured.id);
                  const featuredMeta = featured.myRole === "dm"
                    ? `You run this table · ${featured.memberCount} member${featured.memberCount === 1 ? "" : "s"}`
                    : `${featured.myCharacterName ? `Playing as ${featured.myCharacterName}` : "Player"} · ${featured.memberCount} member${featured.memberCount === 1 ? "" : "s"}`;
                  return (
                    <>
                      <section
                        className="ao-dash-feature"
                        aria-labelledby="ao-dash-feature-name"
                        data-campaign-theme={featured.themeKey}
                        style={{ "--campaign-feature-art": `url("${(featured.bannerImageUrl || getCampaignTheme(featured.themeKey).imageUrl).replace(/["\\)]/g, "")}")` } as CSSProperties}
                      >
                        <div className="ao-dash-feature-main">
                          <span className="ao-dash-eyebrow">{featured.id === activeCampaignId ? "Current campaign" : "Most recent campaign"}</span>
                          <h3 id="ao-dash-feature-name">{featured.name}</h3>
                          <p className="ao-dash-feature-meta">
                            <span className="ao-dash-role-chip" data-role={featured.myRole}>{featured.myRole === "dm" ? "DM" : "Player"}</span>
                            {featuredMeta}
                          </p>
                        </div>
                        <div className="ao-dash-feature-art" aria-hidden="true" />
                        <div className="ao-dash-feature-actions">
                          <button className="dj-btn dj-btn-primary ao-dash-resume" type="button" onClick={() => onActiveCampaignChange(featured.id)}>
                            Open campaign
                          </button>
                          <span className="campaign-code-badge">Code: {featured.code}</span>
                        </div>
                      </section>
                      {running.length > 0 ? (
                        <div className="campaign-group">
                          <h4 className="campaign-group-heading">CAMPAIGNS I RUN</h4>
                          {running.map((campaign) => (
                            <button key={campaign.id} type="button" className="campaign-card" onClick={() => onActiveCampaignChange(campaign.id)}>
                              <div className="campaign-card-main">
                                <strong>{campaign.name}</strong>
                                <small>DM · {campaign.memberCount} member{campaign.memberCount === 1 ? "" : "s"}</small>
                              </div>
                              <span className="campaign-code-badge">Code: {campaign.code}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {playing.length > 0 ? (
                        <div className="campaign-group">
                          <h4 className="campaign-group-heading">CAMPAIGNS I PLAY IN</h4>
                          {playing.map((campaign) => (
                            <button key={campaign.id} type="button" className="campaign-card" onClick={() => onActiveCampaignChange(campaign.id)}>
                              <div className="campaign-card-main">
                                <strong>{campaign.name}</strong>
                                <small>{campaign.myCharacterName ? `Playing as ${campaign.myCharacterName}` : "Player"} · {campaign.memberCount} member{campaign.memberCount === 1 ? "" : "s"}</small>
                              </div>
                              <span className="campaign-code-badge">Code: {campaign.code}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ) : null}

        {view === "create" ? (
          <div className="campaign-body">
            {created ? (
              <div className="campaign-created">
                <h3>Campaign created</h3>
                <p>Share this code with your players.</p>
                <div className="campaign-code-display">
                  <strong>{created.code}</strong>
                  <button className={`glass-button${copiedCode === created.code ? " is-copied" : ""}`} type="button" onClick={() => copyCode(created.code)}>{copiedCode === created.code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
                </div>
                <button className="dj-btn dj-btn-primary" type="button" onClick={() => onActiveCampaignChange(created.id)}>Open Campaign</button>
              </div>
            ) : (
              <div className="campaign-form">
                <label>
                  <span>Campaign Name</span>
                  <input type="text" maxLength={60} value={newName} onChange={(event) => setNewName(event.currentTarget.value)} autoFocus />
                </label>
                <fieldset className="campaign-theme-picker">
                  <legend>Select your campaign theme</legend>
                  <p className="campaign-theme-helper">Choose the atmosphere for your table. You can change it later in campaign settings.</p>
                  <div className="campaign-theme-options">
                    {CAMPAIGN_THEMES.map((campaignTheme) => (
                      <label className={`campaign-theme-option${newThemeKey === campaignTheme.id ? " is-selected" : ""}`} key={campaignTheme.id}>
                        <input
                          type="radio"
                          name="campaign-theme"
                          value={campaignTheme.id}
                          checked={newThemeKey === campaignTheme.id}
                          onChange={() => setNewThemeKey(campaignTheme.id)}
                        />
                        <span className="campaign-theme-image" style={{ backgroundImage: `url(${campaignTheme.imageUrl})` }} aria-hidden="true" />
                        <span className="campaign-theme-copy">
                          <strong>{campaignTheme.label}</strong>
                          <small>{campaignTheme.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
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
                {characters.length === 0 ? (
                  <div className="campaign-no-characters">
                    <p className="cs-muted">You need a character to join this campaign.</p>
                    {onCreateCharacter ? (
                      <button type="button" className="dj-btn dj-btn-primary" onClick={onCreateCharacter}>
                        <Plus size={14} /> Create a Character
                      </button>
                    ) : null}
                  </div>
                ) : null}
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

        {busy ? <div className="import-busy"><Loader2 size={16} className="spin" /><span>Working...</span></div> : null}
      </section>
  );
  if (presentation === "page") {
    return <div className="campaign-page">{panelSurface}</div>;
  }
  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={onClose}>{panelSurface}</div>,
    document.body,
  );
});
