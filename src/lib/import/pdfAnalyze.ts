/**
 * PDF Character Import — Main Analyzer
 *
 * Orchestrates Lane A (fillable form fields), Lane B (D&D Beyond flattened),
 * and Lane C (generic text extraction). Returns an ImportDraft for the review screen.
 *
 * The OCR pipeline reuses `draftFromPageTexts` with recognized text items in
 * the same coordinate space, so OCR'd sheets flow through the same lanes.
 */

import type { ImportDraft, ImportSource } from "./pdfTypes";
import { analyzeDndBeyondPdf } from "./dndBeyondPdf";
import { analyzeFormFields } from "./pdfFormFields";
import { loadPdfFromBuffer } from "./pdfJsServer";
import { extractPdfText, type ExtractedPdfPage } from "./pdfExtract";
import { PDF_IMPORT_LIMITS } from "./importLimits";

/** Maximum upload size (kept as an export for the legacy analyze route). */
export const MAX_PDF_SIZE = PDF_IMPORT_LIMITS.maxFileSizeBytes;

/**
 * Detect the PDF source kind.
 */
function detectSourceKind(
  numPages: number,
  allText: string,
  hasFormFields: boolean,
): ImportSource["kind"] {
  if (hasFormFields) return "fillable-pdf";

  // D&D Beyond sheets have characteristic markers, but the exact section
  // labels vary between exported versions.
  const normalizedText = allText.toLowerCase().replace(/\s+/g, " ");
  const dndBeyondMarkers = [
    "d&d beyond",
    "character sheet",
    "character name",
    "class & level",
    "spellcasting",
    "attacks & spellcasting",
    "weapon attacks & cantrips",
    "proficiencies & languages",
    "proficiencies & training",
  ];
  const markerCount = dndBeyondMarkers.filter((m) => normalizedText.includes(m)).length;
  if (numPages >= 2 && (markerCount >= 3 || (normalizedText.includes("d&d beyond") && markerCount >= 2))) {
    return "dnd-beyond";
  }

  return "generic-pdf";
}

/**
 * Build an ImportDraft from positioned page texts (Lanes B/C only — form
 * fields require the original PDF structure and never survive OCR).
 */
export async function draftFromPageTexts(
  pageTexts: ExtractedPdfPage[],
  numPages: number,
  fileName?: string,
): Promise<ImportDraft> {
  const allText = pageTexts.map((p) => p.text).join("\n");
  const kind = detectSourceKind(numPages, allText, false);
  const source: ImportSource = { kind, pages: numPages, fileName };

  if (kind === "dnd-beyond") {
    return analyzeDndBeyondPdf(pageTexts, source);
  }

  const { analyzeGenericPdf } = await import("./importMapper");
  return analyzeGenericPdf(pageTexts, source);
}

/**
 * Main entry point: analyze a PDF buffer and return an ImportDraft.
 *
 * TODO: Future enhancement — expose uncertain candidates (unstructured text
 * fragments that the parser couldn't categorize) as a separate list in the
 * ImportDraft, so the review screen can let players assign them to stats,
 * spells, inventory, features, or ignore them. Currently all extracted data
 * is mapped directly into structured fields.
 *
 * @param buffer - Raw PDF file bytes
 * @param fileName - Original filename (for source metadata)
 */
export async function analyzePdf(
  buffer: Buffer,
  fileName?: string,
): Promise<ImportDraft> {
  // Size check
  if (buffer.length > MAX_PDF_SIZE) {
    throw new Error(`PDF too large (max ${MAX_PDF_SIZE / 1024 / 1024} MB).`);
  }

  const doc = await loadPdfFromBuffer(buffer);
  const numPages = doc.numPages;

  // Extract page texts with positions
  const extracted = await extractPdfText(doc);

  // Try form fields first (Lane A)
  const formFields = await analyzeFormFields(buffer);
  const hasFormFields = Object.keys(formFields).length > 0;

  // Lane A: Fillable PDF
  if (hasFormFields) {
    const source: ImportSource = { kind: "fillable-pdf", pages: numPages, fileName };
    const { mapFormFieldsToDraft } = await import("./importMapper");
    return mapFormFieldsToDraft(formFields, source);
  }

  // Lanes B/C share the positioned-text path with the OCR pipeline.
  return draftFromPageTexts(extracted.pages, numPages, fileName);
}
