import { NextResponse } from "next/server";
import { authenticateRequest, AuthError, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { deleteUserById, getUserById, loginUser } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json() as Record<string, unknown>;
    const user = getUserById(userId);
    if (!user) throw new AuthError("Account not found.", 404);

    await loginUser({ email: user.email, password: String(body.password ?? "") });
    await deleteUserById(userId);

    const response = NextResponse.json({ deleted: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error && /email or password/.test(error.message)
      ? "Password confirmation failed."
      : "Could not delete account.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Password") ? 403 : 500 });
  }
}
