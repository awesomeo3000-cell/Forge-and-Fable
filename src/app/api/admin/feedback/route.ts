import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { listAllFeedback } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const includeResolved = new URL(request.url).searchParams.get("status") === "all";
    const feedback = await listAllFeedback(includeResolved);
    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load feedback." }, { status: 500 });
  }
}
