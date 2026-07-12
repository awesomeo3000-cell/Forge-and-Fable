import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { respondToCampaignRequest } from "@/lib/dmTable/store";
import type { CampaignRequestResponse } from "@/types/campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id, requestId } = await params;
    const body = await request.json() as Record<string, unknown>;
    if (body.status !== "completed" && body.status !== "dismissed" && body.status !== "unavailable") throw new Error("Unsupported response status.");
    if (body.total !== undefined && (typeof body.total !== "number" || !Number.isInteger(body.total))) throw new Error("Roll total must be an integer.");
    if (body.passed !== undefined && typeof body.passed !== "boolean") throw new Error("Passed must be a boolean.");
    const response = respondToCampaignRequest(id, userId, requestId, {
      status: body.status as CampaignRequestResponse["status"], total: body.total as number | undefined,
      passed: body.passed as boolean | undefined, summary: typeof body.summary === "string" ? body.summary : "Completed",
    });
    return NextResponse.json({ response });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Could not record response.";
    return NextResponse.json({ error: message }, { status: message.includes("not sent") ? 403 : 400 });
  }
}
