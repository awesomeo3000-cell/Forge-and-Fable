/**
 * POST /api/pdf-imports — create a PDF import job (OCR plan §6).
 *
 * Validates the upload, stores the original in the job directory, and kicks
 * the pipeline off detached from this request. Returns 501 while the feature
 * flag is off so the client can fall back to the legacy synchronous analyze.
 */

import { NextResponse, after } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { PDF_IMPORT_LIMITS, PDF_IMPORT_ERROR_COPY, pdfImportOcrEnabled } from "@/lib/import/importLimits";
import { createImportJob, sweepExpiredImportJobs } from "@/lib/import/jobs/importJobStore";
import { runImportPipeline } from "@/lib/import/jobs/importPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);

    if (!pdfImportOcrEnabled()) {
      return NextResponse.json({ error: "PDF import jobs are not enabled." }, { status: 501 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data with a 'file' field." }, { status: 400 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength && contentLength > PDF_IMPORT_LIMITS.maxFileSizeBytes + 1024 * 1024) {
      return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.FILE_TOO_LARGE, code: "FILE_TOO_LARGE" }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided. Send a 'file' field with the PDF." }, { status: 400 });
    }
    if (file.size > PDF_IMPORT_LIMITS.maxFileSizeBytes) {
      return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.FILE_TOO_LARGE, code: "FILE_TOO_LARGE" }, { status: 413 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.INVALID_FILE_TYPE, code: "INVALID_FILE_TYPE" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > PDF_IMPORT_LIMITS.maxFileSizeBytes) {
      return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.FILE_TOO_LARGE, code: "FILE_TOO_LARGE" }, { status: 413 });
    }
    if (!buffer.subarray(0, 5).toString("ascii").startsWith("%PDF")) {
      return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.INVALID_PDF_SIGNATURE, code: "INVALID_PDF_SIGNATURE" }, { status: 400 });
    }

    // Opportunistic retention sweep (§22) — cheap, keeps the disk honest.
    try { sweepExpiredImportJobs(); } catch { /* sweep is best-effort */ }

    const job = createImportJob(userId, file.name, buffer);

    // Run the pipeline as post-response work via after(): a bare `void` promise
    // is not guaranteed to run to completion once the request ends (it worked in
    // local QA but left deployed jobs stuck on "uploaded" — the pipeline never
    // ran). after() keeps the invocation alive until the pipeline settles.
    after(() => runImportPipeline(job.id));

    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to start the PDF import." }, { status: 500 });
  }
}
