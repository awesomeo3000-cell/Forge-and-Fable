/**
 * GET /api/pdf-imports/:jobId/result — the parsed ImportDraft once the job
 * is ready (§6). The draft feeds the existing review screen unchanged.
 */

import fs from "node:fs";
import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { getImportJob, jobFilePath } from "@/lib/import/jobs/importJobStore";
import { authorizeJob } from "@/lib/import/jobs/jobAuth";
import { PDF_IMPORT_ERROR_COPY } from "@/lib/import/importLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { jobId } = await context.params;
    const job = getImportJob(jobId);
    const denied = authorizeJob(job, userId);
    if (denied || !job) return denied ?? NextResponse.json({ error: "Not found." }, { status: 404 });

    if (job.status === "expired") {
      return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.JOB_EXPIRED, code: "JOB_EXPIRED" }, { status: 410 });
    }
    if (job.status !== "ready" && job.status !== "completed") {
      return NextResponse.json({ error: "The import result is not ready yet.", status: job.status }, { status: 409 });
    }

    const resultPath = jobFilePath(jobId, "result");
    if (!fs.existsSync(resultPath)) {
      return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.JOB_EXPIRED, code: "JOB_EXPIRED" }, { status: 410 });
    }
    const result = JSON.parse(fs.readFileSync(resultPath, "utf8")) as { draft: unknown };
    return NextResponse.json({ draft: result.draft, requiresOcr: job.requiresOcr });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to read the import result." }, { status: 500 });
  }
}
