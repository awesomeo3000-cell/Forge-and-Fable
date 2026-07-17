import { NextResponse } from "next/server";
import type { PdfImportJob } from "./importJobStore";
import { PDF_IMPORT_ERROR_COPY } from "../importLimits";

/**
 * Enforce job ownership for every job read (OCR plan §21). Returns a ready
 * response on failure, null when access is allowed. Missing and foreign jobs
 * share one shape so job ids can't be probed.
 */
export function authorizeJob(job: PdfImportJob | null, userId: string): NextResponse | null {
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: PDF_IMPORT_ERROR_COPY.JOB_NOT_FOUND, code: "JOB_NOT_FOUND" }, { status: 404 });
  }
  return null;
}
