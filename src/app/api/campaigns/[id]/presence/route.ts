import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { dmToolsError } from "@/lib/dmToolsRoute";
import { listCampaignPresence, touchCampaignPresence } from "@/lib/dmTable/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try { const userId = await authenticateRequest(request), { id } = await params; return NextResponse.json({ presence: listCampaignPresence(id, userId) }); }
  catch (error) { return dmToolsError(error, "Could not load campaign presence."); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const userId = await authenticateRequest(request), { id } = await params;
    const body = await request.json().catch(() => ({})) as { visibility?: string };
    touchCampaignPresence(id, userId, body.visibility === "hidden" ? "hidden" : "visible");
    return NextResponse.json({ ok: true });
  } catch (error) { return dmToolsError(error, "Could not update campaign presence."); }
}
