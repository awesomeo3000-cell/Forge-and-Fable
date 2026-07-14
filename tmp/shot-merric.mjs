import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3010", { waitUntil: "networkidle", timeout: 45000 });
await p.waitForTimeout(3500);
if (await p.locator("text=/create your account|login/i").first().isVisible({ timeout: 3000 }).catch(() => false)) {
  await p.locator("button:has-text('Login')").first().click().catch(() => {});
  await p.waitForTimeout(600);
  await p.locator('input[type="email"]').first().fill("r18-review@test.local");
  await p.locator('input[type="password"]').first().fill("ledger-review-18!");
  await p.locator("button.login-submit").click();
  await p.waitForTimeout(3000);
}
await p.locator("text=Merric Underbough").first().click({ timeout: 10000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: "QA/screenshots/ao-baseline/P4-merric-default-1440x900.png" });
await b.close();
console.log("done");
