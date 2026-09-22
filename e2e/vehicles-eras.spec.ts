/**
 * Browser verification for the era vehicle layer.
 *
 * The spec drives the layer's *own* harness page (`src/city/vehicles/harness.html`)
 * from the Vite dev server that Playwright owns, so per-era rendering is proven
 * without the composed application. The page mounts the real generated block
 * through react-three-fiber and publishes the layer's state on
 * `window.__vehiclesHarness`, which lets each assertion come from the real
 * layer rather than from a fixture:
 *
 * - vehicle instance counts (data) and mounted instanced-mesh counts (scene);
 * - the era road-marking groups, which differ between all five periods;
 * - night and dusk light behaviour, including indicator blinking;
 * - movement under the simulated clock, with stable counts and matching
 *   instance-matrix digests;
 * - SFX triggers emitted through the layer's documented callback.
 */

import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'

const HARNESS_PATH = '/src/city/vehicles/harness.html'
/**
 * Data-only variant of the same page: identical layer and identical published
 * numbers, but no canvas — the data assertions stay cheap and GPU-independent.
 */
const HARNESS_DATA_PATH = `${HARNESS_PATH}?render=0`
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const

/** Marking groups each era must publish, exactly. */
const EXPECTED_MARKINGS: Record<string, string[]> = {
  '1945': ['streetcar-rail'],
  '1965': ['centre-line', 'parking-lane'],
  '1985': ['centre-line', 'lane-division', 'turn-arrow'],
  '2005': ['bike-lane', 'centre-line', 'lane-division', 'parking-lane'],
  '2025': ['bike-lane', 'centre-line', 'charging-point', 'lane-division', 'pedestrian-priority'],
}

interface HarnessScene {
  movingInstances: number
  parkedInstances: number
  movingVariants: number
  parkedVariants: number
  markingGroups: number
  markingMeshes: number
  meshes: number
  matrixDigest: number
}

interface HarnessSnapshot {
  eraId: string | null
  fromEraId: string
  toEraId: string
  progress: number
  settled: boolean
  clockSec: number
  density: number
  speedMps: number
  spacingM: number
  movingCount: number
  movingByModel: Record<string, number>
  movingByClass: Record<string, number>
  microCount: number
  parkedCount: number
  census: string[]
  markingGroups: Record<string, number>
  markingSignature: string
  markingPieceCount: number
  lights: {
    night: boolean
    dusk: boolean
    headlampIntensity: number
    taillampIntensity: number
    indicators: boolean
  }
  night: boolean
  sfxKinds: string[]
  sfxEmitted: number
  sfxKindsEmitted: string[]
  firstPose: { id: string; modelKey: string; x: number; z: number; headingRad: number } | null
  scene: HarnessScene | null
  webgl: boolean
}

interface HarnessApi {
  webgl: boolean
  errors: string[]
  sfxLog: unknown[]
  snapshot(): HarnessSnapshot
  setEra(eraId: string): void
  setTransition(input: { from: string; to: string; t: number }): void
  setClock(seconds: number): void
  step(delta: number): void
  play(): void
  pause(): void
}

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

async function boot(
  page: Page,
  path: string = HARNESS_DATA_PATH,
): Promise<{ consoleErrors: string[]; pageErrors: string[] }> {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))
  const response = await page.goto(path, { waitUntil: 'load' })
  expect(response?.status(), 'harness document responds successfully').toBe(200)
  await expect(page.locator('body')).toHaveAttribute('data-vehicles-status', 'ready')
  return { consoleErrors, pageErrors }
}

async function snapshot(page: Page): Promise<HarnessSnapshot> {
  const value = await page.evaluate(() => {
    const harness = (window as unknown as { __vehiclesHarness?: HarnessApi }).__vehiclesHarness
    return harness?.snapshot() ?? null
  })
  expect(value, 'harness published a vehicle snapshot').not.toBeNull()
  return value as HarnessSnapshot
}

