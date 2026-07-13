import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { clearRehearsalParty, seatRehearsalParty } from "@/lib/dmTable/rehearsal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json({ members: seatRehearsalParty(id, userId) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Could not seat rehearsal party.";
    return NextResponse.json({ error: message }, { status: message.includes("Only") ? 403 : 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json(clearRehearsalParty(id, userId));
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Could not clear rehearsal party.";
    return NextResponse.json({ error: message }, { status: message.includes("Only") ? 403 : 400 });
  }
}
