import { NextResponse } from "next/server";
import {
  AuthError,
  IMPERSONATION_COOKIE_NAME,
  signImpersonationToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { isAdminEmail } from "@/lib/adminEmail";
import { getUserById } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authError(error: unknown) {
  return error instanceof AuthError
    ? NextResponse.json({ error: error.message }, { status: error.status })
    : NextResponse.json({ error: "Unauthorized." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const targetId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    const target = getUserById(targetId);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (target.id === adminId || isAdminEmail(target.email)) {
      return NextResponse.json({ error: "Choose a non-admin user to impersonate." }, { status: 400 });
    }
    const token = await signImpersonationToken(adminId, target.id);
    const response = NextResponse.json({ user: { id: target.id, name: target.name, email: target.email } });
    response.cookies.set(IMPERSONATION_COOKIE_NAME, token, { ...sessionCookieOptions(), maxAge: 60 * 60 });
    return response;
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(IMPERSONATION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    return authError(error);
  }
}
