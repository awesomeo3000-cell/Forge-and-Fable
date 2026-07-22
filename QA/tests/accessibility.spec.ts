import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test("entry and public policy surfaces pass automated WCAG checks", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  await expectNoSeriousAxeViolations(page);

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("authenticated home and account dialog pass automated WCAG and keyboard checks", async ({ page }, testInfo) => {
  const email = `a11y-${testInfo.project.name}-${Date.now()}@example.com`;
  const password = "release-a11y-password";

  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Display name").fill("Accessibility Tester");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to the Hearth" })).toBeVisible({ timeout: 15_000 });
  await expectNoSeriousAxeViolations(page);

  const workspaceMenu = page.getByTitle("Workspace menu");
  await workspaceMenu.focus();
  await workspaceMenu.press("Enter");
  const accountData = page.getByRole("menuitem", { name: "My data" });
  await accountData.focus();
  await accountData.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Your data" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await expectNoSeriousAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await workspaceMenu.click();
  await page.getByRole("menuitem", { name: "My data" }).click();
  await page.getByLabel("Confirm password").fill(password);
  page.once("dialog", (nativeDialog) => nativeDialog.accept());
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
});

test("reduced-motion preference disables long-running entry animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  const animated = await page.locator("*").evaluateAll((elements) =>
    elements
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          name: style.animationName,
          duration: style.animationDuration,
          iterations: style.animationIterationCount,
        };
      })
      .filter((animation) =>
        animation.name !== "none"
        && animation.duration !== "0s"
        && animation.iterations === "infinite",
      ),
  );
  expect(animated).toEqual([]);
});
