// AO-16 context-aware home dashboard verification (dashboard handoff 2026-07-16).
// Registers a throwaway verified account and checks the new-user (empty) state,
// then creates a campaign via the API and checks the DM/populated state. The
// player-context ranking is covered by tests/dashboardContext.test.ts.
// Tolerant like the other QA scripts. Run: node QA/tests/ao-dashboard.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3011";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "screenshots", "ao-dashboard");
fs.mkdirSync(DIR, { recursive: true });

const log = [];
const consoleErrors = [];
function note(step, status, detail = "") {
  log.push({ step, status, detail });
  console.log(`[${status}] ${step}${detail ? ": " + detail : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200)); });
page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 200)));

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3500);

  // Throwaway verified account.
  const email = `ao_dash_${Date.now()}@forge.test`;
  const password = "ao-dash-pass-1!";
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
  await page.waitForTimeout(3500);
  note("register + verify + login", "ok", email);

  // ── New-user (empty) state: dashboard is the landing, no role-choice gate ──
  try {
    await page.locator(".ao-hd").waitFor({ state: "visible", timeout: 8000 });
    const title = ((await page.locator("#ao-hd-welcome-title").textContent()) ?? "").trim();
    const cards = await page.locator(".ao-hd-action-card").count();
    const primary = await page.locator(".ao-hd-action-card.primary").count();
    const firstCard = ((await page.locator(".ao-hd-action-card").first().textContent()) ?? "").trim();
    const featureEmpty = await page.locator(".ao-hd-feature-empty").count();
    const heroesEmpty = await page.locator(".ao-hd-heroes-empty").count();
    // The retired role-choice screen must not appear.
    const roleChoice = await page.locator("text=What brings you to the table").count();
    await page.screenshot({ path: path.join(DIR, "new-user-1440x900.png") });
    note("new-user dashboard", title === "Welcome to the Hearth" && cards === 4 && primary === 1 && /Create a Character/.test(firstCard) && featureEmpty === 1 && heroesEmpty === 1 && roleChoice === 0 ? "ok" : "fail",
      `title="${title}" cards=${cards} primary=${primary} featureEmpty=${featureEmpty} heroesEmpty=${heroesEmpty} roleChoice=${roleChoice}`);
  } catch (e) {
    note("new-user dashboard", "fail", String(e).slice(0, 160));
  }

  // ── Action cards: two-step select-then-act (click box highlights; CTA acts) ──
  try {
    const cards = page.locator(".ao-hd-action-card");
    const primarySelected = ((await cards.nth(0).getAttribute("class")) ?? "").includes("selected");
    // Highlight the third card via its selection layer — no navigation.
    await cards.nth(2).locator(".ao-hd-action-select").click();
    await page.waitForTimeout(300);
    const thirdSelected = ((await cards.nth(2).getAttribute("class")) ?? "").includes("selected");
    const selectedCount = await page.locator(".ao-hd-action-card.selected").count();
    const stayedOnDashboard = await page.locator(".ao-hd").isVisible();
    await page.screenshot({ path: path.join(DIR, "action-selected-1440x900.png") });
    // Clicking the highlighted card's CTA performs the action (opens campaign panel).
    await cards.nth(2).locator(".ao-hd-action-cta").click();
    await page.waitForTimeout(1500);
    const acted = (await page.locator(".campaign-panel").count()) > 0 || !(await page.locator(".ao-hd").isVisible().catch(() => false));
    note("action select-then-act", primarySelected && thirdSelected && selectedCount === 1 && stayedOnDashboard && acted ? "ok" : "fail",
      `primaryDefault=${primarySelected} thirdSelected=${thirdSelected} selectedCount=${selectedCount} stayed=${stayedOnDashboard} acted=${acted}`);
    // The CTA opened the campaign panel — reload to a clean dashboard for the DM checks.
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
  } catch (e) {
    note("action select-then-act", "fail", String(e).slice(0, 160));
  }

  // ── DM state: create a campaign via the API, then re-open Home ──
  try {
    const created = await page.evaluate(async () => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "The Shattered Vale" }),
      });
      return res.ok;
    });
    // Re-open Home from the rail so the dashboard refetches campaigns.
    await page.locator('.ao-nav-item:has-text("Forge")').first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.locator('.ao-nav-item:has-text("Home")').first().click();
    await page.waitForTimeout(2500);
    const featureName = ((await page.locator(".ao-hd-feature h2").first().textContent()) ?? "").trim();
    const primaryAction = ((await page.locator(".ao-hd-action-card.primary strong").textContent()) ?? "").trim();
    const roleChip = ((await page.locator(".ao-dash-role-chip").first().textContent()) ?? "").trim();
    const welcome = ((await page.locator("#ao-hd-welcome-title").textContent()) ?? "").trim();
    await page.screenshot({ path: path.join(DIR, "dm-1440x900.png") });
    note("dm dashboard", created && featureName === "The Shattered Vale" && /Open Active Campaign/.test(primaryAction) && /Dungeon Master/.test(roleChip) && /,/.test(welcome) ? "ok" : "fail",
      `created=${created} feature="${featureName}" primary="${primaryAction}" role="${roleChip}" welcome="${welcome}"`);
  } catch (e) {
    note("dm dashboard", "fail", String(e).slice(0, 160));
  }

  // ── Responsive: no horizontal overflow at tablet + mobile ──
  for (const vp of [{ tag: "768x1024", width: 768, height: 1024 }, { tag: "390x844", width: 390, height: 844 }]) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      await page.screenshot({ path: path.join(DIR, `dm-${vp.tag}.png`) });
      note(`responsive @ ${vp.tag}`, overflow ? "fail" : "ok", overflow ? "horizontal overflow" : "");
    } catch (e) {
      note(`responsive @ ${vp.tag}`, "fail", String(e).slice(0, 120));
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
