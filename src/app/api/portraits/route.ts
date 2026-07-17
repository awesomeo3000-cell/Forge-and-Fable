/**
 * POST /api/portraits
 *
 * Accepts a portrait image upload (multipart/form-data, 'file' field),
 * validates type and size, stores it, and returns the site-relative
 * portraitUrl to persist on the character.
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import {
  MAX_PORTRAIT_SIZE,
  MAX_PORTRAITS_PER_USER,
  MAX_PORTRAIT_STORAGE_PER_USER,
  PORTRAIT_MIME_TYPES,
  listUserPortraits,
  savePortrait,
  sniffImageMime,
  userPortraitStorage,
} from "@/lib/portraitStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const storage = userPortraitStorage(userId);
    return NextResponse.json({
      portraits: listUserPortraits(userId),
      storage: { ...storage, limitBytes: MAX_PORTRAIT_STORAGE_PER_USER },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not list portraits." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 },
      );
    }

    // Early size check via content-length (if available)
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength && contentLength > MAX_PORTRAIT_SIZE + 1024 * 1024) {
      return NextResponse.json(
        { error: `Image too large (max ${MAX_PORTRAIT_SIZE / 1024 / 1024} MB).` },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send a 'file' field with the image." },
        { status: 400 },
      );
    }

    if (file.size > MAX_PORTRAIT_SIZE) {
      return NextResponse.json(
        { error: `Image too large (max ${MAX_PORTRAIT_SIZE / 1024 / 1024} MB).` },
        { status: 413 },
      );
    }
    if (!PORTRAIT_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, WebP, or GIF images are accepted." },
        { status: 400 },
      );
    }

    // Validate the actual bytes, not just the declared type.
    const bytes = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImageMime(bytes);
    if (!sniffed || bytes.length > MAX_PORTRAIT_SIZE) {
      return NextResponse.json(
        { error: "The file does not look like a valid PNG, JPEG, WebP, or GIF image." },
        { status: 400 },
      );
    }

    const storage = userPortraitStorage(userId);
    if (storage.count >= MAX_PORTRAITS_PER_USER) {
      return NextResponse.json(
        { error: `Upload limit reached (${MAX_PORTRAITS_PER_USER} images per account).` },
        { status: 403 },
      );
    }
    if (storage.bytes + bytes.length > MAX_PORTRAIT_STORAGE_PER_USER) {
      return NextResponse.json(
        { error: `Portrait storage limit reached (${MAX_PORTRAIT_STORAGE_PER_USER / 1024 / 1024} MB per account).` },
        { status: 413 },
      );
    }

    const id = savePortrait(userId, sniffed, bytes);
    return NextResponse.json({ portraitUrl: `/api/portraits/${id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload the portrait." },
      { status: 500 },
    );
  }
}
