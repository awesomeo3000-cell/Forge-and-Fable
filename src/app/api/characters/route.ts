import { NextResponse } from "next/server";
import { createCharacter, listCharacters } from "@/lib/vaultStore";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { validateCharacterInput } from "@/lib/validateCharacter";
import type { Character } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const characters = await listCharacters(userId);
    return NextResponse.json({ characters });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list characters." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const raw = await request.json();
    const body = validateCharacterInput(raw, false) as Omit<Character, "id" | "userId" | "createdAt">;
    const character = await createCharacter(userId, body);

    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create character." },
      { status: 400 },
    );
  }
}
