/**
 * PDF text-quality assessment and OCR decision engine (OCR plan §9).
 *
 * Pure and JSX/IO-free: given the structured extraction result it scores how
 * usable the embedded text is and decides whether the OCR path should run.
 * No single threshold decides alone — coverage, expected character-sheet
 * anchors and gibberish each contribute, and every trigger is recorded as a
 * human-readable reason for the diagnostics file.
 */

import type { ExtractedPdfText } from "./pdfExtract";

export type PdfTextAssessment = {
  pageCount: number;
  totalCharacters: number;
  pagesWithText: number;
  averageCharactersPerPage: number;

  expectedAnchorsFound: string[];
  /** 0–1: fraction of expected sheet anchors present in the text. */
  expectedAnchorScore: number;

  /** 0–1: replacement chars + non-printable garbage as a fraction of text. */
  suspiciousCharacterRatio: number;
  /** 0–1: how much of the document carries a plausible amount of text. */
  textCoverageScore: number;

  requiresOcr: boolean;
  reasons: string[];
};

/**
 * Labels that appear on every mainstream 5e sheet (D&D Beyond 2014/2024,
 * official sheets, most generic exports). Lowercase; matched on normalized
 * text. "species" and "race" cover the 2024/2014 terminology split.
 */
const EXPECTED_ANCHORS = [
  "character name",
  "class",
  "level",
  "species",
  "race",
  "background",
  "armor class",
  "initiative",
  "speed",
  "hit points",
  "proficiency bonus",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "saving throws",
  "skills",
  "equipment",
  "features",
  "spellcasting",
] as const;

/** A page needs at least this much text to count as "covered". A dense
    character sheet page carries thousands of characters; 200 is deliberately
    forgiving so sparse-but-real pages (spell lists) still count. */
const MIN_USEFUL_CHARS_PER_PAGE = 200;

export function assessPdfText(extracted: ExtractedPdfText): PdfTextAssessment {
  const pageCount = extracted.numPages;
  const analyzedPages = extracted.pages;
  const totalCharacters = extracted.totalCharacters;

  const pagesWithText = analyzedPages.filter((p) => p.characterCount >= MIN_USEFUL_CHARS_PER_PAGE).length;
  const averageCharactersPerPage = analyzedPages.length > 0 ? totalCharacters / analyzedPages.length : 0;
  const textCoverageScore = analyzedPages.length > 0 ? pagesWithText / analyzedPages.length : 0;

  const normalized = extracted.fullText.toLowerCase().replace(/\s+/g, " ");
  const expectedAnchorsFound = EXPECTED_ANCHORS.filter((anchor) => normalized.includes(anchor));
  const expectedAnchorScore = expectedAnchorsFound.length / EXPECTED_ANCHORS.length;

  // Replacement characters and control garbage are the classic signature of
  // a broken text layer (bad CMap, subset fonts without ToUnicode).
  let suspicious = 0;
  for (const ch of extracted.fullText) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "�" || (code < 32 && ch !== "\n" && ch !== "\t" && ch !== "\r") || (code >= 0xe000 && code <= 0xf8ff)) {
      suspicious++;
    }
  }
  const suspiciousCharacterRatio = totalCharacters > 0 ? suspicious / totalCharacters : 0;

  const reasons: string[] = [];
  if (pageCount === 0) reasons.push("Document reports zero pages.");
  if (totalCharacters === 0) reasons.push("No embedded text found on any page.");
  else {
    if (textCoverageScore < 0.35) {
      reasons.push(`Only ${pagesWithText} of ${analyzedPages.length} pages carry usable text (coverage ${textCoverageScore.toFixed(2)}).`);
    }
    if (expectedAnchorScore < 0.25) {
      reasons.push(`Few character-sheet labels found (${expectedAnchorsFound.length}/${EXPECTED_ANCHORS.length}).`);
    }
    if (suspiciousCharacterRatio > 0.08) {
      reasons.push(`High garbage-character ratio (${(suspiciousCharacterRatio * 100).toFixed(1)}%).`);
    }
  }

  return {
    pageCount,
    totalCharacters,
    pagesWithText,
    averageCharactersPerPage,
    expectedAnchorsFound: [...expectedAnchorsFound],
    expectedAnchorScore,
    suspiciousCharacterRatio,
    textCoverageScore,
    requiresOcr: reasons.length > 0,
    reasons,
  };
}
