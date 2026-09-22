/**
 * Browser verification for the era atmosphere layer.
 *
 * The spec loads the layer's own harness page (`src/vfx/harness.html`) from the
 * Vite dev server Playwright's `webServer` owns. That page mounts the real render
 * pipeline host and the real `VfxLayer` and nothing else — no composed
 * application, no other content layer — so per-era rendering is proven here,
 * independently of the phase-4 integration.
 *
 * It asserts, for every shipped era: the sky, haze, particle and plume
 * structures the layer builds into the pipeline's world; the era's sun, fog and
 * grade values arriving in the pipeline's own parameter record; particle counts
 * that follow the era tables and the quality tier; clock-driven particle motion
 * with bounded respawn and a wet-surface response; the documented `plumeSources`
 * feed (including its DOM controls) and the return to the era baseline; staged
 * transitions landing exactly on the destination era; and per-era frames that
 * differ measurably, both as pixel statistics and as screenshots.
 */

import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'
import { ERA_IDS, getEra } from '../src/era'
import type { EraId } from '../src/era'
import { resolveSceneQuality } from '../src/scene'
import { resolveVfxSnapshot, vfxTableFor } from '../src/vfx'
import type { VfxSnapshot } from '../src/vfx'

const HARNESS_PATH = '/src/vfx/harness.html'
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/** Smallest per-channel mean difference two eras must show in the frame. */
const MIN_FRAME_CHANNEL_DELTA = 3

interface HarnessFrameStats {
  width: number
  height: number
  meanR: number
  meanG: number
  meanB: number
  meanLuminance: number
  variance: number
}

interface HarnessSnapshotView {
  eraId: EraId
  year: number
  night: boolean
  qualityTier: string
  sky: {
    topColor: string
    horizonColor: string
    groundColor: string
    sunColor: string
    sunDiscSizeRad: number
    horizonSharpness: number
    cloudOpacity: number
    starOpacity: number
    exposure: number
    sunDirection: [number, number, number]
  }
  fog: {
    color: string
    density: number
    heightFalloff: number
    groundHazeOpacity: number
    groundHazeHeight: number
    wetSurfaceLift: number
  }
  grade: {
    exposure: number
    contrast: number
    saturation: number
    temperature: number
    tint: number
    vignette: number
    vignetteOffset: number
    grain: number
    bloomIntensity: number
    bloomThreshold: number
    depthOfField: boolean
  }
  emissive: {
    color: string
    glowIntensity: number
    neonBoost: number
    headlightScale: number
    bloomIntensity: number
    bloomThreshold: number
  }
  lighting: {
    sunAzimuth: number
    sunElevation: number
    sunColor: string
    sunIntensity: number
    ambientIntensity: number
    skyTint: string
    groundTint: string
    night: boolean
    fogColor?: string
    fogDensity?: number
    backgroundColor?: string
  }
  postProcessing: {
    enabled: boolean
    bloomEnabled: boolean
    bloomIntensity: number
    saturation: number
    contrast: number
    temperature: number
    vignetteDarkness: number
  }
  particles: Array<{
    kind: string
    enabled: boolean
    count: number
    sizeM: number
    opacity: number
    color: string
  }>
  totalParticles: number
  plumes: {
    baseline: string[]
    birds: number
    aircraft: number
    rates: Array<{ kind: string; ratePerSecond: number; emissive: boolean }>
  }
}

interface HarnessStructure {
  rootName: string | null
  rootNameMatchesConstant: boolean
  rootInWorld: boolean
  groups: Record<string, number>
  meshes: Array<{ name: string; instanced: boolean; count: number; kind: string | null }>
}

interface HarnessPipelineState {
  quality: string
  effects: string[]
  passOrder: string[]
  postProcessingActive: boolean
  postProcessingFailure: string | null
  fogDensity: number
  fogColor: string | null
  sunColor: string
  sunIntensity: number
  ambientIntensity: number
  background: string | null
  context: {
    available: boolean
    contextType: string
    renderer: string
    drawingBufferWidth: number
    drawingBufferHeight: number
  }
  running: boolean
}

interface HarnessPlumeStats {
  baselineSources: number
  sourceEmitters: number
  emittersByKind: Record<string, number>
  alive: number
  spawned: number
  ambientBirds: number
  ambientAircraft: number
}

interface HarnessStats {
  eraId: EraId
  qualityTier: string
  clockSeconds: number
  frames: number
  particles: Array<{
    kind: string
    enabled: boolean
    count: number
    capacity: number
    alive: number
    spawned: number
    respawned: number
  }>
  plumes: HarnessPlumeStats
  weather: { wetness: number; snowCover: number; leafLitter: number; precipitating: boolean }
  groups: Record<string, number>
}

