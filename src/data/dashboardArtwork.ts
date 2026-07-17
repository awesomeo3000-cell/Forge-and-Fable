import { getCampaignTheme } from "@/lib/campaignThemes";
import { resolvePortraitSrc, isCatalogPortrait } from "@/data/portraits";

/**
 * Centralized home-dashboard artwork registry (final-polish handoff §3/§5).
 * Every dashboard image path lives here — components never hardcode
 * /dashboard/... strings. Files live in public/dashboard and are referenced
 * with root-relative browser paths. No mobile crops exist yet, so those
 * fields are intentionally absent (§5: no broken references).
 */
export const DASHBOARD_ARTWORK = {
  /** Page-level Arcane Storybook backdrop — never reused inside cards (§4.1). */
  backdrop: "/dashboard/dashboard-backdrop.webp",
  /** Warm hearth common-room art, exclusive to the welcome banner (§4.2). */
  welcome: "/dashboard/welcome-hearth.webp",
  /** Tactical planning table, exclusive to session preparation (§4.5). */
  prepareSession: "/dashboard/prepare-session.webp",
  /** Commission-record / orrery art for character creation (§4.6). */
  createCharacter: "/dashboard/create-character.webp",
  /** Static art for campaign-shaped cards and the dynamic-campaign fallback. */
  campaignFallback: "/dashboard/card-campaign.webp",
  /** Fallback when the last character has no resolvable portrait. */
  characterFallback: "/dashboard/card-character.webp",
  /** Existing card art for join/import actions (kept from the prior pass). */
  joinCard: "/dashboard/card-join.webp",
  importCard: "/dashboard/card-import.webp",
} as const;

/** Campaign appearance artwork: chosen banner, then theme art, then fallback (§4.3). */
export function resolveDashboardCampaignArtwork(
  campaign?: { bannerImageUrl: string | null; themeKey: unknown } | null,
): string {
  if (!campaign) return DASHBOARD_ARTWORK.campaignFallback;
  return (
    campaign.bannerImageUrl?.trim() ||
    getCampaignTheme(campaign.themeKey).imageUrl ||
    DASHBOARD_ARTWORK.campaignFallback
  );
}

/**
 * Selected character portrait for the Continue card (§4.4). portraitUrl is an
 * opaque catalog ID or a direct URL (same contract as CharacterPortrait); an
 * unknown catalog ID resolves to the fallback rather than a broken image.
 */
export function resolveDashboardCharacterArtwork(
  character?: { portraitUrl?: string } | null,
): string {
  const portraitId = character?.portraitUrl?.trim();
  if (!portraitId) return DASHBOARD_ARTWORK.characterFallback;
  if (isCatalogPortrait(portraitId)) {
    return resolvePortraitSrc(portraitId) ?? DASHBOARD_ARTWORK.characterFallback;
  }
  return portraitId;
}
