import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    checkDatabaseHealth();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Service unavailable." },
      { status: 503 },
    );
  }
}
