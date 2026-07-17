/**
 * POST /api/pdf-imports/:jobId/cancel — cancel a running import (§6).
 * Marks the job, kills any running OCR child, and removes job files.
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getImportJob, updateImportJob, deleteJobFiles, isTerminalStatus } from "@/lib/import/jobs/importJobStore";
import { cancelImportPipeline } from "@/lib/import/jobs/importPipeline";
import { authorizeJob } from "@/lib/import/jobs/jobAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { jobId } = await context.params;
    const job = getImportJob(jobId);
    const denied = authorizeJob(job, userId);
    if (denied || !job) return denied ?? NextResponse.json({ error: "Not found." }, { status: 404 });

    if (!isTerminalStatus(job.status)) {
      updateImportJob(jobId, { status: "cancelled", progressMessage: "Cancelled" });
      cancelImportPipeline(jobId);
      deleteJobFiles(jobId);
    }
    return NextResponse.json({ ok: true, status: "cancelled" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to cancel the import job." }, { status: 500 });
  }
}
