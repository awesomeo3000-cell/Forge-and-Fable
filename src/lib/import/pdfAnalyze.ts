/**
 * PDF Character Import — Main Analyzer
 *
 * Orchestrates Lane A (fillable form fields), Lane B (D&D Beyond flattened),
 * and Lane C (generic text extraction). Returns an ImportDraft for the review screen.
 */

import type { ImportDraft, ImportSource } from "./pdfTypes";
import { analyzeDndBeyondPdf } from "./dndBeyondPdf";
import { analyzeFormFields } from "./pdfFormFields";
import { loadPdfFromBuffer } from "./pdfJsServer";
import type * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

/** Maximum upload size: 10 MB */
export const MAX_PDF_SIZE = 10 * 1024 * 1024;

/** Maximum pages to parse (safety limit) */
const MAX_PAGES = 30;

/**
 * Load a PDF from a Buffer and return the pdfjs document object.
 */
async function loadPdf(buffer: Buffer): Promise<pdfjs.PDFDocumentProxy> {
  return loadPdfFromBuffer(buffer);
}

/**
 * Extract all text from every page with position metadata.
 */
async function extractPageTexts(
  doc: pdfjs.PDFDocumentProxy,
): Promise<Array<{ page: number; text: string; items: Array<{ str: string; x: number; y: number; width: number; height: number }> }>> {
  const pages: Array<{ page: number; text: string; items: Array<{ str: string; x: number; y: number; width: number; height: number }> }> = [];
  const limit = Math.min(doc.numPages, MAX_PAGES);

  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const items: Array<{ str: string; x: number; y: number; width: number; height: number }> = [];
    let fullText = "";

    for (const item of content.items) {
      if ("str" in item && typeof item.str === "string") {
        const tx = "transform" in item ? (item.transform as number[]) : [1, 0, 0, 1, 0, 0];
        items.push({
          str: item.str,
          x: tx[4],
          y: tx[5],
          width: "width" in item ? (item.width as number) : 0,
          height: "height" in item ? (item.height as number) : 0,
        });
        fullText += item.str + " ";
      }
    }

    pages.push({ page: i, text: fullText.trim(), items });
  }

  return pages;
}

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

  // If text mentions standard D&D labels, treat as generic but hint
  const dndLabels = ["str", "dex", "con", "int", "wis", "cha", "armor class", "hit points"];
  if (dndLabels.some((l) => normalizedText.includes(l))) return "generic-pdf";

  return "generic-pdf";
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

  const doc = await loadPdf(buffer);
  const numPages = doc.numPages;

  // Extract page texts with positions
  const pageTexts = await extractPageTexts(doc);
  const allText = pageTexts.map((p) => p.text).join("\n");

  // Try form fields first (Lane A)
  const formFields = await analyzeFormFields(buffer);
  const hasFormFields = Object.keys(formFields).length > 0;

  // Detect source kind
  const kind = detectSourceKind(numPages, allText, hasFormFields);

  const source: ImportSource = {
    kind,
    pages: numPages,
    fileName,
  };

  // Lane A: Fillable PDF
  if (kind === "fillable-pdf") {
    const { mapFormFieldsToDraft } = await import("./importMapper");
    const draft = mapFormFieldsToDraft(formFields, source);
    return draft;
  }

  // Lane B: D&D Beyond flattened
  if (kind === "dnd-beyond") {
    const draft = analyzeDndBeyondPdf(pageTexts, source);
    return draft;
  }

  // Lane C: Generic PDF — use basic text matching
  const { analyzeGenericPdf } = await import("./importMapper");
  const draft = analyzeGenericPdf(pageTexts, source);
  return draft;
}
