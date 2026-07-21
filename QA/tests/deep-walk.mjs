// Deep DM/campaign walkthrough — extends ux-audit-walk to the surfaces the
// main walk skips: the campaign workspace and every section, plus the menu
// drawer and notification inbox. Writes shots to QA/screenshots/deep-walk.
//   BASE_URL=http://localhost:3000 node QA/tests/deep-walk.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, "QA", "screenshots", "deep-walk");
fs.mkdirSync(DIR, { recursive: true });

const consoleErrors = [];
const shots = [];
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: full });
  shots.push(name);
  console.log("shot:", name);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 240)); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + String(e).slice(0, 240)));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  // Register + verify + login.
  const email = `deep_${Date.now()}@forge.test`;
  const password = "deep-pass-1!";
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  const dn = page.locator('input[placeholder="Display name"]').first();
  if (await dn.count()) await dn.fill("Sable Thorn");
  await page.locator('button:has-text("Create account")').first().click();
  await page.waitForTimeout(2500);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(ROOT, "data", "forge.db"));
  db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email);
  db.close();
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Enter")').first().click();
  await page.waitForTimeout(3500);

  // Create a campaign via API and read its id back.
  const campaignId = await page.evaluate(async () => {
    const r = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: "The Ashen Compact" }),
    });
    const j = await r.json();
    return j?.campaign?.id ?? null;
  });
  console.log("campaignId:", campaignId);

  if (campaignId) {
    // Warm the dynamically-imported workspace bundle (dev compiles on first hit).
    await page.goto(BASE + `/#/campaigns/${campaignId}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(6000);
    const sections = ["overview", "party", "journal", "sessions", "handouts", "activity", "settings"];
    let i = 20;
    for (const s of sections) {
      const hash = s === "overview" ? `#/campaigns/${campaignId}` : `#/campaigns/${campaignId}/${s}`;
      await page.goto(BASE + "/" + hash, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(3500);
      await shot(page, `${i}-cw-${s}`, true);
      i += 1;
    }
    // Mobile overview + party.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + `/#/campaigns/${campaignId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await shot(page, "40-cw-overview-mobile", true);
    await page.goto(BASE + `/#/campaigns/${campaignId}/party`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await shot(page, "41-cw-party-mobile", true);
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  // Menu drawer + notifications on the dashboard.
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const menu = page.locator('button:has-text("MENU"), button:has-text("Menu")').first();
  if (await menu.count()) { await menu.click().catch(() => {}); await page.waitForTimeout(900); await shot(page, "45-menu-drawer"); await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
  const bell = page.locator('[aria-label*="notification" i], button:has(svg):near(:text("MENU"))').first();
  if (await bell.count()) { await bell.click().catch(() => {}); await page.waitForTimeout(900); await shot(page, "46-notifications"); }

  console.log("\nCONSOLE ERRORS (" + consoleErrors.length + "):");
  for (const e of [...new Set(consoleErrors)]) console.log("  " + e);
} finally {
  fs.writeFileSync(path.join(DIR, "console-errors.json"), JSON.stringify([...new Set(consoleErrors)], null, 2));
  await browser.close();
}
console.log("\nShots:", shots.length, "->", DIR);
