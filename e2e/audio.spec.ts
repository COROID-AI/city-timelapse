/**
 * Browser verification of the audio engine, driven entirely through the
 * engine's own harness page (`src/audio/harness.html`).
 *
 * The harness exists so this phase can be verified without the composed
 * application: it imports only the audio module and publishes engine state on
 * `window`, so the spec can assert the real `AudioContext` lifecycle — nothing
 * exists before the gesture, the context runs after it, a bed and a one-shot
 * produce measurable signal at the master analyser, and a crossfade retires the
 * previous bed instead of leaving it running.
 */

import { expect, test, type Page } from '@playwright/test'

const HARNESS_PATH = '/src/audio/harness.html'

/** Shape published by the harness on `window.__audioEngineState`. */
interface HarnessState {
  readonly contextState: string
  readonly contextCreated: boolean
  readonly supported: boolean
  readonly unlocked: boolean
  readonly running: boolean
  readonly muted: boolean
  readonly disposed: boolean
  readonly volumes: Record<string, number>
  readonly currentBed: string | null
  readonly pendingBed: string | null
  readonly retiringBeds: readonly string[]
  readonly liveVoices: number
  readonly oneShotVoices: number
  readonly bedVoices: number
  readonly analyserRms: number
}

interface OneShotTriggerResult {
  readonly id: string
  readonly started: boolean
  readonly durationSeconds: number
}

async function openHarness(page: Page): Promise<void> {
  await page.goto(HARNESS_PATH, { waitUntil: 'load' })
  await page.waitForFunction(
    () => (window as unknown as { __audioEngineState?: unknown }).__audioEngineState !== undefined,
  )
}

async function readState(page: Page): Promise<HarnessState> {
  return page.evaluate(() => (window as unknown as { __audioEngineState: HarnessState }).__audioEngineState)
}

async function readBedKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __audioHarness: { bedKeys: () => string[] } }).__audioHarness.bedKeys())
}

async function readOneShotIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as { __audioHarness: { oneShotIds: () => string[] } }).__audioHarness.oneShotIds(),
  )
}

async function sampleRmsPeak(page: Page, durationMs: number): Promise<number> {
  return page.evaluate(
    (duration) =>
      (
        window as unknown as { __audioHarness: { sampleRmsPeak: (ms?: number) => Promise<number> } }
      ).__audioHarness.sampleRmsPeak(duration),
    durationMs,
  )
}

