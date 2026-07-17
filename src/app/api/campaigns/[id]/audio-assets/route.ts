import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import {
  CAMPAIGN_AUDIO_MIME_TYPES,
  MAX_CAMPAIGN_AUDIO_SIZE,
  saveCampaignAudioAsset,
  sniffAudioMime,
} from "@/lib/campaignAudioStore";
import { addCampaignTrack } from "@/lib/campaignStore";
import type { CampaignTrack } from "@/types/campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id: campaignId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const title = typeof formData.get("title") === "string" ? String(formData.get("title")).trim().slice(0, 60) : "";
    const kindValue = formData.get("kind");
    const kind: CampaignTrack["kind"] | null = kindValue === "music" || kindValue === "cue" ? kindValue : null;
    if (!title || !kind || !file || !(file instanceof File)) return NextResponse.json({ error: "Title, audio file, and track kind are required." }, { status: 400 });
    if (file.size > MAX_CAMPAIGN_AUDIO_SIZE) return NextResponse.json({ error: `Audio file too large (max ${MAX_CAMPAIGN_AUDIO_SIZE / 1024 / 1024} MB).` }, { status: 413 });
    if (!CAMPAIGN_AUDIO_MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Choose a supported audio file such as MP3, WAV, OGG, FLAC, M4A, or WebM." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniffAudioMime(bytes, file.type);
    if (!mime) return NextResponse.json({ error: "The selected file does not look like a supported audio file." }, { status: 400 });
    const assetId = saveCampaignAudioAsset(campaignId, mime, bytes);
    try {
      const track = addCampaignTrack(campaignId, userId, { title, url: `/api/campaigns/${encodeURIComponent(campaignId)}/audio-assets/${assetId}`, kind });
      return NextResponse.json({ track }, { status: 201 });
    } catch (error) {
      // The asset is only useful through a track; avoid leaving it behind if track creation fails.
      const { deleteCampaignAudioAsset } = await import("@/lib/campaignAudioStore");
      deleteCampaignAudioAsset(assetId, campaignId);
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload audio." }, { status: error instanceof Error && error.message.includes("DM") ? 403 : 400 });
  }
}
