/**
 * Provisioning step for the browser suite.
 *
 * The browser binaries Playwright launches live in a shared cache
 * (`~/.cache/ms-playwright`), not in the repository, so a freshly created
 * execution or verification sandbox can resolve the `@playwright/test` package
 * and still have no Chromium to launch. That failure has nothing to do with the
 * code under test, and it would take every browser check down with it.
 *
 * This setup runs once before any spec and asks Playwright to make sure its
 * Chromium build is present. The call is idempotent and offline-safe:
 * `playwright install` reports "already installed" without touching the network
 * when the build is in place (well under a second), and downloads it when it is
 * not. Playwright ships two binaries behind the `chromium` name — the browser and
 * the headless shell — so the installer is the only reliable check for both.
 *
 * If the build still cannot be resolved afterwards, the setup fails with an
 * actionable message instead of letting every spec report a misleading test
 * failure.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from '@playwright/test'

/** Path Playwright expects the Chromium build at, or null when it cannot say. */
function chromiumPath(): string | null {
  try {
    const path = chromium.executablePath()
    return typeof path === 'string' && path.length > 0 ? path : null
  } catch {
    return null
  }
}

export default function globalSetup(): void {
  try {
    execFileSync('npx', ['--no-install', 'playwright', 'install', 'chromium'], { stdio: 'inherit' })
  } catch (error) {
    throw new Error(
      `Chromium could not be provisioned automatically (${String(error)}). Run \`npm run test:e2e:install\` in an environment with network access before the browser checks.`,
    )
  }

  const provisioned = chromiumPath()
  if (provisioned !== null && !existsSync(provisioned)) {
    throw new Error(
      `Chromium still is not available at ${provisioned} after provisioning. Run \`npm run test:e2e:install\` before the browser checks.`,
    )
  }
}
