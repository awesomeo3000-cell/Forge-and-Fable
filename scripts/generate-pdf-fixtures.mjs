/**
 * Generate the PDF import test fixtures (OCR plan §25).
 *
 * Builds three deterministic fixtures under tests/fixtures/pdf-import/:
 *   searchable.pdf — embedded-text character sheet (fast path, no OCR)
 *   image-only.pdf — the same sheet rendered as a JPEG page (OCR path)
 *   malformed.pdf  — a valid signature followed by garbage
 *
 * Uses no PDF library: objects and xref offsets are computed directly so the
 * fixtures never drift with a dependency. Run: node scripts/generate-pdf-fixtures.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const OUT_DIR = path.join(process.cwd(), "tests", "fixtures", "pdf-import");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SHEET_LINES = [
  "CHARACTER NAME Rhea Voss",
  "CLASS Ranger LEVEL 5 BACKGROUND Outlander",
  "SPECIES Wood Elf RACE Wood Elf",
  "ARMOR CLASS 16 INITIATIVE +3 SPEED 35 ft",
  "HIT POINTS 44 PROFICIENCY BONUS +3",
  "STRENGTH 12 DEXTERITY 17 CONSTITUTION 14",
  "INTELLIGENCE 10 WISDOM 15 CHARISMA 8",
  "SAVING THROWS Strength +4 Dexterity +6",
  "SKILLS Perception +6 Stealth +6 Survival +5",
  "EQUIPMENT Longbow, Shortsword, Explorer's Pack",
  "FEATURES AND TRAITS Favored Enemy, Natural Explorer",
  "SPELLCASTING Hunter's Mark, Cure Wounds",
];

/** Assemble numbered objects into a valid PDF with a correct xref table. */
function assemblePdf(objectBodies) {
  const chunks = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [];
  let position = chunks[0].length;
  objectBodies.forEach((body, index) => {
    offsets.push(position);
    const buffer = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "latin1"),
      Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1"),
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    chunks.push(buffer);
    position += buffer.length;
  });
  const xref =
    `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") +
    `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF`;
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

// ── searchable.pdf: two pages of embedded text ──
function textPageStream(lines) {
  const safe = (line) => line.replace(/[()\\]/g, "");
  const body = ["BT /F1 14 Tf 40 740 Td 20 TL", ...lines.map((line) => `(${safe(line)}) Tj T*`), "ET"].join("\n");
  return `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
}

const searchable = assemblePdf([
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
  textPageStream(SHEET_LINES.slice(0, 7)),
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
  textPageStream(SHEET_LINES.slice(7)),
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
]);
fs.writeFileSync(path.join(OUT_DIR, "searchable.pdf"), searchable);

// ── image-only.pdf: the sheet as a JPEG page with zero embedded text ──
const canvas = createCanvas(1224, 1584); // letter at 2x
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#111111";
ctx.font = "600 34px Arial";
SHEET_LINES.forEach((line, index) => ctx.fillText(line, 80, 120 + index * 64));
const jpeg = await canvas.encode("jpeg", 90);

const imageObject = Buffer.concat([
  Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    "latin1",
  ),
  jpeg,
  Buffer.from("\nendstream", "latin1"),
]);
const drawStream = "q 612 0 0 792 0 0 cm /Im1 Do Q";

const imageOnly = assemblePdf([
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${drawStream.length} >>\nstream\n${drawStream}\nendstream`,
  imageObject,
]);
fs.writeFileSync(path.join(OUT_DIR, "image-only.pdf"), imageOnly);

// ── malformed.pdf: right signature, broken body ──
fs.writeFileSync(path.join(OUT_DIR, "malformed.pdf"), Buffer.from("%PDF-1.4\nthis is not a real pdf body", "latin1"));

console.log("Fixtures written to", OUT_DIR);
for (const file of fs.readdirSync(OUT_DIR)) {
  console.log(" ", file, fs.statSync(path.join(OUT_DIR, file)).size, "bytes");
}
