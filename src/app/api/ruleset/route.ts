import { NextResponse } from "next/server";
import { ruleset } from "@/lib/ruleset";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(ruleset);
}
