/**
 * Audio behaviour in the composed application.
 *
 * The request asks for SFX and a per-era soundscape, and the plan's constraint is
 * that verification observes the app through its public surfaces and a real
 * browser. This spec therefore drives the real page and reads the composition's
 * published audio state (the engine's own lifecycle counters included) to assert
 * four things:
 *
 * 1. **Nothing plays before the viewer says so.** Before any gesture the engine
 *    reports `supported: true` but has not even constructed an `AudioContext`
 *    (`contextCreated: false`, `contextState: 'suspended'`), the master output is
 *    muted, and nothing is active. A gesture that is *not* on the canvas (the
 *    first-use panel's button) must leave it that way; the viewer's first gesture
 *    *on the canvas* is what unlocks it, and only then does the context run.
 * 2. **Every era switch selects that era's own ambience bed.** Walking the
 *    timeline through all five years must move the bed id to the descriptor the
 *    era registry publishes for that year — and the era registry is the single
 *    source, so `getSoundscape(eraId).descriptor` is the expectation, not a copy
 *    of the string.
 * 3. **Vehicle SFX fire at a rate-limited cadence.** The vehicle layer's horn and
 *    engine events reach the bridge, which rate-limits them per kind and
 *    globally. The observed cadence is measured from the bridge's own event clock:
 *    consecutive routed events of one kind must respect the documented minimum
 *    gap, and the routed count over the window must stay inside the documented
 *    ceiling. Suppressed events are counted too, which is how the limiter is seen
 *    to be doing work rather than merely not being hit.
 * 4. **Repeated switching releases voices.** The engine reports live, one-shot and
 *    bed voices separately; `liveVoices === oneShotVoices + bedVoices` must hold
 *    at every sample (no orphaned voices), the crossfade must retire the previous
 *    bed, and the app must settle back to at most one bed voice.
 *
 * Everything observed is written to `tests/qa/artifacts/era-audio.json`.
 */

import { expect, test, type Page } from '@playwright/test'
import { ERA_IDS, getSoundscape } from '../src/era'
import type { EraId } from '../src/era'
import { writeJsonArtifact } from '../tests/qa/pixelBaseline'

test.describe.configure({ timeout: 280_000 })

/* -------------------------------------------------------------------------- */
/* Rate limits the bridge documents.                                          */
/*                                                                            */
/* Mirrored here rather than imported because `src/app/audioBridge.ts` reaches */
/* the overlay's stylesheet through `src/ui`, which a Node-side browser check   */
/* cannot load. If these drift, this spec's cadence assertion fails loudly.     */
/* -------------------------------------------------------------------------- */

/** Mirrors `SFX_MIN_INTERVAL_SECONDS` in `src/app/audioBridge.ts`. */
const SFX_MIN_INTERVAL_SECONDS: Readonly<Record<string, number>> = Object.freeze({
  horn: 1.25,
  engine: 0.5,
  'transit-bell': 2,
  'ev-whine': 1,
  'tire-squeal': 1.5,
})

/** Mirrors `SFX_MAX_PER_SECOND` in `src/app/audioBridge.ts`. */
const SFX_MAX_PER_SECOND = 8

/** Tolerance for sampling/clock jitter when checking a minimum gap. */
const CADENCE_TOLERANCE_SECONDS = 0.05

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

interface EngineState {
  readonly contextState: string
  readonly contextCreated: boolean
  readonly supported: boolean
  readonly unlocked: boolean
  readonly running: boolean
  readonly muted: boolean
  readonly disposed: boolean
  readonly currentBed: string | null
  readonly pendingBed: string | null
  readonly retiringBeds: readonly string[]
  readonly liveVoices: number
  readonly oneShotVoices: number
  readonly bedVoices: number
  readonly analyserRms: number
}

interface AudioState {
  readonly supported: boolean
  readonly unlocked: boolean
  readonly muted: boolean
  readonly intentUnlocked: boolean
  readonly intentMuted: boolean
  readonly active: boolean
  readonly bedId: string | null
  readonly bedEraId: EraId | null
  readonly engine: EngineState
  readonly crossfades: number
  readonly cues: number
  readonly sfxRouted: number
  readonly sfxSuppressed: number
  readonly routedByKind: Readonly<Record<string, number>>
  readonly lastSfx: { readonly kind: string; readonly id: string | null; readonly atSeconds: number } | null
}

interface DebugSnapshot {
  readonly eraId: EraId
  readonly transitioning: boolean
  readonly qualityTier: string
  readonly audio: AudioState | null
  readonly loading: { readonly ready: boolean }
}

async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (surface?.read() ?? null) as unknown as DebugSnapshot | null
  })
}

async function audioOf(page: Page): Promise<AudioState | null> {
  return (await readDebug(page))?.audio ?? null
}

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
  const snapshot = await readDebug(page)
  if (snapshot === null) {
    throw new Error('The composition debug surface is not available on window.__cityTimelapse.')
  }
  return snapshot
}

