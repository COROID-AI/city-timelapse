/**
 * Era matrix: every content category, every year, through the composed app.
 *
 * This is the acceptance signal for the whole request. Selecting any of the five
 * years must visibly re-dress *every* aspect of the block, so the check walks the
 * timeline like a viewer (clicking the year stops), waits for the transition to
 * report itself complete, and then asserts — from the composition's own debug
 * surface, never from module internals — that:
 *
 * - the year readout, the HUD, the timeline's `data-era-id` and the registry all
 *   agree on the selected period;
 * - every composed content layer reports the new era and non-zero objects, with
 *   the category counters that must never be empty (storefront bays, signs,
 *   advertising boards, prop instances, moving and parked vehicles, plume
 *   emitters) all above zero;
 * - the five years produce five *distinct* statistic fingerprints for each
 *   category and a distinct combined fingerprint, so "it changed" is a measured
 *   fact rather than a claim;
 * - the frozen block itself (the layout layer) does **not** change, which is what
 *   proves the difference is the dressing rather than the geometry moving;
 * - the camera is byte-identical across all five switches, so the transformation
 *   happens in front of the viewer (also asserted on its own in
 *   `qa-camera.spec.ts`);
 * - every composed content layer — including the buildings and the crowd —
 *   reports the new era with non-zero objects and a category census that no
 *   other year repeats, so "it changed" is a measured fact for all six layers.
 *
 * The per-era census is written to `tests/qa/artifacts/era-matrix.json` so the
 * numbers behind every assertion survive the run.
 *
 * Read-only observation: this spec never touches application sources.
 */

import { expect, test, type Page } from '@playwright/test'
import { ERA_IDS, getEra, getSoundscape } from '../src/era'
import type { EraId } from '../src/era'
import { writeJsonArtifact } from '../tests/qa/pixelBaseline'

// Software rasterisation plus five era rebuilds is slow by nature.
test.describe.configure({ timeout: 280_000 })

/* -------------------------------------------------------------------------- */
/* Debug surface reading                                                      */
/* -------------------------------------------------------------------------- */

interface DebugLayerRecord {
  readonly id: string
  readonly label: string
  readonly mounted: boolean
  readonly kind: string
  readonly eraId: EraId | null
  readonly mounts: number
  readonly objects: number
  readonly meshes: number
  readonly instances: number
  readonly triangles: number
  readonly stats: Readonly<Record<string, number>>
}

