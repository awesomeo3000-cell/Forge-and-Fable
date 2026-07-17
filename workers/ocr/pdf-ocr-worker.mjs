/**
 * PDF OCR worker (OCR plan §10) — runs as an isolated child process so OCR
 * never blocks or crashes the web server, and a timeout can kill it cleanly.
 *
 * Usage: node workers/ocr/pdf-ocr-worker.mjs <jobDir> [maxPages] [dpi]
 *
 * Reads  <jobDir>/original.pdf
 * Writes <jobDir>/ocr-pages.json  — positioned text items in PDF point space
 *                                   (y up), the exact shape the existing
 *                                   D&D Beyond / generic parsers consume.
 *
 * Progress is reported as JSON lines on stdout:
 *   {"type":"progress","page":2,"pages":4}
 *   {"type":"done","pages":4,"words":812,"durationMs":21842}
 *
 * The worker needs no network: the Tesseract language model is vendored in
 * workers/ocr/tessdata and the WASM core ships inside node_modules.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker, OEM } from "tesseract.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const TESSDATA_DIR = path.join(HERE, "tessdata");

const emit = (payload) => process.stdout.write(JSON.stringify(payload) + "\n");

function fail(message, code = 1) {
  emit({ type: "error", message: String(message).slice(0, 500) });
  process.exit(code);
}

const jobDirArg = process.argv[2];
const maxPages = Math.max(1, Number(process.argv[3]) || 12);
const dpi = Math.min(400, Math.max(72, Number(process.argv[4]) || 300));

if (!jobDirArg) fail("Usage: pdf-ocr-worker.mjs <jobDir> [maxPages] [dpi]");
const jobDir = path.resolve(jobDirArg);
const inputPath = path.join(jobDir, "original.pdf");
const outputPath = path.join(jobDir, "ocr-pages.json");
if (!fs.existsSync(inputPath)) fail(`Input not found: original.pdf`);

const started = Date.now();

try {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(inputPath));
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
    // Plain filesystem path (not a file:// URL) — pdfjs' Node font factory
    // reads it with fs. A URL here silently produces blank renders.
    standardFontDataUrl: path.join(REPO_ROOT, "node_modules", "pdfjs-dist", "standard_fonts") + path.sep,
    verbosity: 0,
  }).promise;

  const numPages = doc.numPages;
  const pageTotal = Math.min(numPages, maxPages);
  const scale = dpi / 72;

  const tesseract = await createWorker("eng", OEM.LSTM_ONLY, {
    langPath: TESSDATA_DIR,
    gzip: false,
    cacheMethod: "none",
  });

  const pages = [];
  let totalWords = 0;

  for (let pageNumber = 1; pageNumber <= pageTotal; pageNumber++) {
    emit({ type: "progress", page: pageNumber, pages: pageTotal });

    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const pageHeightPt = viewport.height / scale;

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const png = await canvas.encode("png");
    page.cleanup();

    const { data: ocr } = await tesseract.recognize(png, {}, { blocks: true, text: true });

    // Map word boxes from image pixels (y down) into PDF points (y up),
    // matching pdfjs text items so the same spatial parsers work unchanged.
    const items = [];
    for (const block of ocr.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            const text = word.text.trim();
            if (!text) continue;
            items.push({
              str: text,
              x: word.bbox.x0 / scale,
              y: pageHeightPt - word.bbox.y1 / scale,
              width: (word.bbox.x1 - word.bbox.x0) / scale,
              height: (word.bbox.y1 - word.bbox.y0) / scale,
            });
          }
        }
      }
    }
    totalWords += items.length;
    pages.push({ page: pageNumber, text: (ocr.text ?? "").replace(/\s+/g, " ").trim(), items });
  }

  await tesseract.terminate();
  await doc.destroy();

  fs.writeFileSync(outputPath, JSON.stringify({ dpi, pages, numPages }));
  emit({ type: "done", pages: pageTotal, words: totalWords, durationMs: Date.now() - started });
  process.exit(0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
