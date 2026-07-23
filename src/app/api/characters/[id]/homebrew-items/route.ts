import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { readPinnedItemVersion } from "@/lib/homebrew/homebrewStore";
import { getCharacter, getCharacterForDmReadOnly } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await context.params;
    const readOnlyDmView = new URL(request.url).searchParams.get("mode") === "dm-readonly";
    const character = readOnlyDmView
      ? await getCharacterForDmReadOnly(userId, id)
      : await getCharacter(userId, id);
    if (!character) return NextResponse.json({ error: "Character not found." }, { status: 404 });

    const items = character.inventory.flatMap((item) => {
      const ref = item.homebrew?.contentRef;
      if (!ref || ref.source !== "homebrew" || ref.kind !== "item") return [];
      const resolved = readPinnedItemVersion(ref.definitionId, ref.versionId);
      return resolved ? [{
        itemId: item.id,
        definitionId: ref.definitionId,
        versionId: ref.versionId,
        ...resolved,
      }] : [];
    });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resolve character homebrew items." },
      { status: 500 },
    );
  }
}
