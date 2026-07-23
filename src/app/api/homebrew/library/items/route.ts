import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { listAvailableItems } from "@/lib/homebrew/homebrewStore";
import { homebrewErrorResponse, serverError } from "@/lib/homebrew/routeHelpers";
import type { RulesetId } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const ruleset = new URL(request.url).searchParams.get("ruleset");
    if (ruleset && ruleset !== "2014" && ruleset !== "2024") {
      return NextResponse.json({ error: "Unknown ruleset." }, { status: 400 });
    }
    return NextResponse.json({ items: listAvailableItems(userId, ruleset as RulesetId | undefined) });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not list homebrew items.");
  }
}
