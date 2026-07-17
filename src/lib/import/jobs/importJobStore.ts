/**
 * Durable PDF-import job store (OCR plan §5/§22).
 *
 * Job rows live in SQLite so progress survives a page refresh; job files
 * (original upload, OCR output, parse result, diagnostics) live under
 * `<data dir>/imports/<jobId>/`. Filesystem paths are derived from the job id
 * and never stored in the row or returned to the browser.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb, getDataDir } from "@/lib/db";
import { PDF_IMPORT_LIMITS, type PdfImportErrorCode } from "../importLimits";

export type PdfImportStatus =
  | "uploaded"
  | "extracting-text"
  | "assessing-text"
  | "ocr-queued"
  | "ocr-processing"
  | "parsing"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type PdfImportJob = {
  id: string;
  userId: string;
  status: PdfImportStatus;
  originalFilename: string;
  sizeBytes: number;
  pageCount: number | null;
  requiresOcr: boolean | null;
  ocrReason: string | null;
  ocrDurationMs: number | null;
  textQualityScore: number | null;
  progressPercent: number;
  progressMessage: string | null;
  errorCode: PdfImportErrorCode | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type JobRow = {
  id: string;
  user_id: string;
  status: string;
  original_filename: string;
  size_bytes: number;
  page_count: number | null;
  requires_ocr: number | null;
  ocr_reason: string | null;
  ocr_duration_ms: number | null;
  text_quality_score: number | null;
  progress_percent: number;
  progress_message: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

function rowToJob(row: JobRow): PdfImportJob {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status as PdfImportStatus,
    originalFilename: row.original_filename,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    requiresOcr: row.requires_ocr === null ? null : row.requires_ocr === 1,
    ocrReason: row.ocr_reason,
    ocrDurationMs: row.ocr_duration_ms,
    textQualityScore: row.text_quality_score,
    progressPercent: row.progress_percent,
    progressMessage: row.progress_message,
    errorCode: row.error_code as PdfImportErrorCode | null,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

// ── Job directories ──

export function importsRootDir(): string {
  return path.join(getDataDir(), "imports");
}

/** Job ids are random and become directory names — never user input. */
export function jobDir(jobId: string): string {
  if (!/^imp_[a-f0-9]{24}$/.test(jobId)) throw new Error("Invalid job id.");
  return path.join(importsRootDir(), jobId);
}

export const JOB_FILES = {
  original: "original.pdf",
  ocrPages: "ocr-pages.json",
  result: "result.json",
  diagnostics: "diagnostics.json",
} as const;

export function jobFilePath(jobId: string, file: keyof typeof JOB_FILES): string {
  return path.join(jobDir(jobId), JOB_FILES[file]);
}

// ── CRUD ──

export function createImportJob(userId: string, originalFilename: string, pdf: Buffer): PdfImportJob {
  const id = `imp_${crypto.randomBytes(12).toString("hex")}`;
  const now = new Date();
  const expires = new Date(now.getTime() + PDF_IMPORT_LIMITS.jobRetentionMs);

  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, JOB_FILES.original), pdf);

  // The original filename is stored as metadata only — never used on disk.
  const safeName = originalFilename.slice(0, 200);

  getDb()
    .prepare(
      `INSERT INTO pdf_import_jobs
        (id, user_id, status, original_filename, size_bytes, progress_percent, progress_message, created_at, updated_at, expires_at)
       VALUES (?, ?, 'uploaded', ?, ?, 15, 'Checking document', ?, ?, ?)`,
    )
    .run(id, userId, safeName, pdf.length, now.toISOString(), now.toISOString(), expires.toISOString());

  const job = getImportJob(id);
  if (!job) throw new Error("Failed to create import job.");
  return job;
}

export function getImportJob(jobId: string): PdfImportJob | null {
  const row = getDb().prepare("SELECT * FROM pdf_import_jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  if (!row) return null;
  const job = rowToJob(row);
  // Lazy expiry: anything past its retention window reads as expired.
  if (Date.parse(job.expiresAt) < Date.now() && !["completed", "expired"].includes(job.status)) {
    updateImportJob(jobId, { status: "expired" });
    return { ...job, status: "expired" };
  }
  return job;
}

export function updateImportJob(
  jobId: string,
  patch: Partial<{
    status: PdfImportStatus;
    pageCount: number;
    requiresOcr: boolean;
    ocrReason: string;
    ocrDurationMs: number;
    textQualityScore: number;
    progressPercent: number;
    progressMessage: string;
    errorCode: PdfImportErrorCode;
    errorMessage: string;
  }>,
): void {
  const columns: Record<string, string> = {
    status: "status",
    pageCount: "page_count",
    requiresOcr: "requires_ocr",
    ocrReason: "ocr_reason",
    ocrDurationMs: "ocr_duration_ms",
    textQualityScore: "text_quality_score",
    progressPercent: "progress_percent",
    progressMessage: "progress_message",
    errorCode: "error_code",
    errorMessage: "error_message",
  };
  const sets: string[] = [];
  const values: Array<string | number> = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : (value as string | number));
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(jobId);
  getDb().prepare(`UPDATE pdf_import_jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

/** Terminal statuses never transition again (e.g. cancel-after-finish). */
export function isTerminalStatus(status: PdfImportStatus): boolean {
  return ["ready", "completed", "failed", "cancelled", "expired"].includes(status);
}

// ── File helpers ──

export function deleteJobFiles(jobId: string): void {
  try {
    fs.rmSync(jobDir(jobId), { recursive: true, force: true });
  } catch {
    // Cleanup is best-effort; the sweep retries on the next pass.
  }
}

export function deleteImportJob(jobId: string): void {
  deleteJobFiles(jobId);
  getDb().prepare("DELETE FROM pdf_import_jobs WHERE id = ?").run(jobId);
}

/**
 * Remove expired job rows and their directories, plus any orphan directories
 * left behind by a crash (§22). Runs opportunistically on job creation and
 * from the `cleanup:pdf-imports` script.
 */
export function sweepExpiredImportJobs(): number {
  const db = getDb();
  const expired = db
    .prepare("SELECT id FROM pdf_import_jobs WHERE expires_at < ?")
    .all(new Date().toISOString()) as Array<{ id: string }>;
  for (const { id } of expired) {
    deleteJobFiles(id);
    db.prepare("DELETE FROM pdf_import_jobs WHERE id = ?").run(id);
  }

  // Orphan directories (no matching row).
  let removed = expired.length;
  const root = importsRootDir();
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root)) {
      if (!/^imp_[a-f0-9]{24}$/.test(entry)) continue;
      const row = db.prepare("SELECT id FROM pdf_import_jobs WHERE id = ?").get(entry);
      if (!row) {
        try {
          fs.rmSync(path.join(root, entry), { recursive: true, force: true });
          removed++;
        } catch { /* next sweep */ }
      }
    }
  }
  return removed;
}
