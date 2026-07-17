# PDF Import — Current-State Audit and OCR Integration Decisions

Phase 0 deliverable for the "PDF Import OCR Preprocessing Implementation Plan"
(`docs/pdf-import/pdf-ocr-implementation-plan.md`). Audited 2026-07-17.

## Current upload flow (before this work)

- **Server-backed**, not browser-only. `CharacterImportModal` posts the file to
  `POST /api/import/pdf/analyze` (multipart), which returns an `ImportDraft`
  synchronously; `POST /api/import/pdf/create` turns the reviewed draft into a
  character. Both remain untouched as the fallback path.
- Extraction library: **pdfjs-dist 4.10** (`src/lib/import/pdfJsServer.ts`),
  page text **with coordinates** (PDF points, y-up).
- The analyzer (`src/lib/import/pdfAnalyze.ts`) has three lanes:
  - **Lane A** — AcroForm fields (`pdfFormFields.ts`), most reliable;
  - **Lane B** — D&D Beyond flattened sheets (`dndBeyondPdf.ts`), spatial
    parsing off item coordinates;
  - **Lane C** — generic label/regex matching (`importMapper.ts`).
- A per-field confidence model already exists (`confirmed | review | missing`
  in `pdfTypes.ts`) and the review screen (`CharacterImportModal`) already
  groups fields, shows confidence badges, allows edits, and requires explicit
  confirmation before `create` — so the plan's §16–§19 are largely present.

## Why imports were inconsistent

1. **No OCR**: scanned/image-only PDFs extract zero text and produced a
   near-empty draft with no explanation.
2. **Broken text layers** (subset fonts without ToUnicode) produce garbage
   that the parsers silently fail on.
3. Generic-lane regexes had real bugs on single-spaced extracted text: the
   character-name pattern required a double-space terminator that never
   occurs, and ability scores only matched abbreviations (`STR 12`), not full
   words (`STRENGTH 12`). Fixed in this pass; both affected *all* PDFs.
4. Everything ran in one synchronous request — no progress, no diagnostics,
   nothing to tell the user *why* a sheet read badly.

## Runtime constraints that shaped the OCR design

- Node ≥ 22 (dev: 24), Next 16 App Router, single `next start` process.
- Deployment: **Render (native Node runtime) / Railway (Nixpacks)** — no
  Docker image control, so the plan's preferred Dockerized OCRmyPDF worker
  (Python + Ghostscript + native Tesseract) is not deployable as specified.
  Windows development also has no guaranteed Docker.
- Writable data lives under `FORGE_VAULT_DIR` (Render disk `/var/data`;
  locally `./data`, gitignored). SQLite (`node:sqlite`) with a
  `recordMigration` ledger, revision 19 adds `pdf_import_jobs`.

## Decision: tesseract.js worker instead of OCRmyPDF + Docker

The plan's §2.3 allows an isolated child process as the acceptable
alternative. Chosen engine:

- **Rasterize** pages with pdfjs + `@napi-rs/canvas` (300 DPI; pdfjs already
  ships the canvas binding; `standardFontDataUrl` must be a plain filesystem
  path in Node — a `file://` URL renders blank pages).
- **Recognize** with **tesseract.js 7** (WASM, npm-only, works identically on
  Windows dev and Render/Railway). Language model vendored at
  `workers/ocr/tessdata/eng.traineddata` (tessdata_fast) so the worker makes
  **no network calls**.
- **Skip the OCR'd-PDF intermediate entirely**: the worker emits positioned
  words converted into the exact `{str, x, y, width, height}` shape (PDF
  points, y-up) the existing Lane B/C parsers consume. Same parsers, no
  second extraction pass, original PDF untouched.
- Isolation: `workers/ocr/pdf-ocr-worker.mjs` runs via `spawn` with an
  argument array, hard timeout + kill, concurrency capped (default 2), and
  only ever receives the server-derived job directory path.
- Measured: ~0.7 s/page raster+OCR on dev hardware for the synthetic fixture;
  the end-to-end image-only integration test completes in ~2 s. Budget stays
  the plan's 180 s with a 12-page OCR cap.

Swapping in native OCRmyPDF later only means replacing the worker script —
the runner contract (`runPdfOcr`) doesn't change.

## What was added (map to plan sections)

| Plan | Implementation |
| --- | --- |
| §5 job model | `src/lib/import/jobs/importJobStore.ts` + `pdf_import_jobs` (migration 19); files under `<vault>/imports/<jobId>/` |
| §6 API | `POST /api/pdf-imports`, `GET/DELETE /:jobId`, `GET /:jobId/result`, `POST /:jobId/cancel`, `POST /:jobId/complete`, `GET /:jobId/diagnostics` |
| §7 validation | size/type/signature at upload; encrypted/malformed via pdfjs load mapped to error codes |
| §8 extraction | `pdfExtract.ts` (shared with legacy analyzer) |
| §9 decision | `pdfAssess.ts` — coverage + anchors + garbage ratio, reasons recorded |
| §10–§12 worker/queue | `workers/ocr/pdf-ocr-worker.mjs`, `src/lib/import/ocr/runPdfOcr.ts` |
| §13–§14 progress | job row percent/message, 1 s polling, staged copy in the modal |
| §17–§19 review | existing `ImportField` confidence + review modal reused; OCR fields land as `review`, never `confirmed` |
| §20 diagnostics | `diagnostics.json` per job; admin-gated route in production |
| §22 cleanup | sweep on upload + `npm run cleanup:pdf-imports`; complete/cancel delete files immediately |
| §23 errors | `PdfImportErrorCode` + sanitized user copy in `importLimits.ts` |
| §24 flag | `PDF_IMPORT_OCR_ENABLED=true` (+ `_FORCE`, `_TIMEOUT_MS`, `_MAX_CONCURRENCY`); client falls back to the legacy route on 501 |
| §25–§27 tests | generated fixtures (`npm run fixtures:pdf-import`), unit + integration suites incl. real OCR run |

## Deliberate scope notes

- **Template detection (§15)** beyond the existing D&D Beyond marker check and
  2014/2024 split is deferred: the existing lane detection already routes DDB
  vs generic; finer template ids belong with real-world fixture calibration.
- Job "queue" is the in-process semaphore (§12 first implementation) — right
  for a single-process deployment; the job table already makes a poller
  possible later.
- Thresholds in `pdfAssess.ts` are the plan's starting values; calibrate with
  real failing PDFs via the diagnostics endpoint before tightening.
