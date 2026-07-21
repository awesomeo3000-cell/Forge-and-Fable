// UI repro: open the import modal, upload a PDF, click Create Character, and
// report whether a character actually lands. Auth is done by minting a session
// cookie directly (immune to register/login throttling in a busy dev DB).
//   BASE_URL=http://localhost:3000 node QA/tests/pdf-create-ui-repro.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { SignJWT } from "jose";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PDF = path.join(ROOT, "tests", "fixtures", "pdf-import", "searchable.pdf");
const DIR = path.join(ROOT, "QA", "screenshots", "pdf-create-repro");
fs.mkdirSync(DIR, { recursive: true });

// Read JWT_SECRET from .env.local.
const envText = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const JWT_SECRET = (envText.match(/^JWT_SECRET=(.*)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
if (!JWT_SECRET) throw new Error("JWT_SECRET not found in .env.local");

// Insert a verified user directly and mint a session cookie.
const userId = crypto.randomUUID();
const email = `pdfui_${Date.now()}@forge.test`;
const db = new DatabaseSync(path.join(ROOT, "data", "forge.db"));
db.prepare("INSERT INTO users (id, name, email, password_hash, created_at, email_verified, session_version) VALUES (?, ?, ?, ?, ?, 1, 0)")
  .run(userId, "PDF Tester", email, "x", new Date().toISOString());
db.close();
const token = await new SignJWT({ userId, sessionVersion: 0 })
  .setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").setIssuedAt()
  .sign(new TextEncoder().encode(JWT_SECRET));

const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "ff_session", value: token, url: BASE }]);
// The client bootstraps its logged-in state from localStorage, not the cookie.
await ctx.addInitScript((u) => {
  window.localStorage.setItem("forge-and-fable-user", JSON.stringify(u));
}, { id: userId, name: "PDF Tester", email, createdAt: new Date().toISOString() });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const who = await page.evaluate(async () => (await (await fetch("/api/characters", { credentials: "include" })).json()));
  console.log("auth check /api/characters:", who.error ? `ERR ${who.error}` : `${(who.characters ?? []).length} chars`);

  // Open import via the dashboard "Import a Character" card (the user's path).
  const entry = process.env.ENTRY ?? "card";
  if (entry === "menu") {
    const menu = page.locator('button:has-text("MENU")').first();
    if (await menu.count()) { await menu.click(); await page.waitForTimeout(500); await page.locator('text=Import character').first().click().catch(() => {}); }
  } else {
    const card = page.locator('button:has-text("Import Now"), button:has-text("IMPORT NOW")').first();
    console.log("import card found:", await card.count());
    await card.click().catch((e) => console.log("card click failed:", String(e).slice(0, 100)));
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DIR, "1-modal-open.png"), fullPage: true });
  console.log("file input present after open:", await page.locator('input[type="file"]').count());
  console.log("commission page shown:", (await page.locator('text=Commission a character').count()) > 0 || (await page.locator('text=Quickbuilder').count()) > 0);

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(PDF);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(DIR, "2-review.png"), fullPage: true });

  const createBtn = page.locator('button:has-text("Create Character")').first();
  console.log("Create button:", await createBtn.count(), "disabled:", await createBtn.isDisabled().catch(() => "n/a"));
  await createBtn.click().catch((e) => console.log("click failed:", String(e).slice(0, 120)));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(DIR, "3-after-create.png"), fullPage: true });

  const chars = await page.evaluate(async () => {
    const j = await (await fetch("/api/characters", { credentials: "include" })).json();
    return (j.characters ?? []).map((c) => c.name);
  });
  console.log("characters after create:", JSON.stringify(chars));
  console.log("modal still open:", (await page.locator('button:has-text("Create Character")').count()) > 0);
  console.log("success screen shown:", (await page.locator('text=Character Created').count()) > 0);
} finally {
  console.log("console errors:", errors.length ? errors : "none");
  await browser.close();
}
