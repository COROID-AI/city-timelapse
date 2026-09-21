/**
 * Browser proof of the composed experience.
 *
 * The unit composition suite proves the wiring in jsdom behind stand-ins; this
 * spec proves the same composition in a real browser, on a real WebGL context,
 * through the real dev server: the canvas draws, the timeline drives all five
 * periods, every content layer reports the selected era, the ambience bed
 * follows, camera state survives the switches, reduced motion collapses one, the
 * quality tier changes without remounting, and the debug surface tells the truth
 * the whole way.
 *
 * The spec drives the page the way a viewer does — clicking the timeline stops —
 * so a regression in the slider, the era store, the director, the layers, the
 * audio bridge or the composition shows up here.
 *
 * It is deliberately one journey rather than several isolated checks: building a
 * period in software rasterisation is by far the most expensive thing a browser
 * check does here, so the load, the era walk, the camera proof, the motion
 * preference and the quality override all ride the same live composition. The
 * page is opened with `?tier=low` (a dev-only deep link) for the same reason.
 */

import { expect, test, type Page } from '@playwright/test'
import { ERA_IDS, getEra, getSoundscape } from '../src/era'
import type { EraId } from '../src/era'

// Software rasterisation plus five era rebuilds is slow by nature.
test.describe.configure({ timeout: 240_000 })

/* -------------------------------------------------------------------------- */
/* Debug surface reading                                                      */
/* -------------------------------------------------------------------------- */

interface DebugLayerRecord {
  readonly id: string
  readonly label: string
  readonly mounted: boolean
  readonly mounts: number
  readonly eraId: EraId | null
  readonly objects: number
  readonly meshes: number
  readonly instances: number
  readonly stats: Readonly<Record<string, number>>
}

interface DebugAudioRecord {
  readonly supported: boolean
  readonly unlocked: boolean
  readonly muted: boolean
  readonly intentUnlocked: boolean
  readonly intentMuted: boolean
  readonly active: boolean
  readonly bedId: string | null
  readonly crossfades: number
  readonly sfxRouted: number
  readonly sfxSuppressed: number
}

interface DebugSnapshot {
  readonly eraId: EraId
  readonly year: number
  readonly eraLabel: string
  readonly progress: number
  readonly transitioning: boolean
  readonly qualityTier: string
  readonly frame: number
  readonly mountedLayers: readonly string[]
  readonly pendingLayers: readonly string[]
  readonly layers: readonly DebugLayerRecord[]
  readonly audio: DebugAudioRecord | null
  readonly camera: {
    readonly mode: string
    readonly target: readonly number[]
    readonly orbit: { readonly azimuth: number; readonly polar: number; readonly radius: number }
  }
  readonly inspection: {
    readonly count: number
    readonly anchorCount: number
    readonly objectCount: number
    readonly categories: readonly string[]
    readonly eraId: EraId
  }
  readonly transition: {
    readonly active: boolean
    readonly frames: number
    readonly reducedMotion: boolean
    readonly lastCompletionFrames: number | null
    readonly pendingStages: readonly string[]
    readonly registeredLayers: readonly string[]
  }
  readonly loading: { readonly ready: boolean; readonly failedLayer: string | null }
}

