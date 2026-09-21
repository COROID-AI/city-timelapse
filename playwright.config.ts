import { defineConfig, devices } from '@playwright/test'

/** The dev server port is fixed so browser checks never manage their own server. */
export const DEV_SERVER_PORT = 5173
export const DEV_SERVER_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`

/**
 * Browser harness. `webServer` boots the Vite dev server (strict port) and
 * waits for it before any spec runs, so later tasks only write specs.
 * Chromium is launched with software rasterisation flags so WebGL works in
 * headless containers without a GPU.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: DEV_SERVER_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-gpu-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-dev-shm-usage',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${DEV_SERVER_PORT} --strictPort`,
    url: DEV_SERVER_URL,
    // The dev server on this fixed port may already be running: the workflow's
    // own `qa-app-health` check boots `npm run dev` and probes `/` before the
    // browser commands run, and this config's premise is that browser checks
    // never manage their own server. Reusing whatever is serving the port (and
    // starting one when nothing is) is what keeps a busy port from failing the
    // suite, with or without `CI` set.
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
