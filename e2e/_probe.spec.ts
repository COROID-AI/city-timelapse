/** Temporary calibration probe. Deleted before hand-off. */
import { expect, test, type Page } from '@playwright/test'
import { ERA_IDS } from '../src/era'

test.describe.configure({ timeout: 280_000 })

interface Layer {
  readonly id: string
  readonly mounted: boolean
  readonly kind: string
  readonly eraId: string | null
  readonly objects: number
  readonly meshes: number
  readonly instances: number
  readonly triangles: number
  readonly stats: Record<string, number>
}

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

test('calibration probe', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?tier=high', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect.poll(async () => ((await snap(page))?.['loading'] as { ready: boolean } | undefined)?.ready ?? false, { timeout: 150_000 }).toBe(true)
  await expect.poll(async () => ((await snap(page))?.['frame'] as number | undefined) ?? 0, { timeout: 60_000 }).toBeGreaterThan(0)

  const report: Record<string, unknown> = {}
  report['t0'] = await snap(page)
  await page.waitForTimeout(8000)
  report['highTier'] = {
    debug: await snap(page),
    interaction: await inter(page),
  }

  await page.waitForTimeout(12000)
  report['highTierLater'] = { debug: await snap(page), interaction: await inter(page) }

  await page.getByTestId('quality-low').click()
  await page.waitForTimeout(8000)
  report['lowTier'] = { debug: await snap(page), interaction: await inter(page) }

  // Now hide everything but the canvas, unlock audio, walk eras with instant swaps.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByTestId('audio-unlock').click()
  await page.waitForTimeout(1000)
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'probe-hide'
    style.textContent = 'body * { visibility: hidden !important } .scene-host, .scene-host * { visibility: visible !important }'
    document.head.append(style)
  })

  const frames: Record<string, string> = {}
  const stats: Record<string, unknown> = {}
  for (const eraId of ERA_IDS) {
    await page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`).dispatchEvent('click')
    await expect.poll(async () => ((await snap(page))?.['eraId'] as string | null) ?? null, { timeout: 90_000 }).toBe(eraId)
    await expect.poll(async () => ((await snap(page))?.['transitioning'] as boolean | undefined) ?? true, { timeout: 90_000 }).toBe(false)
    await page.waitForTimeout(1500)
    const s = await snap(page)
    const layers = ((s?.['layers'] as Layer[] | undefined) ?? []).map((l) => ({ id: l.id, mounted: l.mounted, kind: l.kind, eraId: l.eraId, objects: l.objects, meshes: l.meshes, instances: l.instances, triangles: l.triangles, stats: l.stats }))
    stats[eraId] = { layers, audio: s?.['audio'], camera: s?.['camera'], inspection: s?.['inspection'], year: s?.['year'] }
    const buf = await page.getByTestId('scene-canvas-surface').screenshot()
    frames[eraId] = buf.toString('base64')
    console.log('ERA', eraId, JSON.stringify(layers))
  }
  await page.evaluate(() => document.getElementById('probe-hide')?.remove())

  // Adjacent pixel diffs computed in-page.
  const diffs: Record<string, number> = {}
  const eraList = [...ERA_IDS]
  for (let i = 1; i < eraList.length; i += 1) {
    const a = frames[eraList[i - 1] ?? '']
    const b = frames[eraList[i] ?? '']
    if (a === undefined || b === undefined) continue
    const value = await page.evaluate(async ([pa, pb]: [string, string]) => {
      const load = async (b64: string) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
        const bitmap = await createImageBitmap(blob)
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d')
        if (ctx === null) throw new Error('no 2d context')
        ctx.drawImage(bitmap, 0, 0)
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      }
      const ia = await load(pa)
      const ib = await load(pb)
      const w = Math.min(ia.width, ib.width)
      const h = Math.min(ia.height, ib.height)
      let sum = 0
      let differing = 0
      let total = 0
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * ia.width + x) * 4
          const j = (y * ib.width + x) * 4
          const dr = Math.abs((ia.data[i] ?? 0) - (ib.data[j] ?? 0))
          const dg = Math.abs((ia.data[i + 1] ?? 0) - (ib.data[j + 1] ?? 0))
          const db = Math.abs((ia.data[i + 2] ?? 0) - (ib.data[j + 2] ?? 0))
          const d = (dr + dg + db) / 3
          sum += d
          if (d > 8) differing += 1
          total += 1
        }
      }
      return { mean: sum / total, differing: differing / total, w: ia.width, h: ia.height }
    }, [a, b] as [string, string])
    diffs[`${eraList[i - 1]}-${eraList[i]}`] = value as unknown as number
    console.log('DIFF', eraList[i - 1], eraList[i], JSON.stringify(value))
  }

  console.log('PROBE_REPORT', JSON.stringify({ report, stats, diffs }))
})
