import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;

function configurePdfJsWorker() {
  if (workerConfigured) return;

  const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  if (!existsSync(workerPath)) {
    throw new Error("PDF worker file is missing. Run npm install before using PDF import.");
  }

  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  workerConfigured = true;
}

export async function loadPdfFromBuffer(buffer: Buffer): Promise<pdfjs.PDFDocumentProxy> {
  configurePdfJsWorker();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  return loadingTask.promise;
}
