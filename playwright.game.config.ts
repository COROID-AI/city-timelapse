/**
 * Playwright E2E config for the served vanilla-JS Super Mario game.
 *
 * The web server is started from `node scripts/serve.mjs` (serves game/ on
 * http://localhost:8080/). Tests run against that real served page using a
 * real Chromium browser — no unit mocks, no engine helpers.
 *
 * Run with:
 *   npx playwright test -c playwright.game.config.ts
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  // The browser E2E gate runs Chromium against the served page.
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 256, height: 224 },
    // The game listens on window for key events; give the canvas focus so
    // keyboard input lands on the page.
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://localhost:8080/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
});