import { NextResponse } from "next/server";
import { authRateLimitKeys, isAuthRateLimited, recordAuthFailure } from "@/lib/authRateLimit";
import { getDb } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/passwordResetStore";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been sent.";

export async function POST(request: Request) {
  let email = "";
  let keys: string[] = [];
  try {
    const body = await request.json() as Record<string, unknown>;
    email = String(body.email ?? "").trim().toLowerCase();
    keys = authRateLimitKeys(request, "password-reset", email);
    if (isAuthRateLimited(keys)) return NextResponse.json({ message: GENERIC_MESSAGE });

    const user = getDb().prepare("SELECT id, name, email FROM users WHERE email = ?").get(email) as { id: string; name: string; email: string } | undefined;
    if (user) {
      const token = createPasswordResetToken(user.id);
      try {
        await sendPasswordResetEmail({ email: user.email, name: user.name, token, requestOrigin: new URL(request.url).origin });
      } catch (error) {
        console.error("Failed to send password reset email:", error);
      }
    }
    // Count every request, including successful ones, to prevent email spam
    // while keeping the response identical for known and unknown addresses.
    recordAuthFailure(keys);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch {
    if (keys.length > 0) recordAuthFailure(keys);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
