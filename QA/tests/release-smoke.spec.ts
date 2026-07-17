import { expect, test } from "@playwright/test";

test("public surface, health, and security headers are release-safe", async ({ page, request }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Email")).toBeVisible();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.dreamwright.gg");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://www.dreamwright.gg");

  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy-report-only"]).toBeUndefined();
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true });

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: https://www.dreamwright.gg/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("https://www.dreamwright.gg/privacy");

  const internal = await page.goto("/theme-observatory");
  expect(internal?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  for (const asset of [
    "/backdrop.webp",
    "/wayhouse-backdrop.webp",
    "/forge-backdrop.webp",
    "/Start/onboard-character.webp",
    "/Start/onboard-campaign.webp",
  ]) {
    const assetResponse = await request.get(asset);
    expect(assetResponse.status(), asset).toBe(200);
    expect(assetResponse.headers()["content-type"], asset).toContain("image/webp");
  }
});

test("public legal and support routes are reachable and branded", async ({ page }) => {
  for (const [route, heading] of [
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Use"],
    ["/legal", "Licensing & Attributions"],
    ["/support", "Support"],
  ] as const) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to Dreamwright" })).toBeVisible();
  }
});

test("register, log in, export data, and delete the account", async ({ page }, testInfo) => {
  const email = `release-${testInfo.project.name}-${Date.now()}@example.com`;
  const password = "release-test-password";

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Display name").fill("Release Tester");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Enter" })).toBeVisible();
  await page.getByRole("button", { name: "Enter" }).click();

  await expect(page.getByTitle("Account data")).toBeVisible({ timeout: 15_000 });
  await page.getByTitle("Account data").click();
  await expect(page.getByRole("heading", { name: "Your data" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^dreamwright-account-\d{4}-\d{2}-\d{2}\.json$/);

  await page.getByLabel("Confirm password").fill(password);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Enter" })).toBeVisible();
});