interface HarnessApi {
  ready: boolean
  eras: EraId[]
  url: string
  getEra(): EraId | null
  getSnapshot(): HarnessSnapshotView | null
  getStats(): HarnessStats | null
  getStructure(): HarnessStructure | null
  getPipelineState(): HarnessPipelineState | null
  measureFrame(): HarnessFrameStats | null
  advance(seconds: number): HarnessStats | null
  setClock(seconds: number): number
  getClock(): number
  pause(): boolean
  play(): boolean
  isPlaying(): boolean
  stopLoop(): boolean
  startLoop(): boolean
  isRunning(): boolean
  setEra(eraId: EraId): void
  setPlumeSources(sources: unknown[]): void
  setQualityTier(name: string): void
  setTransition(request: { from: EraId; to: EraId; t: number; instant?: boolean }): HarnessSnapshotView | null
  step(frames?: number): number
  buildPlumeSources(count: number): unknown[]
}

declare global {
  interface Window {
    vfxHarness: HarnessApi
  }
}

interface PageWatch {
  readonly consoleErrors: string[]
  readonly pageErrors: string[]
  readonly externalRequests: string[]
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

/** Collects browser noise and off-host traffic so tests can assert on it. */
function watchPage(page: Page): PageWatch {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const externalRequests: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  page.on('request', (request) => {
    if (isExternalRequest(request)) {
      externalRequests.push(request.url())
    }
  })
  return { consoleErrors, pageErrors, externalRequests }
}

/** Resolves the era's snapshot in Node, using the same real data and builders. */
function expectedSnapshot(eraId: EraId): VfxSnapshot {
  return resolveVfxSnapshot({
    era: getEra(eraId),
    table: vfxTableFor(eraId),
    quality: resolveSceneQuality('high'),
  })
}

async function openHarness(page: Page): Promise<void> {
  await page.goto(HARNESS_PATH)
  await page.waitForFunction(() => window.vfxHarness?.ready === true, undefined, { timeout: 45_000 })
  await page.waitForFunction(
    () => window.vfxHarness.getPipelineState()?.context.available === true,
    undefined,
    { timeout: 30_000 },
  )
  // The clock is paused and the animation loop is stopped: the spec then drives
  // every frame itself, so a software-rasterised frame never races an assertion.
  await page.evaluate(() => {
    window.vfxHarness.pause()
    window.vfxHarness.stopLoop()
  })
  await expect(page.locator('#stage canvas')).toBeVisible()
}

async function selectEra(page: Page, eraId: EraId): Promise<void> {
  await page.evaluate((id) => window.vfxHarness.setEra(id as EraId), eraId)
  await page.waitForFunction((id) => window.vfxHarness.getEra() === id, eraId, { timeout: 15_000 })
}

function readSnapshot(page: Page): Promise<HarnessSnapshotView> {
  return page.evaluate(() => window.vfxHarness.getSnapshot() as HarnessSnapshotView)
}

function readStructure(page: Page): Promise<HarnessStructure> {
  return page.evaluate(() => window.vfxHarness.getStructure() as HarnessStructure)
}

function readState(page: Page): Promise<HarnessPipelineState> {
  return page.evaluate(() => window.vfxHarness.getPipelineState() as HarnessPipelineState)
}

function readStats(page: Page): Promise<HarnessStats> {
  return page.evaluate(() => window.vfxHarness.getStats() as HarnessStats)
}

function measure(page: Page): Promise<HarnessFrameStats> {
  return page.evaluate(() => window.vfxHarness.measureFrame() as HarnessFrameStats)
}

async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((value) => {
    window.vfxHarness.advance(value)
  }, seconds)
}

/** Heaviest per-channel difference between two frame samples. */
function frameDistance(a: HarnessFrameStats, b: HarnessFrameStats): number {
  return Math.max(
    Math.abs(a.meanR - b.meanR),
    Math.abs(a.meanG - b.meanG),
    Math.abs(a.meanB - b.meanB),
    Math.abs(a.meanLuminance - b.meanLuminance),
  )
}

