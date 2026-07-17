// Dice tray Option B verification (proposal 35, AO-17).
// Registers a throwaway verified account, creates a character via the PDF
// import API (no creator walk needed), opens the sheet, and drives the new
// roll-ticket tray end to end: sheet-armed advantage inherited by the d20
// chip, mode cycling, roll → result strip with kept die, auto-clear,
// history reroll, formula replacement, and the mobile bottom sheet. Run:
//   BASE_URL=http://localhost:3013 node QA/tests/dice-tray-b.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3013";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, "QA", "screenshots", "dice-tray-b");
fs.mkdirSync(DIR, { recursive: true });

const log = [];
const consoleErrors = [];
function note(step, status, detail = "") {
  log.push({ step, status, detail });
  console.log(`[${status}] ${step}${detail ? ": " + detail : ""}`);
}

const draft = {
  source: { kind: "generic-pdf", pages: 1, fileName: "qa.pdf" },
  identity: {
    name: { value: "Tray Tester", confidence: "confirmed" },
    className: { value: "Fighter", confidence: "confirmed" },
    level: { value: 3, confidence: "confirmed" },
    species: { value: "Human", confidence: "confirmed" },
    background: { value: "Soldier", confidence: "confirmed" },
  },
  abilities: {
    strength: { value: 16, confidence: "confirmed" },
    dexterity: { value: 12, confidence: "confirmed" },
    constitution: { value: 14, confidence: "confirmed" },
    intelligence: { value: 10, confidence: "confirmed" },
    wisdom: { value: 12, confidence: "confirmed" },
    charisma: { value: 8, confidence: "confirmed" },
  },
  vitals: {
    maxHp: { value: 28, confidence: "confirmed" },
    currentHp: { value: 28, confidence: "confirmed" },
    tempHp: { value: null, confidence: "missing" },
    armorClass: { value: 16, confidence: "confirmed" },
    initiative: { value: 1, confidence: "confirmed" },
    speed: { value: "30 ft", confidence: "confirmed" },
  },
  proficiencies: {
    savingThrows: { value: ["Strength", "Constitution"], confidence: "confirmed" },
    skills: { value: ["Athletics"], confidence: "confirmed" },
    armor: { value: null, confidence: "missing" },
    weapons: { value: null, confidence: "missing" },
    languages: { value: ["Common"], confidence: "confirmed" },
    tools: { value: null, confidence: "missing" },
  },
  attacks: [],
  inventory: [],
  spells: [],
  notes: {
    features: { value: null, confidence: "missing" },
    backstory: { value: null, confidence: "missing" },
    personality: { value: null, confidence: "missing" },
    appearance: { value: null, confidence: "missing" },
  },
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200)); });
page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 200)));

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2500);

  const email = `dice_b_${Date.now()}@forge.test`;
  const password = "dice-b-pass-1!";
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
  await page.waitForTimeout(3000);

  // Character via the import API — no creator walkthrough needed.
  const created = await page.evaluate(async (importDraft) => {
    const res = await fetch("/api/import/pdf/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ draft: importDraft }),
    });
    return res.ok;
  }, draft);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  note("register + login + import character", created ? "ok" : "fail", email);

  // Open the sheet from the dashboard.
  await page.locator('.ao-hd-hero-card:has-text("Tray Tester")').first().click();
  await page.locator(".ao-dice-arm").waitFor({ state: "visible", timeout: 10000 });
  note("sheet open with arm toggle", "ok");

  // Arm advantage from the sheet; the tray tab should show the armed dot.
  const advButton = page.locator(".ao-dice-arm").getByRole("button", { name: "Advantage", exact: true });
  await advButton.click();
  const armed = (await advButton.getAttribute("class")) ?? "";
  const tabArmed = await page.locator(".roll-drawer-tab.armed").count();
  note("sheet arms advantage", armed.includes("is-armed") && tabArmed === 1 ? "ok" : "fail", `class="${armed}" tabDot=${tabArmed}`);

  // Open the tray: no segmented mode control; ticket inherits the armed adv.
  await page.locator(".roll-drawer-tab").click();
  await page.locator(".ao-dice-ticket").waitFor({ state: "visible", timeout: 5000 });
  const segmented = await page.locator(".roll-mode").count();
  await page.locator('.ao-dice-die:has-text("d6")').first().click();
  await page.locator('.ao-dice-die:has-text("d6")').first().click();
  await page.locator('.ao-dice-die:has-text("d20")').first().click();
  const d20Chip = page.locator(".ao-dice-chip", { hasText: "1d20" });
  const chipText = ((await d20Chip.textContent()) ?? "").trim();
  note("ticket built, d20 inherits armed adv, no segmented control", segmented === 0 && /adv/.test(chipText) ? "ok" : "fail", `segmented=${segmented} chip="${chipText}"`);

  // Cycle the chip: adv → dis → normal → adv.
  await d20Chip.locator("button").first().click();
  const afterDis = ((await d20Chip.textContent()) ?? "").trim();
  await d20Chip.locator("button").first().click();
  const afterNormal = ((await d20Chip.textContent()) ?? "").trim();
  await d20Chip.locator("button").first().click();
  const backToAdv = ((await d20Chip.textContent()) ?? "").trim();
  note("d20 chip cycles modes", /dis/.test(afterDis) && !/adv|dis/.test(afterNormal) && /adv/.test(backToAdv) ? "ok" : "fail",
    `dis="${afterDis}" normal="${afterNormal}" adv="${backToAdv}"`);

  await page.screenshot({ path: path.join(DIR, "ticket-1440x900.png") });

  // Roll: result strip fills after the dice land; ticket auto-clears.
  const rollLabel = ((await page.locator(".ao-dice-roll").textContent()) ?? "").trim();
  await page.locator(".ao-dice-roll").click();
  await page.locator(".ao-dice-result-total").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(500);
  const resultTotal = ((await page.locator(".ao-dice-result-total").textContent()) ?? "").trim();
  const keptDice = await page.locator(".ao-dice-result .roll-history-die").count();
  const ticketCleared = await page.locator(".ao-dice-ticket-empty").count();
  note("roll → result strip + auto-clear", /^\d+$/.test(resultTotal) && keptDice === 2 && ticketCleared === 1 ? "ok" : "fail",
    `label="${rollLabel}" total=${resultTotal} advFaces=${keptDice} cleared=${ticketCleared}`);
  await page.screenshot({ path: path.join(DIR, "result-1440x900.png") });

  // History reroll re-runs the same pool.
  const before = await page.locator(".roll-history-list li").count();
  await page.locator(".roll-history-list .ao-dice-reroll").first().click();
  await page.waitForTimeout(4000);
  const after = await page.locator(".roll-history-list li").count();
  note("history reroll", after === before + 1 ? "ok" : "fail", `${before} -> ${after}`);

  // Formula replaces the ticket.
  await page.locator(".ao-dice-formula input").fill("4d6kh3+2");
  await page.locator(".ao-dice-formula input").press("Enter");
  const khChip = await page.locator(".ao-dice-chip", { hasText: "4d6kh3" }).count();
  const modText = ((await page.locator(".ao-dice-mod strong").textContent()) ?? "").trim();
  note("formula replaces ticket", khChip === 1 && modText === "+2" ? "ok" : "fail", `khChip=${khChip} mod="${modText}"`);

  // Mobile bottom sheet.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  const trayVisible = await page.locator(".ao-dice-ticket").isVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(DIR, "tray-390x844.png") });
  note("mobile bottom sheet", trayVisible && !overflow ? "ok" : "fail", `visible=${trayVisible} overflow=${overflow}`);

  note("console errors", consoleErrors.length === 0 ? "ok" : "fail", consoleErrors.join(" | ").slice(0, 300));
} finally {
  fs.writeFileSync(path.join(DIR, "capture-log.json"), JSON.stringify({ log, consoleErrors }, null, 2));
  await browser.close();
}
const ok = log.filter((l) => l.status === "ok").length;
console.log(`\nDone. ${ok}/${log.length} steps ok -> ${DIR}`);
process.exitCode = ok === log.length ? 0 : 1;
