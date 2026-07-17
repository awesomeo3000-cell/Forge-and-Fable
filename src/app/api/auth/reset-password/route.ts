import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { BCRYPT_ROUNDS, MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { consumePasswordResetToken } from "@/lib/passwordResetStore";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    if (!token || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
    }
    const userId = consumePasswordResetToken(token);
    if (!userId) return NextResponse.json({ error: "That reset link is invalid or expired. Request a new one." }, { status: 400 });
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    getDb().prepare("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?")
      .run(passwordHash, userId);
    return NextResponse.json({ message: "Password updated. You can now sign in." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not reset password." }, { status: 400 });
  }
}
