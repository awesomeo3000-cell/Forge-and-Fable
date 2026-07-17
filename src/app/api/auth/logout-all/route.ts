import { NextResponse } from "next/server";
import { authenticateRequest, AuthError, revokeAllSessions, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    revokeAllSessions(userId);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not revoke sessions." }, { status: 400 });
  }
}
