import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  localStorage.setItem("forge-and-fable-user", JSON.stringify({ id: "visual-check", name: "Visual Check", email: "visual-check@test.local" }));
});
await page.route("**/api/characters", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ characters: [] }),
}));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const forge = page.getByRole("button", { name: "Forge", exact: true });
if (await forge.count()) {
  await forge.click();
  await page.waitForTimeout(800);
}

console.log((await page.locator("body").innerText()).slice(0, 2000));
await page.screenshot({ path: "tmp/premade-live-check.png", fullPage: true });
await browser.close();
