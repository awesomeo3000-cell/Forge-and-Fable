/**
 * PDF text extraction shared by the legacy analyzer and the OCR pipeline
 * (OCR plan §8). Wraps pdfjs page text into a structured result with per-page
 * stats so the text-quality assessment can reason about coverage without
 * re-walking the document.
 */

import { loadPdfFromBuffer } from "./pdfJsServer";
import { PDF_IMPORT_LIMITS } from "./importLimits";
import type * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type ExtractedTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExtractedPdfPage = {
  page: number;
  text: string;
  items: ExtractedTextItem[];
  characterCount: number;
  wordCount: number;
};

export type ExtractedPdfText = {
  pages: ExtractedPdfPage[];
  /** Total pages in the document (may exceed pages.length when capped). */
  numPages: number;
  fullText: string;
  totalCharacters: number;
  totalWords: number;
};

function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Extract all text from every page with position metadata (PDF point space,
 * y increasing upward — the convention the D&D Beyond parser expects).
 */
export async function extractPdfText(doc: pdfjs.PDFDocumentProxy): Promise<ExtractedPdfText> {
  const pages: ExtractedPdfPage[] = [];
  const limit = Math.min(doc.numPages, PDF_IMPORT_LIMITS.maxParsePages);

  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const items: ExtractedTextItem[] = [];
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

    const text = fullText.trim();
    pages.push({ page: i, text, items, characterCount: text.length, wordCount: countWords(text) });
  }

  const fullText = pages.map((p) => p.text).join("\n");
  return {
    pages,
    numPages: doc.numPages,
    fullText,
    totalCharacters: pages.reduce((sum, p) => sum + p.characterCount, 0),
    totalWords: pages.reduce((sum, p) => sum + p.wordCount, 0),
  };
}

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<ExtractedPdfText> {
  const doc = await loadPdfFromBuffer(buffer);
  try {
    return await extractPdfText(doc);
  } finally {
    await doc.destroy().catch(() => {});
  }
}

/** Wrap already-OCR'd page items (same shape) in the structured result. */
export function extractedTextFromPages(
  pages: Array<{ page: number; text: string; items: ExtractedTextItem[] }>,
  numPages: number,
): ExtractedPdfText {
  const enriched: ExtractedPdfPage[] = pages.map((p) => ({
    ...p,
    characterCount: p.text.length,
    wordCount: countWords(p.text),
  }));
  return {
    pages: enriched,
    numPages,
    fullText: enriched.map((p) => p.text).join("\n"),
    totalCharacters: enriched.reduce((sum, p) => sum + p.characterCount, 0),
    totalWords: enriched.reduce((sum, p) => sum + p.wordCount, 0),
  };
}
