// Populated-state mobile pass at 390x844 (the audit's unverified list).
import { chromium } from "playwright";
const DIR = "QA/screenshots/mobile-pass2";
import fs from "node:fs"; fs.mkdirSync(DIR, { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${DIR}/${name}.png` }); console.log("[ok]", name); };
const overflow = async (name) => {
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (r.sw > r.cw) console.log(`[OVERFLOW] ${name}: scrollWidth ${r.sw} > client ${r.cw}`);
};
await p.goto("http://localhost:3010", { waitUntil: "networkidle", timeout: 45000 });
await p.waitForTimeout(3500);
if (await p.locator("text=/create your account|login/i").first().isVisible({ timeout: 3000 }).catch(() => false)) {
  await p.locator("button:has-text('Login')").first().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.locator('input[type="email"]').first().fill("r18-review@test.local");
  await p.locator('input[type="password"]').first().fill("ledger-review-18!");
  await p.locator("button.login-submit").click();
  await p.waitForTimeout(3000);
}
await shot("01-home-populated"); await overflow("home");
// Heroes: open a populated sheet (Merric = default ink skin)
await p.locator("text=/^Hero$/").first().click({ timeout: 8000 }).catch(() => {});
await p.waitForTimeout(1200);
await p.locator("text=Merric Underbough").first().click({ timeout: 8000 }).catch(() => {});
await shot("02-sheet-populated"); await overflow("sheet");
// One sheet tab
await p.locator('button:has-text("Spells"), [role="tab"]:has-text("Spells")').first().click({ timeout: 4000 }).catch(() => {});
await shot("03-sheet-tab"); await overflow("sheet-tab");
// Roll drawer
await p.locator("text=/^DICE$/i").first().click({ timeout: 4000 }).catch(() => {});
await shot("04-roll-drawer"); await overflow("roll-drawer");
await p.keyboard.press("Escape").catch(() => {});
// Table (campaigns)
await p.locator("text=/^Table$/").first().click({ timeout: 8000 }).catch(() => {});
await shot("05-campaigns"); await overflow("campaigns");
// Open the featured campaign -> DM table populated-ish
await p.locator("text=/open the table|resume campaign/i").first().click({ timeout: 8000 }).catch(() => {});
await p.waitForTimeout(2500);
await shot("06-dm-table"); await overflow("dm-table");
// Forge start
await p.locator("text=/^Forge$/").first().click({ timeout: 8000 }).catch(() => {});
await shot("07-forge-start"); await overflow("forge");
await b.close();
console.log("done");
