/**
 * Safe OCR process runner (OCR plan §10/§12).
 *
 * Spawns the isolated worker with an explicit argument array (never a shell
 * string), enforces a hard timeout by killing the child, caps concurrency
 * with a tiny in-process queue, and supports cancellation by job id. The only
 * path handed to the worker is the server-derived job directory — user input
 * never reaches the command line.
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { PDF_IMPORT_LIMITS, pdfImportOcrConcurrency, pdfImportOcrTimeoutMs } from "../importLimits";
import { jobDir, jobFilePath } from "../jobs/importJobStore";
import type { ExtractedTextItem } from "../pdfExtract";

export type OcrProgress = { page: number; pages: number };

export type OcrResult =
  | {
      success: true;
      durationMs: number;
      pages: Array<{ page: number; text: string; items: ExtractedTextItem[] }>;
      numPages: number;
      words: number;
    }
  | {
      success: false;
      durationMs: number;
      timedOut: boolean;
      cancelled: boolean;
      exitCode: number | null;
      stderr: string;
    };

const WORKER_PATH = path.join(process.cwd(), "workers", "ocr", "pdf-ocr-worker.mjs");

// ── Tiny FIFO queue: at most N OCR children at once (§12 first implementation) ──

let running = 0;
const waiting: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (running < pdfImportOcrConcurrency()) {
    running++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
}

function releaseSlot(): void {
  running--;
  waiting.shift()?.();
}

// ── Cancellation registry ──

const activeChildren = new Map<string, ChildProcess>();
const cancelledJobs = new Set<string>();

/** Kill a running OCR child (or mark a queued one) for a cancelled job. */
export function cancelOcr(jobId: string): void {
  cancelledJobs.add(jobId);
  activeChildren.get(jobId)?.kill();
}

/**
 * Run OCR for a job's original.pdf. Resolves with a structured result —
 * it never throws for worker failures, only for programmer errors.
 */
export async function runPdfOcr(
  jobId: string,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrResult> {
  const started = Date.now();
  await acquireSlot();
  try {
    if (cancelledJobs.has(jobId)) {
      return { success: false, durationMs: 0, timedOut: false, cancelled: true, exitCode: null, stderr: "" };
    }

    const dir = jobDir(jobId); // validates the id shape
    const timeoutMs = pdfImportOcrTimeoutMs();

    return await new Promise<OcrResult>((resolve) => {
      const child = spawn(
        process.execPath,
        [WORKER_PATH, dir, String(PDF_IMPORT_LIMITS.maxOcrPages), String(PDF_IMPORT_LIMITS.ocrRasterDpi)],
        { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      activeChildren.set(jobId, child);

      let stderr = "";
      let timedOut = false;
      let workerError = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < 4000) stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        // Escalate if the process ignores the default signal.
        setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* already gone */ } }, 5000).unref();
      }, timeoutMs);

      const lines = readline.createInterface({ input: child.stdout! });
      lines.on("line", (line) => {
        try {
          const message = JSON.parse(line) as { type: string; page?: number; pages?: number; message?: string };
          if (message.type === "progress" && message.page && message.pages) {
            onProgress?.({ page: message.page, pages: message.pages });
          } else if (message.type === "error" && message.message) {
            workerError = message.message;
          }
        } catch { /* non-JSON noise on stdout is ignored */ }
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);
        activeChildren.delete(jobId);
        const durationMs = Date.now() - started;
        const cancelled = cancelledJobs.has(jobId);
        cancelledJobs.delete(jobId);

        const outputPath = jobFilePath(jobId, "ocrPages");
        if (exitCode === 0 && !cancelled && fs.existsSync(outputPath)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
              pages: Array<{ page: number; text: string; items: ExtractedTextItem[] }>;
              numPages: number;
            };
            resolve({
              success: true,
              durationMs,
              pages: parsed.pages,
              numPages: parsed.numPages,
              words: parsed.pages.reduce((sum, p) => sum + p.items.length, 0),
            });
            return;
          } catch {
            // Fall through to the failure result below.
          }
        }
        resolve({
          success: false,
          durationMs,
          timedOut,
          cancelled,
          exitCode,
          stderr: (workerError || stderr).slice(0, 2000),
        });
      });

      child.on("error", (error) => {
        // spawn itself failed (missing node, worker file, …)
        clearTimeout(timer);
        activeChildren.delete(jobId);
        resolve({
          success: false,
          durationMs: Date.now() - started,
          timedOut: false,
          cancelled: false,
          exitCode: null,
          stderr: String(error).slice(0, 2000),
        });
      });
    });
  } finally {
    releaseSlot();
  }
}
