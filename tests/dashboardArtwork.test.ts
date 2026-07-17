import { describe, expect, it } from "vitest";
import {
  DASHBOARD_ARTWORK,
  resolveDashboardCampaignArtwork,
  resolveDashboardCharacterArtwork,
} from "@/data/dashboardArtwork";

describe("dashboard artwork registry", () => {
  it("uses root-relative /dashboard paths only", () => {
    for (const src of Object.values(DASHBOARD_ARTWORK)) {
      expect(src).toMatch(/^\/dashboard\/[\w-]+\.webp$/);
    }
  });
});

describe("resolveDashboardCampaignArtwork", () => {
  it("falls back when there is no campaign", () => {
    expect(resolveDashboardCampaignArtwork(null)).toBe(DASHBOARD_ARTWORK.campaignFallback);
    expect(resolveDashboardCampaignArtwork(undefined)).toBe(DASHBOARD_ARTWORK.campaignFallback);
  });

  it("prefers the chosen banner image", () => {
    expect(
      resolveDashboardCampaignArtwork({ bannerImageUrl: "/uploads/banner.png", themeKey: "forge" }),
    ).toBe("/uploads/banner.png");
  });

  it("uses the campaign theme art when no banner is set", () => {
    const art = resolveDashboardCampaignArtwork({ bannerImageUrl: null, themeKey: "forge" });
    expect(art).toBe("/forge-backdrop.webp");
  });

  it("resolves an unknown theme key to the default theme, not a broken path", () => {
    const art = resolveDashboardCampaignArtwork({ bannerImageUrl: "  ", themeKey: "nonsense" });
    expect(art).toBeTruthy();
    expect(art).not.toBe("  ");
  });
});

describe("resolveDashboardCharacterArtwork", () => {
  it("falls back when there is no character or portrait", () => {
    expect(resolveDashboardCharacterArtwork(null)).toBe(DASHBOARD_ARTWORK.characterFallback);
    expect(resolveDashboardCharacterArtwork({})).toBe(DASHBOARD_ARTWORK.characterFallback);
    expect(resolveDashboardCharacterArtwork({ portraitUrl: "   " })).toBe(DASHBOARD_ARTWORK.characterFallback);
  });

  it("passes a direct external URL through unchanged", () => {
    expect(resolveDashboardCharacterArtwork({ portraitUrl: "https://example.com/hero.png" })).toBe(
      "https://example.com/hero.png",
    );
  });
});
