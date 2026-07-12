import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { postCampaignEvent } from "@/lib/campaignStore";
import { createCampaignRequest, listCampaignRequests } from "@/lib/dmTable/store";
import type { CampaignRequest } from "@/types/campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kinds = new Set<CampaignRequest["kind"]>(["roll", "rest-short", "rest-long"]);
const resolutions = new Set<CampaignRequest["resolution"]>(["individual", "group", "best"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json({ requests: listCampaignRequests(id, userId) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load requests." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    if (!kinds.has(body.kind as CampaignRequest["kind"])) throw new Error("Unsupported request kind.");
    if (!resolutions.has(body.resolution as CampaignRequest["resolution"])) throw new Error("Unsupported resolution mode.");
    if (!Array.isArray(body.targetUserIds) || body.targetUserIds.some((value) => typeof value !== "string")) throw new Error("Targets must be campaign user IDs.");
    if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) throw new Error("Request payload must be an object.");
    const payload = body.payload as Record<string, unknown>;
    const tracked = createCampaignRequest(id, userId, {
      kind: body.kind as CampaignRequest["kind"], resolution: body.resolution as CampaignRequest["resolution"],
      targetUserIds: body.targetUserIds as string[], payload,
    });
    const type = tracked.kind === "roll" ? "roll-request" : tracked.kind;
    for (const targetUserId of tracked.targetUserIds) {
      postCampaignEvent(id, userId, type, { ...payload, requestId: tracked.id }, targetUserId);
    }
    return NextResponse.json({ request: tracked }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Could not create request.";
    return NextResponse.json({ error: message }, { status: message.includes("DM") ? 403 : 400 });
  }
}
