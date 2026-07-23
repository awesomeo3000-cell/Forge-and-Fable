/**
 * Shared HTTP helpers for the homebrew route handlers: typed-error → response
 * mapping, a body-size guard, and `If-Match` revision parsing. Keeps every route
 * consistent with the status-code contract in proposal §12.
 */
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import {
  HomebrewAuthorizationError,
  HomebrewConflictError,
  HomebrewNotFoundError,
  HomebrewStateError,
  HomebrewValidationError,
} from "@/lib/homebrew/homebrewStore";

/** Envelope + payload byte ceiling (payload budget is 256 KB; allow headroom). */
export const MAX_HOMEBREW_BODY_BYTES = 512 * 1024;

export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_HOMEBREW_BODY_BYTES) {
    throw new RequestBodyError("Request body exceeds the size limit.", 413);
  }
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.", 400);
  }
}

export function parseIfMatch(request: Request): number {
  const raw = request.headers.get("if-match")?.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  if (!raw) {
    throw new RequestBodyError("This action requires the definition revision (If-Match header).", 428);
  }
  const revision = Number(raw);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new RequestBodyError("If-Match must contain a non-negative revision.", 400);
  }
  return revision;
}

/** Map a known error to a JSON response, or return null to let the caller 500. */
export function homebrewErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof RequestBodyError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof HomebrewValidationError) {
    return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
  }
  if (error instanceof HomebrewConflictError) {
    return NextResponse.json({ error: error.message, currentRevision: error.currentRevision }, { status: 409 });
  }
  if (error instanceof HomebrewStateError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof HomebrewAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof HomebrewNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return null;
}

export function serverError(error: unknown, fallback: string): NextResponse {
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}
