// Phase 0 baseline capture, pass 2: screens behind the onboarding fork.
// Run: node QA/tests/ao-baseline-2.mjs (server on :3010)
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
const note = (step, status, detail = "") => {
  log.push({ step, status, detail });
  console.log(`[${status}] ${step}${detail ? ": " + detail.slice(0, 140) : ""}`);
};

async function shots(page, name) {
  for (const vp of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(DIR, `${name}-${vp.tag}.png`) });
      note(`shot ${name} @ ${vp.tag}`, "ok");
    } catch (e) {
      note(`shot ${name} @ ${vp.tag}`, "fail", String(e));
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
}

async function freshUser(page, label) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3500);
  const email = `ao_b2_${label}_${Date.now()}@forge.test`;
  await page.locator('input[type="text"]').first().fill(`AO ${label}`);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill("ao-baseline-pass-1!");
  await page.locator("button.login-submit").click();
  await page.waitForTimeout(2500);
  note(`register ${label}`, "ok", email);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  // Player path: commission -> start modes -> standard creator.
  await freshUser(page, "player");
  await page.locator("text=/begin the commission/i").first().click();
  await page.waitForTimeout(1800);
  await shots(page, "06-start-modes");

  try {
    await page.locator("text=/standard/i").first().click({ timeout: 8000 });
    await page.waitForTimeout(1800);
    note("open standard creator", "ok");
    await shots(page, "07-creator-step1");
    // Advance one step if a next/continue control exists, to capture a filled state.
    const next = page.locator("button:has-text('Next'), button:has-text('Continue')").last();
    if (await next.isVisible({ timeout: 2000 }).catch(() => false)) {
      await next.click();
      await page.waitForTimeout(1200);
      await shots(page, "08-creator-step2");
    }
  } catch (e) {
    note("standard creator", "fail", String(e));
    await shots(page, "07-creator-unreached");
  }

  // Quickbuilder path to reach a sheet fast.
  try {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    await page.locator("text=/begin the commission/i").first().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    await page.locator("text=/quick/i").first().click({ timeout: 8000 });
    await page.waitForTimeout(1800);
    note("open quickbuilder", "ok");
    await shots(page, "09-quickbuilder");
  } catch (e) {
    note("quickbuilder", "fail", String(e));
  }

  // DM path: fresh user takes the DM's chair.
  try {
    await freshUser(page, "dm");
    await page.locator("text=/take the dm's chair/i").first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
    note("dm chair", "ok");
    await shots(page, "10-dm-path");
  } catch (e) {
    note("dm chair", "fail", String(e));
    await shots(page, "10-dm-unreached");
  }
} finally {
  fs.writeFileSync(path.join(DIR, "capture-log-2.json"), JSON.stringify(log, null, 2));
  await browser.close();
}
console.log(`\nDone. ${log.filter((l) => l.status === "ok").length}/${log.length} ok -> ${DIR}`);
