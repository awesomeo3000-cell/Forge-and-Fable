/**
 * Campaign workspace hash routes (campaign workspace handoff §1, §20).
 *
 * The app is a single client page, so the campaign "route" rides the URL hash:
 * #/campaigns/<id> and #/campaigns/<id>/<section>. Pure string helpers — the
 * app shell owns history wiring (popstate, pushState) so deep links, refresh
 * and the back button all land on the right campaign section.
 */

export const CAMPAIGN_SECTIONS = ["overview", "party", "journal", "sessions", "handouts", "activity", "settings"] as const;

export type CampaignSection = (typeof CAMPAIGN_SECTIONS)[number];

export type CampaignRoute = { campaignId: string; section: CampaignSection };

export function isCampaignSection(value: string): value is CampaignSection {
  return (CAMPAIGN_SECTIONS as readonly string[]).includes(value);
}

/** Parse a location.hash (with or without "#") into a campaign route, or null. */
export function parseCampaignHash(hash: string): CampaignRoute | null {
  const path = hash.replace(/^#/, "");
  const match = /^\/campaigns\/([A-Za-z0-9_-]+)(?:\/([a-z]+))?\/?$/.exec(path);
  if (!match) return null;
  const [, campaignId, rawSection] = match;
  if (rawSection !== undefined && !isCampaignSection(rawSection)) return null;
  return { campaignId, section: (rawSection as CampaignSection | undefined) ?? "overview" };
}

/** Format a campaign route as a hash. Overview is the bare campaign URL. */
export function formatCampaignHash(campaignId: string, section: CampaignSection = "overview"): string {
  return section === "overview" ? `#/campaigns/${campaignId}` : `#/campaigns/${campaignId}/${section}`;
}
