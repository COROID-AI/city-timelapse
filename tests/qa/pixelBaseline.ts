/**
 * Pixel-baseline helpers for the era verification suite.
 *
 * The browser suite proves the block re-dresses itself two ways: the composed
 * scene reports per-era statistics (see `e2e/qa-era-matrix.spec.ts`), and the
 * rendered frame actually *looks* different (see `e2e/qa-era-pixels.spec.ts`).
 * This module owns the second half: it captures a fixed-camera frame, writes it
 * under `tests/qa/artifacts/` so the evidence bundle is reproducible from a
 * clean run, and measures the mean per-channel difference between two captures.
 *
 * Two rules make the measurement meaningful rather than tautological:
 *
 * 1. **The overlay is hidden for the capture.** The timeline, HUD and control
 *    strip paint the year on screen, so a naive screenshot would differ between
 *    two eras because of the *label* rather than the block. Hiding the
 *    non-scene DOM for the instant of the capture leaves only what the renderer
 *    drew, which is the thing under test.
 * 2. **The camera is pinned and asserted.** `qa-era-pixels.spec.ts` reads the
 *    camera out of the debug surface before and after every capture and asserts
 *    it is byte-identical, so a difference cannot be explained by a moved view.
 *
 * Decoding happens in the browser (the only PNG decoder guaranteed to be
 * present in this repository's dependency set): the two captures are handed to
 * the page as data URLs, expanded with `createImageBitmap`, drawn into an
 * `OffscreenCanvas` and compared pixel by pixel. No image library, no network.
 *
 * Thresholds below are *calibrated*, not guessed: they are the measured values
 * from a reference run at the `low` quality tier on the reference viewport
 * (1280x800), recorded here so a future regression in art direction — an era
 * that stops changing, or a camera that drifts — trips the suite.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

/** Directory every capture, statistic dump and screenshot lands in. */
export const ARTIFACTS_DIR = join('tests', 'qa', 'artifacts')

/** Test id of the WebGL canvas the captures are clipped to. */
export const SCENE_CANVAS_TEST_ID = 'scene-canvas-surface'

/**
 * Mean per-channel difference (0..255) an adjacent-era pair must exceed.
 *
 * Calibrated on the reference viewport at the `low` tier: the four adjacent
 * pairs measured 27.9 / 48.1 / 49.1 / 35.1, so 12 sits at well under half of the
 * weakest real transformation while still being far above render noise.
 */
export const ADJACENT_ERA_MEAN_DIFF_THRESHOLD = 12

/**
 * Fraction of pixels that must differ by more than
 * {@link DIFFERING_CHANNEL_DELTA}.
 *
 * Calibrated: the four adjacent pairs measured 0.93 / 0.99 / 0.99 / 0.99, so
 * half the frame is a generous floor that still rejects a change confined to one
 * corner of the block.
 */
export const ADJACENT_ERA_DIFFERING_FRACTION_THRESHOLD = 0.5

/**
 * Ceiling for a *same-era* pair captured moments apart.
 *
 * This is the control: it proves the suite is measuring the block's re-dressing
 * rather than animation, particles or noise. It must stay below
 * {@link ADJACENT_ERA_MEAN_DIFF_THRESHOLD}, otherwise the era measurement would
 * be indistinguishable from ordinary motion.
 */
export const SAME_ERA_MEAN_DIFF_CEILING = 12

/** Per-channel difference counted as "this pixel changed". */
export const DIFFERING_CHANNEL_DELTA = 8

/** How one pixel comparison turned out. */
export interface PixelDiff {
  /** Mean absolute per-channel difference over the shared area, 0..255. */
  readonly meanDifference: number
  /** Fraction of pixels whose mean channel delta exceeded the threshold. */
  readonly differingFraction: number
  /** Pixels compared (the smaller of the two captures). */
  readonly comparedPixels: number
  readonly width: number
  readonly height: number
  /** Largest single-channel difference seen, for diagnostics. */
  readonly maxDifference: number
}

/** Creates the artifacts directory (idempotent) and returns it. */
export function ensureArtifactsDir(): string {
  mkdirSync(ARTIFACTS_DIR, { recursive: true })
  return ARTIFACTS_DIR
}

