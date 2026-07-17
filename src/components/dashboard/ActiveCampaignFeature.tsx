import type { CSSProperties } from "react";
import { KeyRound, Plus } from "lucide-react";
import type { CampaignSummary } from "@/lib/campaignStore";
import { getCampaignTheme } from "@/lib/campaignThemes";
import { resolveDashboardCampaignArtwork } from "@/data/dashboardArtwork";

export type CampaignFeatureMeta = { label: string; value: string };

/**
 * Active campaign feature (dashboard handoff §7). When a campaign exists it is
 * the third hierarchy level: name, artwork, role, meta pills and one primary
 * open action. With no campaign it collapses to a small useful empty state —
 * absence never dominates the page.
 */
export default function ActiveCampaignFeature(props: {
  campaign: CampaignSummary | null;
  loading: boolean;
  isActive: boolean;
  meta: CampaignFeatureMeta[];
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onStartCampaign: () => void;
  onJoinCampaign: () => void;
}) {
  if (props.loading) {
    return (
      <article className="ao-hd-feature is-loading" aria-busy="true">
        <div className="ao-hd-feature-copy">
          <span className="ao-dash-eyebrow">Active campaign</span>
          <h2 className="ao-hd-feature-quiet">Opening the tome…</h2>
        </div>
      </article>
    );
  }

  if (!props.campaign) {
    return (
      <article className="ao-hd-feature ao-hd-feature-empty">
        <div className="ao-hd-feature-copy">
          <span className="ao-dash-eyebrow">Your first table</span>
          <h2>The road is open</h2>
          <p>Start a campaign to run as Dungeon Master, or join one with a code from your DM.</p>
          <div className="ao-hd-feature-actions">
            <button className="ao-hd-btn ao-hd-btn-primary" type="button" onClick={props.onStartCampaign}>
              <Plus size={16} aria-hidden="true" /> Start a Campaign
            </button>
            <button className="ao-hd-btn" type="button" onClick={props.onJoinCampaign}>
              <KeyRound size={16} aria-hidden="true" /> Join with a Code
            </button>
          </div>
        </div>
      </article>
    );
  }

  const theme = getCampaignTheme(props.campaign.themeKey);
  const art = resolveDashboardCampaignArtwork(props.campaign).replace(/["\\)]/g, "");

  return (
    <article
      className="ao-hd-feature"
      data-campaign-theme={theme.id}
      style={{ "--campaign-art": `url("${art}")` } as CSSProperties}
    >
      <div className="ao-hd-feature-copy">
        <span className="ao-dash-eyebrow">{props.isActive ? "Active campaign" : "Most recent campaign"}</span>
        <h2>{props.campaign.name}</h2>
        <p className="ao-hd-feature-role">
          <span className="ao-dash-role-chip" data-role={props.campaign.myRole}>
            {props.campaign.myRole === "dm" ? "Dungeon Master" : "Player"}
          </span>
          <span>{props.campaign.memberCount} member{props.campaign.memberCount === 1 ? "" : "s"}</span>
          {props.campaign.myCharacterName ? <span>Playing as {props.campaign.myCharacterName}</span> : null}
        </p>
        <dl className="ao-hd-feature-meta">
          {props.meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="ao-hd-feature-actions">
          <button className="ao-hd-btn ao-hd-btn-primary" type="button" onClick={props.onPrimary}>
            {props.primaryLabel}
          </button>
          <button className="ao-hd-btn" type="button" onClick={props.onSecondary}>
            {props.secondaryLabel}
          </button>
        </div>
      </div>
      <div className="ao-hd-feature-art" aria-hidden="true" />
    </article>
  );
}
