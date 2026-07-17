"use client";

import { memo, useState } from "react";
import { Loader2, Swords, UserPlus } from "lucide-react";
import { FONT_STACKS } from "@/lib/skins";
import type { CharacterTheme } from "@/types/game";

type Props = {
  theme?: CharacterTheme | null;
  onStartBuilding: () => void;
  onRunCampaign: (name: string) => Promise<boolean>;
};

/* Art lives in public/Start/ — drop the files to light the cards; until then
   each card shows its seal-icon fallback. Same ink-wash as the builder cards. */
const CHOICES = [
  {
    key: "character" as const,
    art: "/Start/onboard-character.webp",
    Icon: UserPlus,
    name: "Create a character",
    desc: "Build a hero now — join a campaign whenever one calls.",
    go: "Begin the commission ⟶",
  },
  {
    key: "campaign" as const,
    art: "/Start/onboard-campaign.webp",
    Icon: Swords,
    name: "Run a campaign",
    desc: "Open a table and prepare as DM. No character required.",
    go: "Take the DM’s chair ⟶",
  },
];

export default memo(function OnboardingPanel({
  theme,
  onStartBuilding,
  onRunCampaign,
}: Props) {
  const [mode, setMode] = useState<"choose" | "run-campaign">("choose");
  const [campaignName, setCampaignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Cards start in the seal-fallback state; each flips to full art on load.
  const [loadedArt, setLoadedArt] = useState<Set<string>>(new Set());

  const handleRunCampaign = async () => {
    const name = campaignName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const ok = await onRunCampaign(name);
      if (!ok) setError("Campaign could not be created.");
    } catch {
      setError("Campaign could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const vars = theme ? ({
    "--paper": theme.paper,
    "--ink": theme.ink,
    "--ink-2": `color-mix(in srgb, ${theme.ink} 65%, ${theme.paper})`,
    "--ink-3": `color-mix(in srgb, ${theme.ink} 42%, ${theme.paper})`,
    "--doc-accent": theme.accent,
    "--doc-rule": `color-mix(in srgb, ${theme.ink} 32%, ${theme.paper})`,
    "--doc-rule-soft": `color-mix(in srgb, ${theme.ink} 16%, ${theme.paper})`,
    "--font-body": FONT_STACKS[theme.fontKey],
    "--font-display": FONT_STACKS[theme.fontKey],
    "--sheet-scale": `${theme.fontScale ?? 1}`,
  } as React.CSSProperties) : undefined;

  return (
    <section className="onboarding-panel ledger-page" style={vars}>
      <header className="ledger-page-header onboarding-masthead">
        <span className="ledger-eyebrow">The ledger opens</span>
        <h2>{mode === "choose" ? "What brings you to the table?" : "Name your campaign"}</h2>
      </header>

      {mode === "choose" ? (
        <div className="onboarding-choices">
          {CHOICES.map(({ key, art, Icon, name, desc, go }) => {
            const hasArt = loadedArt.has(key);
            return (
              <button
                key={key}
                type="button"
                className={`onboard-card${hasArt ? " has-art" : ""}`}
                onClick={key === "character" ? onStartBuilding : () => setMode("run-campaign")}
              >
                <span className="onboard-card-art" aria-hidden="true">
                  <img
                    src={art}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onLoad={() => setLoadedArt((s) => new Set(s).add(key))}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </span>
                <span className="onboard-card-scrim" aria-hidden="true" />
                <span className="onboard-card-seal" aria-hidden="true"><Icon size={26} strokeWidth={1.6} /></span>
                <span className="onboard-card-caption">
                  <span className="onboard-card-name">{name}</span>
                  <span className="onboard-card-desc">{desc}</span>
                  <span className="onboard-card-go">{go}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="onboarding-form">
          <label className="onboarding-field">
            <span>Campaign name</span>
            <input
              type="text"
              maxLength={60}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && campaignName.trim() && !busy) void handleRunCampaign(); }}
              placeholder="Shadows of Blackroot"
              autoFocus
            />
          </label>
          {error ? <p className="onboarding-error">{error}</p> : null}
          <p className="onboarding-footnote">† You&apos;ll get a join code to share with your players once the table opens.</p>
          <div className="onboarding-form-actions">
            <button type="button" className="ledger-button" onClick={() => { setMode("choose"); setError(""); }}>
              Back
            </button>
            <button
              type="button"
              className="ledger-button ledger-button-primary"
              onClick={handleRunCampaign}
              disabled={busy || !campaignName.trim()}
            >
              {busy ? <Loader2 size={16} className="spin" /> : "Open the table"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
});
