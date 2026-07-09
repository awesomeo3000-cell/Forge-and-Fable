/**
 * DELETE /api/campaigns/[id]/members/me — leave a campaign
 * PATCH  /api/campaigns/[id]/members/me — switch enrolled character
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { leaveCampaign, switchCampaignCharacter } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id: campaignId } = await params;
    leaveCampaign(campaignId, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to leave campaign." },
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
    const { id: campaignId } = await params;
    const body = await request.json() as { characterId?: string };
    if (!body.characterId || typeof body.characterId !== "string") {
      return NextResponse.json({ error: "characterId is required." }, { status: 400 });
    }
    switchCampaignCharacter(campaignId, userId, body.characterId.trim().slice(0, 64));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to switch character." },
      { status: 400 },
    );
  }
}
