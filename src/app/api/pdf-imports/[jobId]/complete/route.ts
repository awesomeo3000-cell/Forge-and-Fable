/**
 * POST /api/pdf-imports/:jobId/complete — mark a job consumed after the
 * reviewed character has been created (via the existing create route), then
 * drop the job files immediately instead of waiting for retention (§22).
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getImportJob, updateImportJob, deleteJobFiles } from "@/lib/import/jobs/importJobStore";
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

    if (job.status === "ready") {
      updateImportJob(jobId, { status: "completed", progressMessage: "Character created" });
      deleteJobFiles(jobId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to complete the import job." }, { status: 500 });
  }
}
