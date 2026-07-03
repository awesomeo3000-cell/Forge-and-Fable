import { NextResponse } from "next/server";
import { registerUser } from "@/lib/vaultStore";
import { signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const user = await registerUser({
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
