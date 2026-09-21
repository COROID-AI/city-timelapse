/** Temporary perf calibration probe. Deleted before hand-off. */
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

function brief(s: Record<string, unknown> | null): unknown {
  if (s === null) return null
  const layers = (s['layers'] as { id: string; objects: number; meshes: number; instances: number; triangles: number; stats: Record<string, number> }[]) ?? []
  const q = s['qualityTier']
  return {
    tier: q,
    frame: s['frame'],
    fps: s['fps'],
    frameTimeMs: s['frameTimeMs'],
    layers: layers.map((l) => ({ id: l.id, objects: l.objects, instances: l.instances, tris: l.triangles, stats: l.stats })),
  }
}
function quality(i: Record<string, unknown> | null): unknown {
  if (i === null) return null
  return { q: i['quality'], frame: i['frame'], avg: i['averageFrameTimeMs'] }
}

test('perf probe', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect.poll(async () => ((await snap(page))?.['loading'] as { ready: boolean } | undefined)?.ready ?? false, { timeout: 150_000 }).toBe(true)
  await expect.poll(async () => ((await snap(page))?.['frame'] as number | undefined) ?? 0, { timeout: 60_000 }).toBeGreaterThan(0)

  const out: Record<string, unknown> = {}
  out['qualityInitial'] = quality(await inter(page))
  for (const label of ['t10', 't20', 't35', 't50', 't70']) {
    await page.waitForTimeout(label === 't10' ? 10_000 : 15_000)
    out[label] = { brief: brief(await snap(page)), quality: quality(await inter(page)) }
  }
  await page.getByTestId('quality-low').click()
  await page.waitForTimeout(8_000)
  out['manualLow'] = { brief: brief(await snap(page)), quality: quality(await inter(page)) }
  await page.getByTestId('quality-high').click()
  await page.waitForTimeout(8_000)
  out['manualHigh'] = { brief: brief(await snap(page)), quality: quality(await inter(page)) }
  await page.getByTestId('quality-medium').click()
  await page.waitForTimeout(8_000)
  out['manualMedium'] = { brief: brief(await snap(page)), quality: quality(await inter(page)) }

  console.log('PERF_REPORT', JSON.stringify(out))
})
