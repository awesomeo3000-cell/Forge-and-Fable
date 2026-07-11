import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

export function dmToolsError(error: unknown, fallback = "Request failed.") {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : fallback;
  const status = /Only the DM|not a member/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /already active|required|must|invalid|immutable|filters/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
