import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { updateUserName } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json() as Record<string, unknown>;
    const user = await updateUserName(userId, { name: typeof body.name === "string" ? body.name : "" });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update your name." }, { status: 400 });
  }
}
