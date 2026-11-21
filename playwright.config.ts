import { defineConfig, devices } from "@playwright/test";

// P8 — Playwright E2E.
// Sequential by design: the whole run shares one throwaway SQLite DB
// (same model as vitest: fileParallelism false → no cross-file write races).
// Selectors are role/aria/text based — the app ships no data-testid attributes.
export default defineConfig({
  testDir: "./tests/e2e",
  // "*.test.ts" belongs to vitest (tests/unit, tests/integration). Keep
  // Playwright scoped to *.spec.ts so it never picks up vitest suites.
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // CI always retried once; local parity added in P17 — Next 16 dev-mode
  // route-manifest races (background compiles vs. in-flight requests) hit
  // ~1-2 tests per full run with a transient HTML 404 on an already-
  // registered route. A retry re-runs the whole test (fresh exam, fresh
  // attempt), which the race almost always survives. Deterministic
  // failures still fail twice and surface.
  retries: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 45000,
  expect: { timeout: 7000 },
  use: {
    // Traffic goes through the test gateway (infra.ts): no XTransformPort →
    // app (3002), XTransformPort=3003 → classroom-service (3005). This mirrors
    // the production Caddy contract — the client hardcodes the relative path
    // io("/?XTransformPort=3003") and must never see a port URL.
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
});
