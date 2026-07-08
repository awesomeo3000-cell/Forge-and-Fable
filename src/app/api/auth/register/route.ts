import { NextResponse } from "next/server";
import { registerUser, deleteUserById } from "@/lib/vaultStore";
import { SESSION_COOKIE_NAME, sessionCookieOptions, signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory per-email throttle: 10 attempts within 15 minutes resets on restart.
const attemptLog = new Map<string, { count: number; firstAttemptAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    email = String(body.email ?? "").trim().toLowerCase();

    const entry = attemptLog.get(email);
    const now = Date.now();
    if (entry && now - entry.firstAttemptAt < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts, try again later." },
        { status: 429 },
      );
    }

    if (!entry || now - entry.firstAttemptAt >= WINDOW_MS) {
      attemptLog.set(email, { count: 1, firstAttemptAt: now });
    } else {
      entry.count += 1;
    }

    const requiredInviteCode = process.env.REGISTRATION_CODE?.trim();
    if (requiredInviteCode && String(body.inviteCode ?? "") !== requiredInviteCode) {
      return NextResponse.json(
        { error: "Registration requires a valid invite code." },
        { status: 403 },
      );
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

    // Successful registration clears the throttle entry
    attemptLog.delete(email);

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create vault." },
      { status: 400 },
    );
  }
}
