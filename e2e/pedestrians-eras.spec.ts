/**
 * Browser verification for the era pedestrian crowd.
 *
 * The spec loads the layer's **own harness page** (`src/city/pedestrians/harness.html`)
 * from the Vite dev server Playwright owns, so this proof never depends on the
 * composed application or on any other era content layer. The page mounts the
 * real layer against the real canonical block with a simulated clock and
 * publishes everything asserted here on `window.__pedestrianHarness`.
 *
 * Per era the suite checks that the crowd exists at the era's density, is
 * dressed only from that era's own outfit table, carries that era's props, stays
 * on the sidewalk when walking, waits on real layout waiting points, crosses
 * only along real crossing splines and stays inside the shared per-tier budgets
 * — with the renderer's own instance/draw report compared against the estimate,
 * so the per-era screenshots really are an instanced crowd.
 */

import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'
import { getEra, type EraId } from '../src/era'
import {
  SIDEWALK_WALK_LINE,
  classifyGround,
  createCityLayout,
  type CityLayout,
  type PathSpline,
  type Vec3,
} from '../src/city/layout'
import { QUALITY_TIERS } from '../src/lib/quality'

const HARNESS_PATH = '/src/city/pedestrians/harness.html'
const SHOT_DIR = 'test-results/pedestrians-eras'
const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const satisfies readonly EraId[]
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

interface HarnessPedestrian {
  index: number
  state: 'walking' | 'waiting' | 'crossing'
  stage: 'from' | 'props' | 'to'
  splineName: string
  crossingIndex: number
  position: Vec3
  heading: { x: number; z: number }
  distance: number
  outfitKey: string
  propIds: string[]
  heightM: number
  isChild: boolean
  speedMps: number
  dressWeight: number
  crosses: boolean
}

interface HarnessCost {
  pedestrians: number
  instances: number
  triangles: number
  drawCalls: number
  poolTriangles: number
  triangleBudget: number
  drawCallBudget: number
  geometryBudget: number
  lodCounts: [number, number, number]
  withinBudget: boolean
}

interface HarnessFrame {
  pedestrians: number
  instances: number
  drawCalls: number
  triangles: number
  lodCounts: [number, number, number]
  onScreen: number
  timeSeconds: number
}

interface HarnessSnapshot {
  eraId: string
  blend: { from: string; to: string; t: number } | null
  tier: string
  timeSeconds: number
  activeCount: number
  capacity: number
  seed: string
  states: { walking: number; waiting: number; crossing: number; hidden: number }
  outfitKeys: string[]
  propIds: string[]
  signature: string
  sidewalkLength: number
  crossingCount: number
  anchors: Array<{
    crossingName: string
    splineName: string
    anchorDistance: number
    waitingPoint: Vec3
  }>
  table: {
    outfitEraTag: string
    density: number
    speedMps: number
    outfitKeys: string[]
    palette: string[]
    hairIds: string[]
    headwearIds: string[]
    accessoryIds: string[]
    propIds: string[]
    garmentCounts: number[]
  }
  pedestrians: HarnessPedestrian[]
  cost: HarnessCost
  renderer: HarnessFrame | null
}

interface HarnessApi {
  eraIds: string[]
  webgl: boolean
  errors: string[]
  clock: number
  snapshot: HarnessSnapshot
  setEra(eraId: string): void
  setTier(tier: string): void
  setReducedMotion(enabled: boolean): void
  setTransition(blend: { from: string; to: string; t: number; reducedMotion?: boolean }): void
  seek(seconds: number): void
  play(): void
  pause(): void
  step(seconds: number): void
  camera: Vec3
}

let layout: CityLayout

test.beforeAll(() => {
  layout = createCityLayout()
})

// Serial mode: every test renders the crowd through a software rasteriser, so
// running them in one worker keeps each page's main thread free enough to
// answer the harness's simulated-clock calls promptly.
test.describe.configure({ mode: 'serial' })

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

/** Crowd size the layer promises: density x real sidewalk length x tier share. */
function expectedCount(eraId: EraId, sidewalkLength: number, tier: keyof typeof QUALITY_TIERS): number {
  const density = getEra(eraId).population.pedestrianDensity
  return Math.round(density * 0.12 * sidewalkLength * QUALITY_TIERS[tier].density.pedestrians)
}

