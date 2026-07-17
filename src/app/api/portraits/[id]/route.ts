/**
 * GET /api/portraits/[id]
 *
 * Serves a stored user-uploaded portrait image. IDs are random UUIDs
 * (capability URLs), and campaign members' browsers load these directly
 * via <img>, so the response is cacheable and not session-gated.
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { deleteUserPortrait, getPortrait } from "@/lib/portraitStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Portrait not found." }, { status: 404 });
  }
  const portrait = getPortrait(id);
  if (!portrait) {
    return NextResponse.json({ error: "Portrait not found." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(portrait.bytes), {
    status: 200,
    headers: {
      "Content-Type": portrait.mime,
      "Content-Length": String(portrait.bytes.length),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id) || !deleteUserPortrait(userId, id)) {
      return NextResponse.json({ error: "Portrait not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not delete portrait." }, { status: 500 });
  }
}
