/**
 * Browser proof of the staged era transition director.
 *
 * The spec drives the director's *own* harness page
 * (`src/transition/harness.html`) from the Vite dev server Playwright owns, so
 * the director's browser behaviour is verified without the composed application:
 * the page mounts the director over the real era store with the schedule's stub
 * adapters, a stub camera port, a stub audio port and a stub progress indicator.
 *
 * What is asserted, all from the real director:
 * - a switch advances the stub progress indicator from 0 to completion and clears
 *   it, with intermediate frames actually rendered;
 * - every staged layer is applied in the documented theatrical order and lands on
 *   the target era;
 * - switching mid-transition retargets from the dominant era, keeps progressing
 *   (never frozen, never overshooting) and lands on the newest selection;
 * - the camera state is identical across a switch even though one stub layer
 *   tramples it on every frame, and the viewer's own navigation survives;
 * - reduced motion applies the target in a single step with zero staged frames,
 *   still crossfading the ambience.
 */

import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'

const HARNESS_PATH = '/src/transition/harness.html'
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/** The documented theatrical order the harness must schedule. */
const STAGE_ORDER = [
  'atmosphere',
  'buildings',
  'storefronts',
  'props',
  'vehicles',
  'pedestrians',
  'soundscape',
] as const

interface LayerFrameSnapshot {
  id: string
  progress: number
  started: boolean
  complete: boolean
}

interface TransitionSnapshot {
  active: boolean
  fromEra: string
  toEra: string
  selectedEra: string
  progress: number
  storeProgress: number
  transitioning: boolean
  reducedMotion: boolean
  frames: number
  retargetCount: number
  stageOrder: string[]
  registeredLayers: string[]
  pendingStages: string[]
  layerFrames: LayerFrameSnapshot[]
  camera: { tracked: boolean; unchanged: boolean; restorations: number }
  audio: { crossfades: number; lastCrossfadeEraId: string | null; cueIds: string[] }
  lastCompletion: {
    fromEra: string
    toEra: string
    progress: number
    frames: number
    reducedMotion: boolean
    cameraUnchanged: boolean
  } | null
  lastEvent: string
}

interface TraceEntry {
  event: string
  progress: number
  active: boolean
  frames: number
  retargets: number
}

interface CameraState {
  mode: string
  target: number[]
  orbit: { azimuth: number; polar: number; radius: number }
  street: { position: number[]; heading: number; pitch: number }
  fov: number
  near: number
  far: number
}

interface TransitionHarnessApi {
  errors: string[]
  schedule: Array<{ id: string; startSeconds: number; durationSeconds: number; easing: string }>
  durationSeconds: number
  soundscapeStageId: string
  snapshot(): TransitionSnapshot
  setEra(eraId: string): TransitionSnapshot
  step(seconds: number): void
  play(): void
  pause(): void
  setReducedMotion(value: boolean): void
  isPlaying(): boolean
  camera(): CameraState
  cameraCounters(): { captures: number; restores: number; mutations: number }
  moveCamera(amount?: number): CameraState
  layers(): Array<{ id: string; eraId: string | null; progress: number; applications: number }>
  firstFrameOrder(): string[]
  audio(): { crossfades: Array<{ eraId: string; bedId: string; seconds: number }>; cues: Array<{ eraId: string; cueId: string }> }
  trace(): TraceEntry[]
  clearTrace(): void
  indicator(): { state: string; progress: string; lastProgress: string; completions: number }
  store(): { selectedEra: string; fromEra: string; toEra: string; progress: number }
  report(): string
}

declare global {
  interface Window {
    __transitionHarness: TransitionHarnessApi
  }
}

interface BootResult {
  consoleErrors: string[]
  pageErrors: string[]
  externalRequests: string[]
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

async function boot(page: Page, path: string = HARNESS_PATH): Promise<BootResult> {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const externalRequests: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error: Error) => {
    pageErrors.push(error.message)
  })
  page.on('request', (request: Request) => {
    if (isExternalRequest(request)) {
      externalRequests.push(request.url())
    }
  })

  await page.goto(path)
  await expect(page.locator('body')).toHaveAttribute('data-transition-status', 'ready')
  return { consoleErrors, pageErrors, externalRequests }
}

/** Steps the harness clock until the director settles, or fails the step. */
async function settle(page: Page, stepSeconds = 0.2, limit = 120): Promise<TransitionSnapshot> {
  for (let index = 0; index < limit; index += 1) {
    const snapshot = await page.evaluate(() => window.__transitionHarness.snapshot())
    if (!snapshot.active) {
      return snapshot
    }
    await page.evaluate((seconds) => window.__transitionHarness.step(seconds), stepSeconds)
  }
  throw new Error(`Transition did not settle within ${limit} steps.`)
}

