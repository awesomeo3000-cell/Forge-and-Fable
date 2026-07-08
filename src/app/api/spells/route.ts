import { NextResponse } from "next/server";
import raw from "@/data/spells.json";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(raw, {
    headers: {
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
