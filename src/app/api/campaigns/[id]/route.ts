/**
 * GET    /api/campaigns/[id] — campaign detail (members + rolls)
 * DELETE /api/campaigns/[id] — DM-only delete
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getCampaignDetail, deleteCampaign, updateCampaignAppearance, updateCampaignPlayerView } from "@/lib/campaignStore";

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
    const status = message.includes("Not a member") || message.includes("not found") || message.includes("Campaign not found") ? 404 : 500;
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const campaign = ("playerDmViewEnabled" in body || "playerDmViewInitiative" in body || "playerDmViewParty" in body || "playerDmViewRolls" in body)
      ? updateCampaignPlayerView(id, userId, body)
      : updateCampaignAppearance(id, userId, body);
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update campaign appearance." },
      { status: 400 },
    );
  }
}
