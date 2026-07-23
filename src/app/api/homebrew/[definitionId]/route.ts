import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getDefinitionDetail, updateDefinitionMetadata } from "@/lib/homebrew/homebrewStore";
import {
  homebrewErrorResponse,
  parseIfMatch,
  readJsonBody,
  RequestBodyError,
  serverError,
} from "@/lib/homebrew/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ definitionId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { definitionId } = await context.params;
    return NextResponse.json(getDefinitionDetail(userId, definitionId));
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not load homebrew content.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ definitionId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { definitionId } = await context.params;
    const expectedRevision = parseIfMatch(request);
    const body = (await readJsonBody(request)) as Record<string, unknown>;

    if (body.visibility !== undefined && body.visibility !== "private" && body.visibility !== "campaign") {
      throw new RequestBodyError("visibility must be 'private' or 'campaign'.", 400);
    }
    if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length === 0)) {
      throw new RequestBodyError("title must be a non-empty string.", 400);
    }
    if (body.archived !== undefined && typeof body.archived !== "boolean") {
      throw new RequestBodyError("archived must be a boolean.", 400);
    }

    const definition = updateDefinitionMetadata(userId, definitionId, {
      title: body.title as string | undefined,
      visibility: body.visibility as "private" | "campaign" | undefined,
      archived: body.archived as boolean | undefined,
      expectedRevision,
    });
    return NextResponse.json({ definition });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not update homebrew content.");
  }
}