test.describe('audio engine harness', () => {
  test('unlocks on a gesture, plays a bed and a one-shot, then crossfades away', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    page.on('pageerror', (error: Error) => {
      pageErrors.push(error.message)
    })

    await openHarness(page)

    // 1. Before any interaction the engine is suspended and has built nothing.
    const initial = await readState(page)
    expect(initial.supported, 'WebAudio is available in Chromium').toBe(true)
    expect(initial.contextState).toBe('suspended')
    expect(initial.contextCreated, 'no AudioContext before a gesture').toBe(false)
    expect(initial.unlocked).toBe(false)
    expect(initial.running).toBe(false)
    expect(initial.currentBed).toBeNull()
    expect(initial.liveVoices).toBe(0)
    expect(initial.analyserRms).toBe(0)
    await expect(page.getByTestId('state-context')).toContainText('suspended')
    await expect(page.getByTestId('state-rms')).toHaveText('0.0000')

    const beds = await readBedKeys(page)
    expect(beds).toContain('traffic')
    expect(beds).toContain('none')

    // 2. An explicit user gesture unlocks the context.
    await page.getByTestId('unlock-button').click()
    await expect.poll(async () => (await readState(page)).contextState, { timeout: 15_000 }).toBe('running')
    const unlocked = await readState(page)
    expect(unlocked.unlocked).toBe(true)
    expect(unlocked.contextCreated).toBe(true)
    expect(unlocked.running).toBe(true)
    await expect(page.getByTestId('state-context')).toContainText('running')

    // 3. Crossfading to a descriptor bed produces signal at the master analyser.
    await page.getByTestId('bed-select').selectOption('traffic')
    await page.getByTestId('crossfade-button').click()
    await expect.poll(async () => (await readState(page)).currentBed, { timeout: 10_000 }).toBe('traffic')

    const bedState = await readState(page)
    expect(bedState.bedVoices).toBe(1)
    expect(bedState.liveVoices).toBeGreaterThan(0)
    expect(bedState.pendingBed).toBeNull()
    await expect
      .poll(async () => (await readState(page)).analyserRms, { timeout: 10_000 })
      .toBeGreaterThan(0.001)
    const bedRms = (await readState(page)).analyserRms
    await expect(page.getByTestId('state-bed')).toContainText('traffic')
    await expect(page.getByTestId('state-voices')).toContainText(/beds 1/)

    // 4. A one-shot fires on its own and is measurable too.
    await page.getByTestId('one-shot-select').selectOption('siren')
    await page.getByTestId('trigger-button').click()
    await expect
      .poll(async () => (await readState(page)).oneShotVoices, { timeout: 5_000 })
      .toBeGreaterThan(0)

    const oneShotPeak = await sampleRmsPeak(page, 1200)
    expect(oneShotPeak, 'one-shot registers as non-zero RMS').toBeGreaterThan(0.005)
    expect(oneShotPeak).toBeGreaterThan(bedRms * 0.5)

    // 5. Mute gates the output without disturbing the bed or one-shot voices.
    await page.getByTestId('mute-button').click()
    await expect.poll(async () => (await readState(page)).muted, { timeout: 5_000 }).toBe(true)
    const muted = await readState(page)
    expect(muted.currentBed).toBe('traffic')
    expect(muted.bedVoices).toBe(1)
    await page.getByTestId('mute-button').click()
    await expect.poll(async () => (await readState(page)).muted, { timeout: 5_000 }).toBe(false)

    // 6. Crossfading to silence retires the previous bed and releases its nodes.
    await page.getByTestId('bed-select').selectOption('none')
    await page.getByTestId('crossfade-button').click()
    const retiring = await readState(page)
    expect(retiring.currentBed, 'fade-out clears the active bed').toBeNull()
    expect(retiring.retiringBeds).toContain('traffic')

    await expect.poll(async () => (await readState(page)).retiringBeds.length, { timeout: 15_000 }).toBe(0)
    await expect.poll(async () => (await readState(page)).bedVoices, { timeout: 15_000 }).toBe(0)
    await expect.poll(async () => (await readState(page)).analyserRms, { timeout: 15_000 }).toBeLessThan(0.002)

    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(consoleErrors, 'no console errors').toEqual([])
  })

  test('synthesises every one-shot id in a real AudioContext without leaking voices', async ({ page }) => {
    await openHarness(page)
    await page.getByTestId('unlock-button').click()
    await expect.poll(async () => (await readState(page)).contextState, { timeout: 15_000 }).toBe('running')

    const ids = await readOneShotIds(page)
    expect(ids.length).toBeGreaterThanOrEqual(10)
    const required = [
      'horn',
      'streetcar-bell',
      'engine',
      'jackhammer',
      'door-bell',
      'crowd-cheer',
      'birds',
      'siren',
      'train',
      'seagull',
      'ev-whine',
    ]
    for (const id of required) {
      expect(ids, `${id} is part of the library`).toContain(id)
    }

    const triggered: OneShotTriggerResult[] = await page.evaluate(() => {
      const harness = (
        window as unknown as {
          __audioHarness: {
            oneShotIds: () => string[]
            playOneShot: (
              id: string,
              options?: Record<string, number>,
            ) => { started: boolean; durationSeconds: number }
          }
        }
      ).__audioHarness
      return harness.oneShotIds().map((id) => {
        const handle = harness.playOneShot(id, { gain: 0.5, pan: 0 })
        return { id, started: handle.started, durationSeconds: handle.durationSeconds }
      })
    })

    for (const entry of triggered) {
      expect(entry.started, `${entry.id} started`).toBe(true)
      expect(entry.durationSeconds, `${entry.id} reports a duration`).toBeGreaterThan(0)
    }

    const peak = await sampleRmsPeak(page, 1000)
    expect(peak, 'the one-shot library produces measurable signal').toBeGreaterThan(0.005)

    // Voices release themselves once their scheduled window has passed.
    await expect.poll(async () => (await readState(page)).liveVoices, { timeout: 20_000 }).toBe(0)
    await expect.poll(async () => (await readState(page)).analyserRms, { timeout: 15_000 }).toBeLessThan(0.002)
  })
})
