/**
 * Browser proof of the era buildings layer.
 *
 * This is the "buildings-browser" check. It drives the composed application in
 * a real Chromium/WebGL context the way a viewer does — clicking each timeline
 * stop — and asserts, from the composition's own debug surface, that:
 *
 * - the `buildings` slot is mounted and reports non-zero objects and triangles in
 *   every period;
 * - the census changes measurably between every adjacent pair (floors, heights,
 *   windows and roof kits), so the skyline really rebuilds;
 * - the era's night flag lights the windows (1985 is a night scene by default);
 * - the camera is untouched by all five switches.
 *
 * The measured census is written to `tests/qa/artifacts/era-buildings.json`.
 */

import { expect, test, type Page } from '@playwright/test'
import { ERA_IDS, getEra, type EraId } from '../src/era'
import { writeJsonArtifact } from '../tests/qa/pixelBaseline'

test.describe.configure({ timeout: 240_000 })

interface DebugLayer {
  readonly id: string
  readonly mounted: boolean
  readonly kind: string
  readonly eraId: EraId | null
  readonly objects: number
  readonly meshes: number
  readonly instances: number
  readonly triangles: number
  readonly stats: Readonly<Record<string, number>>
}

interface DebugSnapshot {
  readonly eraId: EraId
  readonly year: number
  readonly transitioning: boolean
  readonly qualityTier: string
  readonly mountedLayers: readonly string[]
  readonly pendingLayers: readonly string[]
  readonly layers: readonly DebugLayer[]
  readonly camera: unknown
  readonly loading: { readonly ready: boolean }
}

async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (surface?.read() ?? null) as unknown as DebugSnapshot | null
  })
}

async function requireDebug(page: Page): Promise<DebugSnapshot> {
  const snapshot = await readDebug(page)
  if (snapshot === null) {
    throw new Error('The composition debug surface is not available on window.__cityTimelapse.')
  }
  return snapshot
}

function buildingLayer(snapshot: DebugSnapshot): DebugLayer | undefined {
  return snapshot.layers.find((layer) => layer.id === 'buildings')
}

async function waitForEra(page: Page, eraId: EraId): Promise<DebugSnapshot> {
  await expect
    .poll(async () => (await readDebug(page))?.eraId ?? null, { timeout: 120_000, intervals: [250, 500, 1000] })
    .toBe(eraId)
  await expect
    .poll(async () => (await readDebug(page))?.transitioning ?? true, { timeout: 120_000, intervals: [250, 500, 1000] })
    .toBe(false)
  return requireDebug(page)
}

async function selectYear(page: Page, eraId: EraId): Promise<void> {
  await page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`).dispatchEvent('click')
}

const FINGERPRINT = [
  'buildingCount',
  'totalFloors',
  'maxHeight',
  'windowCount',
  'roofItemCount',
  'vacantLotCount',
  'constructionSiteCount',
  'litWindowCount',
] as const

test('the buildings layer rebuilds visibly in every period with the camera pinned', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 150_000, intervals: [250, 500, 1000] })
    .toBe(true)

  const initial = await requireDebug(page)
  expect(initial.mountedLayers).toContain('buildings')
  expect(initial.pendingLayers).toEqual([])

  const camera = initial.camera
  const censuses: { eraId: EraId; year: number; fingerprint: string; stats: Record<string, number>; objects: number; triangles: number }[] = []

  for (const eraId of ERA_IDS) {
    await selectYear(page, eraId)
    const snapshot = await waitForEra(page, eraId)
    const era = getEra(eraId)
    expect(snapshot.year, `${eraId} year`).toBe(era.year)
    expect(snapshot.camera, `${eraId} camera`).toEqual(camera)

    const layer = buildingLayer(snapshot)
    expect(layer?.mounted, `${eraId} mounted`).toBe(true)
    expect(layer?.eraId, `${eraId} era`).toBe(eraId)
    expect(layer?.objects ?? 0, `${eraId} objects`).toBeGreaterThan(0)
    expect(layer?.triangles ?? 0, `${eraId} triangles`).toBeGreaterThan(0)
    expect(layer?.stats['buildingCount'] ?? 0, `${eraId} buildings`).toBeGreaterThan(0)
    expect(layer?.stats['totalFloors'] ?? 0, `${eraId} floors`).toBeGreaterThan(0)
    expect(layer?.stats['windowCount'] ?? 0, `${eraId} windows`).toBeGreaterThan(0)

    const stats: Record<string, number> = {}
    for (const key of FINGERPRINT) {
      stats[key] = layer?.stats[key] ?? 0
    }
    censuses.push({
      eraId,
      year: era.year,
      fingerprint: FINGERPRINT.map((key) => `${key}=${stats[key] ?? 0}`).join(','),
      stats,
      objects: layer?.objects ?? 0,
      triangles: layer?.triangles ?? 0,
    })
  }

  // Five periods, five distinct building censuses.
  expect(new Set(censuses.map((census) => census.fingerprint)).size).toBe(ERA_IDS.length)

  // 1985 is authored as a night scene: its windows glow.
  const eighties = censuses.find((census) => census.eraId === '1985')
  expect(eighties?.stats['litWindowCount'] ?? 0).toBeGreaterThan(0)

  const artifact = writeJsonArtifact('era-buildings.json', {
    generatedAt: new Date().toISOString(),
    qualityTier: initial.qualityTier,
    fingerprint: [...FINGERPRINT],
    censuses,
  })
  expect(artifact).toContain('era-buildings.json')
  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
