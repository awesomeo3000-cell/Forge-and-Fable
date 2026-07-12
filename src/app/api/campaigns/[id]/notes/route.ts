import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { dmToolsError } from "@/lib/dmToolsRoute";
import { createCharacterNote, listCharacterNotes } from "@/lib/dmTable/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try { const userId = await authenticateRequest(request), { id } = await params; const characterId = new URL(request.url).searchParams.get("characterId") ?? undefined; return NextResponse.json({ notes: listCharacterNotes(id, userId, characterId) }); }
  catch (error) { return dmToolsError(error, "Could not load character notes."); }
}

export async function POST(request: Request, { params }: Context) {
  try { const userId = await authenticateRequest(request), { id } = await params; return NextResponse.json({ note: createCharacterNote(id, userId, await request.json()) }, { status: 201 }); }
  catch (error) { return dmToolsError(error, "Could not create character note."); }
}
