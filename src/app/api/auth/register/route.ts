import { NextResponse } from "next/server";
import { registerUser, deleteUserById } from "@/lib/vaultStore";
import { authRateLimitKeys, clearAuthFailures, isAuthRateLimited, recordAuthFailure } from "@/lib/authRateLimit";
import { consumeRegistrationCode, registrationRequiresCode } from "@/lib/adminStore";
import { createVerificationToken } from "@/lib/verificationStore";
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
    });

    // Generate a verification token and send the email.
    let verificationToken: string;
    try {
      verificationToken = createVerificationToken(user.id);
    } catch (tokenError) {
      await deleteUserById(user.id);
      throw new Error("Could not create verification token. Please try again.");
    }

    // In dev without a Resend API key, auto-verify for convenience.
    if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
      // Auto-verify in dev — import dynamically to avoid bundling into every route.
      const { consumeVerificationToken } = await import("@/lib/verificationStore");
      consumeVerificationToken(verificationToken);
      clearAuthFailures(rateLimitKeys);
      return NextResponse.json({ message: "Account created (dev — auto-verified). You may now log in." });
    }

    let emailSent = false;
    try {
      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        token: verificationToken,
      });
      emailSent = true;
    } catch (emailError) {
      // User was created and token stored — they can request a resend later.
      // Log but don't fail the registration.
      console.error("Failed to send verification email:", emailError);
    }

    clearAuthFailures(rateLimitKeys);

    const message = emailSent
      ? "Account created! Check your email to verify your address."
      : "Account created! We couldn't send a verification email — please contact support.";

    return NextResponse.json({ message });
  } catch (error) {
    if (rateLimitKeys.length > 0) recordAuthFailure(rateLimitKeys);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create vault." },
      { status: 400 },
    );
  }
}
