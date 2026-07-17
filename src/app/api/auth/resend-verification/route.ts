import { NextResponse } from "next/server";
import { authRateLimitKeys, isAuthRateLimited, recordAuthFailure } from "@/lib/authRateLimit";
import { getDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { createVerificationToken, emailVerificationDisabled, isEmailVerified } from "@/lib/verificationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_MESSAGE = "If an unverified account exists for that email, a new verification link has been sent.";

type UserRow = { id: string; name: string; email: string };

export async function POST(request: Request) {
  let keys: string[] = [];
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    keys = authRateLimitKeys(request, "verification-resend", email);
    if (isAuthRateLimited(keys)) {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 429 });
    }

    if (!emailVerificationDisabled()) {
      const user = getDb().prepare("SELECT id, name, email FROM users WHERE email = ?").get(email) as UserRow | undefined;
      if (user && !isEmailVerified(user.id)) {
        const token = createVerificationToken(user.id);
        try {
          await sendVerificationEmail({ email: user.email, name: user.name, token });
        } catch (error) {
          console.error("Failed to resend verification email:", error);
        }
      }
    }

    recordAuthFailure(keys);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch {
    if (keys.length > 0) recordAuthFailure(keys);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
