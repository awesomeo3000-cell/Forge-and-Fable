import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { assessPdfText } from "@/lib/import/pdfAssess";
import { extractPdfTextFromBuffer, extractedTextFromPages, type ExtractedTextItem } from "@/lib/import/pdfExtract";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "pdf-import");

function syntheticPages(texts: string[]) {
  const items: ExtractedTextItem[] = [];
  return extractedTextFromPages(
    texts.map((text, index) => ({ page: index + 1, text, items })),
    texts.length,
  );
}

const RICH_SHEET_TEXT =
  "CHARACTER NAME Rhea Voss CLASS Ranger LEVEL 5 BACKGROUND Outlander SPECIES Wood Elf " +
  "ARMOR CLASS 16 INITIATIVE +3 SPEED 35 ft HIT POINTS 44 PROFICIENCY BONUS +3 " +
  "STRENGTH 12 DEXTERITY 17 CONSTITUTION 14 INTELLIGENCE 10 WISDOM 15 CHARISMA 8 " +
  "SAVING THROWS Skills Equipment Features and Traits Spellcasting notes and more text to pass coverage";

describe("assessPdfText (OCR decision engine)", () => {
  it("does not request OCR for a text-rich sheet with anchors", () => {
    const assessment = assessPdfText(syntheticPages([RICH_SHEET_TEXT, RICH_SHEET_TEXT]));
    expect(assessment.requiresOcr).toBe(false);
    expect(assessment.expectedAnchorScore).toBeGreaterThan(0.5);
    expect(assessment.reasons).toEqual([]);
  });

  it("requests OCR when no text was extracted at all", () => {
    const assessment = assessPdfText(syntheticPages(["", ""]));
    expect(assessment.requiresOcr).toBe(true);
    expect(assessment.reasons.join(" ")).toMatch(/No embedded text/);
  });

  it("requests OCR when most pages are empty (low coverage)", () => {
    const assessment = assessPdfText(syntheticPages([RICH_SHEET_TEXT, "", "", ""]));
    expect(assessment.requiresOcr).toBe(true);
    expect(assessment.textCoverageScore).toBeLessThan(0.35);
  });

  it("requests OCR when text is present but carries no sheet anchors", () => {
    const filler = "lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(20);
    const assessment = assessPdfText(syntheticPages([filler, filler]));
    expect(assessment.requiresOcr).toBe(true);
    expect(assessment.reasons.join(" ")).toMatch(/labels/i);
  });

  it("requests OCR when the text layer is replacement-character garbage", () => {
    const garbled = (RICH_SHEET_TEXT + " ").replace(/[aeiou]/g, "�");
    const assessment = assessPdfText(syntheticPages([garbled, garbled]));
    expect(assessment.requiresOcr).toBe(true);
    expect(assessment.suspiciousCharacterRatio).toBeGreaterThan(0.08);
  });

  it("marks the searchable fixture as not requiring OCR", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "searchable.pdf"));
    const extracted = await extractPdfTextFromBuffer(buffer);
    expect(extracted.numPages).toBe(2);
    const assessment = assessPdfText(extracted);
    expect(assessment.requiresOcr).toBe(false);
  });

  it("marks the image-only fixture as requiring OCR", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "image-only.pdf"));
    const extracted = await extractPdfTextFromBuffer(buffer);
    expect(extracted.totalCharacters).toBe(0);
    const assessment = assessPdfText(extracted);
    expect(assessment.requiresOcr).toBe(true);
  });
});
