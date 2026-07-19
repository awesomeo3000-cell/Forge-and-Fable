import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { CAMPAIGN_HANDOUT_MIME_TYPES, MAX_CAMPAIGN_HANDOUT_SIZE, sniffHandoutMime } from "@/lib/campaignHandoutStore";
import { createUploadedHandout } from "@/lib/dmToolsStore";
import { dmToolsError } from "@/lib/dmToolsRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { id: campaignId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    if (file.size > MAX_CAMPAIGN_HANDOUT_SIZE) return NextResponse.json({ error: `Handout file too large (max ${MAX_CAMPAIGN_HANDOUT_SIZE / 1024 / 1024} MB).` }, { status: 413 });
    if (!CAMPAIGN_HANDOUT_MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Choose an image, PDF, text, Word, or ZIP handout." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniffHandoutMime(bytes, file.type);
    if (!mime) return NextResponse.json({ error: "The selected file does not look like a supported handout." }, { status: 400 });
    const title = (String(form.get("title") ?? file.name).trim() || file.name).slice(0, 100);
    const assetType = mime.startsWith("image/") ? "image" : "document";
    const handout = createUploadedHandout(campaignId, userId, {
      title,
      category: String(form.get("category") ?? "other"),
      description: String(form.get("description") ?? "").slice(0, 500),
      privateNotes: String(form.get("privateNotes") ?? "").slice(0, 2000),
      tags: [],
      assetType,
      recipientUserId: String(form.get("recipientUserId") ?? "") || null,
    }, mime, bytes);
    return NextResponse.json({ handout }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return dmToolsError(error, "Could not upload handout.");
  }
}