async function selectYear(page: Page, eraId: EraId): Promise<void> {
  await page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`).dispatchEvent('click')
}

/**
 * Delivers the viewer's first gesture on the canvas.
 *
 * The unlock listener is bound to the canvas element, and the overlay panels sit
 * over parts of it, so a few points are tried in turn until the intent lands.
 * Each attempt is a real mouse click: the spec does not dispatch a synthetic
 * event, because the point is to exercise the browser's own gesture path.
 */
async function gestureOnCanvas(page: Page): Promise<void> {
  const box = await page.getByTestId('scene-canvas-surface').boundingBox()
  if (box === null) {
    throw new Error('The scene canvas is not visible, so no gesture can be delivered.')
  }
  const points: readonly (readonly [number, number])[] = [
    [0.5, 0.45],
    [0.5, 0.6],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.5, 0.25],
  ]
  for (const [fx, fy] of points) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      if ((await audioOf(page))?.intentUnlocked === true) {
        return
      }
      await page.waitForTimeout(300)
    }
  }
  throw new Error('The canvas gesture never recorded the viewer unlock intent.')
}

/* -------------------------------------------------------------------------- */
/* The journey                                                                */
/* -------------------------------------------------------------------------- */

test('audio stays suspended until a canvas gesture, follows the era and releases voices', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 150_000, intervals: [250, 500, 1000] })
    .toBe(true)

  /* ---------------------------------------------------------------------- */
  /* 1. Suspended until the viewer's own gesture                            */
  /* ---------------------------------------------------------------------- */

  const initial = await audioOf(page)
  expect(initial, 'the composition publishes its audio state').not.toBeNull()
  expect(initial?.supported, 'WebAudio is available in this browser').toBe(true)
  expect(initial?.engine.contextCreated, 'no AudioContext is built before a gesture').toBe(false)
  expect(initial?.engine.contextState, 'the context reports suspended').toBe('suspended')
  expect(initial?.engine.unlocked).toBe(false)
  expect(initial?.engine.running).toBe(false)
  expect(initial?.engine.muted, 'the engine is muted defensively').toBe(true)
  expect(initial?.unlocked).toBe(false)
  expect(initial?.active, 'nothing is playing').toBe(false)
  expect(initial?.intentUnlocked, 'the viewer has not asked for sound yet').toBe(false)
  await expect(page.getByTestId('audio-status')).toHaveText(/Sound is off/i)
  await expect(page.getByTestId('audio-unlock')).toHaveAttribute('aria-pressed', 'false')

  // A gesture that is not on the canvas is not permission for sound.
  if ((await page.getByTestId('overlay-dismiss').count()) > 0) {
    await page.getByTestId('overlay-dismiss').click()
    await page.waitForTimeout(500)
    const afterPanelGesture = await audioOf(page)
    expect(afterPanelGesture?.intentUnlocked, 'a panel click does not unlock the engine').toBe(false)
    expect(afterPanelGesture?.engine.contextCreated).toBe(false)
  }

  await gestureOnCanvas(page)
  await expect
    .poll(async () => (await audioOf(page))?.engine.contextState ?? null, { timeout: 30_000, intervals: [250, 500] })
    .toBe('running')
  const unlocked = await audioOf(page)
  expect(unlocked?.engine.unlocked, 'the engine honours the gesture').toBe(true)
  expect(unlocked?.engine.contextCreated).toBe(true)
  expect(unlocked?.engine.running).toBe(true)
  expect(unlocked?.muted, 'unlocking clears the defensive mute').toBe(false)
  expect(unlocked?.active, 'the block is making sound').toBe(true)
  await expect(page.getByTestId('audio-status')).toHaveText(/Sound is on/i)

  /* ---------------------------------------------------------------------- */
  /* 2. Every era switch selects that era's bed                             */
  /* ---------------------------------------------------------------------- */

  const beds: string[] = []
  let previousCrossfades = unlocked?.crossfades ?? 0
  for (const eraId of ERA_IDS) {
    await selectYear(page, eraId)
    await waitForEra(page, eraId)
    // Give the soundscape stage's crossfade a chance to be observed.
    await expect
      .poll(async () => (await audioOf(page))?.bedId ?? null, { timeout: 30_000, intervals: [250, 500] })
      .toBe(getSoundscape(eraId).descriptor)
    const audio = await audioOf(page)
    expect(audio?.bedEraId, `${eraId} bed era`).toBe(eraId)
    expect(audio?.crossfades ?? 0, `${eraId} issued a crossfade`).toBeGreaterThan(previousCrossfades)
    previousCrossfades = audio?.crossfades ?? previousCrossfades
    beds.push(audio?.bedId ?? '')
  }
  expect(new Set(beds).size, 'five distinct soundscapes were selected').toBe(ERA_IDS.length)

  /* ---------------------------------------------------------------------- */
  /* 3. Vehicle SFX, rate limited                                           */
  /* ---------------------------------------------------------------------- */

  // 1945's fleet is horse-drawn and emits nothing, so a later period drives it.
  await selectYear(page, '2025')
  await waitForEra(page, '2025')

  await expect
    .poll(
      async () => {
        const audio = await audioOf(page)
        return (audio?.sfxRouted ?? 0) + (audio?.sfxSuppressed ?? 0)
      },
      { timeout: 120_000, intervals: [500, 1000] },
    )
    .toBeGreaterThan(0)

  interface Sample {
    readonly atSeconds: number
    readonly routed: number
    readonly suppressed: number
    readonly live: number
    readonly oneShot: number
    readonly bed: number
    readonly retiring: number
  }

  const samples: Sample[] = []
  const events = new Map<string, number[]>()
  const seenEventKeys = new Set<string>()
  const windowSeconds = 25
  const clock = async (): Promise<number> => (await audioOf(page))?.lastSfx?.atSeconds ?? 0
  const startClock = await clock()
  const startedAt = Date.now()
  while (Date.now() - startedAt < windowSeconds * 1000) {
    const audio = await audioOf(page)
    if (audio !== null) {
      samples.push({
        atSeconds: audio.lastSfx?.atSeconds ?? 0,
        routed: audio.sfxRouted,
        suppressed: audio.sfxSuppressed,
        live: audio.engine.liveVoices,
        oneShot: audio.engine.oneShotVoices,
        bed: audio.engine.bedVoices,
        retiring: audio.engine.retiringBeds.length,
      })
      const last = audio.lastSfx
      if (last !== null) {
        const key = `${last.kind}@${last.atSeconds}`
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key)
          const list = events.get(last.kind) ?? []
          list.push(last.atSeconds)
          events.set(last.kind, list)
        }
      }
    }
    await page.waitForTimeout(750)
  }

  const endAudio = await audioOf(page)
  const endClock = endAudio?.lastSfx?.atSeconds ?? startClock
  const observedSeconds = Math.max(1, endClock - startClock)
  const routedDuringWindow = Math.max(0, (endAudio?.sfxRouted ?? 0) - (samples[0]?.routed ?? 0))
  expect(
    routedDuringWindow,
    `routed events per second must stay within the documented ceiling of ${SFX_MAX_PER_SECOND}`,
  ).toBeLessThanOrEqual(Math.ceil(observedSeconds * SFX_MAX_PER_SECOND) + 1)

  const cadences: Record<string, number[]> = {}
  for (const [kind, timestamps] of events) {
    const sorted = [...new Set(timestamps)].sort((a, b) => a - b)
    const gaps: number[] = []
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      if (previous !== undefined && current !== undefined) {
        gaps.push(current - previous)
      }
    }
    cadences[kind] = gaps
    const minimum = SFX_MIN_INTERVAL_SECONDS[kind]
    if (minimum !== undefined) {
      for (const gap of gaps) {
        expect(
          gap,
          `${kind} events must be at least ${minimum}s apart (rate limited per kind)`,
        ).toBeGreaterThanOrEqual(minimum - CADENCE_TOLERANCE_SECONDS)
      }
    }
  }

  // The rate limiter is seen doing work: some triggers were held back.
  await expect
    .poll(async () => (await audioOf(page))?.sfxSuppressed ?? 0, { timeout: 90_000, intervals: [500, 1000] })
    .toBeGreaterThan(0)
  const routed = await audioOf(page)
  const routedTotal = Object.values(routed?.routedByKind ?? {}).reduce((total, value) => total + value, 0)
  expect(routedTotal, 'the per-kind counters add up to the routed total').toBe(routed?.sfxRouted ?? -1)
  expect(routed?.cues ?? 0, 'the director issued era cue SFX').toBeGreaterThan(0)

  /* ---------------------------------------------------------------------- */
  /* 4. Voices are accounted for and released                               */
  /* ---------------------------------------------------------------------- */

  for (const sample of samples) {
    expect(
      sample.live,
      'live voices are exactly the one-shot plus bed voices (no orphaned voices)',
    ).toBe(sample.oneShot + sample.bed)
  }

  // Repeated switching retires the previous bed instead of stacking beds up.
  await expect
    .poll(async () => (await audioOf(page))?.engine.retiringBeds.length ?? -1, { timeout: 60_000, intervals: [250, 500] })
    .toBe(0)
  await expect
    .poll(async () => (await audioOf(page))?.engine.bedVoices ?? -1, { timeout: 60_000, intervals: [250, 500] })
    .toBeLessThanOrEqual(1)

  const settled = await audioOf(page)
  expect(settled?.engine.currentBed, 'the settled bed is the last era selected').toBe(
    getSoundscape('2025').descriptor,
  )
  expect(settled?.engine.pendingBed, 'nothing is still waiting for an unlock').toBeNull()

  const artifact = writeJsonArtifact('era-audio.json', {
    generatedAt: new Date().toISOString(),
    rateLimits: { perKindSeconds: SFX_MIN_INTERVAL_SECONDS, maxPerSecond: SFX_MAX_PER_SECOND },
    beds,
    observedCadenceSeconds: cadences,
    observationWindowSeconds: observedSeconds,
    samples,
    final: {
      routed: settled?.sfxRouted ?? 0,
      suppressed: settled?.sfxSuppressed ?? 0,
      routedByKind: settled?.routedByKind ?? {},
      cues: settled?.cues ?? 0,
      engine: settled?.engine ?? null,
    },
  })
  expect(artifact).toContain('era-audio.json')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
