/**
 * Browser smoke test for the scaffold.
 *
 * Playwright's `webServer` (see playwright.config.ts) boots the Vite dev server
 * on a fixed port, so this spec only has to load the page. It asserts the scene
 * host element is present, that the renderer either mounted a canvas or took
 * its documented no-WebGL fallback, that nothing was logged as an error, and
 * that the page never requested a remote asset or font origin — the app is
 * procedural end to end.
 */

import { expect, test, type ConsoleMessage, type Request } from '@playwright/test'

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

function isExternalRequest(request: Request): boolean {
  let url: URL
  try {
    url = new URL(request.url())
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  return !LOCAL_HOSTNAMES.has(url.hostname)
}

test.describe('city timelapse scaffold', () => {
  test('boots the dev server and renders the scene host without console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const externalRequests: string[] = []

    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    page.on('pageerror', (error: Error) => {
      pageErrors.push(error.message)
    })
    page.on('request', (request: Request) => {
      if (isExternalRequest(request)) {
        externalRequests.push(request.url())
      }
    })

    const response = await page.goto('/', { waitUntil: 'load' })
    expect(response?.status(), 'index document responds successfully').toBe(200)

    const sceneHost = page.getByTestId('scene-host')
    await expect(sceneHost).toBeVisible()
    await expect(sceneHost).toHaveAttribute('data-webgl', /^(true|false)$/)
    await expect(page.getByRole('heading', { name: /city time period timelapse/i })).toBeVisible()
    await expect(page.getByTestId('scene-status')).toContainText(/frame budget/i)

    const canvasCount = await sceneHost.locator('canvas').count()
    const fallbackCount = await sceneHost.getByTestId('scene-fallback').count()
    expect(canvasCount + fallbackCount, 'scene host rendered a canvas or the fallback').toBeGreaterThan(0)

    // Give late async work (WebGL init, store hydration) a chance to surface noise.
    await page.waitForTimeout(500)

    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(consoleErrors, 'no console errors').toEqual([])
    expect(externalRequests, 'no remote asset or font requests').toEqual([])
  })

  test('mounts the WebGL canvas in a WebGL-capable browser', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })

    const capability = await page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
        if (gl === null) {
          return { supported: false, renderer: 'none' }
        }
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
        const renderer = debugInfo === null ? gl.getParameter(gl.VERSION) : gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        return { supported: true, renderer: String(renderer) }
      } catch {
        return { supported: false, renderer: 'error' }
      }
    })

    test.skip(!capability.supported, `WebGL unavailable in this browser (renderer: ${capability.renderer})`)

    const sceneHost = page.getByTestId('scene-host')
    await expect(sceneHost).toHaveAttribute('data-webgl', 'true')
    await expect(sceneHost.locator('canvas')).toHaveCount(1)
  })
})
