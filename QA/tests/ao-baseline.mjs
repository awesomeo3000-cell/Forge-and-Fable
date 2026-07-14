// Arcane Observatory Phase 0 baseline capture (proposal 34 / plan Phase 0.4).
// Screenshots the pre-redesign presentation at the plan's four breakpoints.
// Tolerant by design: every step is best-effort; whatever state is reached is
// captured and labeled. Run: node QA/tests/ao-baseline.mjs (server on :3010)
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "screenshots", "ao-baseline");
fs.mkdirSync(DIR, { recursive: true });

const VIEWPORTS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1280x800", width: 1280, height: 800 },
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "390x844", width: 390, height: 844 },
];

const log = [];
function note(step, status, detail = "") {
  log.push({ step, status, detail });
  console.log(`[${status}] ${step}${detail ? ": " + detail : ""}`);
}

async function shotAllViewports(page, name) {
  for (const vp of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(DIR, `${name}-${vp.tag}.png`), fullPage: false });
      await page.screenshot({ path: path.join(DIR, `${name}-${vp.tag}-full.png`), fullPage: true });
      note(`shot ${name} @ ${vp.tag}`, "ok");
    } catch (e) {
      note(`shot ${name} @ ${vp.tag}`, "fail", String(e).slice(0, 120));
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3500); // splash
  await shotAllViewports(page, "01-auth");

  // Register a throwaway account (register is the default auth mode).
  try {
    const email = `ao_baseline_${Date.now()}@forge.test`;
    await page.locator('input[type="text"]').first().fill("AO Baseline");
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill("ao-baseline-pass-1!");
    await page.locator("button.login-submit").click();
    await page.waitForTimeout(2500);
    note("register", "ok", email);
  } catch (e) {
    note("register", "fail", String(e).slice(0, 160));
  }
  await shotAllViewports(page, "02-start");

  // Standard creator, first step.
  try {
    await page.locator("text=Standard").first().click();
    await page.waitForTimeout(1800);
    note("open standard creator", "ok");
  } catch (e) {
    note("open standard creator", "fail", String(e).slice(0, 120));
  }
  await shotAllViewports(page, "03-creator");

  // Back to start, then a premade -> character sheet.
  try {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const premade = page.locator("text=/premade/i").first();
    await premade.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(DIR, "04a-premade-picker-1440x900.png") });
    // Pick the first concrete premade option if a picker appeared.
    const pick = page.locator(".premade-option, [class*='premade'] button, [class*='premade'] img").first();
    if (await pick.isVisible({ timeout: 2000 }).catch(() => false)) await pick.click();
    await page.waitForTimeout(3000);
    note("premade to sheet", "ok");
  } catch (e) {
    note("premade to sheet", "fail", String(e).slice(0, 160));
  }
  await shotAllViewports(page, "04-sheet");

  // Campaigns surface, best effort.
  try {
    const camp = page.locator("text=/campaign/i").first();
    await camp.click({ timeout: 4000 });
    await page.waitForTimeout(2000);
    note("open campaigns", "ok");
  } catch (e) {
    note("open campaigns", "fail", String(e).slice(0, 120));
  }
  await shotAllViewports(page, "05-campaigns");
} finally {
  fs.writeFileSync(path.join(DIR, "capture-log.json"), JSON.stringify(log, null, 2));
  await browser.close();
}
console.log(`\nDone. ${log.filter((l) => l.status === "ok").length}/${log.length} steps ok -> ${DIR}`);
