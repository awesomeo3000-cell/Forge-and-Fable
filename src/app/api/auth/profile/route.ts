import { NextResponse } from "next/server";
import { authenticateRequest, AuthError, getImpersonationSession } from "@/lib/auth";
import { getUserById, updateUserName } from "@/lib/vaultStore";
import { isAdminEmail } from "@/lib/adminEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const user = getUserById(userId);
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const impersonation = await getImpersonationSession(request);
    const actor = impersonation ? getUserById(impersonation.actorUserId) : null;
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, isAdmin: isAdminEmail(user.email) },
      impersonating: actor ? { id: actor.id, name: actor.name, email: actor.email } : null,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not load your profile." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json() as Record<string, unknown>;
    const user = await updateUserName(userId, { name: typeof body.name === "string" ? body.name : "" });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update your name." }, { status: 400 });
  }
}
