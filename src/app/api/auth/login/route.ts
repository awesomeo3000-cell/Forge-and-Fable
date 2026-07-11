import { NextResponse } from "next/server";
import { loginUser } from "@/lib/vaultStore";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signToken } from "@/lib/auth";
import { authRateLimitKeys, clearAuthFailures, isAuthRateLimited, recordAuthFailure } from "@/lib/authRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let email = "";
  let rateLimitKeys: string[] = [];
  try {
    const body = await request.json();
    email = String(body.email ?? "").trim().toLowerCase();

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

    clearAuthFailures(rateLimitKeys);

    const token = await signToken({ userId: user.id });
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (rateLimitKeys.length > 0) recordAuthFailure(rateLimitKeys);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open vault." },
      { status: 401 },
    );
  }
}
