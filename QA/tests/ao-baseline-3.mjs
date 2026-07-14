// Phase 0 baseline capture, pass 3: DM's chair path (reuses live session).
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
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

// Register fresh; if the auth form is absent we are already signed in.
const text = page.locator('input[type="text"]').first();
if (await text.isVisible({ timeout: 3000 }).catch(() => false)) {
  await text.fill("AO DM");
  await page.locator('input[type="email"]').first().fill(`ao_dm_${Date.now()}@forge.test`);
  await page.locator('input[type="password"]').first().fill("ao-baseline-pass-1!");
  await page.locator("button.login-submit").click();
  await page.waitForTimeout(2500);
}
await page.locator("text=/take the dm/i").first().click({ timeout: 10000 });
await page.waitForTimeout(2500);
for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DIR, `10-dm-path-${vp.tag}.png`) });
  console.log(`[ok] 10-dm-path @ ${vp.tag}`);
}
// If a campaign-create control exists, capture that state too.
const create = page.locator("button:has-text('Create'), button:has-text('New campaign'), text=/open a table/i").first();
if (await create.isVisible({ timeout: 3000 }).catch(() => false)) {
  await create.click();
  await page.waitForTimeout(1800);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(DIR, `11-dm-campaign-1440x900.png`) });
  console.log("[ok] 11-dm-campaign @ 1440x900");
}
await browser.close();
fs.appendFileSync(path.join(DIR, "capture-log-2.json"), "\n// pass 3 complete\n");
console.log("Done pass 3.");
