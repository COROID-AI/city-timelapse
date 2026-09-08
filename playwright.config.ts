import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the City Time Period Timelapse browser QA harness.
 *
 * Launches the system-installed Chromium (no `playwright install` needed) and
 * serves the composed scene through Vite. The E2E drives the REAL top timeline
 * slider across all five eras and asserts the scene transforms on screen with
 * no console errors, capturing per-era screenshots under `tests/screenshots/`
 * as committed evidence.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
// The sandbox-provided Chromium binary (confirmed present via `chromium --version`).
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.playwright-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: `${BASE_URL}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});