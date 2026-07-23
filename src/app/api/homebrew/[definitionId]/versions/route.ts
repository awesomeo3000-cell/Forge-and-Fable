import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { saveVersion } from "@/lib/homebrew/homebrewStore";
import {
  homebrewErrorResponse,
  parseIfMatch,
  readJsonBody,
  RequestBodyError,
  serverError,
} from "@/lib/homebrew/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ definitionId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { definitionId } = await context.params;
    const expectedRevision = parseIfMatch(request);
    const body = (await readJsonBody(request)) as Record<string, unknown>;

    if (body.payload == null || typeof body.payload !== "object") {
      throw new RequestBodyError("A payload is required.", 400);
    }
    if (typeof body.changeSummary !== "string" || body.changeSummary.trim().length === 0) {
      throw new RequestBodyError("A change summary is required.", 400);
    }

    const version = saveVersion(userId, definitionId, {
      payload: body.payload as never,
      changeSummary: body.changeSummary,
      label: typeof body.label === "string" ? body.label : undefined,
      parentVersionId: typeof body.parentVersionId === "string" ? body.parentVersionId : undefined,
      expectedRevision,
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not save version.");
  }
}
