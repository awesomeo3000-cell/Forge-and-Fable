/**
 * PDF Form Fields Analyzer (Lane A)
 *
 * Attempts to read AcroForm fields from a PDF.
 * Uses pdfjs-dist to inspect the document's form field annotations.
 */

import type { loadPdfFromBuffer } from "./pdfJsServer";

type LoadedPdfDocument = Awaited<ReturnType<typeof loadPdfFromBuffer>>;

/**
 * Try to extract form fields from an already-loaded PDF document.
 * Returns a flat key→value record of all form fields found.
 * Returns empty object if no form fields exist (flattened PDF).
 *
 * Takes the caller's loaded document rather than a buffer: form-heavy sheets
 * (MPMB exports carry 2000+ fields) cost hundreds of MB of pdfjs structures,
 * and loading a second copy here pushed one import past a 512MB container.
 */
export async function analyzeFormFields(doc: LoadedPdfDocument): Promise<Record<string, string>> {
  const fields: Record<string, string> = {};

  try {
    // pdfjs-dist doesn't directly expose form fields via its public API.
    // We try to access them through the document's metadata/annotations.
    // For form-field-rich PDFs, we'd use a different library (pdf-lib).
    // For now, iterate pages and look for Widget annotations (form fields).

    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      const page = await doc.getPage(i);
      const annotations = await page.getAnnotations();

      for (const annotation of annotations) {
        if (annotation.subtype === "Widget") {
          const fieldName = (annotation as Record<string, unknown>).fieldName as string | undefined;
          const fieldValue = (annotation as Record<string, unknown>).fieldValue as string | undefined;
          const alternativeFieldName = (annotation as Record<string, unknown>).alternativeFieldName as string | undefined;

          const name = fieldName || alternativeFieldName;
          if (name && fieldValue !== undefined) {
            fields[name] = String(fieldValue);
          }
        }
      }
    }
  } catch {
    // Not a parseable PDF or no annotations — return empty
  }

  return fields;
}
