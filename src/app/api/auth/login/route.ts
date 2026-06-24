import { NextResponse } from "next/server";
import { loginUser } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await loginUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open vault." },
      { status: 401 },
    );
  }
}
