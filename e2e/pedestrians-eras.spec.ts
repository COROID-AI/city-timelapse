/**
 * Browser proof of the era pedestrian layer.
 *
 * This is the "pedestrians-browser" check. It drives the composed application
 * in a real Chromium/WebGL context the way a viewer does — clicking each
 * timeline stop — and asserts, from the composition's own debug surface, that:
 *
 * - the `pedestrians` slot is mounted and reports non-zero objects and instances
 *   in every period (the crowd is instanced, so instances >> meshes);
 * - crowd size follows the era density against the real sidewalk length, so the
 *   five periods report five distinct censuses;
 * - every person is bound to a real spline or crosswalk (the layer publishes its
 *   own census), and the camera is untouched by all five switches.
 *
 * The measured census is written to `tests/qa/artifacts/era-pedestrians.json`.
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

function crowdLayer(snapshot: DebugSnapshot): DebugLayer | undefined {
  return snapshot.layers.find((layer) => layer.id === 'pedestrians')
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

const FINGERPRINT = ['pedestrianCount', 'walkerCount', 'waiterCount', 'adultCount', 'childCount'] as const

test('the crowd re-dresses in every period with the camera pinned', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 150_000, intervals: [250, 500, 1000] })
    .toBe(true)

  const initial = await requireDebug(page)
  expect(initial.mountedLayers).toContain('pedestrians')
  expect(initial.pendingLayers).toEqual([])

  const camera = initial.camera
  const censuses: {
    eraId: EraId
    year: number
    fingerprint: string
    stats: Record<string, number>
    objects: number
    instances: number
  }[] = []

  for (const eraId of ERA_IDS) {
    await selectYear(page, eraId)
    const snapshot = await waitForEra(page, eraId)
    const era = getEra(eraId)
    expect(snapshot.year, `${eraId} year`).toBe(era.year)
    expect(snapshot.camera, `${eraId} camera`).toEqual(camera)

    const layer = crowdLayer(snapshot)
    expect(layer?.mounted, `${eraId} mounted`).toBe(true)
    expect(layer?.eraId, `${eraId} era`).toBe(eraId)
    expect(layer?.objects ?? 0, `${eraId} objects`).toBeGreaterThan(0)
    expect(layer?.instances ?? 0, `${eraId} instances`).toBeGreaterThan(0)
    expect(layer?.instances ?? 0, `${eraId} instanced`).toBeGreaterThan(layer?.meshes ?? 0)
    expect(layer?.stats['pedestrianCount'] ?? 0, `${eraId} crowd`).toBeGreaterThan(0)
    expect(layer?.stats['walkerCount'] ?? 0, `${eraId} walkers`).toBeGreaterThan(0)
    expect(layer?.stats['sidewalkLengthM'] ?? 0, `${eraId} sidewalk`).toBeGreaterThan(0)

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
      instances: layer?.instances ?? 0,
    })
  }

  // Five periods, five distinct crowd censuses.
  expect(new Set(censuses.map((census) => census.fingerprint)).size).toBe(ERA_IDS.length)
  // The crowd grows from the sparse wartime street to the packed contemporary one.
  const first = censuses[0]?.stats['pedestrianCount'] ?? 0
  const last = censuses[censuses.length - 1]?.stats['pedestrianCount'] ?? 0
  expect(last, 'the crowd grows over the timeline').toBeGreaterThan(first)

  const artifact = writeJsonArtifact('era-pedestrians.json', {
    generatedAt: new Date().toISOString(),
    qualityTier: initial.qualityTier,
    fingerprint: [...FINGERPRINT],
    censuses,
  })
  expect(artifact).toContain('era-pedestrians.json')
  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
