import { NextResponse } from "next/server";
import { registerUser, deleteUserById } from "@/lib/vaultStore";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signToken } from "@/lib/auth";
import { authRateLimitKeys, clearAuthFailures, isAuthRateLimited, recordAuthFailure } from "@/lib/authRateLimit";
import { consumeRegistrationCode, registrationRequiresCode } from "@/lib/adminStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let email = "";
  let rateLimitKeys: string[] = [];
  try {
    const body = (await request.json()) as Record<string, unknown>;
    email = String(body.email ?? "").trim().toLowerCase();

    rateLimitKeys = authRateLimitKeys(request, "register", email);
    if (isAuthRateLimited(rateLimitKeys)) {
      return NextResponse.json(
        { error: "Too many attempts, try again later." },
        { status: 429 },
      );
    }

    // Registration is gated when the env code is set OR any live admin invite
    // exists. A valid code = the env value (unlimited) or a live DB invite
    // (consumed atomically). Ungated instances register freely.
    if (registrationRequiresCode()) {
      if (!consumeRegistrationCode(String(body.inviteCode ?? ""))) {
        recordAuthFailure(rateLimitKeys);
        return NextResponse.json(
          { error: "Registration requires a valid invite code." },
          { status: 403 },
        );
      }
    }

    const user = await registerUser({
      email,
      password: String(body.password ?? ""),
    });

    let token: string;
    try {
      token = await signToken({ userId: user.id });
    } catch (signError) {
      await deleteUserById(user.id);
      throw signError;
    }

    clearAuthFailures(rateLimitKeys);

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (rateLimitKeys.length > 0) recordAuthFailure(rateLimitKeys);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create vault." },
      { status: 400 },
    );
  }
}
