import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { addCampaignTrack, deleteCampaignTrack, listCampaignTracks } from "@/lib/campaignStore";
import type { CampaignTrack } from "@/types/campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readTrack(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Track data is required.");
  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 60) : "";
  const url = typeof input.url === "string" ? input.url.trim().slice(0, 500) : "";
  const kind: CampaignTrack["kind"] | null = input.kind === "music" || input.kind === "cue" ? input.kind : null;
  if (!title || !url || !kind) throw new Error("Title, URL, and track kind are required.");
  if (!/^https?:\/\//i.test(url)) throw new Error("Track URL must use http or https.");
  return { title, url, kind };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json({ tracks: listCampaignTracks(id, userId) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load tracks." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json({ track: addCampaignTrack(id, userId, readTrack(await request.json())) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add track." }, { status: error instanceof Error && error.message.includes("DM") ? 403 : 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const trackId = new URL(request.url).searchParams.get("trackId")?.trim();
    if (!trackId) return NextResponse.json({ error: "trackId is required." }, { status: 400 });
    deleteCampaignTrack(id, userId, trackId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete track." }, { status: error instanceof Error && error.message.includes("DM") ? 403 : 400 });
  }
}
