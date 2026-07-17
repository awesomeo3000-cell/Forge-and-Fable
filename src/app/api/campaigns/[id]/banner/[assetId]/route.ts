import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getCampaignBannerAsset } from "@/lib/campaignBannerStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id: campaignId, assetId } = await params;
    if (!UUID_PATTERN.test(assetId)) return NextResponse.json({ error: "Campaign image not found." }, { status: 404 });
    const asset = getCampaignBannerAsset(assetId, campaignId, userId);
    if (!asset) return NextResponse.json({ error: "Campaign image not found." }, { status: 404 });
    return new NextResponse(new Uint8Array(asset.bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(asset.bytes.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Campaign image not found." }, { status: 404 });
  }
}
