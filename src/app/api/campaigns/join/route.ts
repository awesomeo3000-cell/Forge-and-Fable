/**
 * POST /api/campaigns/join — join a campaign by code
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { joinCampaign } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json();
    const { code, characterId } = body as { code?: string; characterId?: string };

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "Join code is required." }, { status: 400 });
    }
    if (!characterId || typeof characterId !== "string") {
      return NextResponse.json({ error: "Character ID is required." }, { status: 400 });
    }

    const campaign = joinCampaign(userId, code.trim().toUpperCase(), characterId);
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to join campaign." },
      { status: 400 },
    );
  }
}
