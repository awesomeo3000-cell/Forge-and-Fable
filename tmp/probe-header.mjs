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
const info = await p.evaluate(() => {
  const bar = document.querySelector(".builder-topbar");
  if (!bar) return { found: false, candidates: [...document.querySelectorAll("header")].map(h => h.className) };
  const cs = getComputedStyle(bar);
  return {
    found: true,
    className: bar.className,
    height: bar.getBoundingClientRect().height,
    display: cs.display,
    childs: [...bar.children].map(c => ({ cls: c.className, h: Math.round(c.getBoundingClientRect().height), w: Math.round(c.getBoundingClientRect().width) })),
    actions: (() => { const a = bar.querySelector(".builder-actions"); return a ? { display: getComputedStyle(a).display, flexDir: getComputedStyle(a).flexDirection, gridCols: getComputedStyle(a).gridTemplateColumns, h: Math.round(a.getBoundingClientRect().height) } : null; })(),
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
