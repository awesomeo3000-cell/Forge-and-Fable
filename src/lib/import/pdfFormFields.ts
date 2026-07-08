/**
 * PDF Form Fields Analyzer (Lane A)
 *
 * Attempts to read AcroForm fields from a PDF.
 * Uses pdfjs-dist to inspect the document's form field annotations.
 */

import { loadPdfFromBuffer } from "./pdfJsServer";

/**
 * Try to extract form fields from a PDF buffer.
 * Returns a flat key→value record of all form fields found.
 * Returns empty object if no form fields exist (flattened PDF).
 */
export async function analyzeFormFields(buffer: Buffer): Promise<Record<string, string>> {
  const fields: Record<string, string> = {};

  try {
    const doc = await loadPdfFromBuffer(buffer);

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
