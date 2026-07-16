import { describe, expect, it } from "vitest";
import { formatCampaignHash, parseCampaignHash } from "@/lib/campaignRoute";

describe("parseCampaignHash", () => {
  it("parses a bare campaign hash as overview", () => {
    expect(parseCampaignHash("#/campaigns/abc123")).toEqual({ campaignId: "abc123", section: "overview" });
  });
  it("parses a section hash", () => {
    expect(parseCampaignHash("#/campaigns/abc123/party")).toEqual({ campaignId: "abc123", section: "party" });
    expect(parseCampaignHash("/campaigns/abc123/settings")).toEqual({ campaignId: "abc123", section: "settings" });
    expect(parseCampaignHash("#/campaigns/abc123/handouts")).toEqual({ campaignId: "abc123", section: "handouts" });
  });
  it("tolerates a trailing slash", () => {
    expect(parseCampaignHash("#/campaigns/abc123/journal/")).toEqual({ campaignId: "abc123", section: "journal" });
  });
  it("rejects unknown sections and foreign hashes", () => {
    expect(parseCampaignHash("#/campaigns/abc123/loot")).toBeNull();
    expect(parseCampaignHash("#/characters/abc123")).toBeNull();
    expect(parseCampaignHash("")).toBeNull();
    expect(parseCampaignHash("#/campaigns/")).toBeNull();
  });
});

describe("formatCampaignHash", () => {
  it("keeps overview as the bare campaign URL", () => {
    expect(formatCampaignHash("abc123")).toBe("#/campaigns/abc123");
    expect(formatCampaignHash("abc123", "overview")).toBe("#/campaigns/abc123");
  });
  it("appends other sections", () => {
    expect(formatCampaignHash("abc123", "sessions")).toBe("#/campaigns/abc123/sessions");
  });
  it("round-trips through parse", () => {
    expect(parseCampaignHash(formatCampaignHash("c9", "activity"))).toEqual({ campaignId: "c9", section: "activity" });
  });
});
