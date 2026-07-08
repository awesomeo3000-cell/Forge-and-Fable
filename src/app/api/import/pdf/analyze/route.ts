/**
 * POST /api/import/pdf/analyze
 *
 * Accepts a PDF file upload, parses it, and returns an ImportDraft
 * for the review screen. Does NOT persist the PDF or any character data.
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { analyzePdf, MAX_PDF_SIZE } from "@/lib/import/pdfAnalyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await authenticateRequest(request);

    // Must be multipart/form-data
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send a 'file' field with the PDF." },
        { status: 400 },
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted." },
        { status: 400 },
      );
    }

    // Validate file signature (PDFs start with %PDF)
    const buffer = Buffer.from(await file.arrayBuffer());
    const header = buffer.slice(0, 5).toString("ascii");
    if (!header.startsWith("%PDF")) {
      return NextResponse.json(
        { error: "Invalid PDF file (bad signature)." },
        { status: 400 },
      );
    }

    // Size check
    if (buffer.length > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: `PDF too large (max ${MAX_PDF_SIZE / 1024 / 1024} MB).` },
        { status: 400 },
      );
    }

    // Analyze
    const draft = await analyzePdf(buffer, file.name);

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to analyze PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
