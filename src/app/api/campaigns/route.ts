/**
 * GET  /api/campaigns — list campaigns the caller DMs or belongs to
 * POST /api/campaigns — create a new campaign (caller = DM)
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { createCampaign, listCampaigns } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const campaigns = listCampaigns(userId);
    return NextResponse.json({ campaigns });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to list campaigns." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name || typeof name !== "string" || !name.trim() || name.trim().length > 60) {
      return NextResponse.json({ error: "Campaign name is required (max 60 chars)." }, { status: 400 });
    }

    const campaign = createCampaign(userId, name);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create campaign." },
      { status: 400 },
    );
  }
}
