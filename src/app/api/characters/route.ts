import { NextResponse } from "next/server";
import { createCharacter, listCharacters } from "@/lib/vaultStore";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { CharacterValidationError, validateCharacterInput } from "@/lib/validateCharacter";
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
  let userId: string;
  try {
    userId = await authenticateRequest(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not authenticate character creation." }, { status: 500 });
  }

  let body: Omit<Character, "id" | "userId" | "createdAt">;
  try {
    const raw = await request.json();
    body = validateCharacterInput(raw, false) as Omit<Character, "id" | "userId" | "createdAt">;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid character payload." },
      { status: 400 },
    );
  }

  try {
    const character = await createCharacter(userId, body);
    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    if (error instanceof CharacterValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Storage/transaction failures must be visible as infrastructure errors;
    // returning 400 here makes a real persistence outage look like bad input.
    return NextResponse.json({ error: "Could not create character." }, { status: 500 });
  }
}
