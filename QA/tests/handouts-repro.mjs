// Repro for the Handouts grid bug report (2026-07): "Open image / document"
// and "Manage sharing" links look bad, and the document card spills outside
// its container. Registers a throwaway verified DM, seeds one image handout
// and one document handout (both shared) via the API, then screenshots the
// Handouts tab of the campaign workspace.
//   BASE_URL=http://localhost:3000 node QA/tests/handouts-repro.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, "QA", "screenshots", "handouts-repro");
fs.mkdirSync(DIR, { recursive: true });

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: path.join(DIR, `${name}.png`), ...opts });
  console.log("shot:", name);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 200)));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  const email = `handouts_${Date.now()}@forge.test`;
  const password = "handouts-pass-1!";
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Create account")').first().click();
  await page.waitForTimeout(2000);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(ROOT, "data", "forge.db"));
  db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email);
  db.close();
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Enter")').first().click();
  await page.waitForTimeout(2500);

  // Seed a campaign + two handouts (image + document) via the API, both shared.
  const result = await page.evaluate(async () => {
    const campRes = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: "Handout Repro Table" }),
    });
    const camp = await campRes.json();
    const campaignId = camp.campaign.id;

    async function makeHandout(payload) {
      const res = await fetch(`/api/campaigns/${campaignId}/handouts`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return { error: data };
      const shareRes = await fetch(`/api/campaigns/${campaignId}/handouts/${data.handout.id}/share`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: "{}",
      });
      return { handout: data.handout, shared: shareRes.ok };
    }

    const image = await makeHandout({
      title: "wexfordemo.png",
      category: "npc",
      assetType: "image",
      assetUrl: "https://picsum.photos/seed/wexford/600/400",
    });
    const doc = await makeHandout({
      title: "June_2026_Spending_Addendum.pdf",
      category: "other",
      assetType: "document",
      assetUrl: "https://example.com/June_2026_Spending_Addendum.pdf",
    });
    return { campaignId, image, doc };
  });
  console.log("seed result:", JSON.stringify(result));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Open the campaign, go to Handouts.
  const resume = page.locator(".ao-dash-resume, .campaign-card").first();
  if (await resume.count()) {
    await resume.click();
  } else {
    await page.locator('.ao-nav-item:has-text("Campaign")').first().click();
    await page.waitForTimeout(1000);
    await page.locator(".ao-dash-resume, .campaign-card").first().click();
  }
  await page.waitForTimeout(4000);
  await shot(page, "00-after-open-campaign");
  // Dismiss any blocking modal (first-look tour, choose-character sheet, etc).
  for (let i = 0; i < 3; i++) {
    const scrim = page.locator(".modal-scrim").first();
    if (!(await scrim.count())) break;
    console.log("dismissing scrim, text:", (await scrim.innerText().catch(() => "")).slice(0, 200));
    await scrim.click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.waitForTimeout(600);
  }
  const handoutsTab = page.locator('button:has-text("Handouts")').first();
  await handoutsTab.waitFor({ state: "visible", timeout: 15000 });
  for (let i = 0; i < 5; i++) {
    try {
      await handoutsTab.click({ timeout: 5000 });
      break;
    } catch {
      console.log("Handouts click blocked, retrying after scrim dismiss...");
      const scrim = page.locator(".modal-scrim").first();
      if (await scrim.count()) await scrim.click({ position: { x: 5, y: 5 } }).catch(() => {});
      await page.waitForTimeout(600);
    }
  }
  await page.waitForTimeout(1500);

  await shot(page, "handouts-tab-full", { fullPage: true });

  const grid = page.locator(".ao-cw-handout-grid");
  if (await grid.count()) {
    await shot(page, "handouts-grid-only", { clip: await grid.boundingBox().then((b) => b ?? undefined) });
  }

  // Narrower viewport closer to the reported screenshot's proportions.
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(600);
  await page.locator(".ao-cw-handout-grid, .ao-cw-panel-empty").first().waitFor({ state: "visible", timeout: 20000 });
  await page.locator(".ao-cw-handout-grid").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "handouts-narrow-900", { fullPage: true });
  const narrowOverflow = await page.evaluate(() => {
    const grid = document.querySelector(".ao-cw-handout-grid");
    const panel = document.querySelector(".ao-cw-panel");
    if (!grid || !panel) return null;
    const gridBox = grid.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const cards = [...grid.querySelectorAll(".ao-cw-handout-card")].map((card) => {
      const box = card.getBoundingClientRect();
      const strong = card.querySelector(".ao-cw-handout-copy strong");
      return {
        title: strong?.textContent,
        cardBox: box,
        overflowsPanel: box.right > panelBox.right + 1,
        titleScrollWidth: strong?.scrollWidth,
        titleClientWidth: strong?.clientWidth,
      };
    });
    return { panelBox, gridBox, cards, panelScrollWidth: panel.scrollWidth, panelClientWidth: panel.clientWidth };
  });
  fs.writeFileSync(path.join(DIR, "narrow-overflow.json"), JSON.stringify(narrowOverflow, null, 2));
  console.log("narrow overflow:", JSON.stringify(narrowOverflow, null, 2));

  // Sweep widths looking for real horizontal overflow (scrollWidth > clientWidth).
  for (const width of [1920, 1440, 1200, 1024, 900, 820, 780, 761, 760, 700, 640, 600, 480, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const panel = document.querySelector(".ao-cw-panel");
      const grid = document.querySelector(".ao-cw-handout-grid");
      return {
        docOverflow: doc.scrollWidth - doc.clientWidth,
        panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : null,
        gridOverflow: grid ? grid.scrollWidth - grid.clientWidth : null,
        gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      };
    });
    console.log(`width ${width}:`, JSON.stringify(overflow));
    if (overflow.docOverflow > 2 || overflow.panelOverflow > 2 || overflow.gridOverflow > 2) {
      await shot(page, `overflow-found-${width}`, { fullPage: true });
    }
  }

  // Overflow diagnostics.
  const overflow = await page.evaluate(() => {
    const grid = document.querySelector(".ao-cw-handout-grid");
    if (!grid) return null;
    const gridBox = grid.getBoundingClientRect();
    const cards = [...grid.querySelectorAll(".ao-cw-handout-card")].map((card) => {
      const box = card.getBoundingClientRect();
      const thumb = card.querySelector(".ao-cw-handout-thumb, img");
      const thumbBox = thumb ? thumb.getBoundingClientRect() : null;
      const links = [...card.querySelectorAll(".ao-cw-link")].map((l) => ({
        text: l.textContent?.trim(),
        tag: l.tagName,
        box: l.getBoundingClientRect(),
        computedDisplay: getComputedStyle(l).display,
        computedColor: getComputedStyle(l).color,
      }));
      return {
        cardHeight: box.height,
        cardRight: box.right,
        overflowsGrid: box.right > gridBox.right + 1,
        thumbHeight: thumbBox?.height,
        thumbComputedHeight: thumb ? getComputedStyle(thumb).height : null,
        links,
      };
    });
    return { gridBox, cards };
  });
  fs.writeFileSync(path.join(DIR, "overflow-diagnostics.json"), JSON.stringify(overflow, null, 2));
  console.log("diagnostics:", JSON.stringify(overflow, null, 2));

  // Interaction check: "Manage sharing" is a real, independently focusable
  // button now — Tab should reach it, and clicking it must open the share
  // modal for the RIGHT handout (not rely on a parent card click handler).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  const manageBtn = page.locator('.ao-cw-handout-card:has-text("June_2026_Spending_Addendum.pdf") button:has-text("Manage sharing")');
  await manageBtn.focus();
  const isFocused = await manageBtn.evaluate((el) => el === document.activeElement);
  console.log("manage-sharing button independently focusable:", isFocused);
  await manageBtn.click();
  await page.waitForTimeout(600);
  const shareModalTitle = await page.locator(".campaign-handout-share h2").textContent().catch(() => null);
  console.log("share modal opened for:", shareModalTitle);
  await shot(page, "share-modal-open");
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);

  // Clicking empty card space (not a button/link) should NOT open anything now.
  const card = page.locator('.ao-cw-handout-card:has-text("wexfordemo.png")');
  const cardBox = await card.boundingBox();
  if (cardBox) await page.mouse.click(cardBox.x + 10, cardBox.y + cardBox.height / 2);
  await page.waitForTimeout(400);
  const modalAfterCardClick = await page.locator(".campaign-handout-share").count();
  console.log("modal opened from empty-card click (should be 0):", modalAfterCardClick);
} finally {
  await browser.close();
}
