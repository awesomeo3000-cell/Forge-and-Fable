import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getVersion } from "@/lib/homebrew/homebrewStore";
import { homebrewErrorResponse, serverError } from "@/lib/homebrew/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ definitionId: string; versionId: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { definitionId, versionId } = await context.params;
    return NextResponse.json({ version: getVersion(userId, definitionId, versionId) });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not load version.");
  }
}
