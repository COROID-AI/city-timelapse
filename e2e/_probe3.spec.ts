/** Temporary frame-rate probe. Deleted before hand-off. */
import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 280_000 })

async function snap(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const s = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (s?.read() ?? null) as Record<string, unknown> | null
  })
}
async function inter(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const s = (window as unknown as { __cityTimelapseInteraction?: { read(): unknown } })
      .__cityTimelapseInteraction
    return (s?.read() ?? null) as Record<string, unknown> | null
  })
}

async function rafCount(page: Page, ms: number): Promise<number> {
  return page.evaluate((duration: number) => {
    return new Promise<number>((resolve) => {
      let count = 0
      const start = performance.now()
      const tick = (): void => {
        count += 1
        if (performance.now() - start >= duration) {
          resolve(count)
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, ms)
}

test('frame-rate probe', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect.poll(async () => ((await snap(page))?.['loading'] as { ready: boolean } | undefined)?.ready ?? false, { timeout: 150_000 }).toBe(true)
  await page.waitForTimeout(60_000)

  const out: Record<string, unknown> = {}
  out['a'] = { d: await snap(page), i: await inter(page), raf: await rafCount(page, 5000) }
  await page.waitForTimeout(20_000)
  out['b'] = { d: await snap(page), i: await inter(page), raf: await rafCount(page, 5000) }
  console.log('RAF_REPORT', JSON.stringify(out))
})
