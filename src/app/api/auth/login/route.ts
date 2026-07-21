import { NextResponse } from "next/server";
import { InvalidCredentialsError, loginUser } from "@/lib/vaultStore";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signToken } from "@/lib/auth";
import { authRateLimitKeys, clearAuthFailures, isAuthRateLimited, recordAuthFailure } from "@/lib/authRateLimit";
import { emailVerificationDisabled, isEmailVerified } from "@/lib/verificationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  let rateLimitKeys: string[] = [];
  try {
    const email = String(body.email ?? "").trim().toLowerCase();

    rateLimitKeys = authRateLimitKeys(request, "login", email);
    if (isAuthRateLimited(rateLimitKeys)) {
      return NextResponse.json(
        { error: "Too many attempts, try again later." },
        { status: 429 },
      );
    }

    const user = await loginUser({
      email,
      password: String(body.password ?? ""),
    });

    // Block login until the email is verified — unless verification is
    // switched off (local server), which also unblocks accounts that were
    // registered before the switch and never verified.
    if (!emailVerificationDisabled() && !isEmailVerified(user.id)) {
      recordAuthFailure(rateLimitKeys);
      return NextResponse.json(
        { error: "Please verify your email before logging in. Check your inbox for a verification link." },
        { status: 403 },
      );
    }

    clearAuthFailures(rateLimitKeys);

    const token = await signToken({ userId: user.id });
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    // Only genuine credential failures return 401 and count against the
    // throttle. Infrastructure faults (DB, JWT signing, etc.) return a generic
    // 500 without leaking the internal message or burning the user's attempts
    // (DW-004).
    if (error instanceof InvalidCredentialsError) {
      if (rateLimitKeys.length > 0) recordAuthFailure(rateLimitKeys);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error("Unexpected login failure:", error);
    return NextResponse.json(
      { error: "Could not open vault. Please try again." },
      { status: 500 },
    );
  }
}
