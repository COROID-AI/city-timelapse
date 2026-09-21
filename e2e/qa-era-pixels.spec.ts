/**
 * Adjacent-era pixel proof: the block really does re-dress on screen.
 *
 * The matrix spec proves the *statistics* change. This spec proves the *pixels*
 * change, which is the actual promise to the viewer ("the city block must
 * transform before the viewer's eyes"). It does that without trusting anything
 * but the rendered frame and the composition's debug surface:
 *
 * 1. The camera is pinned — it is never moved by the spec — and its state is read
 *    before and after every capture. All five reads must be byte-identical, so a
 *    difference can never be explained by a moved view.
 * 2. The non-scene DOM (timeline, HUD, controls) is hidden for the instant of
 *    each capture. Otherwise the year *label* alone would produce a difference
 *    and the comparison would be tautological.
 * 3. Every adjacent era pair must exceed the calibrated thresholds recorded in
 *    `tests/qa/pixelBaseline.ts`.
 * 4. A same-era control pair is captured moments apart and must stay *below* the
 *    adjacent threshold and below every adjacent measurement. That control is what
 *    turns "these images differ" into "these images differ because the period
 *    changed" rather than "because vehicles move".
 *
 * Captures land in `tests/qa/artifacts/` (`era-<id>.png` scene-only for the
 * measurement, `frame-<id>.png` full viewport for the human art review) together
 * with `era-pixels.json`, which records every measurement and camera state.
 */

import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ERA_IDS, getEra } from '../src/era'
import type { EraId } from '../src/era'
import {
  ADJACENT_ERA_DIFFERING_FRACTION_THRESHOLD,
  ADJACENT_ERA_MEAN_DIFF_THRESHOLD,
  SAME_ERA_MEAN_DIFF_CEILING,
  artifactPath,
  captureFrame,
  captureScene,
  meanPixelDifference,
  writeJsonArtifact,
  type PixelDiff,
} from '../tests/qa/pixelBaseline'

// Software rasterisation, five era rebuilds and fifteen canvas captures: the
// budget is generous because the captures are the expensive part, and they run
// on the reference (GPU-less) viewport by design.
test.describe.configure({ timeout: 420_000 })

interface DebugSnapshot {
  readonly eraId: EraId
  readonly transitioning: boolean
  readonly camera: unknown
  readonly frame: number
  readonly loading: { readonly ready: boolean }
}

async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (surface?.read() ?? null) as unknown as DebugSnapshot | null
  })
}

async function waitForEra(page: Page, eraId: EraId): Promise<void> {
  await expect
    .poll(async () => (await readDebug(page))?.eraId ?? null, { timeout: 120_000, intervals: [250, 500, 1000] })
    .toBe(eraId)
  await expect
    .poll(async () => (await readDebug(page))?.transitioning ?? true, {
      timeout: 120_000,
      intervals: [250, 500, 1000],
    })
    .toBe(false)
}

