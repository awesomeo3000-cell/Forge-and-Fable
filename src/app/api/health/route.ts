import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = checkDatabaseHealth();
    return NextResponse.json({ ok: true, database });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Database health check failed." },
      { status: 503 },
    );
  }
}
