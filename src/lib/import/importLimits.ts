/**
 * PDF import limits, feature flags and error taxonomy (OCR plan §7/§23/§24).
 * All limits live here so they can be tuned in one place; the env flags let
 * the OCR workflow roll out without touching the legacy analyze route.
 */

export const PDF_IMPORT_LIMITS = {
  /** Matches the legacy analyze route's cap so both paths agree. */
  maxFileSizeBytes: 10 * 1024 * 1024,
  /** Pages the text extractor will read (legacy MAX_PAGES). */
  maxParsePages: 30,
  /** Pages the OCR path will rasterize — OCR cost is per page. */
  maxOcrPages: 12,
  maxOcrDurationMs: 180_000,
  maxConcurrentOcrJobs: 2,
  /** Job records and temp files live this long after creation. */
  jobRetentionMs: 60 * 60 * 1000,
  /** Raster resolution for OCR. 300 DPI is the Tesseract sweet spot. */
  ocrRasterDpi: 300,
} as const;

/** Master switch for the job-based OCR import workflow (plan §24). */
export function pdfImportOcrEnabled(): boolean {
  return process.env.PDF_IMPORT_OCR_ENABLED === "true";
}

/** Force OCR on every import — calibration/debugging only. */
export function pdfImportOcrForced(): boolean {
  return process.env.PDF_IMPORT_OCR_FORCE === "true";
}

export function pdfImportOcrTimeoutMs(): number {
  const configured = Number(process.env.PDF_IMPORT_OCR_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : PDF_IMPORT_LIMITS.maxOcrDurationMs;
}

export function pdfImportOcrConcurrency(): number {
  const configured = Number(process.env.PDF_IMPORT_OCR_MAX_CONCURRENCY);
  return Number.isFinite(configured) && configured >= 1
    ? Math.min(Math.floor(configured), 4)
    : PDF_IMPORT_LIMITS.maxConcurrentOcrJobs;
}

// ── Error taxonomy (§23): machine-readable codes with plain user copy ──

export type PdfImportErrorCode =
  | "INVALID_FILE_TYPE"
  | "INVALID_PDF_SIGNATURE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "PDF_ENCRYPTED"
  | "PDF_MALFORMED"
  | "TEXT_EXTRACTION_FAILED"
  | "OCR_TIMEOUT"
  | "OCR_FAILED"
  | "PARSER_FAILED"
  | "JOB_EXPIRED"
  | "JOB_NOT_FOUND"
  | "JOB_ACCESS_DENIED";

/** User-facing copy per code — no internals, no paths, no stderr (§14/§21). */
export const PDF_IMPORT_ERROR_COPY: Record<PdfImportErrorCode, string> = {
  INVALID_FILE_TYPE: "Only PDF files are accepted.",
  INVALID_PDF_SIGNATURE: "This file does not look like a valid PDF.",
  FILE_TOO_LARGE: `PDF too large (max ${PDF_IMPORT_LIMITS.maxFileSizeBytes / 1024 / 1024} MB).`,
  TOO_MANY_PAGES: `This PDF has too many pages to import (max ${PDF_IMPORT_LIMITS.maxOcrPages} for scanned sheets).`,
  PDF_ENCRYPTED: "This PDF is password-protected. Remove the password and try again.",
  PDF_MALFORMED: "We could not open this PDF. Try re-exporting it.",
  TEXT_EXTRACTION_FAILED: "We could not read this PDF reliably. You can try another export or enter the details manually.",
  OCR_TIMEOUT: "Reading this scanned sheet took too long. Try a smaller or clearer export.",
  OCR_FAILED: "We could not read this PDF reliably. You can try another export or enter the details manually.",
  PARSER_FAILED: "We could not match this sheet's details. You can try another export or enter the details manually.",
  JOB_EXPIRED: "This import expired. Upload the PDF again to continue.",
  JOB_NOT_FOUND: "This import could not be found. Upload the PDF again to continue.",
  JOB_ACCESS_DENIED: "This import belongs to a different account.",
};

export class PdfImportError extends Error {
  readonly code: PdfImportErrorCode;
  /** Internal detail for diagnostics — never sent to the browser. */
  readonly internalDetail?: string;

  constructor(code: PdfImportErrorCode, internalDetail?: string) {
    super(PDF_IMPORT_ERROR_COPY[code]);
    this.code = code;
    this.internalDetail = internalDetail;
  }
}
