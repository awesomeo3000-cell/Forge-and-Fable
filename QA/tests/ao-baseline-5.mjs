// Phase 0 baseline capture, pass 5: real character sheet.
// Seeds characters via the API using cookie auth (r18-seed.mjs predates the
// httpOnly ff_session cookie), then opens the sheet in Playwright.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "screenshots", "ao-baseline");
const EMAIL = "r18-review@test.local";
const PASSWORD = "ledger-review-18!";
const VIEWPORTS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1280x800", width: 1280, height: 800 },
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "390x844", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// Login via API inside the browser context so ff_session lands in the jar.
let res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
if (!res.ok()) {
  res = await ctx.request.post(`${BASE}/api/auth/register`, { data: { name: "R18 Reviewer", email: EMAIL, password: PASSWORD } });
  if (!res.ok()) throw new Error(`auth failed: ${await res.text()}`);
}
console.log("[ok] authenticated as", EMAIL);

// Seed two characters if the roster is empty (payload mirrors r18-seed.mjs).
const settings = {
  diceRollingEnabled: false, optionalClassFeatures: false, customizeOrigin: false,
  advancementType: "milestone", hitPointType: "fixed", usePrerequisites: false,
  useFeatPrerequisites: true, useMulticlassPrerequisites: false, showLevelScaledSpells: false,
  encumbranceType: "standard", ignoreCoinWeight: true, modifiersTop: true,
};
const abilities = { strength: 10, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 10, charisma: 13 };
const base = {
  level: 3, alignment: "Neutral", physicalCharacteristics: "", personalCharacteristics: "",
  generalNotes: "", sourceIds: ["5-5e-core"], settings, abilities, currentHp: 21, maxHp: 21, tempHp: 0,
  inventory: [], spellsKnown: [], customRules: [], skillProficiencies: ["stealth", "perception"],
  toolProficiencies: [], languages: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  deathSaves: { successes: 0, failures: 0 },
};
const existing = await (await ctx.request.get(`${BASE}/api/characters`)).json();
if ((existing.characters ?? []).length === 0) {
  for (const hero of [
    { ...base, ruleset: "2014", name: "Merric Underbough", raceId: "halfling", classId: "rogue", background: "Criminal" },
    { ...base, ruleset: "2014", name: "Isolde Vance", raceId: "human", classId: "wizard", background: "Sage", level: 5 },
  ]) {
    const r = await ctx.request.post(`${BASE}/api/characters`, { data: hero });
    if (!r.ok()) throw new Error(`create failed for ${hero.name}: ${await r.text()}`);
    console.log("[ok] created", hero.name);
  }
} else {
  console.log("[ok] roster already has", existing.characters.length);
}

const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(3500);
// UI login if the auth screen is showing (API cookie does not reach the page).
if (await page.locator("text=/create your account|login/i").first().isVisible({ timeout: 3000 }).catch(() => false)) {
  await page.locator("button:has-text('Login')").first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator("button.login-submit").click();
  await page.waitForTimeout(3000);
}
await page.screenshot({ path: path.join(DIR, "16-roster-1440x900.png") });
console.log("[ok] 16-roster");

// Open the wizard (spellcaster exercises more sheet regions).
await page.locator("text=Isolde Vance").first().click({ timeout: 10000 });
await page.waitForTimeout(2500);
for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(DIR, `17-sheet-${vp.tag}.png`) });
  console.log(`[ok] 17-sheet @ ${vp.tag}`);
}
await page.screenshot({ path: path.join(DIR, "17-sheet-390x844-full.png"), fullPage: true });
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(DIR, "17-sheet-1440x900-full.png"), fullPage: true });

// Tab states at desktop.
for (const tab of ["Inventory", "Spells", "Features", "Notes", "Actions"]) {
  const t = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
  if (await t.isVisible({ timeout: 1500 }).catch(() => false)) {
    await t.click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(DIR, `18-sheet-tab-${tab.toLowerCase()}-1440x900.png`) });
    console.log(`[ok] 18-sheet-tab-${tab}`);
  }
}
await browser.close();
console.log("Done pass 5.");
