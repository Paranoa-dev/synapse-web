import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * `projects` is the browser matrix required by #174. CI selects exactly one
 * project per matrix leg (`npx playwright test --project=${{ matrix.project }}`)
 * so a failure is attributable to a specific engine, while a local
 * `npx playwright test` with no `--project` runs all three back to back.
 *
 * Ports deliberately avoid 3000 (the port `npm run dev` uses) so `reuseExistingServer`
 * can never silently attach to a developer's dev server.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // `forbidOnly` keeps a stray `test.only` from collapsing the matrix locally.
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  // The app has no server, so the "server" is the production build of the app
  // itself. Building rather than running `next dev` keeps the suite honest about
  // what actually ships (static generation, minified bundles) at the cost of a
  // ~40s build per matrix leg.
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
