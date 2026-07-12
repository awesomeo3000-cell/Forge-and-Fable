import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { dmToolsError } from "@/lib/dmToolsRoute";
import { deleteCharacterNote, updateCharacterNote } from "@/lib/dmTable/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try { const userId = await authenticateRequest(request), { id, noteId } = await params; return NextResponse.json({ note: updateCharacterNote(id, userId, noteId, await request.json()) }); }
  catch (error) { return dmToolsError(error, "Could not update character note."); }
}

export async function DELETE(request: Request, { params }: Context) {
  try { const userId = await authenticateRequest(request), { id, noteId } = await params; deleteCharacterNote(id, userId, noteId); return NextResponse.json({ ok: true }); }
  catch (error) { return dmToolsError(error, "Could not delete character note."); }
}
