/**
 * DELETE /api/campaigns/[id]/members/[userId] — the DM removes a player
 * from the campaign (membership, presence, and initiative rows).
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { removeCampaignMember } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const dmUserId = await authenticateRequest(request);
    const { id: campaignId, userId: targetUserId } = await params;
    removeCampaignMember(campaignId, dmUserId, targetUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove the player." },
      { status: 400 },
    );
  }
}
