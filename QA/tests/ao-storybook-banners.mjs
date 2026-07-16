// AO-14 Arcane Storybook chapter-banner verification (art handoff 2026-07-16).
// Registers a throwaway account, opens the Standard creator, walks all seven
// chapters via the Orrery Path, and checks: banner art loads (chapters I–VI),
// The Seal switches to backdrop mode, and no console errors fire.
// Tolerant by design like ao-baseline.mjs. Run: node QA/tests/ao-storybook-banners.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3011";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "screenshots", "ao-storybook");
fs.mkdirSync(DIR, { recursive: true });

const CHAPTERS = ["provenance", "likeness", "vocation", "origin", "lineage", "attributes", "seal"];

const log = [];
const consoleErrors = [];
function note(step, status, detail = "") {
  log.push({ step, status, detail });
  console.log(`[${status}] ${step}${detail ? ": " + detail : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
});
page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 200)));

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3500); // splash

  // Throwaway account (register is the default auth mode). Registration now
  // requires email verification, so flip the flag directly in the local DB
  // before logging in.
  try {
    const email = `ao_storybook_${Date.now()}@forge.test`;
    const password = "ao-storybook-pass-1!";
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button:has-text("Create account")').first().click();
    await page.waitForTimeout(2500);

    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "forge.db"));
    db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email);
    db.close();

    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button:has-text("Enter")').first().click();
    await page.waitForTimeout(3000);
    note("register + verify + login", "ok", email);
  } catch (e) {
    note("register + verify + login", "fail", String(e).slice(0, 160));
  }

  // Standard creator — route through the home dashboard if one appears.
  try {
    const entry = page.locator('button:has-text("Create a character")').first();
    if (await entry.isVisible({ timeout: 4000 }).catch(() => false)) {
      await entry.click();
      await page.waitForTimeout(1500);
    }
    await page.locator('button:has-text("the full commission")').first().click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("Open the commission")').first().click();
    await page.waitForTimeout(1800);
    note("open standard creator", "ok");
  } catch (e) {
    note("open standard creator", "fail", String(e).slice(0, 120));
    await page.screenshot({ path: path.join(DIR, "debug-post-login.png") });
    const clickables = await page.locator("button").allTextContents();
    note("post-login buttons", "info", JSON.stringify(clickables.filter((t) => t.trim()).slice(0, 20)));
  }

  const steps = page.locator(".ao-orrery-step");
  for (let i = 0; i < 7; i++) {
    const id = CHAPTERS[i];
    try {
      await steps.nth(i).click();
      await page.waitForTimeout(1200);

      if (i < 6) {
        // Banner mode: image present, loaded, chip labeled.
        const img = page.locator(".ao-chapter-banner-art img");
        await img.waitFor({ state: "attached", timeout: 5000 });
        const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
        const src = await img.getAttribute("src");
        const chip = (await page.locator(".ao-chapter-banner-chip").textContent()) ?? "";
        const okSrc = src === `/commission/${id}-banner.webp`;
        note(`chapter ${i + 1} (${id}) banner`, loaded && okSrc ? "ok" : "fail",
          `src=${src} loaded=${loaded} chip="${chip.trim()}"`);
      } else {
        // The Seal: backdrop shell variant, no banner.
        const mode = await page.locator(".ao-orrery").getAttribute("data-art-mode");
        const bannerCount = await page.locator(".ao-chapter-banner").count();
        note(`chapter 7 (seal) backdrop`, mode === "backdrop" && bannerCount === 0 ? "ok" : "fail",
          `data-art-mode=${mode} banners=${bannerCount}`);
      }

      await page.screenshot({ path: path.join(DIR, `ch${i + 1}-${id}-1440x900.png`) });
    } catch (e) {
      note(`chapter ${i + 1} (${id})`, "fail", String(e).slice(0, 160));
    }
  }

  // Responsive spot checks on Vocation and The Seal.
  for (const vp of [{ tag: "768x1024", width: 768, height: 1024 }, { tag: "390x844", width: 390, height: 844 }]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const idx of [2, 6]) {
      try {
        await steps.nth(idx).click();
        await page.waitForTimeout(1000);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        note(`responsive ${CHAPTERS[idx]} @ ${vp.tag}`, overflow ? "fail" : "ok",
          overflow ? "horizontal overflow" : "");
        await page.screenshot({ path: path.join(DIR, `ch${idx + 1}-${CHAPTERS[idx]}-${vp.tag}.png`) });
      } catch (e) {
        note(`responsive ${CHAPTERS[idx]} @ ${vp.tag}`, "fail", String(e).slice(0, 120));
      }
    }
  }

  note("console errors", consoleErrors.length === 0 ? "ok" : "fail", consoleErrors.join(" | ").slice(0, 400));
} finally {
  fs.writeFileSync(path.join(DIR, "capture-log.json"), JSON.stringify({ log, consoleErrors }, null, 2));
  await browser.close();
}
const ok = log.filter((l) => l.status === "ok").length;
console.log(`\nDone. ${ok}/${log.length} steps ok -> ${DIR}`);
process.exitCode = ok === log.length ? 0 : 1;
