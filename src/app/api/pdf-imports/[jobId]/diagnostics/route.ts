/**
 * GET /api/pdf-imports/:jobId/diagnostics — import diagnostics (§20):
 * assessment scores, OCR decision reasons, stage timings, worker stderr.
 * Admin-only (job owner additionally allowed outside production) — this is
 * the tool for improving inconsistent imports, not a user surface.
 */

import fs from "node:fs";
import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getImportJob, jobFilePath } from "@/lib/import/jobs/importJobStore";
import { authorizeJob } from "@/lib/import/jobs/jobAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const userId = await authenticateRequest(request);
    const { jobId } = await context.params;
    const job = getImportJob(jobId);
    const denied = authorizeJob(job, userId);
    if (denied) return denied;

    if (process.env.NODE_ENV === "production") {
      await requireAdmin(request);
    }

    const diagPath = jobFilePath(jobId, "diagnostics");
    if (!fs.existsSync(diagPath)) {
      return NextResponse.json({ error: "No diagnostics recorded for this job." }, { status: 404 });
    }
    return NextResponse.json(JSON.parse(fs.readFileSync(diagPath, "utf8")));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to read diagnostics." }, { status: 500 });
  }
}
