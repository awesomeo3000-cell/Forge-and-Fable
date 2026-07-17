import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import {
  CAMPAIGN_BANNER_MIME_TYPES,
  MAX_CAMPAIGN_BANNER_SIZE,
  saveCampaignBannerAsset,
  sniffCampaignBannerMime,
  deleteCampaignBannerAsset,
} from "@/lib/campaignBannerStore";
import { requireCampaignDm, updateCampaignAppearance } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id: campaignId } = await params;
    requireCampaignDm(campaignId, userId);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
    }
    if (file.size > MAX_CAMPAIGN_BANNER_SIZE) {
      return NextResponse.json({ error: `Campaign image too large (max ${MAX_CAMPAIGN_BANNER_SIZE / 1024 / 1024} MB).` }, { status: 413 });
    }
    if (!CAMPAIGN_BANNER_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Choose a PNG, JPEG, WebP, or GIF image." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniffCampaignBannerMime(bytes);
    if (!mime || !CAMPAIGN_BANNER_MIME_TYPES.has(mime)) {
      return NextResponse.json({ error: "The selected file does not look like a supported image." }, { status: 400 });
    }

    const assetId = saveCampaignBannerAsset(campaignId, mime, bytes);
    const bannerImageUrl = `/api/campaigns/${encodeURIComponent(campaignId)}/banner/${assetId}`;
    try {
      updateCampaignAppearance(campaignId, userId, { bannerImageUrl });
      return NextResponse.json({ bannerImageUrl }, { status: 201 });
    } catch (error) {
      deleteCampaignBannerAsset(assetId, campaignId);
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload campaign artwork." },
      { status: error instanceof Error && error.message.includes("DM") ? 403 : 400 },
    );
  }
}
