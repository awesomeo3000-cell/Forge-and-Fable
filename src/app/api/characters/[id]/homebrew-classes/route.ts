import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { readPinnedVersionPayload } from "@/lib/homebrew/homebrewStore";
import { getCharacter, getCharacterForDmReadOnly } from "@/lib/vaultStore";
import type { HomebrewClassPayload, HomebrewSubclassPayload, RulesContentRef } from "@/types/homebrew";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve the immutable pinned payloads for a character's homebrew class and
 * subclass references (from `classLevels`). Pinned resolution — no access
 * re-check — so a character keeps resolving content it already uses (§11.2).
 * The client builds a resolved-DTO registry from these to compute progression.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await context.params;
    const readOnlyDmView = new URL(request.url).searchParams.get("mode") === "dm-readonly";
    const character = readOnlyDmView
      ? await getCharacterForDmReadOnly(userId, id)
      : await getCharacter(userId, id);
    if (!character) return NextResponse.json({ error: "Character not found." }, { status: 404 });

    const refs: RulesContentRef[] = [];
    for (const entry of character.classLevels ?? []) {
      if (entry.classRef.source === "homebrew") refs.push(entry.classRef);
      if (entry.subclassRef?.source === "homebrew") refs.push(entry.subclassRef);
    }

    const classes = refs.flatMap((ref) => {
      if (ref.source !== "homebrew") return [];
      const payload = readPinnedVersionPayload(ref.definitionId, ref.versionId);
      if (!payload || (payload.kind !== "class" && payload.kind !== "subclass") || payload.kind !== ref.kind) return [];
      return [{ ref, kind: ref.kind, payload: payload as HomebrewClassPayload | HomebrewSubclassPayload }];
    });
    return NextResponse.json({ classes });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resolve character homebrew classes." },
      { status: 500 },
    );
  }
}
