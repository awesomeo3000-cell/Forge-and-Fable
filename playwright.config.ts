import { defineConfig, devices } from "@playwright/test";

const port = 3200;
const localBaseURL = `http://127.0.0.1:${port}`;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || localBaseURL;

export default defineConfig({
  testDir: "./QA/tests",
  testMatch: /(release-.*|homebrew-.*|accessibility)\.spec\.ts/,
  outputDir: ".tmp/playwright-results",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    channel: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: externalBaseURL ? undefined : {
    command: `npm run start -- -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      APP_URL: "https://www.dreamwright.gg",
      DISABLE_EMAIL_VERIFICATION: "true",
      ENABLE_INTERNAL_REVIEW_ROUTES: "false",
      FORGE_VAULT_DIR: ".tmp/e2e-data",
      JWT_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only-secret",
    },
  },
});
