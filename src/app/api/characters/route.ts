import { NextResponse } from "next/server";
import { createCharacter, listCharacters } from "@/lib/vaultStore";
import type { Character } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUserId(request: Request) {
  return request.headers.get("x-user-id")?.trim() ?? "";
}

export async function GET(request: Request) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Vault session required." }, { status: 401 });
  }

  const characters = await listCharacters(userId);
  return NextResponse.json({ characters });
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);

    if (!userId) {
      return NextResponse.json({ error: "Vault session required." }, { status: 401 });
    }

    const body = (await request.json()) as Omit<Character, "id" | "userId" | "createdAt">;
    const character = await createCharacter(userId, body);

    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create character." },
      { status: 400 },
    );
  }
}
