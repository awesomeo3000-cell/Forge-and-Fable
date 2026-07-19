/**
 * GET    /api/pdf-imports/:jobId — job status for progress polling (§6/§13).
 * DELETE /api/pdf-imports/:jobId — delete the job and its files.
 *
 * Every read is authorized against the job's owner; filesystem paths and
 * internal error detail never leave the server (§21).
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getImportJob, deleteImportJob, updateImportJob, isTerminalStatus } from "@/lib/import/jobs/importJobStore";
import { authorizeJob } from "@/lib/import/jobs/jobAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A healthy pipeline writes progress at every stage (and per OCR page), so any
// non-terminal job that hasn't advanced in this long has been abandoned — a
// deploy restart, or post-response work the host dropped. Self-heal it to
// failed so the poller gets a terminal answer instead of spinning forever.
const STALL_MS = 120_000;

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { jobId } = await context.params;
    let job = getImportJob(jobId);
    const denied = authorizeJob(job, userId);
    if (denied || !job) return denied ?? NextResponse.json({ error: "Not found." }, { status: 404 });

    if (!isTerminalStatus(job.status) && Date.now() - Date.parse(job.updatedAt) > STALL_MS) {
      updateImportJob(job.id, {
        status: "failed",
        errorCode: "STALLED",
        errorMessage: "The import stopped unexpectedly before it finished. Please try uploading the PDF again.",
        progressMessage: "Import failed",
      });
      job = getImportJob(jobId) ?? job;
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progressPercent: job.progressPercent,
      progressMessage: job.progressMessage,
      requiresOcr: job.requiresOcr,
      pageCount: job.pageCount,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to read the import job." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { jobId } = await context.params;
    const job = getImportJob(jobId);
    const denied = authorizeJob(job, userId);
    if (denied) return denied;

    deleteImportJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to delete the import job." }, { status: 500 });
  }
}
