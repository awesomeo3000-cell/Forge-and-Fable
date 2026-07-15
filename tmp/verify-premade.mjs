import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

const forge = page.getByRole("button", { name: "Forge", exact: true });
if (await forge.count()) {
  await forge.click();
  await page.waitForTimeout(800);
}

console.log((await page.locator("body").innerText()).slice(0, 2000));
await page.screenshot({ path: "tmp/premade-live-check.png", fullPage: true });
await browser.close();
