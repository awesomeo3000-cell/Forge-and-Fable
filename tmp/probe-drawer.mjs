import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://localhost:3010", { waitUntil: "networkidle", timeout: 45000 });
await p.waitForTimeout(3500);
if (await p.locator("text=/login/i").first().isVisible({ timeout: 2500 }).catch(() => false)) {
  await p.locator("button:has-text('Login')").first().click().catch(() => {});
  await p.waitForTimeout(400);
  await p.locator('input[type="email"]').first().fill("r18-review@test.local");
  await p.locator('input[type="password"]').first().fill("ledger-review-18!");
  await p.locator("button.login-submit").click();
  await p.waitForTimeout(3000);
}
await p.screenshot({ path: "QA/screenshots/mobile-pass2/08-drawer-pill-closed.png" });
await p.locator(".roll-drawer-tab").click({ timeout: 5000 });
await p.waitForTimeout(800);
await p.screenshot({ path: "QA/screenshots/mobile-pass2/09-drawer-bottom-sheet.png" });
// close via X
await p.locator(".roll-drawer-close").click({ timeout: 5000 });
await p.waitForTimeout(500);
const closedByX = !(await p.locator(".roll-drawer-body").isVisible().catch(() => false));
// reopen, close via Escape
await p.locator(".roll-drawer-tab").click();
await p.waitForTimeout(600);
await p.keyboard.press("Escape");
await p.waitForTimeout(400);
const closedByEsc = !(await p.locator(".roll-drawer-body").isVisible().catch(() => false));
console.log("closed via X:", closedByX, "| closed via Escape:", closedByEsc);
await b.close();
