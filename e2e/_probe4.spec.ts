/** Temporary tier-ladder probe. Deleted before hand-off. */
import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 280_000 })

async function snap(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const s = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (s?.read() ?? null) as Record<string, unknown> | null
  })
}

test('tier ladder probe', async ({ page }) => {
  for (const tier of ['low', 'medium']) {
    await page.goto(`/?tier=${tier}`, { waitUntil: 'load' })
    await expect(page.getByTestId('ui-overlay')).toBeVisible()
    await expect.poll(async () => ((await snap(page))?.['loading'] as { ready: boolean } | undefined)?.ready ?? false, { timeout: 180_000 }).toBe(true)
    await expect.poll(async () => ((await snap(page))?.['frame'] as number | undefined) ?? 0, { timeout: 60_000 }).toBeGreaterThan(0)
    await page.waitForTimeout(2000)
    const s = await snap(page)
    const layers = (s?.['layers'] as { id: string; qualityTier: string; objects: number; meshes: number; instances: number; triangles: number; stats: Record<string, number> }[]) ?? []
    console.log('TIER_PROBE', tier, JSON.stringify(layers.map((l) => ({ id: l.id, t: l.qualityTier, o: l.objects, m: l.meshes, i: l.instances, tri: l.triangles, st: l.stats }))))
  }
})
