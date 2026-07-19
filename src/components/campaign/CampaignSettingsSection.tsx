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
  campaign: { id: string; name: string; code: string; themeKey: CampaignThemeId; bannerImageUrl?: string | null; playerDmViewEnabled: boolean; playerDmViewInitiative: boolean; playerDmViewParty: boolean; playerDmViewRolls: boolean };
  busy: boolean;
  copiedCode: string;
  onCopyCode: (code: string) => void;
  onSaveAppearance: (themeKey: string, bannerImageUrl: string) => Promise<boolean>;
  onSavePlayerView: (input: Record<string, boolean>) => Promise<boolean>;
  onDeleteCampaign: () => Promise<boolean>;
}) {
  const [themeKey, setThemeKey] = useState<string>(props.campaign.themeKey);
  const [imageUrl, setImageUrl] = useState(props.campaign.bannerImageUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [playerView, setPlayerView] = useState({ enabled: props.campaign.playerDmViewEnabled, initiative: props.campaign.playerDmViewInitiative, party: props.campaign.playerDmViewParty, rolls: props.campaign.playerDmViewRolls });
  const [playerViewSaved, setPlayerViewSaved] = useState(false);

  const saveAppearance = async () => {
    setSaved(false);
    setSaveError(false);
    const ok = await props.onSaveAppearance(themeKey, imageUrl.trim());
    if (ok) setSaved(true);
    else setSaveError(true);
  };

  const deleteMatches = deleteName.trim() === props.campaign.name;
  const savePlayerView = async () => {
    setPlayerViewSaved(false);
    if (await props.onSavePlayerView({ playerDmViewEnabled: playerView.enabled, playerDmViewInitiative: playerView.initiative, playerDmViewParty: playerView.party, playerDmViewRolls: playerView.rolls })) setPlayerViewSaved(true);
  };

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

      <section className="ao-cw-panel" aria-labelledby="ao-cw-player-view-title">
        <div className="ao-cw-panel-head"><span className="ao-dash-eyebrow">DM controls</span><h3 id="ao-cw-player-view-title">Shared table view</h3></div>
        <p className="ao-cw-settings-hint">Let players open a read-only window into the table. Private DM notes and controls stay hidden.</p>
        <label className="ao-cw-check-row"><input type="checkbox" checked={playerView.enabled} onChange={(e) => setPlayerView((v) => ({ ...v, enabled: e.target.checked }))} /> Allow players to open the shared table view</label>
        <label className="ao-cw-check-row"><input type="checkbox" checked={playerView.initiative} onChange={(e) => setPlayerView((v) => ({ ...v, initiative: e.target.checked }))} disabled={!playerView.enabled} /> Show shared initiative</label>
        <label className="ao-cw-check-row"><input type="checkbox" checked={playerView.party} onChange={(e) => setPlayerView((v) => ({ ...v, party: e.target.checked }))} disabled={!playerView.enabled} /> Show party status</label>
        <label className="ao-cw-check-row"><input type="checkbox" checked={playerView.rolls} onChange={(e) => setPlayerView((v) => ({ ...v, rolls: e.target.checked }))} disabled={!playerView.enabled} /> Show public roll feed</label>
        <div className="ao-cw-settings-actions"><button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => void savePlayerView()} disabled={props.busy}>Save table view</button><span className="ao-cw-save-note" aria-live="polite">{playerViewSaved ? "Table view saved" : ""}</span></div>
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
