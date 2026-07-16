"use client";

import { useState } from "react";
import { Check, Copy, Loader2, ShieldAlert } from "lucide-react";
import { CAMPAIGN_THEMES } from "@/lib/campaignThemes";
import type { CampaignThemeId } from "@/types/campaign";

/**
 * DM-only campaign Settings (handoff §4.10, §16): Appearance and the invite
 * code moved here from the old campaign modal, and Delete moved into a Danger
 * Zone that requires typing the campaign name. Business logic is unchanged —
 * the same PATCH/DELETE endpoints the modal used, invoked by the page wrapper.
 */
export default function CampaignSettingsSection(props: {
  campaign: { id: string; name: string; code: string; themeKey: CampaignThemeId; bannerImageUrl?: string | null };
  busy: boolean;
  copiedCode: string;
  onCopyCode: (code: string) => void;
  onSaveAppearance: (themeKey: string, bannerImageUrl: string) => Promise<boolean>;
  onDeleteCampaign: () => Promise<boolean>;
}) {
  const [themeKey, setThemeKey] = useState<string>(props.campaign.themeKey);
  const [imageUrl, setImageUrl] = useState(props.campaign.bannerImageUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteName, setDeleteName] = useState("");

  const saveAppearance = async () => {
    setSaved(false);
    setSaveError(false);
    const ok = await props.onSaveAppearance(themeKey, imageUrl.trim());
    if (ok) setSaved(true);
    else setSaveError(true);
  };

  const deleteMatches = deleteName.trim() === props.campaign.name;

  return (
    <div className="ao-cw-settings">
      <section className="ao-cw-panel" aria-labelledby="ao-cw-appearance-title">
        <div className="ao-cw-panel-head">
          <span className="ao-dash-eyebrow">Settings</span>
          <h3 id="ao-cw-appearance-title">Appearance</h3>
        </div>
        <p className="ao-cw-settings-hint">The artwork sets the campaign’s identity — it fills the workspace header, the dashboard and the campaign list.</p>
        <div className="ao-cw-theme-options" role="radiogroup" aria-label="Campaign artwork preset">
          {CAMPAIGN_THEMES.map((theme) => (
            <label className={`ao-cw-theme-option${themeKey === theme.id ? " is-selected" : ""}`} key={theme.id}>
              <input
                type="radio"
                name="ao-cw-appearance-theme"
                value={theme.id}
                checked={themeKey === theme.id}
                onChange={() => setThemeKey(theme.id)}
              />
              <span className="ao-cw-theme-image" style={{ backgroundImage: `url(${theme.imageUrl})` }} aria-hidden="true" />
              <span className="ao-cw-theme-copy">
                <strong>{theme.label}</strong>
                <small>{theme.description}</small>
              </span>
            </label>
          ))}
        </div>
        <label className="ao-cw-field">
          <span>Custom image URL (optional)</span>
          <input
            value={imageUrl}
            onChange={(event) => { setImageUrl(event.currentTarget.value); setSaved(false); }}
            placeholder="https://… or /your-image.jpg"
          />
        </label>
        <div className="ao-cw-settings-actions">
          <button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => void saveAppearance()} disabled={props.busy}>
            {props.busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : null} Save appearance
          </button>
          <span aria-live="polite" className={`ao-cw-save-note${saveError ? " is-error" : ""}`}>
            {saved ? "Appearance saved" : saveError ? "Appearance could not be saved" : ""}
          </span>
        </div>
      </section>

      <section className="ao-cw-panel" aria-labelledby="ao-cw-invite-title">
        <div className="ao-cw-panel-head">
          <span className="ao-dash-eyebrow">Settings</span>
          <h3 id="ao-cw-invite-title">Invitations</h3>
        </div>
        <p className="ao-cw-settings-hint">Players join with this campaign code from the Table screen’s “Join a Campaign” action.</p>
        <div className="ao-cw-invite-row">
          <strong className="ao-cw-invite-code">{props.campaign.code}</strong>
          <button type="button" className="ao-cw-btn" onClick={() => props.onCopyCode(props.campaign.code)}>
            {props.copiedCode === props.campaign.code ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy code</>}
          </button>
        </div>
      </section>

      <section className="ao-cw-panel ao-cw-danger-zone" aria-labelledby="ao-cw-danger-title">
        <div className="ao-cw-panel-head">
          <span className="ao-dash-eyebrow">Settings</span>
          <h3 id="ao-cw-danger-title"><ShieldAlert size={15} aria-hidden="true" /> Danger Zone</h3>
        </div>
        <p className="ao-cw-settings-hint">
          Deleting the campaign removes it for every member — the party, its journal, sessions and table history. This cannot be undone.
        </p>
        {deleteArmed ? (
          <div className="ao-cw-danger-confirm">
            <label className="ao-cw-field">
              <span>Type <strong>{props.campaign.name}</strong> to confirm</span>
              <input
                value={deleteName}
                onChange={(event) => setDeleteName(event.currentTarget.value)}
                autoFocus
                aria-label={`Type ${props.campaign.name} to confirm deletion`}
              />
            </label>
            <div className="ao-cw-settings-actions">
              <button type="button" className="ao-cw-btn" onClick={() => { setDeleteArmed(false); setDeleteName(""); }} disabled={props.busy}>Cancel</button>
              <button
                type="button"
                className="ao-cw-btn ao-cw-btn-danger"
                onClick={() => void props.onDeleteCampaign()}
                disabled={props.busy || !deleteMatches}
              >
                {props.busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : null} Delete this campaign
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="ao-cw-btn ao-cw-btn-danger" onClick={() => setDeleteArmed(true)}>Delete campaign…</button>
        )}
      </section>
    </div>
  );
}
