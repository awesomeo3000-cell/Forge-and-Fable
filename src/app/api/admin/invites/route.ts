import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { createInviteCode, listInviteCodes } from "@/lib/adminStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error: unknown, fallbackStatus = 500) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: fallbackStatus });
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ invites: listInviteCodes() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const invite = createInviteCode(adminId, { label: body.label, maxUses: body.maxUses });
    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    return fail(error, 400);
  }
}
