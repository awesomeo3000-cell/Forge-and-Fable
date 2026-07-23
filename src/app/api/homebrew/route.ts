import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createDefinition, listOwnedDefinitions } from "@/lib/homebrew/homebrewStore";
import {
  homebrewErrorResponse,
  readJsonBody,
  RequestBodyError,
  serverError,
} from "@/lib/homebrew/routeHelpers";
import type { ContentBaseline, HomebrewKind } from "@/types/homebrew";
import type { RulesetId } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: readonly HomebrewKind[] = ["item", "class", "subclass", "species", "feat"];
const RULESETS: readonly RulesetId[] = ["2014", "2024"];

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const url = new URL(request.url);
    const kindParam = url.searchParams.get("kind");
    if (kindParam && !KINDS.includes(kindParam as HomebrewKind)) {
      return NextResponse.json({ error: "Unknown content kind filter." }, { status: 400 });
    }
    const definitions = listOwnedDefinitions(userId, {
      kind: (kindParam as HomebrewKind) ?? undefined,
      includeArchived: url.searchParams.get("includeArchived") === "true",
    });
    return NextResponse.json({ definitions });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not list homebrew content.");
  }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = (await readJsonBody(request)) as Record<string, unknown>;

    const kind = body.kind;
    const ruleset = body.ruleset;
    const title = body.title;
    if (typeof kind !== "string" || !KINDS.includes(kind as HomebrewKind)) {
      throw new RequestBodyError("A valid content kind is required.", 400);
    }
    if (typeof ruleset !== "string" || !RULESETS.includes(ruleset as RulesetId)) {
      throw new RequestBodyError("A valid ruleset is required.", 400);
    }
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new RequestBodyError("A title is required.", 400);
    }
    if (body.payload == null || typeof body.payload !== "object") {
      throw new RequestBodyError("A payload is required.", 400);
    }

    const result = createDefinition(userId, {
      kind: kind as HomebrewKind,
      ruleset: ruleset as RulesetId,
      title,
      visibility: body.visibility === "campaign" ? "campaign" : "private",
      payload: body.payload as never,
      changeSummary: typeof body.changeSummary === "string" ? body.changeSummary : undefined,
      baseline: (body.baseline as ContentBaseline | undefined) ?? undefined,
      label: typeof body.label === "string" ? body.label : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return homebrewErrorResponse(error) ?? serverError(error, "Could not create homebrew content.");
  }
}
