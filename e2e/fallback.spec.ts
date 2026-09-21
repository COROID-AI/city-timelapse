/**
 * Browser proof of the fallback, loading and degraded states.
 *
 * The composed experience has three states that are easy to get wrong and
 * expensive to get wrong: the page before the block is built, a browser without
 * WebGL, and a layer that throws while a period is being generated. None of them
 * may leave a blank canvas or a dead UI.
 *
 * The checks use the two dev-only diagnostics the composition documents: a
 * patched `getContext` for the WebGL-unavailable case (which is exactly what a
 * real browser without WebGL does), the `?hold=loading` flag for the loading
 * state, and the `window.__cityTimelapseForceFailure` hook for the layer-failure
 * state.
 */

import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 180_000 })

interface DebugSnapshot {
  readonly eraId: string
  readonly mountedLayers: readonly string[]
  readonly pendingLayers: readonly string[]
  readonly loading: { readonly ready: boolean; readonly failedLayer: string | null }
}

async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => {
    const surface = (
      window as unknown as { __cityTimelapse?: { read(): unknown } }
    ).__cityTimelapse
    return (surface?.read() ?? null) as unknown as DebugSnapshot | null
  })
}

/** Makes the browser report no WebGL context at all, like a real incapable host. */
function blockWebgl(): void {
  const original = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function patched(
    this: HTMLCanvasElement,
    contextId: string,
    ...rest: unknown[]
  ): unknown {
    if (typeof contextId === 'string' && contextId.toLowerCase().includes('webgl')) {
      return null
    }
    return (original as unknown as (this: HTMLCanvasElement, ...args: unknown[]) => unknown).apply(
      this,
      [contextId, ...rest],
    )
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
}

test.describe('degraded states', () => {
  test('WebGL unavailable: explains itself and keeps the UI operable', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error: Error) => pageErrors.push(error.message))

    await page.addInitScript(blockWebgl)
    await page.goto('/', { waitUntil: 'load' })

    // A clear message instead of a blank canvas.
    await expect(page.getByTestId('scene-host')).toHaveAttribute('data-webgl', 'false')
    await expect(page.getByTestId('scene-fallback')).toBeVisible()
    await expect(page.getByTestId('scene-fallback')).toHaveAttribute(
      'data-reason',
      'webgl-unavailable',
    )
    await expect(page.getByTestId('scene-fallback-message')).toContainText(/webgl/i)

    // The overlay reports the failure as well, and offers a retry.
    await expect(page.getByTestId('ui-overlay')).toHaveAttribute('data-scene-status', 'error')
    await expect(page.getByTestId('overlay-error')).toBeVisible()
    await expect(page.getByTestId('overlay-retry')).toBeVisible()

    // The UI still works: the timeline selects eras and the controls respond.
    await expect(page.getByTestId('timeline')).toBeVisible()
    await page.locator('[data-testid="timeline-stop"][data-era-id="2025"]').dispatchEvent('click')
    await expect(page.getByTestId('timeline-year-readout')).toHaveText('2025')
    await expect(page.getByTestId('hud-year')).toHaveText('2025')
    await page.getByTestId('quality-low').click()
    await expect(page.getByTestId('quality-low')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('audio-unlock').click()
    await expect(page.getByTestId('audio-unlock')).toHaveAttribute('aria-pressed', 'true')

    expect(pageErrors, 'no uncaught errors').toEqual([])
  })

  test('a failed layer keeps the rest of the block and the UI alive', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error: Error) => pageErrors.push(error.message))

    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>)['__cityTimelapseForceFailure'] = 'storefronts'
    })
    await page.goto('/', { waitUntil: 'load' })

    // The failure is reported, not swallowed and not fatal.
    await expect(page.getByTestId('scene-fallback')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId('scene-fallback')).toHaveAttribute('data-reason', 'layer-failure')
    await expect(page.getByTestId('scene-fallback')).toHaveAttribute('data-layer', 'storefronts')
    await expect(page.getByTestId('overlay-error')).toBeVisible()

    // The renderer is still mounted and the other layers built.
    await expect(page.getByTestId('scene-canvas-surface')).toBeVisible()
    const snapshot = await readDebug(page)
    expect(snapshot).not.toBeNull()
    expect(snapshot?.mountedLayers).toEqual(
      expect.arrayContaining(['layout', 'atmosphere', 'props', 'vehicles']),
    )
    expect(snapshot?.mountedLayers ?? []).not.toContain('storefronts')
    expect(snapshot?.loading.ready).toBe(false)
    expect(snapshot?.loading.failedLayer).toBe('storefronts')

    // The timeline still drives the era store while the block is degraded.
    await page.locator('[data-testid="timeline-stop"][data-era-id="1985"]').dispatchEvent('click')
    await expect(page.getByTestId('timeline-year-readout')).toHaveText('1985')
    await page.getByTestId('motion-reduce').click()
    await expect(page.getByTestId('motion-reduce')).toHaveAttribute('aria-pressed', 'true')

    expect(pageErrors, 'no uncaught errors').toEqual([])
  })

  test('the loading state is explicit, honest and non-blocking', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error: Error) => pageErrors.push(error.message))

    await page.goto('/?hold=loading', { waitUntil: 'load' })

    // The loading state names the work that is still outstanding.
    await expect(page.getByTestId('composition-progress')).toBeVisible()
    await expect(page.getByTestId('composition-progress')).toHaveAttribute('data-ready', 'false')
    await expect(page.getByTestId('composition-progress-detail')).toContainText(/steps complete/i)
    await expect(page.getByTestId('overlay-loading')).toBeVisible()
    await expect(page.getByTestId('ui-overlay')).toHaveAttribute('data-scene-status', 'loading')

    // Nothing is blocked: the timeline still records the viewer's intent.
    await page.locator('[data-testid="timeline-stop"][data-era-id="1965"]').dispatchEvent('click')
    await expect(page.getByTestId('timeline-year-readout')).toHaveText('1965')
    await page.getByTestId('legend-toggle').click()

    // The composition has not been built, so no debug surface exists yet.
    expect(await readDebug(page)).toBeNull()
    expect(pageErrors, 'no uncaught errors').toEqual([])
  })
})
