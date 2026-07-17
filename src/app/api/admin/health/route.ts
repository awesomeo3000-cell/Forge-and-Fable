import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { checkDatabaseHealth } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ ok: true, database: checkDatabaseHealth() });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Health check failed." }, { status: 503 });
  }
}
