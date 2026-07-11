"use client";

import { memo, useState } from "react";
import { Loader2, Plus, Swords } from "lucide-react";
import { FONT_STACKS } from "@/lib/skins";
import type { CharacterTheme } from "@/types/game";

type Props = {
  theme?: CharacterTheme | null;
  onStartBuilding: () => void;
  onRunCampaign: (name: string) => Promise<boolean>;
};

export default memo(function OnboardingPanel({
  theme,
  onStartBuilding,
  onRunCampaign,
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
    <section className="onboarding-panel ledger-page" style={vars}>
      <header className="ledger-page-header onboarding-masthead">
        <span className="ledger-eyebrow">The ledger opens</span>
        <h2>{mode === "choose" ? "What brings you to the table?" : "Name your campaign"}</h2>
      </header>

      {mode === "choose" ? (
        <div className="onboarding-choices">
          <button type="button" className="onboarding-choice" onClick={onStartBuilding}>
            <span className="onboarding-choice-seal" aria-hidden="true"><Plus size={24} strokeWidth={1.6} /></span>
            <span className="onboarding-choice-name">Create a character</span>
            <span className="onboarding-choice-desc">Build a hero now — join a campaign whenever one calls.</span>
            <span className="onboarding-choice-go">Begin the commission ⟶</span>
          </button>
          <button type="button" className="onboarding-choice" onClick={() => setMode("run-campaign")}>
            <span className="onboarding-choice-seal" aria-hidden="true"><Swords size={24} strokeWidth={1.6} /></span>
            <span className="onboarding-choice-name">Run a campaign</span>
            <span className="onboarding-choice-desc">Open a table and prepare as DM. No character required.</span>
            <span className="onboarding-choice-go">Take the DM&apos;s chair ⟶</span>
          </button>
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