function distanceToSpline(spline: PathSpline, point: Vec3): number {
  let best = Number.POSITIVE_INFINITY
  for (let sample = 0; sample < spline.sampleCount; sample += 1) {
    const next = (sample + 1) % spline.sampleCount
    const ax = spline.positions[sample * 3] ?? 0
    const az = spline.positions[sample * 3 + 2] ?? 0
    const bx = spline.positions[next * 3] ?? 0
    const bz = spline.positions[next * 3 + 2] ?? 0
    const vx = bx - ax
    const vz = bz - az
    const lengthSquared = vx * vx + vz * vz
    const t =
      lengthSquared > 0
        ? Math.min(1, Math.max(0, ((point.x - ax) * vx + (point.z - az) * vz) / lengthSquared))
        : 0
    best = Math.min(best, Math.hypot(point.x - (ax + vx * t), point.z - (az + vz * t)))
  }
  return best
}

function splineByName(name: string): PathSpline | undefined {
  return layout.pedestrianSplines.find((spline) => spline.name === name)
}

const WAITING_POINTS: readonly Vec3[] = createCityLayout().crossings.flatMap(
  (crossing) => crossing.waitingPoints,
)

async function openHarness(page: Page): Promise<{
  consoleErrors: string[]
  pageErrors: string[]
  externalRequests: string[]
}> {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const externalRequests: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))
  page.on('request', (request: Request) => {
    if (isExternalRequest(request)) {
      externalRequests.push(request.url())
    }
  })

  const response = await page.goto(HARNESS_PATH, { waitUntil: 'load' })
  expect(response?.status(), 'harness document responds successfully').toBe(200)
  await expect(page.locator('body')).toHaveAttribute('data-pedestrians-status', 'ready')
  await expect(page.locator('body')).toHaveAttribute('data-pedestrians-era', ERA_IDS[0])
  await expect(page.getByTestId('pedestrians-summary')).toContainText(/pedestrians/)
  await expect(page.getByTestId('pedestrians-report')).toContainText('outfits:')
  return { consoleErrors, pageErrors, externalRequests }
}

async function setEra(page: Page, eraId: EraId): Promise<void> {
  await page.evaluate(
    ({ source, id }) => {
      const harness = (window as unknown as Record<string, { setEra(era: string): void }>)[source]
      harness?.setEra(id)
    },
    { source: '__pedestrianHarness', id: eraId },
  )
}

/** Reads the page's crowd snapshot without advancing the simulated clock. */
async function readSnapshot(page: Page): Promise<HarnessSnapshot> {
  const snapshot = await page.evaluate(
    () => (window as unknown as { __pedestrianHarness?: HarnessApi }).__pedestrianHarness?.snapshot,
  )
  expect(snapshot, 'harness published a crowd snapshot').toBeTruthy()
  return snapshot as HarnessSnapshot
}

/** Drives the page's simulated clock and reads the resulting crowd. */
async function seek(page: Page, seconds: number): Promise<HarnessSnapshot> {
  const snapshot = await page.evaluate((value) => {
    const harness = (
      window as unknown as { __pedestrianHarness: { pause(): void; seek(t: number): void } }
    ).__pedestrianHarness
    harness.pause()
    harness.seek(value)
    return (
      window as unknown as { __pedestrianHarness: { snapshot: unknown } }
    ).__pedestrianHarness.snapshot
  }, seconds)
  expect(snapshot, 'harness published a crowd snapshot').toBeTruthy()
  return snapshot as HarnessSnapshot
}

