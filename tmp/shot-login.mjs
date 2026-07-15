import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const tag = process.argv[2] || "login";
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
// Fresh context = logged out, so the auth screen shows.
await p.goto("http://localhost:3010", { waitUntil: "networkidle", timeout: 45000 });
await p.waitForTimeout(4000);
await p.screenshot({ path: `QA/screenshots/mobile-pass2/${tag}-1440.png` });
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(800);
await p.screenshot({ path: `QA/screenshots/mobile-pass2/${tag}-390.png` });
await b.close(); console.log("shot", tag);
