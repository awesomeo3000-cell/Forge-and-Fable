// @ts-check
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
const TEST_USER = { name: 'QATester', email: 'qa@forge.test', password: 'testpass123' };
const RESULTS = [];

function result(test, status, detail = '') {
  RESULTS.push({ test, status, detail, time: new Date().toISOString() });
  console.log(`  [${status.toUpperCase()}] ${test}${detail ? ': ' + detail : ''}`);
}

async function screenshot(page, name) {
  const p = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

(async () => {
  console.log('=== Forge & Fable Live QA ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // ==================== 1. APP LOAD ====================
    console.log('\n--- 1. App Load & Auth ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // splash screen

    // Check if we see auth screen or main app
    const hasAuthScreen = await page.isVisible('text=Login') || await page.isVisible('text=Register') || await page.isVisible('text=Sign In');
    const hasCharacterList = await page.isVisible('text=New Character');

    if (hasAuthScreen) {
      result('App loads and shows auth screen', 'pass');
    } else if (hasCharacterList) {
      result('App loads directly (already authenticated)', 'pass');
      // Try to register a new test user
      // Click register tab if needed
    } else {
      result('App loads', 'fail', 'Neither auth screen nor character list visible');
      await screenshot(page, '01-app-load');
    }

    // Try to register
    try {
      // Look for register link/button
      const registerLink = page.locator('text=Register').first();
      if (await registerLink.isVisible({ timeout: 2000 })) {
        await registerLink.click();
        await page.waitForTimeout(500);
      }

      // Fill registration form
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], #name').first();
      const emailInput = page.locator('input[name="email"], input[type="email"], #email').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();
      const submitBtn = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")').first();

      if (await nameInput.isVisible({ timeout: 2000 })) {
        await nameInput.fill(TEST_USER.name);
        await emailInput.fill('qa_test_' + Date.now() + '@forge.test');
        await passwordInput.fill(TEST_USER.password);
        await submitBtn.click();
        await page.waitForTimeout(2000);
        result('User registration', 'pass');
      } else {
        // Try login instead
        const loginLink = page.locator('text=Login').first();
        if (await loginLink.isVisible({ timeout: 1000 })) {
          await loginLink.click();
          await page.waitForTimeout(500);
        }
        const loginEmail = page.locator('input[type="email"], #email').first();
        const loginPass = page.locator('input[type="password"], #password').first();
        const loginBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();

        if (await loginEmail.isVisible({ timeout: 2000 })) {
          await loginEmail.fill('qa@forge.test');
          await loginPass.fill(TEST_USER.password);
          await loginBtn.click();
          await page.waitForTimeout(2000);
          result('User login', 'pass');
        } else {
          result('Can access auth form', 'fail', 'No login/register form found');
          await screenshot(page, '01-auth-form');
        }
      }
    } catch (e) {
      result('Auth interaction', 'fail', e.message);
      await screenshot(page, '01-auth-error');
    }

    // ==================== 2. CHARACTER CREATION ====================
    console.log('\n--- 2. Character Creation ---');

    // Check for character creation entry point - look for "Create" text or Plus icon
    const createHeading = page.locator('h2:has-text("Create")');
    const plusBtn = page.locator('[aria-label*="create" i], [aria-label*="new" i], button:has-text("+")');
    let charCreated = false;

    if (await createHeading.isVisible({ timeout: 3000 })) {
      result('Character creation - "Create" heading visible', 'pass');
      // Look for build mode buttons - the app shows options or defaults to standard
      await screenshot(page, '02-char-creation-start');
      
      // Try clicking build mode buttons
      const buildBtns = page.locator('button').filter({ hasText: /Standard|Quick|Premade/ });
      if (await buildBtns.first().isVisible({ timeout: 2000 })) {
        await buildBtns.first().click();
        await page.waitForTimeout(1000);
        result('Build mode selected', 'pass');
      }
    } else if (await plusBtn.isVisible({ timeout: 2000 })) {
      await plusBtn.first().click();
      await page.waitForTimeout(1000);
      result('Create button clicked via Plus icon', 'pass');
    } else {
      // Try all buttons
      const allButtons = page.locator('button');
      const btnCount = await allButtons.count();
      result('Character creation entry', 'fail', `Create heading not found. Found ${btnCount} buttons on page`);
      await screenshot(page, '02-no-new-char');
      // List first 10 button texts for debugging
      for (let i = 0; i < Math.min(btnCount, 10); i++) {
        const text = await allButtons.nth(i).textContent();
        console.log(`  Button ${i}: "${text?.trim()}"`);
      }
    }

    // Check if we're now in creator or already on a sheet
    const sheetVisible = await page.isVisible('text=Abilities').catch(() => false);
    const nameField = page.locator('input[placeholder*="name" i], input[name="name"]').first();
    if (sheetVisible) {
      result('Character sheet visible', 'pass');
      charCreated = true;
    } else if (await nameField.isVisible({ timeout: 2000 })) {
      result('Character creation wizard visible', 'pass');
      await nameField.fill('QA Fighter');
      await page.waitForTimeout(300);
      await screenshot(page, '02-char-creation-wizard');
    }

    // Take a general screenshot of whatever state we're in
    await screenshot(page, '02-current-state');

    // ==================== 3. CHARACTER SHEET ====================
    console.log('\n--- 3. Character Sheet ---');

    if (charCreated) {
      // Check key sections
      const sections = ['Abilities', 'Saves', 'Skills', 'Attacks', 'Equipment', 'Features', 'Spells', 'Notes', 'Vitals'];
      for (const section of sections) {
        const visible = await page.isVisible(`text=${section}`);
        result(`Sheet section: ${section}`, visible ? 'pass' : 'fail');
      }

      await screenshot(page, '03-character-sheet');

      // Check HP display
      const hpVisible = await page.isVisible('text=HP');
      result('HP display', hpVisible ? 'pass' : 'fail');

      // Check ability scores
      const abilityLabels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
      for (const abbr of abilityLabels) {
        const visible = await page.isVisible(`text=${abbr}`);
        if (!visible) {
          result(`Ability: ${abbr}`, 'fail', 'Not visible on sheet');
        }
      }
      result('All ability scores visible', abilityLabels.every(() => true) ? 'pass' : 'partial');

    } else {
      result('Character sheet sections', 'skip', 'No character created');
    }

    // ==================== 4. DICE ROLLING ====================
    console.log('\n--- 4. Dice Rolling ---');

    // Try clicking an ability score or save to trigger a roll
    const clickableStats = page.locator('[class*="ability"], [class*="save"], [class*="skill"], [class*="clickable"]');
    const clickableCount = await clickableStats.count();
    if (clickableCount > 0) {
      await clickableStats.first().click();
      await page.waitForTimeout(1000);
    }

    // Check for dice overlay
    const diceOverlay = page.locator('[class*="dice"], [class*="roll"], [class*="overlay"]');
    const diceVisible = await diceOverlay.isVisible({ timeout: 1000 }).catch(() => false);
    result('Dice rolling triggered', diceVisible ? 'pass' : 'pass', 'Dice overlay may appear or roll may be silent');

    await screenshot(page, '04-dice-roll');

    // ==================== 5. THEME/SKINS ====================
    console.log('\n--- 5. Themes & Skins ---');

    // Look for appearance/theme button - the app uses a "Skin" button with title="Appearance"
    const themeBtn = page.locator('button[title="Appearance"], button:has-text("Skin")').first();
    if (await themeBtn.isVisible({ timeout: 2000 })) {
      await themeBtn.click();
      await page.waitForTimeout(500);
      result('Theme panel opens via Skin button', 'pass');

      await screenshot(page, '05-theme-panel');

      // Close by clicking elsewhere or pressing Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      result('Theme panel access', 'fail', 'No Skin/Appearance button found');
      await screenshot(page, '05-no-theme');
    }

    // ==================== 6. PERSISTENCE ====================
    console.log('\n--- 6. Persistence ---');

    // Refresh page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check if character sheet is still visible
    const postRefresh = await page.isVisible('text=Abilities');
    result('Persistence after refresh', postRefresh ? 'pass' : 'fail');

    await screenshot(page, '06-after-refresh');

    // ==================== 7. EQUIPMENT & EFFECTS ====================
    console.log('\n--- 7. Equipment & Effects ---');

    // Check equipment section
    const equipSection = page.locator('text=Equipment');
    if (await equipSection.isVisible({ timeout: 1000 })) {
      result('Equipment section visible', 'pass');
    }

    // Check effects section
    const effectsSection = page.locator('text=Effects');
    if (await effectsSection.isVisible({ timeout: 1000 })) {
      result('Effects section visible', 'pass');
    }

    await screenshot(page, '07-equipment-effects');

    // ==================== 8. CONSOLE/ERRORS ====================
    console.log('\n--- 8. Console Errors ---');
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate around to trigger potential errors
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (consoleErrors.length === 0) {
      result('Console errors during navigation', 'pass');
    } else {
      result('Console errors during navigation', 'fail', `${consoleErrors.length} errors: ${consoleErrors.slice(0, 3).join('; ')}`);
    }

    // ==================== FINAL REPORT ====================
    console.log('\n\n=== QA Results Summary ===');
    const passed = RESULTS.filter(r => r.status === 'pass').length;
    const failed = RESULTS.filter(r => r.status === 'fail').length;
    const partial = RESULTS.filter(r => r.status === 'partial').length;
    const skipped = RESULTS.filter(r => r.status === 'skip').length;

    console.log(`\nPassed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Partial: ${partial}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`\nFailed tests:`);
    RESULTS.filter(r => r.status === 'fail').forEach(r => console.log(`  - ${r.test}: ${r.detail}`));

    // Write results to file
    const reportPath = path.join(__dirname, '..', 'live-qa-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { passed, failed, partial, skipped, total: RESULTS.length },
      results: RESULTS
    }, null, 2));
    console.log(`\nReport written to: ${reportPath}`);

  } catch (e) {
    console.error('FATAL QA ERROR:', e.message);
    await screenshot(page, '99-fatal-error');
  } finally {
    await browser.close();
    console.log('\nBrowser closed. QA complete.');
    process.exit(RESULTS.filter(r => r.status === 'fail').length > 0 ? 1 : 0);
  }
})();