/** Reads the debug surface the composition publishes in dev builds. */
async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => {
    const surface = (
      window as unknown as { __cityTimelapse?: { read(): unknown } }
    ).__cityTimelapse
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

function layerOf(snapshot: DebugSnapshot, id: string): DebugLayerRecord | undefined {
  return snapshot.layers.find((layer) => layer.id === id)
}

function statOf(snapshot: DebugSnapshot, id: string, stat: string): number {
  return layerOf(snapshot, id)?.stats[stat] ?? 0
}

/** Waits until the composition has settled on one era and returns its state. */
async function waitForEra(page: Page, eraId: EraId): Promise<DebugSnapshot> {
  await expect
    .poll(async () => (await readDebug(page))?.eraId ?? null, { timeout: 90_000 })
    .toBe(eraId)
  await expect
    .poll(async () => (await readDebug(page))?.transitioning ?? true, { timeout: 90_000 })
    .toBe(false)
  return requireDebug(page)
}

/** Fingerprint of the block's per-era census, used to prove it re-dressed. */
function censusOf(snapshot: DebugSnapshot): string {
  return [
    statOf(snapshot, 'storefronts', 'units'),
    statOf(snapshot, 'storefronts', 'signs'),
    statOf(snapshot, 'storefronts', 'advertising'),
    statOf(snapshot, 'storefronts', 'graffiti'),
    statOf(snapshot, 'props', 'propCount'),
    statOf(snapshot, 'props', 'instanceCount'),
    statOf(snapshot, 'vehicles', 'movingInstances'),
    statOf(snapshot, 'vehicles', 'parkedInstances'),
  ].join('|')
}

/**
 * Selects a year the way a viewer does.
 *
 * The stop's decorative dot sits above the button in the rail, so the click is
 * dispatched on the stop itself rather than aimed at its centre.
 */
async function selectYear(page: Page, eraId: EraId): Promise<void> {
  await page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`).dispatchEvent('click')
}

/* -------------------------------------------------------------------------- */
/* The journey                                                                */
/* -------------------------------------------------------------------------- */

test('composes the block, walks all five years and keeps its camera and controls', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 120_000 })
    .toBe(true)

  /* ---------------------------------------------------------------------- */
  /* Mounts, canvas and the debug surface                                   */
  /* ---------------------------------------------------------------------- */

  await expect(page.getByTestId('scene-canvas-surface')).toBeVisible()
  expect(await page.getByTestId('scene-host').locator('canvas').count()).toBe(1)

  const mounted = await requireDebug(page)
  expect(mounted.qualityTier).toBe('low')
  expect(mounted.mountedLayers).toEqual([
    'layout',
    'atmosphere',
    'storefronts',
    'props',
    'vehicles',
  ])
  // The two barrels that have not shipped are reported, not hidden.
  expect(mounted.pendingLayers).toEqual(expect.arrayContaining(['buildings', 'pedestrians']))
  expect(mounted.transition.pendingStages).toEqual(
    expect.arrayContaining(['buildings', 'pedestrians']),
  )
  expect(mounted.transition.registeredLayers).toEqual([
    'atmosphere',
    'storefronts',
    'props',
    'vehicles',
  ])

  for (const id of ['layout', 'atmosphere', 'storefronts', 'props', 'vehicles']) {
    const layer = layerOf(mounted, id)
    expect(layer?.mounted, id).toBe(true)
    expect(layer?.mounts, id).toBe(1)
    expect(layer?.objects ?? 0, id).toBeGreaterThan(0)
  }

  // The render loop is live: rendered frames are being counted.
  await expect
    .poll(async () => (await readDebug(page))?.frame ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(0)

  // The inspection surface covers anchors and mounted layer objects.
  expect(mounted.inspection.count).toBeGreaterThan(0)
  expect(mounted.inspection.anchorCount).toBeGreaterThan(0)
  expect(mounted.inspection.objectCount).toBeGreaterThan(0)
  expect(mounted.inspection.categories.length).toBeGreaterThan(0)

  /* ---------------------------------------------------------------------- */
  /* Audio defers until the viewer's gesture                                */
  /* ---------------------------------------------------------------------- */

  expect(mounted.audio?.intentUnlocked).toBe(false)
  expect(mounted.audio?.muted).toBe(true)
  expect(mounted.audio?.active).toBe(false)

  await page.getByTestId('audio-unlock').click()
  await expect
    .poll(async () => (await readDebug(page))?.audio?.intentUnlocked ?? false, { timeout: 30_000 })
    .toBe(true)
  await expect
    .poll(async () => (await readDebug(page))?.audio?.intentMuted ?? true, { timeout: 30_000 })
    .toBe(false)

  /* ---------------------------------------------------------------------- */
  /* The five periods                                                       */
  /* ---------------------------------------------------------------------- */

  const camera = mounted.camera
  const censuses: string[] = []
  const beds: string[] = []

  for (const eraId of ERA_IDS) {
    await selectYear(page, eraId)
    const snapshot = await waitForEra(page, eraId)
    const era = getEra(eraId)

    // Year readout, HUD and debug surface agree with the registry.
    await expect(page.getByTestId('timeline-year-readout')).toHaveText(era.shortLabel)
    await expect(page.getByTestId('hud-year')).toHaveText(era.shortLabel)
    await expect(page.getByTestId('timeline')).toHaveAttribute('data-era-id', eraId)
    expect(snapshot.year).toBe(era.year)

    // Every content layer reports the era it now shows.
    expect(layerOf(snapshot, 'storefronts')?.eraId, `${eraId} storefronts`).toBe(eraId)
    expect(layerOf(snapshot, 'props')?.eraId, `${eraId} props`).toBe(eraId)
    expect(layerOf(snapshot, 'vehicles')?.eraId, `${eraId} vehicles`).toBe(eraId)
    expect(layerOf(snapshot, 'atmosphere')?.eraId, `${eraId} atmosphere`).toBe(eraId)

    // And each of them actually built something for that period.
    expect(statOf(snapshot, 'storefronts', 'units'), `${eraId} bays`).toBeGreaterThan(0)
    expect(statOf(snapshot, 'storefronts', 'signs'), `${eraId} signs`).toBeGreaterThan(0)
    expect(statOf(snapshot, 'props', 'propCount'), `${eraId} props`).toBeGreaterThan(0)
    expect(statOf(snapshot, 'vehicles', 'movingInstances'), `${eraId} traffic`).toBeGreaterThan(0)
    expect(statOf(snapshot, 'atmosphere', 'plumeEmitters'), `${eraId} plumes`).toBeGreaterThan(0)

    // The ambience bed follows the era.
    expect(snapshot.audio?.bedId, `${eraId} bed`).toBe(getSoundscape(eraId).descriptor)

    // The inspection surface was refreshed for the new period.
    expect(snapshot.inspection.eraId, `${eraId} inspection`).toBe(eraId)
    expect(snapshot.inspection.count).toBeGreaterThan(0)

    // Camera continuity: the viewer's framing survives every switch.
    expect(snapshot.camera, `${eraId} camera`).toEqual(camera)

    censuses.push(censusOf(snapshot))
    beds.push(getSoundscape(eraId).descriptor)
  }

  // Five distinct ambience beds, and the block re-dressed between every period.
  expect(new Set(beds).size).toBe(ERA_IDS.length)
  for (let index = 1; index < censuses.length; index += 1) {
    expect(censuses[index], `era ${ERA_IDS[index]} census`).not.toBe(censuses[index - 1])
  }

  // Live vehicle emissions reach the atmosphere's `plumeSources` input. The
  // assertion is made on the newest period, which reliably drives motorised
  // traffic (1945's fleet is horse-drawn and emits nothing).
  const newest = await requireDebug(page)
  expect(newest.eraId).toBe('2025')
  expect(statOf(newest, 'atmosphere', 'plumeSources'), '2025 sources').toBeGreaterThan(0)

  // The vehicle layer's SFX events reach the audio bridge while the block runs:
  // routed when the engine is live, and counted as suppressed while it is still
  // locked or when the rate limiter holds one back. Either way they arrive.
  await expect
    .poll(
      async () => {
        const audio = (await readDebug(page))?.audio
        return (audio?.sfxRouted ?? 0) + (audio?.sfxSuppressed ?? 0)
      },
      { timeout: 90_000 },
    )
    .toBeGreaterThan(0)

  /* ---------------------------------------------------------------------- */
  /* Reduced motion collapses a switch into one step                        */
  /* ---------------------------------------------------------------------- */

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(async () => page.getByTestId('ui-overlay').getAttribute('data-reduced-motion'))
    .toBe('true')

  await selectYear(page, '1985')
  const reduced = await waitForEra(page, '1985')
  expect(reduced.transition.reducedMotion).toBe(true)
  expect(reduced.transition.lastCompletionFrames).toBe(0)
  expect(reduced.transition.frames).toBe(0)
  expect(layerOf(reduced, 'storefronts')?.eraId).toBe('1985')
  expect(layerOf(reduced, 'vehicles')?.eraId).toBe('1985')

  /* ---------------------------------------------------------------------- */
  /* Quality is the viewer's, and applies without remounting                */
  /* ---------------------------------------------------------------------- */

  await page.getByTestId('quality-low').click()
  await expect(page.getByTestId('quality-status')).toHaveText(/manual/i)
  await expect(page.getByTestId('quality-low')).toHaveAttribute('aria-pressed', 'true')

  const afterTier = await requireDebug(page)
  expect(afterTier.qualityTier).toBe('low')
  expect(afterTier.mountedLayers).toEqual(mounted.mountedLayers)
  for (const layer of afterTier.layers) {
    expect(layer.mounts, layer.id).toBeLessThanOrEqual(1)
  }
  expect(await page.getByTestId('scene-host').locator('canvas').count()).toBe(1)

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