test.describe('era atmosphere in the browser', () => {
  // A small viewport keeps software rasterisation fast; the layer's behaviour is
  // resolution independent and every era is still rendered in full.
  test.use({ viewport: { width: 480, height: 320 } })

  test('mounts the layer into a live pipeline with its structures in place', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    const state = await readState(page)
    expect(state.context.available).toBe(true)
    expect(state.context.contextType).toMatch(/^webgl2?$/)
    expect(state.postProcessingFailure).toBeNull()

    // The spec stopped the loop for determinism; the harness can start it again.
    expect(state.running).toBe(false)
    expect(await page.evaluate(() => window.vfxHarness.startLoop())).toBe(true)
    expect(await page.evaluate(() => window.vfxHarness.isRunning())).toBe(true)
    expect(await page.evaluate(() => window.vfxHarness.stopLoop())).toBe(false)

    const structure = await readStructure(page)
    expect(structure.rootName).toBe('vfx-root')
    expect(structure.rootNameMatchesConstant).toBe(true)
    expect(structure.rootInWorld).toBe(true)
    expect(Object.keys(structure.groups)).toEqual(
      expect.arrayContaining(['vfx-sky', 'vfx-haze', 'vfx-particles', 'vfx-plumes', 'vfx-ambient']),
    )

    // One sky dome and one haze wall, plus a mesh per weather family and per
    // plume family — never more.
    const meshNames = structure.meshes.map((mesh) => mesh.name)
    expect(meshNames.filter((name) => name === 'vfx-sky-dome')).toHaveLength(1)
    expect(meshNames.filter((name) => name === 'vfx-haze-wall')).toHaveLength(1)

    const snapshot = await readSnapshot(page)
    const expected = expectedSnapshot(snapshot.eraId)
    const expectedParticleMeshes = expected.particles.kinds
      .filter((kind) => kind.enabled && kind.count > 0)
      .map((kind) => `vfx-particles-${kind.kind}`)
    for (const name of expectedParticleMeshes) {
      expect(meshNames).toContain(name)
    }
    expect(meshNames).toContain('vfx-ambient-birds')

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
    expect(watch.externalRequests).toEqual([])
  })

  test('renders each era with its own sky, fog, grade and particle counts', async ({ page }) => {
    test.setTimeout(150_000)
    const watch = watchPage(page)
    await openHarness(page)

    for (const eraId of ERA_IDS) {
      await selectEra(page, eraId)
      await advance(page, 0.2)

      const snapshot = await readSnapshot(page)
      const expected = expectedSnapshot(eraId)
      const state = await readState(page)
      const structure = await readStructure(page)
      const stats = await readStats(page)

      expect(snapshot.eraId).toBe(eraId)
      expect(snapshot.year).toBe(expected.year)

      // Sky: the era's gradient, disc, glow and exposure are what the dome holds.
      expect(snapshot.sky.topColor).toBe(expected.sky.topColor)
      expect(snapshot.sky.horizonColor).toBe(expected.sky.horizonColor)
      expect(snapshot.sky.sunColor).toBe(expected.sky.sunColor)
      expect(snapshot.sky.starOpacity).toBeCloseTo(expected.sky.starOpacity, 5)
      expect(snapshot.sky.exposure).toBeCloseTo(expected.sky.exposure, 5)
      expect(snapshot.sky.sunDirection[1]).toBeCloseTo(expected.sky.sunDirection[1], 5)

      // Sun, fog and grade reach the pipeline's own parameter record.
      expect(snapshot.lighting.sunElevation).toBeCloseTo(expected.lighting.sunElevation, 6)
      expect(state.sunColor?.toLowerCase()).toBe(expected.lighting.sunColor.toLowerCase())
      expect(state.fogColor?.toLowerCase()).toBe(getEra(eraId).atmosphere.hazeColor.toLowerCase())
      expect(state.fogDensity).toBeCloseTo(expected.fog.density, 6)
      expect(state.background?.toLowerCase()).toBe(expected.sky.horizonColor.toLowerCase())
      expect(state.effects).toEqual(expect.arrayContaining(['colorGrade', 'vignette']))

      // Particle families follow the era table: rain only where it rains, with
      // era- and tier-driven counts.
      for (const kind of expected.particles.kinds) {
        const present = stats.particles.find((entry) => entry.kind === kind.kind)
        if (!kind.enabled || kind.count === 0) {
          expect(structure.meshes.some((mesh) => mesh.name === `vfx-particles-${kind.kind}`)).toBe(false)
          expect(present).toBeUndefined()
        } else {
          expect(present?.count).toBe(kind.count)
          const mesh = structure.meshes.find((entry) => entry.name === `vfx-particles-${kind.kind}`)
          expect(mesh?.instanced).toBe(true)
          expect(mesh?.count).toBe(kind.count)
        }
      }
      expect(stats.particles.reduce((total, kind) => total + kind.count, 0)).toBe(
        expected.particles.totalCount,
      )

      // Plumes: the era's baseline vents and ambient accents are live.
      expect(stats.plumes.baselineSources).toBe(expected.plumes.baseline.length)
      expect(stats.plumes.ambientBirds).toBe(expected.plumes.ambient.birds)
      expect(stats.plumes.ambientAircraft).toBe(expected.plumes.ambient.aircraft)

      // The frame renders the era's atmosphere rather than a blank canvas.
      const frame = await measure(page)
      expect(frame.meanLuminance).toBeGreaterThan(2)
      expect(frame.variance).toBeGreaterThan(1)
    }

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
    expect(watch.externalRequests).toEqual([])
  })

  test('produces measurably different frames and screenshots per era', async ({ page }) => {
    test.setTimeout(150_000)
    const watch = watchPage(page)
    await openHarness(page)
    // Captures need the compositor to keep receiving frames; the clock stays
    // paused, so the simulated atmosphere is frozen while it renders.
    await page.evaluate(() => {
      window.vfxHarness.pause()
      window.vfxHarness.startLoop()
    })

    const frames = new Map<EraId, HarnessFrameStats>()
    const shots = new Map<EraId, Buffer>()

    for (const eraId of ERA_IDS) {
      await selectEra(page, eraId)
      await advance(page, 0.5)
      frames.set(eraId, await measure(page))
      await page.evaluate(() => window.vfxHarness.step(1))
      shots.set(eraId, await page.locator('#stage canvas').screenshot())
    }

    // Every screenshot is its own image, and no two are byte-identical.
    for (const eraId of ERA_IDS) {
      const shot = shots.get(eraId)
      expect(shot, `screenshot for ${eraId}`).toBeDefined()
      // A captured era frame is a real, non-trivial PNG (a flat image of this
      // size compresses to a couple of hundred bytes).
      expect((shot as Buffer).length).toBeGreaterThan(200)
    }
    for (let left = 0; left < ERA_IDS.length; left += 1) {
      for (let right = left + 1; right < ERA_IDS.length; right += 1) {
        const a = shots.get(ERA_IDS[left] as EraId) as Buffer
        const b = shots.get(ERA_IDS[right] as EraId) as Buffer
        expect(a.equals(b), `${ERA_IDS[left]} vs ${ERA_IDS[right]} screenshots`).toBe(false)
      }
    }

    // Adjacent eras differ by more than rendering noise, in pixel statistics.
    for (let index = 1; index < ERA_IDS.length; index += 1) {
      const previous = frames.get(ERA_IDS[index - 1] as EraId) as HarnessFrameStats
      const next = frames.get(ERA_IDS[index] as EraId) as HarnessFrameStats
      expect(
        frameDistance(previous, next),
        `${ERA_IDS[index - 1]} vs ${ERA_IDS[index]} frame difference`,
      ).toBeGreaterThan(MIN_FRAME_CHANNEL_DELTA)
    }

    await page.evaluate(() => window.vfxHarness.stopLoop())
    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('advances the weather with the caller clock and respawns inside bounds', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)
    await selectEra(page, '1985')
    await advance(page, 0.2)

    const before = await readStats(page)
    await advance(page, 2)
    const after = await readStats(page)

    expect(after.frames).toBeGreaterThan(before.frames)
    expect(after.clockSeconds).toBeGreaterThan(before.clockSeconds + 1)
    const rain = after.particles.find((kind) => kind.kind === 'rain')
    expect(rain?.enabled).toBe(true)
    expect(rain?.respawned ?? 0).toBeGreaterThan(0)
    expect(after.weather.precipitating).toBe(true)
    expect(after.weather.wetness).toBeGreaterThan(0)
    expect(after.weather.wetness).toBeLessThanOrEqual(1)

    // A dry era stops the rain and dries the surfaces out again, step by step.
    await selectEra(page, '2005')
    const dry = await readStats(page)
    expect(dry.weather.precipitating).toBe(false)
    expect(dry.particles.find((kind) => kind.kind === 'rain')?.enabled ?? false).toBe(false)
    await advance(page, 1)
    const drier = await readStats(page)
    await advance(page, 1)
    const driest = await readStats(page)
    expect(drier.weather.wetness).toBeLessThan(dry.weather.wetness)
    expect(driest.weather.wetness).toBeLessThan(drier.weather.wetness)

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('tiers particle counts and the effect chain with the quality setting', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)
    await selectEra(page, '1985')
    const high = await readStats(page)
    const highState = await readState(page)

    await page.selectOption('#quality', 'low')
    await page.waitForFunction(() => window.vfxHarness.getStats()?.qualityTier === 'low')
    await advance(page, 0.2)
    const low = await readStats(page)
    const lowState = await readState(page)

    expect(lowState.effects).not.toContain('bloom')
    expect(highState.effects).toContain('bloom')
    expect(
      low.particles.reduce((total, kind) => total + kind.count, 0),
    ).toBeLessThan(high.particles.reduce((total, kind) => total + kind.count, 0))

    await page.selectOption('#quality', 'high')
    await page.waitForFunction(() => window.vfxHarness.getStats()?.qualityTier === 'high')
    await advance(page, 0.2)
    const restored = await readStats(page)
    expect(restored.particles.reduce((total, kind) => total + kind.count, 0)).toBe(
      high.particles.reduce((total, kind) => total + kind.count, 0),
    )

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('feeds plume sources from the DOM controls and returns to the era baseline', async ({
    page,
  }) => {
    const watch = watchPage(page)
    await openHarness(page)
    await selectEra(page, '1985')
    await advance(page, 1)

    const baseline = await readStats(page)
    expect(baseline.plumes.sourceEmitters).toBe(0)
    expect(baseline.plumes.baselineSources).toBe(expectedSnapshot('1985').plumes.baseline.length)
    expect(baseline.plumes.spawned).toBeGreaterThan(0)

    // The page's own control feeds four vehicles (exhaust, steam, EV glow).
    await page.getByTestId('vfx-feed-plumes').click()
    await page.waitForFunction(() => window.vfxHarness.getStats()?.plumes.sourceEmitters === 4)
    await advance(page, 1)
    const fed = await readStats(page)
    expect(fed.plumes.sourceEmitters).toBe(4)
    expect(fed.plumes.emittersByKind['exhaust']).toBeGreaterThanOrEqual(2)
    expect(fed.plumes.emittersByKind['steam']).toBeGreaterThanOrEqual(1)
    expect(fed.plumes.emittersByKind['evGlow']).toBeGreaterThanOrEqual(1)
    expect(fed.plumes.spawned).toBeGreaterThan(baseline.plumes.spawned)
    expect(await page.evaluate(() => document.body.dataset.vfxSourceEmitters)).toBe('4')

    // Emptying the input returns exactly the era's baseline vents.
    await page.getByTestId('vfx-clear-plumes').click()
    await page.waitForFunction(() => window.vfxHarness.getStats()?.plumes.sourceEmitters === 0)
    const emptied = await readStats(page)
    expect(emptied.plumes.baselineSources).toBe(baseline.plumes.baselineSources)
    expect(emptied.plumes.emittersByKind).toEqual(baseline.plumes.emittersByKind)

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('stages a transition and lands exactly on the destination era', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    const from = expectedSnapshot('1945')
    const to = expectedSnapshot('2025')
    await selectEra(page, '1945')

    const midpoint = await page.evaluate(() =>
      window.vfxHarness.setTransition({ from: '1945', to: '2025', t: 0.5 }),
    )
    expect(midpoint).not.toBeNull()
    const midpointFog = (midpoint as HarnessSnapshotView).fog.density
    expect(midpointFog).toBeGreaterThan(Math.min(from.fog.density, to.fog.density))
    expect(midpointFog).toBeLessThan(Math.max(from.fog.density, to.fog.density))
    const midpointState = await readState(page)
    expect(midpointState.fogDensity).toBeCloseTo(midpointFog, 6)

    // t = 1 is the destination era exactly, and the pipeline holds it.
    const landed = await page.evaluate(() =>
      window.vfxHarness.setTransition({ from: '1945', to: '2025', t: 1 }),
    )
    const landedView = landed as HarnessSnapshotView
    expect(landedView.eraId).toBe('2025')
    expect(landedView.fog.density).toBeCloseTo(to.fog.density, 8)
    expect(landedView.sky.topColor).toBe(to.sky.topColor)
    expect(landedView.grade.saturation).toBeCloseTo(to.grade.saturation, 8)
    const landedState = await readState(page)
    expect(landedState.fogDensity).toBeCloseTo(to.fog.density, 6)
    expect(landedState.fogColor?.toLowerCase()).toBe(getEra('2025').atmosphere.hazeColor.toLowerCase())

    // Reduced motion: the same request with `instant` snaps straight to the target.
    const instant = await page.evaluate(() =>
      window.vfxHarness.setTransition({ from: '1945', to: '2025', t: 0.2, instant: true }),
    )
    expect((instant as HarnessSnapshotView).fog.density).toBeCloseTo(to.fog.density, 8)

    // Selecting an era directly is the same instant path.
    await selectEra(page, '1985')
    const restored = await readSnapshot(page)
    expect(restored.eraId).toBe('1985')
    expect(restored.fog.density).toBeCloseTo(expectedSnapshot('1985').fog.density, 8)

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })
})
