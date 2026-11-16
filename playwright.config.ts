import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against an app that is already serving; point it at one with E2E_BASE_URL.
 * No webServer block on purpose: the developer owns the dev server.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "en", use: { ...devices["Desktop Chrome"], locale: "en-US" } },
    { name: "ar", use: { ...devices["Desktop Chrome"], locale: "ar-QA" } },
  ],
});
