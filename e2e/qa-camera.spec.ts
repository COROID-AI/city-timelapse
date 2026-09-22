/**
 * Camera continuity: the viewer's framing survives every era switch.
 *
 * The request's premise is that the block transforms *in front of the viewer*.
 * That only holds if selecting a year never moves the viewer, so this spec pins
 * the question down to the strongest observable form: the camera state the
 * composition publishes must be byte-identical before the walk, after every one
 * of the five switches, and after returning to the year it started on. The
 * canvas rectangle is checked too, so the framing cannot change by the viewport
 * being re-laid-out behind the viewer's back.
 *
 * The capture geometry is asserted in `qa-era-pixels.spec.ts` as well, so a
 * regression that moved the view would fail there as well as here.
 */

import { expect, test, type Page } from '@playwright/test'
import { ERA_IDS, getEra } from '../src/era'
import type { EraId } from '../src/era'
import { writeJsonArtifact } from '../tests/qa/pixelBaseline'

test.describe.configure({ timeout: 280_000 })

interface CameraState {
  readonly mode: string
  readonly target: readonly number[]
  readonly orbit: { readonly azimuth: number; readonly polar: number; readonly radius: number }
  readonly street: {
    readonly position: readonly number[]
    readonly heading: number
    readonly pitch: number
  }
  readonly fov: number
  readonly near: number
  readonly far: number
}

interface DebugSnapshot {
  readonly eraId: EraId
  readonly transitioning: boolean
  readonly qualityTier: string
  readonly camera: CameraState
  readonly frame: number
  readonly qualityTierAtBuild?: string
  readonly loading: { readonly ready: boolean }
}

async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (surface?.read() ?? null) as unknown as DebugSnapshot | null
  })
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

/** Exact serialisation of the camera, so "unchanged" means byte-identical. */
function cameraKey(camera: CameraState): string {
  return JSON.stringify(camera)
}

test('the camera is identical before and after every era switch', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 150_000, intervals: [250, 500, 1000] })
    .toBe(true)
  await expect
    .poll(async () => (await readDebug(page))?.frame ?? 0, { timeout: 60_000, intervals: [250, 500, 1000] })
    .toBeGreaterThan(0)

  const initial = await readDebug(page)
  if (initial === null) {
    throw new Error('The composition debug surface is not available on window.__cityTimelapse.')
  }
  const initialKey = cameraKey(initial.camera)

  // The shipped framing is a real camera, not an empty record.
  expect(initial.camera.mode).toBe('orbit')
  expect(initial.camera.orbit.radius).toBeGreaterThan(0)
  expect(initial.camera.fov).toBeGreaterThan(0)
  expect(initial.camera.far).toBeGreaterThan(initial.camera.near)

  const canvas = page.getByTestId('scene-canvas-surface')
  const initialBox = await canvas.boundingBox()
  expect(initialBox, 'the scene canvas is laid out').not.toBeNull()
  const viewport = page.viewportSize()

  const perEra: Record<string, unknown> = {}

  for (const eraId of ERA_IDS) {
    await selectYear(page, eraId)
    const snapshot = await waitForEra(page, eraId)

    await expect(page.getByTestId('timeline-year-readout'), `${eraId} readout`).toHaveText(getEra(eraId).shortLabel)
    await expect(page.getByTestId('timeline'), `${eraId} timeline`).toHaveAttribute('data-era-id', eraId)
    expect(snapshot.eraId, `${eraId} era`).toBe(eraId)

    // Byte-identical camera before, during and after the switch.
    expect(cameraKey(snapshot.camera), `${eraId} camera state`).toBe(initialKey)
    expect(snapshot.camera, `${eraId} camera object`).toEqual(initial.camera)

    // And the same region of the screen is being framed.
    const box = await canvas.boundingBox()
    expect(box, `${eraId} canvas box`).toEqual(initialBox)
    expect(await canvas.count(), `${eraId} single canvas`).toBe(1)
    expect(page.viewportSize(), `${eraId} viewport`).toEqual(viewport)

    perEra[eraId] = { camera: cameraKey(snapshot.camera), matchesInitial: true }
  }

  // Returning to the year the walk started on leaves the viewer where they were.
  await selectYear(page, ERA_IDS[0])
  const returned = await waitForEra(page, ERA_IDS[0])
  expect(cameraKey(returned.camera), 'the camera returns unchanged to the starting year').toBe(initialKey)

  const artifact = writeJsonArtifact('era-camera.json', {
    generatedAt: new Date().toISOString(),
    initialCamera: initialKey,
    initialBox,
    viewport,
    perEra,
    returnedCamera: cameraKey(returned.camera),
  })
  expect(artifact).toContain('era-camera.json')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