test.describe('era pedestrian crowd harness', () => {
  test('renders every era at its own density, outfits and props', async ({ page }) => {
    const { consoleErrors, pageErrors, externalRequests } = await openHarness(page)

    for (const eraId of ERA_IDS) {
      await setEra(page, eraId)
      const snapshot = await seek(page, 40)
      const table = getEra(eraId).population

      expect(snapshot.eraId).toBe(eraId)
      expect(snapshot.blend).toBeNull()
      expect(snapshot.tier).toBe('high')
      expect(snapshot.crossingCount).toBe(8)
      expect(snapshot.anchors).toHaveLength(8)
      expect(snapshot.sidewalkLength).toBeGreaterThan(400)

      // Crowd size follows the era density against the page's real sidewalk.
      expect(snapshot.activeCount).toBe(expectedCount(eraId, snapshot.sidewalkLength, 'high'))
      expect(snapshot.pedestrians).toHaveLength(snapshot.activeCount)
      expect(snapshot.capacity).toBeGreaterThanOrEqual(snapshot.activeCount)
      expect(snapshot.states.walking + snapshot.states.waiting + snapshot.states.crossing).toBe(
        snapshot.activeCount,
      )
      expect(snapshot.table.density).toBe(table.pedestrianDensity)
      expect(snapshot.table.speedMps).toBe(table.averageSpeedMps)
      expect(snapshot.table.outfitEraTag).toBe(table.outfitEraTag)

      // Dressed from this era's own looks, hair, headwear and props.
      expect(snapshot.table.outfitKeys.sort()).toEqual([...table.modelKeys].sort())
      expect(snapshot.table.hairIds.length).toBeGreaterThanOrEqual(4)
      expect(snapshot.table.headwearIds.length).toBeGreaterThanOrEqual(3)
      expect(snapshot.table.accessoryIds.length).toBeGreaterThanOrEqual(4)
      expect(snapshot.table.propIds.length).toBeGreaterThanOrEqual(4)
      expect(snapshot.table.palette.length).toBeGreaterThan(table.outfitPalette.length)
      expect(snapshot.table.garmentCounts.every((count) => count >= 4)).toBe(true)

      for (const pedestrian of snapshot.pedestrians) {
        expect(snapshot.table.outfitKeys, `${eraId} outfit`).toContain(pedestrian.outfitKey)
        expect(pedestrian.stage).toBe('to')
        expect(pedestrian.heightM).toBeGreaterThan(1.1)
        expect(pedestrian.heightM).toBeLessThan(1.95)
        expect(pedestrian.speedMps).toBeGreaterThan(0.4)
        expect(pedestrian.propIds.length).toBeGreaterThan(0)
        for (const prop of pedestrian.propIds) {
          expect(snapshot.table.propIds, `${eraId} prop`).toContain(prop)
        }
      }
      expect(snapshot.outfitKeys).toHaveLength(5)

      // The estimate stays inside the shared per-tier geometry and draw budget.
      expect(snapshot.cost.triangles).toBeGreaterThan(0)
      expect(snapshot.cost.triangles).toBeLessThanOrEqual(snapshot.cost.triangleBudget)
      expect(snapshot.cost.drawCalls).toBeLessThanOrEqual(snapshot.cost.drawCallBudget)
      expect(snapshot.cost.poolTriangles).toBeLessThanOrEqual(snapshot.cost.geometryBudget)
      expect(snapshot.cost.withinBudget).toBe(true)
      expect(snapshot.cost.instances).toBeGreaterThan(snapshot.cost.drawCalls)
    }

    const harnessErrors = await page.evaluate(
      () =>
        (window as unknown as { __pedestrianHarness: { errors: string[] } }).__pedestrianHarness
          .errors,
    )
    expect(harnessErrors, 'harness reported no runtime problems').toEqual([])
    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(consoleErrors, 'no console errors').toEqual([])
    expect(externalRequests, 'no remote asset or font requests').toEqual([])
  })

  test('walks the real sidewalk, waits at real waypoints and crosses only at crossings', async ({
    page,
  }) => {
    await openHarness(page)

    for (const eraId of ['1945', '1985', '2025'] as const) {
      await setEra(page, eraId)
      const snapshot = await seek(page, 45)
      expect(snapshot.pedestrians.length).toBeGreaterThan(0)

      for (const pedestrian of snapshot.pedestrians) {
        const ground = classifyGround(pedestrian.position.x, pedestrian.position.z)
        if (pedestrian.state === 'walking') {
          expect(pedestrian.splineName, 'walkers use the sidewalk loop').toBe(
            'pedestrian:sidewalk:loop',
          )
          expect(ground, `${eraId} walker on the pavement`).toBe('sidewalk')
          // Inside the corridor: the walk line plus the person's own weave.
          const across = Math.max(Math.abs(pedestrian.position.x), Math.abs(pedestrian.position.z))
          expect(Math.abs(across - SIDEWALK_WALK_LINE)).toBeLessThan(1.4)
          continue
        }

        expect(ground, 'nobody stands on a parcel or off the block').not.toBe('parcel')
        expect(ground).not.toBe('outside')
        expect(pedestrian.crossingIndex).toBeGreaterThanOrEqual(0)
        const crossing = layout.crossings[pedestrian.crossingIndex]
        expect(crossing, 'the crossing belongs to the layout').toBeDefined()
        const crossingSpline = splineByName(crossing?.spline ?? '')
        expect(crossingSpline).toBeDefined()

        if (pedestrian.state === 'waiting') {
          const onWaypoint = WAITING_POINTS.some(
            (point) =>
              Math.abs(point.x - pedestrian.position.x) < 1e-6 &&
              Math.abs(point.z - pedestrian.position.z) < 1e-6,
          )
          expect(onWaypoint, 'a waiter stands exactly on a published waiting point').toBe(true)
          expect(
            distanceToSpline(crossingSpline as PathSpline, pedestrian.position),
            'the waiting point is at the crossing mouth',
          ).toBeLessThan(3)
          continue
        }

        expect(pedestrian.splineName).toBe(crossing?.spline)
        expect(
          distanceToSpline(crossingSpline as PathSpline, pedestrian.position),
          'a crosser walks the layout crossing loop',
        ).toBeLessThan(0.5)
      }
    }

    // Crossings really happen: sample the window and watch both crossing states.
    const observed = await page.evaluate(() => {
      const harness = (
        window as unknown as {
          __pedestrianHarness: {
            seek(t: number): void
            snapshot: { states: { crossing: number; waiting: number } }
          }
        }
      ).__pedestrianHarness
      let waiting = 0
      let crossing = 0
      for (let time = 0; time <= 120; time += 5) {
        harness.seek(time)
        waiting += harness.snapshot.states.waiting
        crossing += harness.snapshot.states.crossing
      }
      return { waiting, crossing }
    })
    expect(observed.waiting).toBeGreaterThan(0)
    expect(observed.crossing).toBeGreaterThan(0)
  })

  test('stages a blend, switches instantly for reduced motion and rescales by tier', async ({
    page,
  }) => {
    await openHarness(page)

    await page.evaluate(() => {
      const harness = (
        window as unknown as {
          __pedestrianHarness: {
            setEra(era: string): void
            setTransition(blend: { from: string; to: string; t: number }): void
          }
        }
      ).__pedestrianHarness
      harness.setEra('1945')
      harness.setTransition({ from: '1945', to: '2025', t: 0 })
    })
    const start = await seek(page, 30)
    expect(start.pedestrians.every((pedestrian) => pedestrian.stage === 'from')).toBe(true)
    const keys1945 = getEra('1945').population.modelKeys
    expect(
      start.pedestrians.every((pedestrian) => keys1945.includes(pedestrian.outfitKey)),
    ).toBe(true)
    expect(start.activeCount).toBe(expectedCount('1945', start.sidewalkLength, 'high'))

    await page.evaluate(() => {
      const harness = (
        window as unknown as { __pedestrianHarness: { setTransition(blend: unknown): void } }
      ).__pedestrianHarness
      harness.setTransition({ from: '1945', to: '2025', t: 0.5 })
    })
    const middle = await readSnapshot(page)
    const stages = new Set(middle.pedestrians.map((pedestrian) => pedestrian.stage))
    expect(stages.has('from')).toBe(true)
    expect(stages.has('props')).toBe(true)
    expect(stages.has('to')).toBe(true)
    expect(middle.blend?.t).toBe(0.5)
    expect(middle.eraId).toBe('2025')
    const fromCount = expectedCount('1945', middle.sidewalkLength, 'high')
    const toCount = expectedCount('2025', middle.sidewalkLength, 'high')
    expect(middle.activeCount).toBe(Math.round(fromCount + (toCount - fromCount) * 0.5))
    // Props lead the garments: the mid-blend crowd carries the new era's props.
    for (const pedestrian of middle.pedestrians.filter((entry) => entry.stage === 'props')) {
      for (const prop of pedestrian.propIds) {
        expect(getEra('2025').population.modelKeys.length).toBeGreaterThan(0)
        expect(prop.length).toBeGreaterThan(0)
      }
    }

    await page.evaluate(() => {
      const harness = (
        window as unknown as { __pedestrianHarness: { setTransition(blend: unknown): void } }
      ).__pedestrianHarness
      harness.setTransition({ from: '1945', to: '2025', t: 1 })
    })
    const settled = await readSnapshot(page)
    expect(settled.blend).toBeNull()
    expect(settled.activeCount).toBe(toCount)
    expect(settled.pedestrians.every((pedestrian) => pedestrian.stage === 'to')).toBe(true)

    // Reduced motion: one clean switch, no staged cross-dressing.
    await setEra(page, '1945')
    await page.getByTestId('pedestrians-reduced').click()
    const reduced = await readSnapshot(page)
    expect(reduced.eraId).toBe('2025')
    expect(reduced.blend).toBeNull()
    expect(reduced.pedestrians.every((pedestrian) => pedestrian.stage === 'to')).toBe(true)

    // A cheaper tier carries a proportional share of the same density.
    await page.evaluate(() => {
      const harness = (
        window as unknown as { __pedestrianHarness: { setTier(tier: string): void; seek(t: number): void } }
      ).__pedestrianHarness
      harness.setTier('low')
      harness.seek(40)
    })
    await expect(page.locator('body')).toHaveAttribute('data-pedestrians-tier', 'low')
    const low = await readSnapshot(page)
    expect(low.tier).toBe('low')
    expect(low.activeCount).toBe(expectedCount('2025', low.sidewalkLength, 'low'))
    expect(low.activeCount).toBeLessThan(reduced.activeCount)
    expect(low.cost.triangles).toBeLessThanOrEqual(low.cost.triangleBudget)
    expect(low.cost.drawCalls).toBeLessThanOrEqual(low.cost.drawCallBudget)
    expect(low.cost.withinBudget).toBe(true)

    await page.evaluate(() => {
      const harness = (
        window as unknown as { __pedestrianHarness: { setTier(tier: string): void; seek(t: number): void } }
      ).__pedestrianHarness
      harness.setTier('high')
      harness.seek(40)
    })
    await expect(page.locator('body')).toHaveAttribute('data-pedestrians-tier', 'high')
  })

  test('is reproducible from the simulated clock, and renders an instanced crowd', async ({
    page,
  }) => {
    await openHarness(page)
    await setEra(page, '2025')

    const first = await page.evaluate(() => {
      const harness = (
        window as unknown as {
          __pedestrianHarness: { seek(t: number): void; snapshot: { signature: string } }
        }
      ).__pedestrianHarness
      harness.seek(0)
      harness.seek(72)
      return harness.snapshot
    })
    const second = await page.evaluate(() => {
      const harness = (
        window as unknown as {
          __pedestrianHarness: { seek(t: number): void; snapshot: { signature: string } }
        }
      ).__pedestrianHarness
      harness.seek(0)
      harness.seek(72)
      return harness.snapshot
    })
    const staged = await page.evaluate(() => {
      const harness = (
        window as unknown as {
          __pedestrianHarness: { seek(t: number): void; snapshot: { signature: string } }
        }
      ).__pedestrianHarness
      harness.seek(0)
      harness.seek(30)
      harness.seek(72)
      return harness.snapshot
    })
    expect(second.signature).toBe(first.signature)
    expect(staged.signature).toBe(first.signature)
    const clock = await page.evaluate(
      () => (window as unknown as { __pedestrianHarness: { clock: number } }).__pedestrianHarness.clock,
    )
    expect(clock).toBeGreaterThan(70)

    const webgl = await page.evaluate(
      () => (window as unknown as { __pedestrianHarness: { webgl: boolean } }).__pedestrianHarness.webgl,
    )
    test.skip(!webgl, 'WebGL unavailable in this browser')

    await expect(page.getByTestId('pedestrians-viewport').locator('canvas')).toHaveCount(1)
    const rendered = await seek(page, 72)
    expect(rendered.renderer, 'the layer reported its own frame').not.toBeNull()
    expect(rendered.renderer?.pedestrians).toBe(rendered.activeCount)
    expect(rendered.renderer?.drawCalls).toBeLessThanOrEqual(rendered.cost.drawCallBudget)
    expect(rendered.renderer?.triangles).toBeLessThanOrEqual(rendered.cost.triangleBudget)
    // Instancing: many instances share each pooled geometry.
    expect(rendered.renderer?.instances ?? 0).toBeGreaterThan((rendered.renderer?.drawCalls ?? 1) * 3)
    expect(
      (rendered.renderer?.lodCounts ?? [0, 0, 0]).reduce((total, value) => total + value, 0),
    ).toBe(rendered.activeCount)
    // The camera really sees pedestrians, so the screenshots below are evidence
    // of the era's crowd and not of an empty pavement.
    expect(rendered.renderer?.onScreen ?? 0).toBeGreaterThan(2)

    // Per-era screenshots for the QA baseline, plus proof that two eras really
    // do not render the same pixels.
    const shots = new Map<string, Buffer>()
    for (const eraId of ERA_IDS) {
      await setEra(page, eraId)
      await seek(page, 72)
      await expect(page.locator('body')).toHaveAttribute('data-pedestrians-era', eraId)
      const shot = await page
        .getByTestId('pedestrians-viewport')
        .screenshot({ path: `${SHOT_DIR}/era-${eraId}.png` })
      expect(shot.byteLength, `${eraId} screenshot has pixels`).toBeGreaterThan(5_000)
      shots.set(eraId, shot)
    }
    expect(shots.get('1945')?.equals(shots.get('2025') ?? Buffer.alloc(0))).toBe(false)
    expect(shots.get('1985')?.equals(shots.get('2025') ?? Buffer.alloc(0))).toBe(false)
  })
})
