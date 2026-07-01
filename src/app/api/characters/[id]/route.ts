import { NextResponse } from "next/server";
import { deleteCharacter, getCharacter, updateCharacter } from "@/lib/vaultStore";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { validateCharacterInput, ALLOWED_PATCH_FIELDS } from "@/lib/validateCharacter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizePatch(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Patch body must be a JSON object.");
  }

  const patch = raw as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(patch)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      throw new Error(`Field "${key}" cannot be modified.`);
    }
    sanitized[key] = patch[key];
  }

  if (Object.keys(sanitized).length === 0) {
    throw new Error("Patch body contains no updatable fields.");
  }

  return sanitized;
}

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await context.params;

    const character = await getCharacter(userId, id);

    if (!character) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    return NextResponse.json({ character });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load character." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await context.params;

    const raw = await request.json();
    const patch = sanitizePatch(raw);
    validateCharacterInput(patch, true);
    const character = await updateCharacter(userId, id, patch);

    return NextResponse.json({ character });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update character." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await context.params;

    await deleteCharacter(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete character." },
      { status: 400 },
    );
  }
}
