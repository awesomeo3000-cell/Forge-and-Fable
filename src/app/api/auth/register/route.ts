import { NextResponse } from "next/server";
import { registerUser, deleteUserById } from "@/lib/vaultStore";
import { signToken } from "@/lib/auth";

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

    return NextResponse.json({ user, token });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create vault." },
      { status: 400 },
    );
  }
}
