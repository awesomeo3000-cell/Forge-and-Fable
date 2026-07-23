import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { deprecateVersion } from "@/lib/homebrew/homebrewStore";
import { homebrewErrorResponse, serverError } from "@/lib/homebrew/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ definitionId: string; versionId: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { definitionId, versionId } = await context.params;
    return NextResponse.json({ version: deprecateVersion(userId, definitionId, versionId) });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not deprecate version.");
  }
}
