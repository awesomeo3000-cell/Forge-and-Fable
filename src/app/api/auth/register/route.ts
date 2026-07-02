import { NextResponse } from "next/server";
import { registerUser } from "@/lib/vaultStore";
import { signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireInviteCode(body: Record<string, unknown>) {
  const inviteCode = process.env.REGISTRATION_INVITE_CODE?.trim();
  if (!inviteCode) return;

  if (String(body.inviteCode ?? "").trim() !== inviteCode) {
    throw new Error("Enter the current invite code to create an account.");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    requireInviteCode(body);
    const user = await registerUser({
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
    });

    const token = await signToken({ userId: user.id });

    return NextResponse.json({ user, token });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create vault." },
      { status: 400 },
    );
  }
}
