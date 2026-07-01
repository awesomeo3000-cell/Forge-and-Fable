import { NextResponse } from "next/server";
import { ruleset } from "@/lib/ruleset";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(ruleset);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load ruleset." },
      { status: 500 },
    );
  }
}