interface DebugSnapshot {
  readonly eraId: EraId
  readonly year: number
  readonly eraLabel: string
  readonly transitioning: boolean
  readonly qualityTier: string
  readonly frame: number
  readonly layerOrder: readonly string[]
  readonly mountedLayers: readonly string[]
  readonly pendingLayers: readonly string[]
  readonly layers: readonly DebugLayerRecord[]
  readonly audio: {
    readonly supported: boolean
    readonly bedId: string | null
    readonly bedEraId: EraId | null
  } | null
  readonly camera: unknown
  readonly inspection: {
    readonly eraId: EraId
    readonly year: number
    readonly count: number
    readonly anchorCount: number
    readonly objectCount: number
    readonly categories: readonly string[]
    readonly layers: readonly string[]
  }
  readonly transition: { readonly active: boolean; readonly frames: number }
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

function layerOf(snapshot: DebugSnapshot, id: string): DebugLayerRecord | undefined {
  return snapshot.layers.find((layer) => layer.id === id)
}

function statOf(snapshot: DebugSnapshot, id: string, stat: string): number {
  return layerOf(snapshot, id)?.stats[stat] ?? 0
}

/** Waits until the composition has settled on one era and returns its state. */
async function waitForEra(page: Page, eraId: EraId): Promise<DebugSnapshot> {
  await expect
    .poll(async () => (await readDebug(page))?.eraId ?? null, { timeout: 120_000, intervals: [250, 500, 1000] })
    .toBe(eraId)
  await expect
    .poll(async () => (await readDebug(page))?.transitioning ?? true, {
      timeout: 120_000,
      intervals: [250, 500, 1000],
    })
    .toBe(false)
  return requireDebug(page)
}

/**
 * Selects a year the way a viewer does: a click on the stop's own button.
 *
 * The stop's decorative dot sits above the button in the rail, so the click is
 * dispatched on the stop element rather than aimed at its centre.
 */
async function selectYear(page: Page, eraId: EraId): Promise<void> {
  await page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`).dispatchEvent('click')
}

/* -------------------------------------------------------------------------- */
/* Category expectations                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The content categories the composed block ships, with the counters that must
 * be non-zero for *every* year.
 *
 * Counters that are legitimately allowed to be zero in some periods are
 * deliberately left out: 1945 has no graffiti and no illuminated signage, and
 * its horse-drawn fleet emits no exhaust plumes, so requiring those above zero
 * would encode the wrong expectation.
 */
interface CategoryExpectation {
  readonly layer: string
  readonly label: string
  readonly nonzero: readonly string[]
  /** Counters folded into this category's per-era fingerprint. */
  readonly fingerprint: readonly string[]
}

const CATEGORIES: readonly CategoryExpectation[] = [
  {
    layer: 'atmosphere',
    label: 'Atmosphere and sky',
    nonzero: ['plumeEmitters'],
    fingerprint: ['plumeEmitters', 'plumeBaseline', 'plumeSources', 'plumeSourcesPublished', 'ambientBirds'],
  },
  {
    layer: 'buildings',
    label: 'Buildings and roof kits',
    nonzero: ['buildingCount', 'totalFloors', 'windowCount'],
    fingerprint: [
      'buildingCount',
      'totalFloors',
      'maxHeight',
      'windowCount',
      'roofItemCount',
      'vacantLotCount',
      'constructionSiteCount',
    ],
  },
  {
    layer: 'storefronts',
    label: 'Storefronts, signage and advertising',
    nonzero: ['units', 'signs', 'advertising', 'textures', 'meshes'],
    fingerprint: ['units', 'meshes', 'signs', 'awnings', 'advertising', 'graffiti', 'litMeshes', 'textures'],
  },
  {
    layer: 'props',
    label: 'Street furniture',
    nonzero: ['propCount', 'instanceCount', 'drawCalls'],
    fingerprint: ['propCount', 'instanceCount', 'drawCalls', 'recipesUsed', 'pointLights', 'anchorsCovered'],
  },
  {
    layer: 'vehicles',
    label: 'Vehicles',
    nonzero: ['movingInstances', 'parkedInstances', 'markingMeshes'],
    fingerprint: [
      'movingInstances',
      'parkedInstances',
      'movingVariants',
      'parkedVariants',
      'meshes',
      'markingMeshes',
    ],
  },
  {
    layer: 'pedestrians',
    label: 'Pedestrians',
    nonzero: ['pedestrianCount', 'walkerCount', 'waiterCount'],
    fingerprint: ['pedestrianCount', 'walkerCount', 'waiterCount', 'adultCount', 'childCount'],
  },
]

/** Stable, art-direction-bearing fingerprint of one category in one era. */
function categoryFingerprint(snapshot: DebugSnapshot, category: CategoryExpectation): string {
  return category.fingerprint.map((stat) => `${stat}=${statOf(snapshot, category.layer, stat)}`).join(',')
}

/** Everything the census records for one year. */
interface EraCensus {
  readonly eraId: EraId
  readonly year: number
  readonly eraLabel: string
  readonly mountedLayers: readonly string[]
  readonly pendingLayers: readonly string[]
  readonly categories: Record<string, Record<string, number>>
  readonly objectCounts: Record<string, number>
  readonly fingerprints: Record<string, string>
  readonly combinedFingerprint: string
  readonly bedId: string | null
  readonly inspection: { readonly count: number; readonly anchorCount: number; readonly objectCount: number }
}

/* -------------------------------------------------------------------------- */
/* The journey                                                                */
/* -------------------------------------------------------------------------- */

test('all five years report distinct, non-zero statistics for every composed content category', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  // The staged (non-instant) transition is what the acceptance describes, so the
  // walk is done with the viewer's default motion preference.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  // `?tier=low` is a dev-only deep link; it keeps five era rebuilds inside the
  // browser check's time budget without changing the art direction.
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 150_000, intervals: [250, 500, 1000] })
    .toBe(true)
  await expect
    .poll(async () => (await readDebug(page))?.frame ?? 0, { timeout: 60_000, intervals: [250, 500, 1000] })
    .toBeGreaterThan(0)

  /* ---------------------------------------------------------------------- */
  /* The composed layers                                                    */
  /* ---------------------------------------------------------------------- */

  const mounted = await requireDebug(page)
  expect(mounted.qualityTier).toBe('low')
  expect(mounted.layerOrder).toEqual([
    'layout',
    'atmosphere',
    'buildings',
    'storefronts',
    'props',
    'vehicles',
    'pedestrians',
  ])
  expect(mounted.mountedLayers).toEqual([
    'layout',
    'atmosphere',
    'buildings',
    'storefronts',
    'props',
    'vehicles',
    'pedestrians',
  ])
  // Every barrel ships in this revision, so nothing is pending.
  expect(mounted.pendingLayers).toEqual([])
  for (const id of ['layout', ...CATEGORIES.map((category) => category.layer)]) {
    const layer = layerOf(mounted, id)
    expect(layer?.mounted, id).toBe(true)
    expect(layer?.objects ?? 0, id).toBeGreaterThan(0)
  }

  /* ---------------------------------------------------------------------- */
  /* The five periods                                                       */
  /* ---------------------------------------------------------------------- */

  const camera = mounted.camera
  const layoutMeshes = statOf(mounted, 'layout', 'meshCount')
  const censuses: EraCensus[] = []
  const timings: Record<string, number> = {}

  for (const eraId of ERA_IDS) {
    const startedAt = Date.now()
    await selectYear(page, eraId)
    const snapshot = await waitForEra(page, eraId)
    timings[eraId] = Date.now() - startedAt
    const era = getEra(eraId)

    // The year readout, the HUD, the timeline and the registry agree.
    await expect(page.getByTestId('timeline-year-readout'), `${eraId} readout`).toHaveText(era.shortLabel)
    await expect(page.getByTestId('hud-year'), `${eraId} hud`).toHaveText(era.shortLabel)
    await expect(page.getByTestId('timeline'), `${eraId} timeline`).toHaveAttribute('data-era-id', eraId)
    expect(snapshot.year, `${eraId} year`).toBe(era.year)
    expect(snapshot.inspection.eraId, `${eraId} inspection era`).toBe(eraId)
    expect(snapshot.inspection.count, `${eraId} inspection targets`).toBeGreaterThan(0)

    // Every composed category re-dressed for this period and is not empty.
    for (const category of CATEGORIES) {
      const layer = layerOf(snapshot, category.layer)
      expect(layer?.eraId, `${eraId} ${category.layer} era`).toBe(eraId)
      expect(layer?.mounted, `${eraId} ${category.layer} mounted`).toBe(true)
      expect(layer?.objects ?? 0, `${eraId} ${category.layer} objects`).toBeGreaterThan(0)
      for (const stat of category.nonzero) {
        expect(statOf(snapshot, category.layer, stat), `${eraId} ${category.layer}.${stat}`).toBeGreaterThan(0)
      }
    }

    // The block itself does not move: only its dressing changes.
    expect(layerOf(snapshot, 'layout')?.eraId, `${eraId} layout era`).toBeNull()
    expect(statOf(snapshot, 'layout', 'meshCount'), `${eraId} layout meshes`).toBe(layoutMeshes)

    // The ambience bed the composition has requested follows the period.
    expect(snapshot.audio?.bedId, `${eraId} bed`).toBe(getSoundscape(eraId).descriptor)

    // Camera continuity: the viewer's framing survives every switch.
    expect(snapshot.camera, `${eraId} camera`).toEqual(camera)

    const categories: Record<string, Record<string, number>> = {}
    const objectCounts: Record<string, number> = {}
    const fingerprints: Record<string, string> = {}
    for (const category of CATEGORIES) {
      const stats: Record<string, number> = {}
      for (const stat of category.fingerprint) {
        stats[stat] = statOf(snapshot, category.layer, stat)
      }
      categories[category.layer] = stats
      objectCounts[category.layer] = layerOf(snapshot, category.layer)?.objects ?? 0
      fingerprints[category.layer] = categoryFingerprint(snapshot, category)
    }

    censuses.push({
      eraId,
      year: snapshot.year,
      eraLabel: snapshot.eraLabel,
      mountedLayers: snapshot.mountedLayers,
      pendingLayers: snapshot.pendingLayers,
      categories,
      objectCounts,
      fingerprints,
      combinedFingerprint: CATEGORIES.map((category) => fingerprints[category.layer]).join('||'),
      bedId: snapshot.audio?.bedId ?? null,
      inspection: {
        count: snapshot.inspection.count,
        anchorCount: snapshot.inspection.anchorCount,
        objectCount: snapshot.inspection.objectCount,
      },
    })
  }

  /* ---------------------------------------------------------------------- */
  /* Distinctness                                                           */
  /* ---------------------------------------------------------------------- */

  expect(censuses.map((census) => census.eraId)).toEqual([...ERA_IDS])

  // Each category answers differently in each of the five years.
  for (const category of CATEGORIES) {
    const unique = new Set(censuses.map((census) => census.fingerprints[category.layer] ?? ''))
    expect(
      [...unique],
      `${category.label} must report five distinct per-era statistic fingerprints`,
    ).toHaveLength(ERA_IDS.length)
  }

  // And the block as a whole is distinct in every year, including adjacent ones.
  const combined = censuses.map((census) => census.combinedFingerprint)
  expect(new Set(combined).size, 'the five years are mutually distinct').toBe(ERA_IDS.length)
  for (let index = 1; index < combined.length; index += 1) {
    expect(combined[index], `era ${ERA_IDS[index]} differs from ${ERA_IDS[index - 1]}`).not.toBe(combined[index - 1])
  }

  const artifact = writeJsonArtifact('era-matrix.json', {
    generatedAt: new Date().toISOString(),
    qualityTier: mounted.qualityTier,
    layerOrder: mounted.layerOrder,
    mountedLayers: mounted.mountedLayers,
    pendingLayers: mounted.pendingLayers,
    note:
      'Every composed content layer ships in this revision, so buildings and pedestrians carry real per-era statistics here alongside atmosphere, storefronts, props and vehicles.',
    timingsMs: timings,
    censuses,
  })
  expect(artifact).toContain('era-matrix.json')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
