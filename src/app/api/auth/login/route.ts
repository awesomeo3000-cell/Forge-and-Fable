import { NextResponse } from "next/server";
import { loginUser } from "@/lib/vaultStore";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory per-email throttle: 10 failed attempts within 15 minutes resets on restart.
const attemptLog = new Map<string, { count: number; firstAttemptAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body.email ?? "").trim().toLowerCase();

    // Check throttle
    const entry = attemptLog.get(email);
    const now = Date.now();
    if (entry && now - entry.firstAttemptAt < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts, try again later." },
        { status: 429 },
      );
    }

    const user = await loginUser({
      email,
      password: String(body.password ?? ""),
    });

    // Successful login clears the throttle entry
    attemptLog.delete(email);

    const token = await signToken({ userId: user.id });
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    // Record failed attempt
    const now = Date.now();
    const entry = attemptLog.get(email);
    if (!entry || now - entry.firstAttemptAt >= WINDOW_MS) {
      attemptLog.set(email, { count: 1, firstAttemptAt: now });
    } else {
      entry.count += 1;
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open vault." },
      { status: 401 },
    );
  }
}
