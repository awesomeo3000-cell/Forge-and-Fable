// PDF OCR import verification (OCR plan §27/§28, handoff 2026-07-17).
// Drives the real UI end to end against a server running with
// PDF_IMPORT_OCR_ENABLED=true: registers a throwaway verified account, opens
// the import modal, uploads the image-only fixture (zero embedded text), waits
// through the staged OCR progress, checks the review screen recovered the
// sheet, creates the character, and finally uploads the searchable fixture to
// confirm the fast path skips OCR. Run:
//   BASE_URL=http://localhost:3012 node QA/tests/pdf-ocr-import.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3012";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, "QA", "screenshots", "pdf-ocr-import");
const FIXTURES = path.join(ROOT, "tests", "fixtures", "pdf-import");
fs.mkdirSync(DIR, { recursive: true });

const log = [];
const consoleErrors = [];
function note(step, status, detail = "") {
  log.push({ step, status, detail });
  console.log(`[${status}] ${step}${detail ? ": " + detail : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200)); });
page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 200)));

async function openImportModal() {
  // Home dashboard → Around the Hearth → Import Character.
  await page.locator('.ao-nav-item:has-text("Home")').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('button.ao-hd-link-row:has-text("Import Character")').first().click();
  await page.locator(".import-modal").waitFor({ state: "visible", timeout: 8000 });
}

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2500);

  // Throwaway verified account (repo QA pattern).
  const email = `pdf_ocr_${Date.now()}@forge.test`;
  const password = "pdf-ocr-pass-1!";
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Create account")').first().click();
  await page.waitForTimeout(2500);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(ROOT, "data", "forge.db"));
  db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email);
  db.close();
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Enter")').first().click();
  await page.waitForTimeout(3000);
  note("register + verify + login", "ok", email);

  // ── Image-only PDF: OCR path through the real modal ──
  try {
    await openImportModal();
    await page.locator('.import-modal input[type="file"]').setInputFiles(path.join(FIXTURES, "image-only.pdf"));

    // Staged progress appears (progressbar + OCR explanation, §13/§14).
    let sawProgressBar = false;
    let sawOcrCopy = false;
    for (let i = 0; i < 60; i++) {
      if (await page.locator(".import-review").count()) break;
      if (await page.locator('.import-busy [role="progressbar"]').count()) sawProgressBar = true;
      if (await page.locator('.import-busy:has-text("recognizing it automatically")').count()) {
        if (!sawOcrCopy) await page.screenshot({ path: path.join(DIR, "ocr-progress.png") });
        sawOcrCopy = true;
      }
      await page.waitForTimeout(500);
    }
    await page.locator(".import-review").waitFor({ state: "visible", timeout: 30000 });
    await page.screenshot({ path: path.join(DIR, "ocr-review.png") });

    const nameValue = await page.locator('.import-review input').first().inputValue();
    const summary = ((await page.locator(".import-summary").textContent()) ?? "").trim();
    note(
      "image-only OCR import",
      sawProgressBar && /Rhea/i.test(nameValue) ? "ok" : "fail",
      `progressBar=${sawProgressBar} ocrCopy=${sawOcrCopy} name="${nameValue}" summary="${summary.slice(0, 80)}"`,
    );

    // Review → Create Character.
    const createButton = page.locator('.import-actions button:has-text("Create Character")');
    const enabled = await createButton.isEnabled();
    await createButton.click();
    await page.waitForTimeout(2500);
    const created = (await page.locator(".import-modal").count()) === 0 || (await page.locator('.import-modal:has-text("Create")').count()) === 0;
    await page.screenshot({ path: path.join(DIR, "after-create.png") });
    note("create character from OCR draft", enabled && created ? "ok" : "fail", `enabled=${enabled} modalClosed=${created}`);
  } catch (e) {
    await page.screenshot({ path: path.join(DIR, "ocr-flow-error.png") }).catch(() => {});
    note("image-only OCR import", "fail", String(e).slice(0, 200));
  }

  // ── Searchable PDF: fast path skips OCR ──
  try {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await openImportModal();
    const started = Date.now();
    await page.locator('.import-modal input[type="file"]').setInputFiles(path.join(FIXTURES, "searchable.pdf"));
    await page.locator(".import-review").waitFor({ state: "visible", timeout: 20000 });
    const elapsed = Date.now() - started;
    const sawOcrCopy = await page.locator('.import-busy:has-text("recognizing it automatically")').count();
    await page.screenshot({ path: path.join(DIR, "searchable-review.png") });
    note("searchable fast path", sawOcrCopy === 0 ? "ok" : "fail", `elapsedMs=${elapsed} ocrCopyShown=${sawOcrCopy}`);
  } catch (e) {
    note("searchable fast path", "fail", String(e).slice(0, 200));
  }

  note("console errors", consoleErrors.length === 0 ? "ok" : "fail", consoleErrors.join(" | ").slice(0, 300));
} finally {
  fs.writeFileSync(path.join(DIR, "capture-log.json"), JSON.stringify({ log, consoleErrors }, null, 2));
  await browser.close();
}
const ok = log.filter((l) => l.status === "ok").length;
console.log(`\nDone. ${ok}/${log.length} steps ok -> ${DIR}`);
process.exitCode = ok === log.length ? 0 : 1;
