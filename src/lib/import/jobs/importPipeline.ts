/**
 * PDF import pipeline (OCR plan §1/§13): validate → extract → assess →
 * OCR when required → parse → result. Runs detached from the upload request;
 * every stage writes truthful progress to the job row and a diagnostics file
 * to the job directory. The original upload is never modified (§2.2).
 */

import fs from "node:fs";
import { loadPdfFromBuffer } from "../pdfJsServer";
import { extractPdfText, extractedTextFromPages, type ExtractedPdfText } from "../pdfExtract";
import { assessPdfText, type PdfTextAssessment } from "../pdfAssess";
import { draftFromPageTexts } from "../pdfAnalyze";
import { analyzeFormFields } from "../pdfFormFields";
import type { ImportDraft, ImportSource } from "../pdfTypes";
import { PDF_IMPORT_LIMITS, PdfImportError, pdfImportOcrForced } from "../importLimits";
import { runPdfOcr, cancelOcr } from "../ocr/runPdfOcr";
import {
  getImportJob,
  updateImportJob,
  jobFilePath,
  isTerminalStatus,
} from "./importJobStore";

type Diagnostics = {
  jobId: string;
  originalFilename: string;
  stages: Array<{ stage: string; at: string; durationMs?: number; detail?: unknown }>;
  assessment?: PdfTextAssessment;
  ocr?: { durationMs: number; words?: number; stderr?: string; timedOut?: boolean };
  parse?: { sourceKind: string; usedOcrText: boolean };
  error?: { code: string; detail?: string };
};

function appendDiagnostics(diag: Diagnostics, jobId: string): void {
  try {
    fs.writeFileSync(jobFilePath(jobId, "diagnostics"), JSON.stringify(diag, null, 2));
  } catch { /* diagnostics are best-effort */ }
}

/** True when the job was cancelled (or expired) out from under the pipeline. */
function jobStopped(jobId: string): boolean {
  const job = getImportJob(jobId);
  return !job || isTerminalStatus(job.status);
}

/**
 * Run the full pipeline for an uploaded job. Fire-and-forget from the upload
 * route — all outcomes land on the job row, never as a thrown error.
 */
