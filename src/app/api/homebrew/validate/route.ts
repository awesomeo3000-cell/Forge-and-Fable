import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { validateHomebrewPayload } from "@/lib/homebrew/homebrewSchema";
import { homebrewErrorResponse, readJsonBody, RequestBodyError, serverError } from "@/lib/homebrew/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Validate an unsaved editor payload and return structured diagnostics. */
export async function POST(request: Request) {
  try {
    await authenticateRequest(request);
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    if (body.payload == null || typeof body.payload !== "object") {
      throw new RequestBodyError("A payload is required.", 400);
    }
    const errors = validateHomebrewPayload(body.payload);
    return NextResponse.json({ valid: errors.length === 0, errors });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not validate payload.");
  }
}
