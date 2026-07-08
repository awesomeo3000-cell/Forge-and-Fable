/**
 * GET    /api/campaigns/[id] — campaign detail (members + rolls)
 * DELETE /api/campaigns/[id] — DM-only delete
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getCampaignDetail, deleteCampaign } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const detail = getCampaignDetail(id, userId);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load campaign.";
    const status = message.includes("Not a member") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    deleteCampaign(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete campaign." },
      { status: 400 },
    );
  }
}