export async function runImportPipeline(jobId: string): Promise<void> {
  const job = getImportJob(jobId);
  if (!job || job.status !== "uploaded") return;

  const diag: Diagnostics = { jobId, originalFilename: job.originalFilename, stages: [] };
  const stage = (name: string, detail?: unknown, durationMs?: number) => {
    diag.stages.push({ stage: name, at: new Date().toISOString(), durationMs, detail });
    appendDiagnostics(diag, jobId);
  };

  try {
    const buffer = fs.readFileSync(jobFilePath(jobId, "original"));

    // ── Validate: open the document (signature/size checked at upload) ──
    updateImportJob(jobId, { status: "extracting-text", progressPercent: 20, progressMessage: "Reading existing text" });
    let doc;
    try {
      doc = await loadPdfFromBuffer(buffer);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw new PdfImportError(/password/i.test(message) ? "PDF_ENCRYPTED" : "PDF_MALFORMED", message);
    }

    let extracted: ExtractedPdfText;
    const extractStart = Date.now();
    try {
      extracted = await extractPdfText(doc);
    } catch (error) {
      throw new PdfImportError("TEXT_EXTRACTION_FAILED", error instanceof Error ? error.message : String(error));
    } finally {
      await doc.destroy().catch(() => {});
    }
    updateImportJob(jobId, { pageCount: extracted.numPages });
    stage("extract-text", { pages: extracted.pages.length, characters: extracted.totalCharacters }, Date.now() - extractStart);

    // Fillable AcroForm sheets are the most reliable lane and are destroyed
    // by rasterization — they always take the fast path, never OCR.
    const formFields = await analyzeFormFields(buffer);
    const hasFormFields = Object.keys(formFields).length > 0;

    // ── Assess ──
    if (jobStopped(jobId)) return;
    updateImportJob(jobId, { status: "assessing-text", progressPercent: 32, progressMessage: "Checking text quality" });
    const assessment = assessPdfText(extracted);
    diag.assessment = assessment;
    const requiresOcr = !hasFormFields && (assessment.requiresOcr || pdfImportOcrForced());
    updateImportJob(jobId, {
      requiresOcr,
      ocrReason: assessment.reasons.join(" ") || (pdfImportOcrForced() ? "PDF_IMPORT_OCR_FORCE" : ""),
      textQualityScore: Math.round(assessment.textCoverageScore * 100) / 100,
    });
    stage("assess-text", { requiresOcr, reasons: assessment.reasons, hasFormFields });

    // ── OCR when required ──
    let parseInput = extracted;
    let usedOcrText = false;
    if (requiresOcr) {
      if (extracted.numPages > PDF_IMPORT_LIMITS.maxOcrPages) {
        throw new PdfImportError("TOO_MANY_PAGES", `numPages=${extracted.numPages}`);
      }
      if (jobStopped(jobId)) return;
      updateImportJob(jobId, { status: "ocr-queued", progressPercent: 35, progressMessage: "Preparing your sheet for import" });

      const ocr = await runPdfOcr(jobId, ({ page, pages }) => {
        const span = 70 - 38;
        updateImportJob(jobId, {
          status: "ocr-processing",
          progressPercent: Math.min(70, 38 + Math.round((page / pages) * span)),
          progressMessage: `Recognizing text on page ${page} of ${pages}`,
        });
      });

      if (!ocr.success) {
        diag.ocr = { durationMs: ocr.durationMs, stderr: ocr.stderr, timedOut: ocr.timedOut };
        if (ocr.cancelled || jobStopped(jobId)) return;
        throw new PdfImportError(ocr.timedOut ? "OCR_TIMEOUT" : "OCR_FAILED", ocr.stderr);
      }
      updateImportJob(jobId, { ocrDurationMs: ocr.durationMs });
      diag.ocr = { durationMs: ocr.durationMs, words: ocr.words };
      stage("ocr", { pages: ocr.pages.length, words: ocr.words }, ocr.durationMs);

      // Mixed PDFs: keep real embedded text where a page has it and use the
      // recognized text only for pages that were image-only (§34.3).
      const merged = ocr.pages.map((ocrPage) => {
        const originalPage = extracted.pages.find((p) => p.page === ocrPage.page);
        return originalPage && originalPage.characterCount >= 200 ? originalPage : ocrPage;
      });
      parseInput = extractedTextFromPages(merged, extracted.numPages);
      usedOcrText = true;
    }

    // ── Parse ──
    if (jobStopped(jobId)) return;
    updateImportJob(jobId, { status: "parsing", progressPercent: 78, progressMessage: "Reading character details" });
    let draft: ImportDraft;
    const parseStart = Date.now();
    try {
      if (hasFormFields) {
        const source: ImportSource = { kind: "fillable-pdf", pages: extracted.numPages, fileName: job.originalFilename };
        const { mapFormFieldsToDraft } = await import("../importMapper");
        draft = mapFormFieldsToDraft(formFields, source);
      } else {
        draft = await draftFromPageTexts(parseInput.pages, extracted.numPages, job.originalFilename);
      }
    } catch (error) {
      throw new PdfImportError("PARSER_FAILED", error instanceof Error ? error.message : String(error));
    }
    diag.parse = { sourceKind: draft.source.kind, usedOcrText };
    stage("parse", diag.parse, Date.now() - parseStart);

    // ── Result ──
    fs.writeFileSync(jobFilePath(jobId, "result"), JSON.stringify({ draft }));
    if (jobStopped(jobId)) return;
    updateImportJob(jobId, { status: "ready", progressPercent: 100, progressMessage: "Ready for review" });
    stage("ready");
  } catch (error) {
    const importError = error instanceof PdfImportError
      ? error
      : new PdfImportError("TEXT_EXTRACTION_FAILED", error instanceof Error ? error.message : String(error));
    diag.error = { code: importError.code, detail: importError.internalDetail };
    appendDiagnostics(diag, jobId);
    if (!jobStopped(jobId)) {
      updateImportJob(jobId, {
        status: "failed",
        errorCode: importError.code,
        errorMessage: importError.message,
        progressMessage: "Import failed",
      });
    }
  }
}

/** Cancel a job: mark the row and kill any running OCR child. */
export function cancelImportPipeline(jobId: string): void {
  cancelOcr(jobId);
}
