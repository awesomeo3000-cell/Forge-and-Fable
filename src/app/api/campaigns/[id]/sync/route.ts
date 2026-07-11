/**
 * GET /api/campaigns/[id]/sync?eventCursor=<ISO|ID>&rollCursor=<ISO|ID>
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { syncCampaign } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const search = new URL(request.url).searchParams;
    const legacySince = search.get("since") ?? undefined;
    return NextResponse.json(syncCampaign(id, userId, {
      events: search.get("eventCursor") ?? legacySince,
      rolls: search.get("rollCursor") ?? legacySince,
    }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to sync campaign.";
    return NextResponse.json({ error: message }, { status: message.includes("member") ? 404 : 400 });
  }
}
