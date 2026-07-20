// Full UX/UI audit walkthrough (2026-07). Registers a throwaway verified
// user, imports a ready character, and screenshots every major surface at
// desktop + mobile while collecting console errors. Read the shots to audit.
//   BASE_URL=http://localhost:3014 node QA/tests/ux-audit-walk.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3014";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, "QA", "screenshots", "ux-audit");
fs.mkdirSync(DIR, { recursive: true });

const consoleErrors = [];
const shots = [];
async function shot(page, name, full = false) {
  const file = path.join(DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  shots.push(name);
  console.log("shot:", name);
}

const draft = {
  source: { kind: "generic-pdf", pages: 1, fileName: "audit.pdf" },
  identity: {
    name: { value: "Auditor Vex", confidence: "confirmed" },
    className: { value: "Wizard", confidence: "confirmed" },
    level: { value: 5, confidence: "confirmed" },
    species: { value: "Elf", confidence: "confirmed" },
    background: { value: "Sage", confidence: "confirmed" },
  },
  abilities: {
    strength: { value: 8, confidence: "confirmed" }, dexterity: { value: 14, confidence: "confirmed" },
    constitution: { value: 13, confidence: "confirmed" }, intelligence: { value: 17, confidence: "confirmed" },
    wisdom: { value: 12, confidence: "confirmed" }, charisma: { value: 10, confidence: "confirmed" },
  },
  vitals: {
    maxHp: { value: 27, confidence: "confirmed" }, currentHp: { value: 27, confidence: "confirmed" },
    tempHp: { value: null, confidence: "missing" }, armorClass: { value: 12, confidence: "confirmed" },
    initiative: { value: 2, confidence: "confirmed" }, speed: { value: "30 ft", confidence: "confirmed" },
  },
  proficiencies: {
    savingThrows: { value: ["Intelligence", "Wisdom"], confidence: "confirmed" },
    skills: { value: ["Arcana", "History", "Investigation"], confidence: "confirmed" },
    armor: { value: null, confidence: "missing" }, weapons: { value: null, confidence: "missing" },
    languages: { value: ["Common", "Elvish", "Draconic"], confidence: "confirmed" }, tools: { value: null, confidence: "missing" },
  },
  attacks: [], inventory: [], spells: [],
  notes: {
    features: { value: null, confidence: "missing" }, backstory: { value: null, confidence: "missing" },
    personality: { value: null, confidence: "missing" }, appearance: { value: null, confidence: "missing" },
  },
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 240)); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + String(e).slice(0, 240)));

try {
  // ── Logged-out auth ──
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  await shot(page, "01-auth-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await shot(page, "02-auth-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);

  // ── Register + verify + login ──
  const email = `audit_${Date.now()}@forge.test`;
  const password = "audit-pass-1!";
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Create account")').first().click();
  await page.waitForTimeout(2500);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(ROOT, "data", "forge.db"));
  db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email);
  db.close();
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Enter")').first().click();
  await page.waitForTimeout(3500);

  // ── Home dashboard, empty ──
  await shot(page, "03-dashboard-empty-desktop");
  await shot(page, "04-dashboard-empty-full", true);

  // ── Commission entry (Create a Character) ──
  const createBtn = page.locator('button:has-text("Create a Character")').first();
  if (await createBtn.count()) {
    await createBtn.click();
    await page.waitForTimeout(2000);
    await shot(page, "05-commission-entry");
    // Try to enter the full commission.
    const open = page.locator('button:has-text("the full commission"), button:has-text("Open the commission"), button:has-text("Standard")').first();
    if (await open.count()) { await open.click().catch(() => {}); await page.waitForTimeout(1500); }
    const openCommission = page.locator('button:has-text("Open the commission")').first();
    if (await openCommission.count()) { await openCommission.click().catch(() => {}); await page.waitForTimeout(2000); }
    await shot(page, "06-creator-chapter", true);
  }

  // ── Import a character via API, back to dashboard ──
  await page.evaluate(async (d) => {
    await fetch("/api/import/pdf/create", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ draft: d }) });
  }, draft);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot(page, "07-dashboard-populated", true);

  // ── Hero sheet ──
  const hero = page.locator('.ao-hd-hero-card:has-text("Auditor Vex")').first();
  if (await hero.count()) {
    await hero.click();
    await page.waitForTimeout(2500);
    await shot(page, "08-hero-sheet-desktop");
    await shot(page, "09-hero-sheet-full", true);
    // Open dice tray.
    const tab = page.locator(".roll-drawer-tab").first();
    if (await tab.count()) { await tab.click(); await page.waitForTimeout(600); await shot(page, "10-dice-tray"); }
  }

  // ── Import modal ──
  const importNav = page.locator('button:has-text("Import"), .ao-header-action:has-text("Import")').first();
  if (await importNav.count()) {
    await importNav.click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "11-import-modal");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // ── Campaigns ──
  const campNav = page.locator('.ao-nav-item:has-text("Campaign")').first();
  if (await campNav.count()) {
    await campNav.click();
    await page.waitForTimeout(2000);
    await shot(page, "12-campaigns", true);
  }

  // ── Mobile: dashboard + sheet ──
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot(page, "13-dashboard-mobile", true);
  const heroM = page.locator('.ao-hd-hero-card:has-text("Auditor Vex")').first();
  if (await heroM.count()) {
    await heroM.click();
    await page.waitForTimeout(2500);
    await shot(page, "14-hero-sheet-mobile", true);
  }

  console.log("\nCONSOLE ERRORS (" + consoleErrors.length + "):");
  for (const e of [...new Set(consoleErrors)]) console.log("  " + e);
} finally {
  fs.writeFileSync(path.join(DIR, "console-errors.json"), JSON.stringify([...new Set(consoleErrors)], null, 2));
  await browser.close();
}
console.log("\nShots:", shots.length, "->", DIR);
