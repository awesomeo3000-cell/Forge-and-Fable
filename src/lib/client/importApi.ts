import type { ImportDraft } from "@/lib/import/pdfTypes";
import type { Character } from "@/types/game";

/**
 * Parse a response that should be JSON but may be an HTML error page from a
 * proxy layer (Cloudflare/Render gateway timeouts and restarts serve HTML the
 * app never wrote). Blindly calling response.json() on those surfaced raw
 * "Unexpected token '<'" SyntaxErrors to players — translate them into
 * friendly, status-aware messages instead.
 */
async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (response.status === 413) throw new Error("PDF too large for the server to accept.");
    if (response.status === 401 || response.status === 403) throw new Error("Your session expired — log in again and retry.");
    if (response.status >= 500 || response.status === 408) {
      throw new Error(`The server is momentarily unavailable (HTTP ${response.status}). Please try again.`);
    }
    throw new Error(`${fallbackMessage} (HTTP ${response.status}).`);
  }
}

export async function analyzePdf(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/import/pdf/analyze", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await readJsonResponse<{ draft?: ImportDraft; error?: string }>(response, "Failed to analyze PDF");

  if (!response.ok || !data.draft) {
    throw new Error(data.error ?? "Failed to analyze PDF.");
  }

  return data.draft;
}

export async function createCharacterFromPdfDraft(draft: ImportDraft) {
  const response = await fetch("/api/import/pdf/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ draft }),
  });

  const data = await readJsonResponse<{ character?: Character; error?: string }>(response, "Failed to create character");

  if (!response.ok || !data.character) {
    throw new Error(data.error ?? "Failed to create character.");
  }

  return data.character;
}

// ── Job-based import workflow (PDF OCR plan §6/§13) ──

export type ImportJobStatusResponse = {
  id: string;
  status: string;
  progressPercent: number;
  progressMessage: string | null;
  requiresOcr: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
};

/** Thrown when the job workflow is disabled server-side (501) so the modal
    can fall back to the legacy synchronous analyze route. */
export class ImportJobsUnavailableError extends Error {}

export async function createImportJob(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/pdf-imports", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (response.status === 501) throw new ImportJobsUnavailableError();
  const data = await readJsonResponse<{ jobId?: string; error?: string }>(response, "Failed to start the PDF import");
  if (!response.ok || !data.jobId) throw new Error(data.error ?? "Failed to start the PDF import.");
  return data.jobId;
}

export async function getImportJobStatus(jobId: string): Promise<ImportJobStatusResponse> {
  const response = await fetch(`/api/pdf-imports/${jobId}`, { credentials: "include" });
  const data = await readJsonResponse<ImportJobStatusResponse & { error?: string }>(response, "Failed to read import progress");
  if (!response.ok) throw new Error(data.error ?? "Failed to read import progress.");
  return data;
}

export async function getImportJobResult(jobId: string): Promise<ImportDraft> {
  const response = await fetch(`/api/pdf-imports/${jobId}/result`, { credentials: "include" });
  const data = await readJsonResponse<{ draft?: ImportDraft; error?: string }>(response, "Failed to read the import result");
  if (!response.ok || !data.draft) throw new Error(data.error ?? "Failed to read the import result.");
  return data.draft;
}

export async function cancelImportJob(jobId: string): Promise<void> {
  await fetch(`/api/pdf-imports/${jobId}/cancel`, { method: "POST", credentials: "include" }).catch(() => {});
}

export async function completeImportJob(jobId: string): Promise<void> {
  await fetch(`/api/pdf-imports/${jobId}/complete`, { method: "POST", credentials: "include" }).catch(() => {});
}

/**
 * Poll a job until it reaches a terminal state, reporting progress along the
 * way. Resolves with the ready draft; rejects with plain user-facing errors.
 */
export async function runImportJob(
  file: File,
  onProgress: (progress: { percent: number; message: string; requiresOcr: boolean }) => void,
  registerCancel?: (cancel: () => void) => void,
): Promise<{ jobId: string; draft: ImportDraft }> {
  const jobId = await createImportJob(file);
  let cancelled = false;
  registerCancel?.(() => {
    cancelled = true;
    void cancelImportJob(jobId);
  });

  // 1s polling (§13). A healthy job advances its progress percent at every
  // stage; if it stops advancing for this long the server-side pipeline has
  // stalled, so give up rather than spin forever (the server self-heals the
  // job too, but this guarantees the UI never hangs).
  const STALL_MS = 45_000;
  let bestPercent = -1;
  let lastAdvanceAt = Date.now();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (cancelled) throw new Error("Import cancelled.");

    // A single failed poll (proxy 5xx during a deploy/restart, network blip)
    // must not abort the whole import — the job lives server-side. Skip the
    // beat and keep polling; a genuinely dead pipeline stops advancing and the
    // stall guard below ends the wait with a clear error.
    let status: ImportJobStatusResponse;
    try {
      status = await getImportJobStatus(jobId);
    } catch {
      if (Date.now() - lastAdvanceAt > STALL_MS) {
        void cancelImportJob(jobId);
        throw new Error("The import stalled and did not finish. Please try uploading the PDF again.");
      }
      continue;
    }
    onProgress({
      percent: status.progressPercent,
      message: status.progressMessage ?? "Working…",
      requiresOcr: status.requiresOcr === true,
    });

    if (status.progressPercent > bestPercent) {
      bestPercent = status.progressPercent;
      lastAdvanceAt = Date.now();
    } else if (Date.now() - lastAdvanceAt > STALL_MS) {
      void cancelImportJob(jobId);
      throw new Error("The import stalled and did not finish. Please try uploading the PDF again.");
    }

    if (status.status === "ready") {
      const draft = await getImportJobResult(jobId);
      return { jobId, draft };
    }
    if (status.status === "failed") {
      throw new Error(status.errorMessage ?? "We could not read this PDF reliably.");
    }
    if (status.status === "cancelled" || status.status === "expired") {
      throw new Error(status.status === "expired" ? "This import expired. Upload the PDF again to continue." : "Import cancelled.");
    }
  }
}
