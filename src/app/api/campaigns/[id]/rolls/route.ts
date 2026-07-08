/**
 * POST /api/campaigns/[id]/rolls — post a roll to the campaign feed
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { postRoll } from "@/lib/campaignStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id: campaignId } = await params;
    const body = await request.json();
    const { label, detail, total, characterName } = body as {
      label?: string;
      detail?: string;
      total?: number;
      characterName?: string;
    };

    if (!label || typeof label !== "string" || label.length > 80) {
      return NextResponse.json({ error: "Label is required (max 80 chars)." }, { status: 400 });
    }
    if (typeof detail !== "string" || detail.length > 200) {
      return NextResponse.json({ error: "Detail must be a string (max 200 chars)." }, { status: 400 });
    }
    if (typeof total !== "number" || !Number.isInteger(total) || total < -999 || total > 999) {
      return NextResponse.json({ error: "Total must be an integer between -999 and 999." }, { status: 400 });
    }
    if (!characterName || typeof characterName !== "string" || characterName.length > 80) {
      return NextResponse.json({ error: "Character name is required." }, { status: 400 });
    }

    const roll = postRoll(campaignId, userId, characterName, label, detail, total);
    return NextResponse.json({ roll }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to post roll.";
    return NextResponse.json({ error: message }, { status: message.includes("member") ? 404 : 400 });
  }
}
