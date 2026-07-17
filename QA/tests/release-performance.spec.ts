import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __dreamwrightLcp?: number;
  }
}

test("mobile entry surface stays within the 1.0 performance budget", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "The release budget is a mobile gate.");

  await page.addInitScript(() => {
    window.__dreamwrightLcp = 0;
    new PerformanceObserver((list) => {
      const latest = list.getEntries().at(-1);
      if (latest) window.__dreamwrightLcp = latest.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return {
      lcp: window.__dreamwrightLcp ?? 0,
      domContentLoaded: navigation.domContentLoadedEventEnd,
      load: navigation.loadEventEnd,
      transferBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
    };
  });

  console.log(`[performance] ${testInfo.project.name} ${JSON.stringify(metrics)}`);

  expect(metrics.lcp, JSON.stringify(metrics)).toBeGreaterThan(0);
  expect(metrics.lcp, JSON.stringify(metrics)).toBeLessThanOrEqual(4_000);
  expect(metrics.transferBytes, JSON.stringify(metrics)).toBeLessThanOrEqual(3.5 * 1024 * 1024);
});
