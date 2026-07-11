"use client";

import { memo, useState } from "react";
import { Loader2, Plus, Swords, Users } from "lucide-react";
import { FONT_STACKS } from "@/lib/skins";
import type { CharacterTheme } from "@/types/game";

type Props = {
  theme?: CharacterTheme | null;
  onStartBuilding: () => void;
  onRunCampaign: (name: string) => Promise<boolean>;
  onJoinCampaign: () => void;
  onGoToLedger: () => void;
};

export default memo(function OnboardingPanel({
  theme,
  onStartBuilding,
  onRunCampaign,
  onJoinCampaign,
  onGoToLedger,
}: Props) {
  const [mode, setMode] = useState<"choose" | "run-campaign">("choose");
  const [campaignName, setCampaignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    <section className="onboarding-panel" style={vars}>
      <div className="onboarding-masthead">
        <span className="onboarding-eyebrow">FORGE &amp; FABLE</span>
        <h2>What brings you to the table?</h2>
      </div>

      {mode === "choose" ? (
        <div className="onboarding-choices">
          <button type="button" className="onboarding-choice" onClick={onStartBuilding}>
            <span className="onboarding-choice-icon"><Plus size={20} /></span>
            <span className="onboarding-choice-text">
              <strong>Create a Character</strong>
              <small>Build a character now. You can join a campaign later.</small>
            </span>
          </button>
          <button type="button" className="onboarding-choice" onClick={() => setMode("run-campaign")}>
            <span className="onboarding-choice-icon"><Swords size={20} /></span>
            <span className="onboarding-choice-text">
              <strong>Run a Campaign</strong>
              <small>Create a campaign and begin preparing as DM. No character required.</small>
            </span>
          </button>
          <button type="button" className="onboarding-choice" onClick={onJoinCampaign}>
            <span className="onboarding-choice-icon"><Users size={20} /></span>
            <span className="onboarding-choice-text">
              <strong>Join a Campaign</strong>
              <small>Enter a campaign code and choose a character.</small>
            </span>
          </button>
          <button type="button" className="onboarding-choice onboarding-choice-secondary" onClick={onGoToLedger}>
            <span className="onboarding-choice-text">
              <strong>Go to My Ledger</strong>
              <small>View existing characters and campaigns.</small>
            </span>
          </button>
        </div>
      ) : (
        <div className="onboarding-form">
          <label>
            <span>Campaign name</span>
            <input
              type="text"
              maxLength={60}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Shadows of Blackroot"
              autoFocus
            />
          </label>
          {error ? <p className="onboarding-error">{error}</p> : null}
          <div className="onboarding-form-actions">
            <button type="button" className="glass-button" onClick={() => { setMode("choose"); setError(""); }}>
              Back
            </button>
            <button
              type="button"
              className="dj-btn dj-btn-primary"
              onClick={handleRunCampaign}
              disabled={busy || !campaignName.trim()}
            >
              {busy ? <Loader2 size={16} className="spin" /> : "Create Campaign"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
});
