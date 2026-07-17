import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/verificationStore";
import { appUrl } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing verification token." },
      { status: 400 },
    );
  }

  const userId = consumeVerificationToken(token);
  if (!userId) {
    // Redirect to the app with an error status — the frontend can show a message.
    const errorUrl = new URL("/", appUrl());
    errorUrl.searchParams.set("verified", "error");
    return NextResponse.redirect(errorUrl);
  }

  const successUrl = new URL("/", appUrl());
  successUrl.searchParams.set("verified", "1");
  return NextResponse.redirect(successUrl);
}