/** Absolute-ish path (relative to the repository root) of one artifact. */
export function artifactPath(fileName: string): string {
  return join(ARTIFACTS_DIR, fileName)
}

/** Writes a JSON artifact, creating the directory first, and returns its path. */
export function writeJsonArtifact(fileName: string, value: unknown): string {
  ensureArtifactsDir()
  const target = artifactPath(fileName)
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return target
}

/** Style element id used while a capture is in flight. */
const CAPTURE_STYLE_ID = 'qa-capture-scene-only'

/**
 * Hides every DOM surface except the scene host.
 *
 * `visibility` rather than `display` so the layout — and therefore the canvas
 * rectangle — is untouched while the capture is taken, and the canvas subtree is
 * re-shown explicitly so hiding an ancestor cannot blank it.
 */
async function hideNonSceneSurfaces(page: Page): Promise<void> {
  await page.evaluate((id: string) => {
    document.getElementById(id)?.remove()
    const style = document.createElement('style')
    style.id = id
    style.textContent =
      'body * { visibility: hidden !important; } .scene-host, .scene-host * { visibility: visible !important; }'
    document.head.append(style)
  }, CAPTURE_STYLE_ID)
}

/** Removes the capture style, restoring the overlay. */
async function showNonSceneSurfaces(page: Page): Promise<void> {
  await page.evaluate((id: string) => {
    document.getElementById(id)?.remove()
  }, CAPTURE_STYLE_ID)
}

/**
 * Captures the WebGL canvas with the overlay hidden and writes it to disk.
 *
 * Returns the PNG bytes so the caller can diff them without re-reading the file.
 */
export async function captureScene(page: Page, fileName: string): Promise<Buffer> {
  ensureArtifactsDir()
  await hideNonSceneSurfaces(page)
  try {
    return await page.getByTestId(SCENE_CANVAS_TEST_ID).screenshot({ path: artifactPath(fileName) })
  } finally {
    await showNonSceneSurfaces(page)
  }
}

/** Captures the whole viewport (overlay included) for the human art review. */
export async function captureFrame(page: Page, fileName: string): Promise<Buffer> {
  ensureArtifactsDir()
  return page.screenshot({ path: artifactPath(fileName) })
}

/**
 * Mean per-channel difference between two PNG captures.
 *
 * The comparison runs inside the page: both buffers travel as base64 data URLs,
 * are decoded with `createImageBitmap`, and are compared over the overlap of
 * their dimensions (identical for captures of the same viewport).
 */
export async function meanPixelDifference(page: Page, first: Buffer, second: Buffer): Promise<PixelDiff> {
  return page.evaluate(
    async ([a, b]: [string, string]) => {
      const decode = async (base64: string): Promise<ImageData> => {
        const response = await fetch(`data:image/png;base64,${base64}`)
        const bitmap = await createImageBitmap(await response.blob())
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')
        if (context === null) {
          throw new Error('OffscreenCanvas 2D context is unavailable, so screenshots cannot be compared.')
        }
        context.drawImage(bitmap, 0, 0)
        return context.getImageData(0, 0, bitmap.width, bitmap.height)
      }

      const left = await decode(a)
      const right = await decode(b)
      const width = Math.min(left.width, right.width)
      const height = Math.min(left.height, right.height)
      let sum = 0
      let differing = 0
      let max = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * left.width + x) * 4
          const j = (y * right.width + x) * 4
          const dr = Math.abs((left.data[i] ?? 0) - (right.data[j] ?? 0))
          const dg = Math.abs((left.data[i + 1] ?? 0) - (right.data[j + 1] ?? 0))
          const db = Math.abs((left.data[i + 2] ?? 0) - (right.data[j + 2] ?? 0))
          const delta = (dr + dg + db) / 3
          sum += delta
          if (delta > 8) {
            differing += 1
          }
          if (delta > max) {
            max = delta
          }
        }
      }
      const comparedPixels = Math.max(1, width * height)
      return {
        meanDifference: sum / comparedPixels,
        differingFraction: differing / comparedPixels,
        comparedPixels,
        width,
        height,
        maxDifference: max,
      }
    },
    [first.toString('base64'), second.toString('base64')] as [string, string],
  )
}
