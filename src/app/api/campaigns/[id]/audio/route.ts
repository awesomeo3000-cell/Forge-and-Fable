import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { CampaignConflictError, updateCampaignAudio } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json();
    if (!Number.isInteger(body?.version) || (body.trackId !== null && typeof body.trackId !== "string")) {
      return NextResponse.json({ error: "trackId and version are required." }, { status: 400 });
    }
    return NextResponse.json({ audio: updateCampaignAudio(id, userId, body.trackId, body.version) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CampaignConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update audio." }, { status: error instanceof Error && error.message.includes("DM") ? 403 : 400 });
  }
}