test.describe('transition director harness', () => {
  test('boots the director over the era store with a stub progress indicator', async ({ page }) => {
    const bootResult = await boot(page)

    const snapshot = await page.evaluate(() => window.__transitionHarness.snapshot())
    expect(snapshot.active).toBe(false)
    expect(snapshot.selectedEra).toBe('1945')
    expect(snapshot.stageOrder).toEqual([...STAGE_ORDER])
    expect(snapshot.registeredLayers).toEqual([...STAGE_ORDER])

    // The schedule is the shipped table: every stage has a real window.
    const schedule = await page.evaluate(() => window.__transitionHarness.schedule)
    expect(schedule.map((entry) => entry.id)).toEqual([...STAGE_ORDER])
    for (const entry of schedule) {
      expect(entry.durationSeconds).toBeGreaterThan(0)
      expect(entry.startSeconds).toBeGreaterThanOrEqual(0)
    }
    expect(schedule[0]?.startSeconds).toBe(0)

    // The stub indicator starts idle and cleared.
    const indicatorState = await page.evaluate(() => window.__transitionHarness.indicator())
    expect(indicatorState).toMatchObject({ state: 'idle', progress: '', completions: 0 })

    // The camera is tracked from the first frame on.
    const cameraBefore = await page.evaluate(() => window.__transitionHarness.camera())
    expect(cameraBefore.mode).toBe('orbit')
    expect(Number.isFinite(cameraBefore.orbit.azimuth)).toBe(true)

    const errors = await page.evaluate(() => window.__transitionHarness.errors)
    expect(errors).toEqual([])
    expect(bootResult.consoleErrors).toEqual([])
    expect(bootResult.pageErrors).toEqual([])
    expect(bootResult.externalRequests).toEqual([])
  })

  test('advances the stub progress indicator to completion, then clears it', async ({ page }) => {
    await boot(page)

    await page.locator('[data-testid="era-stop"][data-era-id="2025"]').click()
    await page.evaluate(() => window.__transitionHarness.clearTrace())
    await page.locator('[data-testid="toggle-play"]').click()

    await expect(page.locator('[data-testid="stub-progress-indicator"]')).toHaveAttribute(
      'data-state',
      'running',
      { timeout: 5_000 },
    )
    await expect(page.locator('[data-testid="stub-progress-indicator"]')).toHaveAttribute(
      'data-state',
      'complete',
      { timeout: 20_000 },
    )

    const indicatorState = await page.evaluate(() => window.__transitionHarness.indicator())
    expect(indicatorState.state).toBe('complete')
    expect(indicatorState.progress, 'the indicator is cleared on completion').toBe('')
    expect(indicatorState.lastProgress).toBe('1')
    expect(indicatorState.completions).toBe(1)

    const trace = await page.evaluate(() => window.__transitionHarness.trace())
    const progresses = trace.map((entry) => entry.progress)
    // Intermediate frames really happened, and nothing ran backwards or past 1.
    expect(progresses.length).toBeGreaterThan(1)
    expect(progresses.some((progress) => progress > 0 && progress < 1)).toBe(true)
    expect(Math.max(...progresses)).toBe(1)
    for (let index = 1; index < progresses.length; index += 1) {
      expect(progresses[index], `progress ${index} never decreases`).toBeGreaterThanOrEqual(
        progresses[index - 1] ?? 0,
      )
    }

    // Every staged layer was applied, in the documented order, on the target era.
    const layers = await page.evaluate(() => window.__transitionHarness.layers())
    expect(layers.map((layer) => layer.id)).toEqual([...STAGE_ORDER])
    for (const layer of layers) {
      expect(layer.applications, `${layer.id} was applied`).toBeGreaterThan(0)
      expect(layer.eraId).toBe('2025')
    }
    const firstFrameOrder = await page.evaluate(() => window.__transitionHarness.firstFrameOrder())
    expect(firstFrameOrder).toEqual([...STAGE_ORDER])

    // One ambience crossfade to the target era's soundscape, plus era cue SFX.
    const audio = await page.evaluate(() => window.__transitionHarness.audio())
    expect(audio.crossfades).toHaveLength(1)
    expect(audio.crossfades[0]?.eraId).toBe('2025')
    expect(audio.crossfades[0]?.bedId).toContain('2025')
    expect(audio.cues.length).toBeGreaterThan(0)

    const storeState = await page.evaluate(() => window.__transitionHarness.store())
    expect(storeState).toEqual({ selectedEra: '2025', fromEra: '2025', toEra: '2025', progress: 0 })

    const snapshot = await page.evaluate(() => window.__transitionHarness.snapshot())
    expect(snapshot.active).toBe(false)
    expect(snapshot.progress).toBe(1)
    expect(snapshot.lastCompletion).toMatchObject({
      fromEra: '1945',
      toEra: '2025',
      progress: 1,
      reducedMotion: false,
      cameraUnchanged: true,
    })
    expect(await page.locator('body').getAttribute('data-transition-active')).toBe('false')
  })

  test('retargets mid-transition without deadlock, restart or overshoot', async ({ page }) => {
    await boot(page)

    await page.evaluate(() => window.__transitionHarness.setEra('2025'))
    await page.evaluate(() => window.__transitionHarness.step(1.0))
    const midway = await page.evaluate(() => window.__transitionHarness.snapshot())
    expect(midway.active).toBe(true)
    expect(midway.progress).toBeGreaterThan(0)
    expect(midway.progress).toBeLessThan(0.5)

    await page.evaluate(() => window.__transitionHarness.clearTrace())
    await page.evaluate(() => window.__transitionHarness.setEra('1985'))
    const retargeted = await page.evaluate(() => window.__transitionHarness.snapshot())
    expect(retargeted.toEra).toBe('1985')
    expect(retargeted.fromEra).toBe('1945')
    expect(retargeted.retargetCount).toBe(1)
    expect(retargeted.progress).toBeCloseTo(midway.progress, 6)

    const settled = await settle(page)
    expect(settled.active).toBe(false)
    expect(settled.lastCompletion).toMatchObject({ fromEra: '1945', toEra: '1985', progress: 1 })

    const trace = await page.evaluate(() => window.__transitionHarness.trace())
    const progresses = trace.map((entry) => entry.progress)
    expect(progresses.some((progress) => progress > 0 && progress < 1)).toBe(true)
    expect(Math.max(...progresses)).toBe(1)
    for (let index = 1; index < progresses.length; index += 1) {
      expect(progresses[index], `progress ${index} continues monotonically`).toBeGreaterThanOrEqual(
        progresses[index - 1] ?? 0,
      )
    }

    const layers = await page.evaluate(() => window.__transitionHarness.layers())
    for (const layer of layers) {
      expect(layer.eraId, `${layer.id} lands on the newest selection`).toBe('1985')
    }
    const indicatorState = await page.evaluate(() => window.__transitionHarness.indicator())
    expect(indicatorState.state).toBe('complete')
    expect(indicatorState.progress).toBe('')
    const storeState = await page.evaluate(() => window.__transitionHarness.store())
    expect(storeState).toEqual({ selectedEra: '1985', fromEra: '1985', toEra: '1985', progress: 0 })
    expect(await page.evaluate(() => window.__transitionHarness.errors)).toEqual([])
  })

  test('keeps the camera state identical across a switch even when a layer tramples it', async ({
    page,
  }) => {
    await boot(page)

    const before = await page.evaluate(() => window.__transitionHarness.camera())
    await page.evaluate(() => window.__transitionHarness.setEra('2005'))
    await settle(page)

    const after = await page.evaluate(() => window.__transitionHarness.camera())
    expect(after).toEqual(before)

    const counters = await page.evaluate(() => window.__transitionHarness.cameraCounters())
    expect(counters.mutations, 'the trap layer really moved the camera').toBeGreaterThan(0)
    expect(counters.restores, 'the director put it back').toBeGreaterThan(0)

    const snapshot = await page.evaluate(() => window.__transitionHarness.snapshot())
    expect(snapshot.camera).toMatchObject({ tracked: true, unchanged: true })
    expect(snapshot.camera.restorations).toBeGreaterThan(0)
    expect(await page.locator('body').getAttribute('data-transition-camera-unchanged')).toBe('true')
  })

  test('leaves the viewer free to move while the block re-dresses', async ({ page }) => {
    await boot(page)

    await page.evaluate(() => window.__transitionHarness.setEra('2005'))
    await page.evaluate(() => window.__transitionHarness.step(0.6))
    const moved = await page.evaluate(() => window.__transitionHarness.moveCamera(0.4))
    await settle(page)

    const after = await page.evaluate(() => window.__transitionHarness.camera())
    expect(after.orbit.azimuth).toBeCloseTo(moved.orbit.azimuth, 6)
    expect(after.orbit.azimuth).toBeGreaterThan(0)
  })

  test('applies the target in a single step under reduced motion, and still crossfades', async ({
    page,
  }) => {
    await boot(page)

    await page.locator('[data-testid="toggle-reduced"]').click()
    await expect(page.locator('[data-testid="toggle-reduced"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.evaluate(() => window.__transitionHarness.setEra('1965'))

    const snapshot = await page.evaluate(() => window.__transitionHarness.snapshot())
    expect(snapshot.active).toBe(false)
    expect(snapshot.reducedMotion).toBe(true)
    expect(snapshot.frames, 'no staged frames at all').toBe(0)
    expect(snapshot.progress).toBe(1)
    expect(snapshot.lastCompletion).toMatchObject({ fromEra: '1945', toEra: '1965', frames: 0 })
    expect(snapshot.layerFrames.every((frame) => frame.progress === 0)).toBe(true)

    const layers = await page.evaluate(() => window.__transitionHarness.layers())
    for (const layer of layers) {
      expect(layer.applications, `${layer.id} applied once`).toBe(1)
      expect(layer.eraId).toBe('1965')
    }

    const audio = await page.evaluate(() => window.__transitionHarness.audio())
    expect(audio.crossfades).toHaveLength(1)
    expect(audio.crossfades[0]?.eraId).toBe('1965')
    expect(audio.cues.length).toBeGreaterThan(0)

    const indicatorState = await page.evaluate(() => window.__transitionHarness.indicator())
    expect(indicatorState).toMatchObject({ state: 'complete', progress: '', lastProgress: '1' })
    expect(await page.locator('body').getAttribute('data-transition-frames')).toBe('0')
    expect(await page.locator('body').getAttribute('data-transition-reduced')).toBe('true')
  })
})
