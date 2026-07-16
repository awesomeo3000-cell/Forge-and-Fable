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

  // Entry triptych (AO-15): three plates, art loaded, selection cue, then open.
  try {
    const entry = page.locator('button:has-text("Create a character")').first();
    if (await entry.isVisible({ timeout: 4000 }).catch(() => false)) {
      await entry.click();
      await page.waitForTimeout(1500);
    }
    const plates = page.locator(".commission-panel");
    await plates.first().waitFor({ state: "visible", timeout: 5000 });
    const plateCount = await plates.count();
    const artLoaded = await page.locator(".commission-plate img").evaluateAll(
      (imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0),
    );
    const primaryDisabledBefore = await page.locator('button:has-text("Open the commission")').first().isDisabled();
    await page.screenshot({ path: path.join(DIR, "00-entry-resting-1440x900.png") });
    await page.locator('button:has-text("the full commission")').first().click();
    await page.waitForTimeout(600);
    const chosen = await page.locator(".commission-panel.chosen").count();
    const cue = ((await page.locator(".commission-panel.chosen .commission-cue").textContent()) ?? "").trim();
    await page.screenshot({ path: path.join(DIR, "00-entry-selected-1440x900.png") });
    note("entry triptych", plateCount === 3 && artLoaded && primaryDisabledBefore && chosen === 1 && cue.includes("Selected") ? "ok" : "fail",
      `plates=${plateCount} art=${artLoaded} disabledBefore=${primaryDisabledBefore} chosen=${chosen} cue="${cue}"`);
    await page.locator('button:has-text("Open the commission")').first().click();
    await page.waitForTimeout(1800);
    note("open standard creator", "ok");
  } catch (e) {
    note("open standard creator", "fail", String(e).slice(0, 120));
    await page.screenshot({ path: path.join(DIR, "debug-post-login.png") });
    const clickables = await page.locator("button").allTextContents();
    note("post-login buttons", "info", JSON.stringify(clickables.filter((t) => t.trim()).slice(0, 20)));
  }

  // Fresh commission: no chapter is "decided" yet (statMethod starts null).
  try {
    const progress = ((await page.locator(".ao-orrery-brand-count").textContent()) ?? "").trim();
    note("fresh progress count", progress.startsWith("0 of 6") ? "ok" : "fail", progress);
  } catch (e) {
    note("fresh progress count", "fail", String(e).slice(0, 120));
  }

  const steps = page.locator(".ao-orrery-step");

  // ── Chapter workspace interactions (complete-commission handoff) ──

  // Chapter I: Provenance — identity card, source cards, live summary.
  try {
    await steps.nth(0).click();
    await page.waitForTimeout(900);
    await page.locator(".ao-identity-name input").fill("Storybook Regression");
    await page.waitForTimeout(400);
    const summaryName = ((await page.locator(".ao-summary-rows dd").first().textContent()) ?? "").trim();
    const sourceCards = await page.locator(".ao-source-card").count();
    const firstCard = page.locator(".ao-source-card").first();
    const wasEnabled = (await firstCard.getAttribute("class"))?.includes("enabled") ?? false;
    await firstCard.click();
    await page.waitForTimeout(300);
    const nowEnabled = (await firstCard.getAttribute("class"))?.includes("enabled") ?? false;
    await firstCard.click(); // restore
    await page.waitForTimeout(300);
    note("provenance workspace", summaryName === "Storybook Regression" && sourceCards >= 4 && wasEnabled !== nowEnabled ? "ok" : "fail",
      `summary="${summaryName}" sources=${sourceCards} toggle=${wasEnabled}->${nowEnabled}`);
  } catch (e) {
    note("provenance workspace", "fail", String(e).slice(0, 160));
  }

  // Chapter IV: Origin — preview, confirm, decision cards.
  try {
    await steps.nth(3).click();
    await page.waitForTimeout(900);
    await page.locator(".ao-origin .ao-catalog-card").first().click();
    await page.waitForTimeout(400);
    const featureTitle = ((await page.locator(".ao-origin .ao-feature-title").textContent()) ?? "").trim();
    await page.locator(".ao-origin .ao-feature-confirm").click();
    await page.waitForTimeout(500);
    const recorded = await page.locator(".ao-origin .ao-catalog-card.selected").count();
    note("origin preview/confirm", featureTitle.length > 0 && recorded === 1 ? "ok" : "fail",
      `feature="${featureTitle}" recorded=${recorded}`);
  } catch (e) {
    note("origin preview/confirm", "fail", String(e).slice(0, 160));
  }

  // Chapter V: Lineage — preview a lineage, seal it, browse a family.
  try {
    await steps.nth(4).click();
    await page.waitForTimeout(900);
    await page.locator(".ao-lineage .ao-catalog-card").first().click();
    await page.waitForTimeout(400);
    const isFamily = (await page.locator(".ao-lineage-variants").count()) > 0;
    if (isFamily) {
      await page.locator(".ao-lineage-variant").first().click();
      await page.waitForTimeout(400);
    }
    const sealButton = page.locator(".ao-lineage .ao-feature-confirm");
    await sealButton.waitFor({ state: "visible", timeout: 4000 });
    await sealButton.click();
    await page.waitForTimeout(500);
    const sealed = await page.locator(".ao-lineage .ao-catalog-card.selected").count();
    note("lineage preview/seal", sealed >= 1 ? "ok" : "fail", `family=${isFamily} sealed=${sealed}`);
  } catch (e) {
    note("lineage preview/seal", "fail", String(e).slice(0, 160));
  }

  // Chapter VI: Attributes — method-first, workspace appears, roll obvious.
  try {
    await steps.nth(5).click();
    await page.waitForTimeout(900);
    const workspaceBefore = await page.locator(".ao-ability-grid").count();
    const methodCards = await page.locator(".ao-method-card").count();
    await page.locator('.ao-method-card:has-text("Point Buy")').click();
    await page.waitForTimeout(500);
    const workspaceAfter = await page.locator(".ao-ability-grid").count();
    const abilityCards = await page.locator(".ao-ability-card").count();
    await page.locator('.ao-method-card:has-text("Rolled")').click();
    await page.waitForTimeout(500);
    const rollVisible = await page.locator(".ao-roll-action").isVisible();
    await page.screenshot({ path: path.join(DIR, "ch6-attributes-rolled-1440x900.png") });
    await page.locator('.ao-method-card:has-text("Point Buy")').click();
    await page.waitForTimeout(400);
    note("attributes method-first", methodCards === 4 && workspaceBefore === 0 && workspaceAfter === 1 && abilityCards === 6 && rollVisible ? "ok" : "fail",
      `methods=${methodCards} before=${workspaceBefore} after=${workspaceAfter} abilities=${abilityCards} roll=${rollVisible}`);
  } catch (e) {
    note("attributes method-first", "fail", String(e).slice(0, 160));
  }

  // Chapter VII: certificate leads with the portrait.
  try {
    await steps.nth(6).click();
    await page.waitForTimeout(900);
    const portrait = await page.locator(".ao-cert-portrait").count();
    note("seal portrait", portrait === 1 ? "ok" : "fail", `portraits=${portrait}`);
  } catch (e) {
    note("seal portrait", "fail", String(e).slice(0, 120));
  }
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
