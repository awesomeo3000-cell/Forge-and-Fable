// Phase 0 baseline capture, pass 4: reach a real character sheet via premade.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "screenshots", "ao-baseline");
const VIEWPORTS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1280x800", width: 1280, height: 800 },
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "390x844", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(3500);

const text = page.locator('input[type="text"]').first();
if (await text.isVisible({ timeout: 3000 }).catch(() => false)) {
  await text.fill("AO Sheet");
  await page.locator('input[type="email"]').first().fill(`ao_sheet_${Date.now()}@forge.test`);
  await page.locator('input[type="password"]').first().fill("ao-baseline-pass-1!");
  await page.locator("button.login-submit").click();
  await page.waitForTimeout(2500);
}
await page.locator("text=/begin the commission/i").first().click({ timeout: 10000 });
await page.waitForTimeout(1500);
await page.locator("text=/premade/i").first().click({ timeout: 10000 });
await page.waitForTimeout(800);
await page.locator("text=/open the commission/i").first().click({ timeout: 10000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(DIR, "12-premade-picker-1440x900.png") });
console.log("[ok] 12-premade-picker");

// Choose the first premade option and confirm through whatever CTA follows.
const option = page.locator("main img, [class*='premade'] img, [class*='option'] img").first();
await option.click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1000);
for (const label of [/inscribe/i, /commission/i, /create/i, /confirm/i, /choose/i, /begin/i]) {
  const btn = page.locator(`button:text-matches("${label.source}", "i")`).last();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
}
await page.screenshot({ path: path.join(DIR, "13-after-premade-1440x900.png") });

// If we are on a sheet now, capture all breakpoints and a couple of tabs.
for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(DIR, `14-sheet-${vp.tag}.png`), fullPage: vp.tag === "1440x900" });
  console.log(`[ok] 14-sheet @ ${vp.tag}`);
}
await page.setViewportSize({ width: 1440, height: 900 });
for (const tab of ["Inventory", "Spells", "Features", "Notes"]) {
  const t = page.locator(`text=${tab}`).first();
  if (await t.isVisible({ timeout: 1500 }).catch(() => false)) {
    await t.click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(DIR, `15-sheet-tab-${tab.toLowerCase()}-1440x900.png`) });
    console.log(`[ok] 15-sheet-tab-${tab}`);
  }
}
await browser.close();
console.log("Done pass 4.");
