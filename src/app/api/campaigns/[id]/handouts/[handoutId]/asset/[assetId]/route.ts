import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getCampaignHandoutAsset } from "@/lib/campaignHandoutStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; handoutId: string; assetId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id, handoutId, assetId } = await params;
    const asset = getCampaignHandoutAsset(assetId, id, handoutId, userId);
    if (!asset) return NextResponse.json({ error: "Handout file not found." }, { status: 404 });
    return new NextResponse(new Uint8Array(asset.bytes), {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(asset.bytes.length),
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not load handout file." }, { status: 400 });
  }
}
