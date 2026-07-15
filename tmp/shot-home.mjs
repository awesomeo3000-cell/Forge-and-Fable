import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3010", { waitUntil: "networkidle", timeout: 45000 });
await p.waitForTimeout(3500);
const email = p.locator('input[type="email"]').first();
if (await email.isVisible({ timeout: 2500 }).catch(() => false)) {
  await p.locator("button:has-text('Login')").first().click().catch(() => {});
  await p.waitForTimeout(400);
  await email.fill("r18-review@test.local");
  await p.locator('input[type="password"]').first().fill("ledger-review-18!");
  await p.locator("button.ao-title-submit").click();
  await p.waitForTimeout(3000);
}
await p.locator("text=/^Home$/").first().click({ timeout: 6000 }).catch(() => {});
await p.waitForTimeout(1200);
await p.screenshot({ path: "QA/screenshots/mobile-pass2/10-home-deflavored.png" });
await b.close(); console.log("done");
