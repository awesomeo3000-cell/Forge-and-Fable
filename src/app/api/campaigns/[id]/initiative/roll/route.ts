/**
 * POST /api/campaigns/[id]/initiative/roll - member submits own initiative.
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { rollCampaignInitiative } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json();
    if (typeof body?.initiative !== "number" || !Number.isInteger(body.initiative) || body.initiative < -99 || body.initiative > 99) {
      return NextResponse.json({ error: "initiative must be an integer from -99 to 99." }, { status: 400 });
    }
    if (typeof body.characterName !== "string" || !body.characterName.trim() || body.characterName.length > 80) {
      return NextResponse.json({ error: "characterName is required." }, { status: 400 });
    }
    const initiative = rollCampaignInitiative(id, userId, body.characterName, body.initiative);
    return NextResponse.json({ initiative }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to roll initiative.";
    return NextResponse.json({ error: message }, { status: message.includes("member") ? 404 : 400 });
  }
}