async function selectYear(page: Page, eraId: EraId): Promise<void> {
  await page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`).dispatchEvent('click')
}

/** A capture read back from disk, so the comparison runs on the archived bytes. */
function readArtifact(fileName: string): Buffer {
  return readFileSync(artifactPath(fileName))
}

/** Camera state serialised exactly as the debug surface reports it. */
function cameraKey(camera: unknown): string {
  return JSON.stringify(camera)
}

interface EraCapture {
  readonly eraId: EraId
  readonly year: number
  readonly sceneFile: string
  readonly frameFile: string
  readonly camera: string
}

test('every adjacent era pair differs in pixels with the camera pinned', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  // Instant swaps: the final dressed state is what the captures compare, and the
  // staged morph is already covered by the matrix spec's default-motion walk.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 150_000, intervals: [250, 500, 1000] })
    .toBe(true)
  await expect
    .poll(async () => (await readDebug(page))?.frame ?? 0, { timeout: 60_000, intervals: [250, 500, 1000] })
    .toBeGreaterThan(0)

  // The first-use panel would appear in the human-review captures.
  if ((await page.getByTestId('overlay-dismiss').count()) > 0) {
    await page.getByTestId('overlay-dismiss').click()
  }

  const captures: EraCapture[] = []
  const controlDiffs: PixelDiff[] = []

  for (const eraId of ERA_IDS) {
    await selectYear(page, eraId)
    await waitForEra(page, eraId)
    const snapshot = await readDebug(page)
    expect(snapshot, `${eraId} snapshot`).not.toBeNull()
    const camera = cameraKey(snapshot?.camera)

    const sceneFile = `era-${eraId}.png`
    const first = await captureScene(page, sceneFile)
    const frameFile = `frame-${eraId}.png`
    await captureFrame(page, frameFile)

    // The camera must not have moved while the frame was captured.
    const afterCapture = await readDebug(page)
    expect(cameraKey(afterCapture?.camera), `${eraId} camera during capture`).toBe(camera)
    expect(afterCapture?.eraId, `${eraId} era during capture`).toBe(eraId)

    if (eraId === ERA_IDS[0]) {
      // Same-era control: two captures of the same period, moments apart, with
      // no era switch in between. Traffic keeps moving, so this is not zero — it
      // is the floor the adjacent-era measurement has to clear.
      const repeat = await captureScene(page, `era-${eraId}-repeat.png`)
      const control = await meanPixelDifference(page, first, repeat)
      controlDiffs.push(control)
      expect(control.comparedPixels, 'control captures share a size').toBeGreaterThan(0)
    }

    captures.push({
      eraId,
      year: getEra(eraId).year,
      sceneFile,
      frameFile,
      camera,
    })
  }

  /* ---------------------------------------------------------------------- */
  /* Camera is pinned across every capture                                  */
  /* ---------------------------------------------------------------------- */

  const referenceCamera = captures[0]?.camera
  expect(referenceCamera, 'a camera state was captured').toBeTruthy()
  for (const capture of captures) {
    expect(capture.camera, `${capture.eraId} camera is unchanged`).toBe(referenceCamera)
  }

  /* ---------------------------------------------------------------------- */
  /* Adjacent pairs                                                         */
  /* ---------------------------------------------------------------------- */

  interface PairResult {
    readonly from: EraId
    readonly to: EraId
    readonly firstFile: string
    readonly secondFile: string
    readonly diff: PixelDiff
    readonly passed: boolean
  }

  const pairs: PairResult[] = []
  for (let index = 1; index < captures.length; index += 1) {
    const previous = captures[index - 1]
    const current = captures[index]
    if (previous === undefined || current === undefined) {
      continue
    }
    const first = readArtifact(previous.sceneFile)
    const second = readArtifact(current.sceneFile)
    const diff = await meanPixelDifference(page, first, second)
    expect(diff.width, `${previous.eraId}->${current.eraId} capture width`).toBeGreaterThan(0)
    expect(diff.height, `${previous.eraId}->${current.eraId} capture height`).toBeGreaterThan(0)

    const passed =
      diff.meanDifference > ADJACENT_ERA_MEAN_DIFF_THRESHOLD &&
      diff.differingFraction > ADJACENT_ERA_DIFFERING_FRACTION_THRESHOLD
    expect(
      diff.meanDifference,
      `${previous.eraId} -> ${current.eraId} mean pixel difference must exceed ${ADJACENT_ERA_MEAN_DIFF_THRESHOLD}`,
    ).toBeGreaterThan(ADJACENT_ERA_MEAN_DIFF_THRESHOLD)
    expect(
      diff.differingFraction,
      `${previous.eraId} -> ${current.eraId} fraction of changed pixels must exceed ${ADJACENT_ERA_DIFFERING_FRACTION_THRESHOLD}`,
    ).toBeGreaterThan(ADJACENT_ERA_DIFFERING_FRACTION_THRESHOLD)

    pairs.push({
      from: previous.eraId,
      to: current.eraId,
      firstFile: previous.sceneFile,
      secondFile: current.sceneFile,
      diff,
      passed,
    })
  }

  expect(pairs, 'every adjacent era pair was compared').toHaveLength(ERA_IDS.length - 1)

  /* ---------------------------------------------------------------------- */
  /* The control proves the measurement is about the era, not about motion   */
  /* ---------------------------------------------------------------------- */

  const control = controlDiffs[0]
  expect(control, 'a same-era control pair was captured').toBeDefined()
  const weakestPair = pairs.reduce((weakest, pair) =>
    pair.diff.meanDifference < weakest.diff.meanDifference ? pair : weakest,
  )
  expect(
    control?.meanDifference ?? 0,
    'a same-era control pair must stay under the adjacent-era threshold',
  ).toBeLessThan(SAME_ERA_MEAN_DIFF_CEILING)
  expect(
    control?.meanDifference ?? 0,
    `control (${control?.meanDifference.toFixed(2)}) must be smaller than the weakest adjacent pair (${weakestPair.diff.meanDifference.toFixed(2)})`,
  ).toBeLessThan(weakestPair.diff.meanDifference)

  const artifact = writeJsonArtifact('era-pixels.json', {
    generatedAt: new Date().toISOString(),
    qualityTier: 'low',
    camera: referenceCamera,
    thresholds: {
      adjacentMeanDifference: ADJACENT_ERA_MEAN_DIFF_THRESHOLD,
      adjacentDifferingFraction: ADJACENT_ERA_DIFFERING_FRACTION_THRESHOLD,
      sameEraMeanDifferenceCeiling: SAME_ERA_MEAN_DIFF_CEILING,
    },
    captures,
    pairs: pairs.map((pair) => ({
      from: pair.from,
      to: pair.to,
      meanDifference: pair.diff.meanDifference,
      differingFraction: pair.diff.differingFraction,
      comparedPixels: pair.diff.comparedPixels,
      width: pair.diff.width,
      height: pair.diff.height,
      passed: pair.passed,
    })),
    sameEraControl: control ?? null,
  })
  expect(artifact).toContain('era-pixels.json')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
