import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3010/theme-observatory/palettes", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.screenshot({ path: "QA/screenshots/ao-baseline/P2-palettes-full.png", fullPage: true });
await b.close();
console.log("done");
