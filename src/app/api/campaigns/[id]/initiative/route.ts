/**
 * PUT /api/campaigns/[id]/initiative - DM-only shared initiative update.
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { CampaignConflictError, updateCampaignInitiative } from "@/lib/campaignStore";
import type { InitiativeState } from "@/types/campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json();
    if (typeof body?.version !== "number" || !Number.isInteger(body.version)) {
      return NextResponse.json({ error: "version is required." }, { status: 400 });
    }
    if (!body.data || typeof body.data !== "object" || !Array.isArray(body.data.combatants)) {
      return NextResponse.json({ error: "data must be an InitiativeState." }, { status: 400 });
    }
    const initiative = updateCampaignInitiative(id, userId, body.data as InitiativeState, body.version);
    return NextResponse.json({ initiative });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CampaignConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update initiative." },
      { status: error instanceof Error && error.message.includes("DM") ? 403 : 400 },
    );
  }
}
