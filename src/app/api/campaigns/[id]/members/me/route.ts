/**
 * DELETE /api/campaigns/[id]/members/me — leave a campaign
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { leaveCampaign } from "@/lib/campaignStore";

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