async function selectEra(page: Page, eraId: string): Promise<HarnessSnapshot> {
  await page.evaluate((id) => {
    ;(window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness.setEra(id)
  }, eraId)
  await expect(page.locator('body')).toHaveAttribute('data-vehicles-era', eraId)
  return snapshot(page)
}

async function setClock(page: Page, seconds: number): Promise<HarnessSnapshot> {
  await page.evaluate((value) => {
    ;(window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness.setClock(value)
  }, seconds)
  return snapshot(page)
}

test.describe('era vehicle layer harness', () => {
  test('boots the layer with the real block and no runtime problems', async ({ page }) => {
    const externalRequests: string[] = []
    page.on('request', (request: Request) => {
      if (isExternalRequest(request)) {
        externalRequests.push(request.url())
      }
    })
    const { consoleErrors, pageErrors } = await boot(page)

    await expect(page.getByTestId('vehicles-summary')).toContainText(/driving/)
    await expect(page.getByTestId('vehicles-report')).toContainText('marking groups:')
    await expect(page.getByTestId('vehicles-report')).toContainText('instanced scene:')

    const errors = await page.evaluate(
      () => (window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness.errors,
    )
    expect(errors, 'harness reported no runtime problems').toEqual([])
    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(consoleErrors, 'no console errors').toEqual([])
    expect(externalRequests, 'no remote asset or font requests').toEqual([])

    const first = await snapshot(page)
    expect(first.settled).toBe(true)
    expect(first.movingCount).toBeGreaterThan(0)
    expect(first.parkedCount).toBeGreaterThan(0)
    expect(first.census.length).toBeGreaterThanOrEqual(4)
    expect(first.markingPieceCount).toBeGreaterThan(0)
  })

  test('renders a distinct, era-correct fleet and marking set for all five periods', async ({ page }) => {
    await boot(page)
    const counts = new Map<string, number>()
    const markings = new Map<string, string[]>()
    const parked = new Map<string, number>()

    for (const eraId of ERA_IDS) {
      const snap = await selectEra(page, eraId)
      counts.set(eraId, snap.movingCount)
      parked.set(eraId, snap.parkedCount)
      markings.set(
        eraId,
        Object.keys(snap.markingGroups)
          .sort(),
      )

      expect(snap.settled).toBe(true)
      expect(snap.eraId).toBe(eraId)
      expect(snap.movingCount, `${eraId} traffic`).toBeGreaterThan(0)
      expect(snap.parkedCount, `${eraId} parking`).toBeGreaterThan(0)
      if (eraId === '1945') {
        expect(snap.microCount, '1945 has no micro-mobility').toBe(0)
      } else {
        expect(snap.microCount, `${eraId} has micro-mobility`).toBeGreaterThan(0)
      }
      expect(markings.get(eraId)).toEqual(EXPECTED_MARKINGS[eraId])
      expect(snap.markingSignature).toBe(EXPECTED_MARKINGS[eraId]?.join('+'))
      expect(snap.spacingM).toBeGreaterThan(0)
      expect(snap.density).toBeGreaterThan(0)
      expect(snap.density).toBeLessThanOrEqual(1)
      // The body attributes mirror the published state for cheap selectors.
      await expect(page.locator('body')).toHaveAttribute('data-vehicles-count', String(snap.movingCount))
      await expect(page.locator('body')).toHaveAttribute(
        'data-vehicles-markings',
        EXPECTED_MARKINGS[eraId]?.join('+') ?? '',
      )
    }

    // Every period fields a different amount of traffic and parking.
    expect(new Set(counts.values()).size).toBe(ERA_IDS.length)
    expect(new Set(parked.values()).size).toBe(ERA_IDS.length)
    const busiest = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
    expect(busiest).toBe('2005')
    const quietest = [...counts.entries()].sort((left, right) => left[1] - right[1])[0]?.[0]
    expect(quietest).toBe('1945')
    // Micro-mobility really is period-gated: no bike or scooter in 1945.
    const eraNames = ['e-scooter-2025', 'bmx-bike-1985', 'cargo-e-bike', 'delivery-robot-2025']
    const winterCensus = (await selectEra(page, '1945')).census
    for (const modelKey of eraNames) {
      expect(winterCensus).not.toContain(modelKey)
    }
    const today = await selectEra(page, '2025')
    expect(today.census).toContain('delivery-robot-2025')
    expect(today.census).toContain('e-scooter-2025')
  })

  test('lights the fleet at night and at dusk, and not in daylight', async ({ page }) => {
    await boot(page)
    const daylight = ['1945', '1965', '2005'] as const
    for (const eraId of daylight) {
      const snap = await selectEra(page, eraId)
      expect(snap.lights.night, `${eraId} is daylight`).toBe(false)
      expect(snap.lights.headlampIntensity, `${eraId} lamps off`).toBe(0)
      await expect(page.locator('body')).toHaveAttribute('data-vehicles-night', 'false')
    }

    const night = await selectEra(page, '1985')
    expect(night.lights.night).toBe(true)
    expect(night.lights.headlampIntensity).toBeGreaterThan(0)
    expect(night.lights.taillampIntensity).toBeGreaterThan(0)
    expect(night.lights.indicators).toBe(true)
    await expect(page.locator('body')).toHaveAttribute('data-vehicles-night', 'true')

    const dusk = await selectEra(page, '2025')
    expect(dusk.lights.night).toBe(false)
    expect(dusk.lights.dusk).toBe(true)
    expect(dusk.lights.headlampIntensity).toBeGreaterThan(0)

    // Indicator lamps blink per vehicle, only where the era runs its lamps.
    const blinking = await page.evaluate(() => {
      const harness = (window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness
      const layer = (harness as unknown as { layer: { poseAt(clock: number): { lamps: { indicator: boolean } }[] } })
        .layer
      const clocks = Array.from({ length: 60 }, (_, index) => index * 0.05)
      return clocks.filter((clock) => layer.poseAt(clock).some((pose) => pose.lamps.indicator)).length
    })
    expect(blinking).toBeGreaterThan(0)

    await selectEra(page, '1965')
    const darkIndicators = await page.evaluate(() => {
      const harness = (window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness
      const layer = (harness as unknown as { layer: { poseAt(clock: number): { lamps: { indicator: boolean } }[] } })
        .layer
      const clocks = Array.from({ length: 60 }, (_, index) => index * 0.05)
      return clocks.filter((clock) => layer.poseAt(clock).some((pose) => pose.lamps.indicator)).length
    })
    expect(darkIndicators).toBe(0)
  })

  test('moves the fleet with the simulated clock and fires SFX triggers', async ({ page }) => {
    await boot(page)
    const night = await selectEra(page, '1985')
    const start = await setClock(page, 0)
    expect(start.clockSec).toBe(0)
    expect(start.firstPose).not.toBeNull()

    const later = await setClock(page, 3)
    expect(later.clockSec).toBe(3)
    expect(later.firstPose).not.toBeNull()
    expect(later.firstPose?.id).toBe(start.firstPose?.id)
    const moved = Math.hypot(
      (later.firstPose?.x ?? 0) - (start.firstPose?.x ?? 0),
      (later.firstPose?.z ?? 0) - (start.firstPose?.z ?? 0),
    )
    expect(moved, 'the lead vehicle drove along its lane').toBeGreaterThan(10)
    expect(later.movingCount).toBe(night.movingCount)
    expect(later.markingSignature).toBe(start.markingSignature)

    // A minute of scene time is enough for every convoy to have sounded its
    // horn and engine at least once, rate limiting included.
    const minute = await setClock(page, 60)
    expect(minute.clockSec).toBe(60)
    expect(minute.movingCount).toBe(night.movingCount)
    expect(minute.markingSignature).toBe(start.markingSignature)
    expect(minute.sfxEmitted).toBeGreaterThan(0)
    expect(minute.sfxKindsEmitted).toContain('horn')
    expect(minute.sfxKindsEmitted).toContain('engine')
    const sfxLog = await page.evaluate(
      () => (window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness.sfxLog.length,
    )
    expect(sfxLog).toBeGreaterThan(0)

    // Rewinding is supported and never emits backwards.
    const rewound = await setClock(page, 10)
    expect(rewound.clockSec).toBe(10)
    expect(rewound.sfxEmitted).toBe(minute.sfxEmitted)
    await expect(page.locator('body')).toHaveAttribute('data-vehicles-sfx', String(minute.sfxEmitted))
  })

  test('cross-fades a staged era switch through the DOM controls and the API', async ({ page }) => {
    await boot(page)

    // The era selector replaces the fleet outright.
    await page.getByTestId('era-1985').click()
    await expect(page.locator('body')).toHaveAttribute('data-vehicles-era', '1985')
    const eighties = await snapshot(page)
    expect(eighties.markingGroups['turn-arrow'] ?? 0).toBeGreaterThan(0)

    // The blend button starts a staged switch at t = 0.5.
    await page.getByTestId('vehicles-blend').click()
    await expect(page.locator('body')).toHaveAttribute('data-vehicles-era', '1985->2005')
    const blended = await snapshot(page)
    expect(blended.settled).toBe(false)
    expect(blended.progress).toBeCloseTo(0.5, 5)
    expect(blended.markingGroups['turn-arrow'] ?? 0).toBeGreaterThan(0)
    expect(blended.markingGroups['bike-lane'] ?? 0).toBeGreaterThan(0)
    expect(blended.census).toContain('checker-taxi-1985')
    expect(blended.census).toContain('suv-2000s')
    expect(blended.movingCount).toBeGreaterThan(0)

    // Settling the blend lands on the destination era.
    await page.getByTestId('vehicles-settle').click()
    await expect(page.locator('body')).toHaveAttribute('data-vehicles-era', '2005')
    const settled = await snapshot(page)
    expect(settled.settled).toBe(true)
    expect(Object.keys(settled.markingGroups).sort()).toEqual(EXPECTED_MARKINGS['2005'])

    // And the API can stage a full period jump with the same result.
    await page.evaluate(() => {
      const harness = (window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness
      harness.setTransition({ from: '1945', to: '2025', t: 0.5 })
    })
    await expect(page.locator('body')).toHaveAttribute('data-vehicles-era', '1945->2025')
    const halfway = await snapshot(page)
    expect(halfway.markingGroups['streetcar-rail'] ?? 0).toBeGreaterThan(0)
    expect(halfway.markingGroups['bike-lane'] ?? 0).toBeGreaterThan(0)

    await page.evaluate(() => {
      const harness = (window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness
      harness.setTransition({ from: '1945', to: '2025', t: 1 })
    })
    await expect(page.locator('body')).toHaveAttribute('data-vehicles-era', '2025')
    const done = await snapshot(page)
    expect(Object.keys(done.markingGroups).sort()).toEqual(EXPECTED_MARKINGS['2025'])
    expect(done.microCount).toBeGreaterThan(0)
  })

  test('renders the era fleet with instanced meshes in a navigable canvas', async ({ page }, testInfo) => {
    // Software WebGL is slow: give the frame and screenshot work room, and keep
    // the drawing buffer small.
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 900, height: 620 })
    await boot(page, HARNESS_PATH)
    const webgl = await page.evaluate(
      () => (window as unknown as { __vehiclesHarness: HarnessApi }).__vehiclesHarness.webgl,
    )
    test.skip(!webgl, 'WebGL unavailable in this browser')

    await expect(page.locator('body')).toHaveAttribute('data-vehicles-webgl', 'true')
    const viewport = page.getByTestId('vehicles-viewport')
    await expect(viewport.locator('canvas')).toHaveCount(1)

    const mounted = await selectEra(page, '1985')
    expect(mounted.scene).not.toBeNull()
    const scene = mounted.scene
    expect(scene?.movingInstances).toBe(mounted.movingCount)
    expect(scene?.parkedInstances).toBe(mounted.parkedCount)
    expect(scene?.movingVariants).toBeGreaterThan(0)
    expect(scene?.meshes).toBeGreaterThan(0)
    expect(scene?.markingMeshes).toBeGreaterThan(0)
    expect(scene?.markingGroups).toBe(Object.keys(mounted.markingGroups).length)

    // One screenshot per era, kept as verification evidence: the five periods
    // must not render the same street.
    const canvas = page.locator('canvas')
    const shots = new Map<string, string>()
    for (const eraId of ERA_IDS) {
      const era = await selectEra(page, eraId)
      await page.waitForTimeout(400)
      const shot = await canvas.screenshot()
      expect(shot.byteLength, `${eraId} rendered a frame`).toBeGreaterThan(1000)
      shots.set(eraId, shot.toString('base64'))
      await testInfo.attach(`vehicles-${eraId}.png`, { body: shot, contentType: 'image/png' })
      await expect(page.locator('body')).toHaveAttribute(
        'data-vehicles-markings',
        EXPECTED_MARKINGS[eraId]?.join('+') ?? '',
      )
      expect(Object.keys(era.markingGroups).sort(), `${eraId} marking groups on screen`).toEqual(
        EXPECTED_MARKINGS[eraId],
      )
    }
    expect(new Set(shots.values()).size, 'every era renders its own street').toBe(ERA_IDS.length)

    // The instance matrices move when the clock moves, and rewind with it.
    const digestAt = async (seconds: number): Promise<number> => {
      const snap = await setClock(page, seconds)
      return snap.scene?.matrixDigest ?? 0
    }
    const zero = await digestAt(0)
    const twelve = await digestAt(12)
    expect(zero).not.toBe(0)
    expect(twelve).not.toBe(zero)
    expect(await digestAt(0)).toBe(zero)

    // The camera can be driven, so vehicles are visible in a navigable scene.
    const before = await page.evaluate(
      () => (window as unknown as { __vehiclesHarness: { __view?: { position: number[] } } }).__vehiclesHarness.__view,
    )
    const box = await viewport.boundingBox()
    expect(box).not.toBeNull()
    if (box !== null) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.5 + 160, box.y + box.height * 0.5 + 40, { steps: 8 })
      await page.mouse.up()
      await page.mouse.wheel(0, -180)
    }
    const after = await page.evaluate(
      () => (window as unknown as { __vehiclesHarness: { __view?: { position: number[] } } }).__vehiclesHarness.__view,
    )
    expect(after?.position).toBeDefined()
    expect(after?.position).not.toEqual(before?.position)
  })
})
