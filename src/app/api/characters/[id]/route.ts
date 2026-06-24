import { NextResponse } from "next/server";
import { deleteCharacter, getCharacter, updateCharacter } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUserId(request: Request) {
  return request.headers.get("x-user-id")?.trim() ?? "";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = getUserId(request);
  const { id } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: "Vault session required." }, { status: 401 });
  }

  const character = await getCharacter(userId, id);

  if (!character) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }

  return NextResponse.json({ character });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = getUserId(request);
    const { id } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Vault session required." }, { status: 401 });
    }

    const patch = await request.json();
    const character = await updateCharacter(userId, id, patch);

    return NextResponse.json({ character });
  } catch (error) {
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
    const userId = getUserId(request);
    const { id } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Vault session required." }, { status: 401 });
    }

    await deleteCharacter(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete character." },
      { status: 400 },
    );
  }
}
