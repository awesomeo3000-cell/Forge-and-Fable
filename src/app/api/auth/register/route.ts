import { NextResponse } from "next/server";
import { registerUser, deleteUserById } from "@/lib/vaultStore";
import { authRateLimitKeys, clearAuthFailures, isAuthRateLimited, recordAuthFailure } from "@/lib/authRateLimit";
import { consumeRegistrationCode, registrationRequiresCode } from "@/lib/adminStore";
import { createVerificationToken, emailVerificationDisabled } from "@/lib/verificationStore";
import { sendVerificationEmail } from "@/lib/email";

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
      // Chosen display name; registerUser falls back to an email-derived
      // name when blank, so existing clients keep working.
      name: String(body.name ?? "").trim().slice(0, 80),
    });

    // Generate a token for production email verification. Local development
    // consumes it immediately below.
    let verificationToken: string;
    try {
      verificationToken = createVerificationToken(user.id);
    } catch {
      await deleteUserById(user.id);
      throw new Error("Could not create verification token. Please try again.");
    }

    // Never require external email verification during non-production local
    // testing, or anywhere DISABLE_EMAIL_VERIFICATION=true (the local server
    // runs a production build, so NODE_ENV alone can't identify it).
    if (process.env.NODE_ENV !== "production" || emailVerificationDisabled()) {
      // Auto-verify — import dynamically to avoid bundling into every route.
      const { consumeVerificationToken } = await import("@/lib/verificationStore");
      consumeVerificationToken(verificationToken);
      clearAuthFailures(rateLimitKeys);
      return NextResponse.json({ message: "Account created (auto-verified). You may now log in." });
    }

    let emailSent = false;
    let emailErrorMessage = "";
    try {
      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        token: verificationToken,
        requestOrigin: (() => {
          const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
          const forwardedProto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
          return forwardedHost ? `${forwardedProto}://${forwardedHost.split(",")[0].trim()}` : new URL(request.url).origin;
        })(),
      });
      emailSent = true;
    } catch (emailError) {
      // User was created and token stored — they can request a resend later.
      console.error("Failed to send verification email:", emailError);
      emailErrorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
    }

    clearAuthFailures(rateLimitKeys);

    const message = emailSent
      ? "Account created! Check your email to verify your address."
      : `Account created, but we couldn't send the verification email: ${emailErrorMessage}`;

    return NextResponse.json({ message });
  } catch (error) {
    if (rateLimitKeys.length > 0) recordAuthFailure(rateLimitKeys);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create vault." },
      { status: 400 },
    );
  }
}
