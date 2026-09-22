/**
 * Browser checks for the render pipeline.
 *
 * The harness page (`src/scene/harness.html`) mounts the real pipeline — the
 * imperative `createRenderPipeline` by default, and the React `SceneCanvas`
 * host when opened with `?host=react` — fills its world with a small procedural
 * block, and publishes a scripting API on `window.citySceneHarness`.
 *
 * These tests therefore drive the shipped code through a real browser: a live
 * WebGL context, pixel-ratio and resize handling, pointer/wheel/keyboard/touch
 * navigation, tier switching, the instrumentation readout, lighting changes
 * measured from the rendered pixels, post-processing degradation and recovery
 * from a lost context.
 */

import { expect, test, type Page } from '@playwright/test'
import { DEV_SERVER_URL } from '../playwright.config'

const HARNESS_PATH = '/src/scene/harness.html'
/** Absolute URL, so contexts created directly from `browser` also work. */
const HARNESS_URL = `${DEV_SERVER_URL}${HARNESS_PATH}`

interface HarnessContextInfo {
  available: boolean
  contextType: string
  isWebGL2: boolean
  renderer: string
  pixelRatio: number
  drawingBufferWidth: number
  drawingBufferHeight: number
}

interface HarnessCamera {
  mode: string
  orbit: { azimuth: number; polar: number; radius: number }
  street: { position: number[]; heading: number; pitch: number }
  target: number[]
  fov: number
  near: number
  far: number
}

interface HarnessState {
  quality: string
  shadowMapSize: number
  pixelRatio: number
  effects: string[]
  passOrder: string[]
  postProcessingActive: boolean
  postProcessingFailure: string | null
  postProcessingSize: {
    cssWidth: number
    cssHeight: number
    bufferWidth: number
    bufferHeight: number
  }
  context: HarnessContextInfo
  contextLost: boolean
  running: boolean
  cameraMode: string
  camera: HarnessCamera
  cameraAspect: number
  background: string | null
  sunColor: string
  sunIntensity: number
  ambientIntensity: number
  fogDensity: number
}

interface HarnessStats {
  frames: number
  hookFrames: number
  frameTimeMs: number
  averageFrameTimeMs: number
  averageFps: number
  minFrameTimeMs: number
  maxFrameTimeMs: number
  budgetMs: number
  withinBudget: boolean
  overBudgetFrames: number
}

interface HarnessHandle {
  mode: string
  ready: boolean
  measureLuminance(): { average: number; min: number; max: number; width: number; height: number }
  step(frames?: number): number
  setLighting(patch: Record<string, unknown>): unknown
  setQualityTier(name: string): string
  setPostProcessing(patch: Record<string, unknown>): unknown
  getStats(): HarnessStats
  getState(): HarnessState
  lightingPresets: Record<string, Record<string, unknown>>
  pipeline: {
    controls: {
      mode: string
      getState(): HarnessCamera
      zoomBy(factor: number): void
      orbitBy(azimuth: number, polar: number): void
      setMode(mode: string): void
      bounds: { orbitRadius: { min: number; max: number } }
    }
    getCameraState(): HarnessCamera
    setCameraState(patch: Record<string, unknown>): void
    instrumentation: { sample(): HarnessStats }
    renderFrame(deltaSeconds?: number): number
    renderer: { getContext(): WebGLRenderingContext }
  }
}

declare global {
  interface Window {
    citySceneHarness: HarnessHandle
  }
}

interface PageWatch {
  readonly consoleErrors: string[]
  readonly pageErrors: string[]
}

/** Collects browser noise so every test can assert on it. */
function watchPage(page: Page): PageWatch {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  return { consoleErrors, pageErrors }
}

async function openHarness(page: Page, query = ''): Promise<void> {
  await page.goto(`${HARNESS_URL}${query}`, { waitUntil: 'load' })
  try {
    await page.waitForFunction(() => window.citySceneHarness?.ready === true, undefined, {
      timeout: 30_000,
    })
  } catch (cause) {
    const diagnostic = await page.evaluate(() => ({
      dataset: { ...document.body.dataset },
      readout: document.getElementById('readout')?.textContent ?? null,
    }))
    throw new Error(`harness never became ready: ${JSON.stringify(diagnostic)} — ${String(cause)}`)
  }
}

function readState(page: Page): Promise<HarnessState> {
  return page.evaluate(() => window.citySceneHarness.getState())
}

function readStats(page: Page): Promise<HarnessStats> {
  return page.evaluate(() => window.citySceneHarness.getStats())
}

function measureLuminance(
  page: Page,
): Promise<{ average: number; min: number; max: number; width: number; height: number }> {
  return page.evaluate(() => window.citySceneHarness.measureLuminance())
}

test.describe('render pipeline in the browser', () => {
  test('mounts the canvas host with a live WebGL renderer at the right size', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    const state = await readState(page)
    expect(state.context.available).toBe(true)
    expect(state.context.contextType).toMatch(/^webgl2?$/)
    expect(state.context.renderer.length).toBeGreaterThan(0)
    expect(state.running).toBe(true)
    expect(state.contextLost).toBe(false)

    const canvas = page.locator('#canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    const expectedWidth = Math.round(box?.width ?? 0) * state.pixelRatio
    const expectedHeight = Math.round(box?.height ?? 0) * state.pixelRatio
    expect(state.context.drawingBufferWidth).toBeCloseTo(expectedWidth, -1)
    expect(state.context.drawingBufferHeight).toBeCloseTo(expectedHeight, -1)

    // An opening viewpoint inside the block envelope, with a lit scene.
    expect(state.cameraMode).toBe('orbit')
    expect(state.camera.orbit.radius).toBeGreaterThan(0)
    expect(state.background).not.toBeNull()
    expect(state.fogDensity).toBeGreaterThan(0)

    // The initial frame renders something rather than a blank canvas.
    const luminance = await measureLuminance(page)
    expect(luminance.average).toBeGreaterThan(2)
    expect(luminance.max).toBeGreaterThan(20)

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('mounts the React canvas host component end to end', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page, '?host=react')

    const state = await readState(page)
    expect(state.context.available).toBe(true)
    expect(state.context.contextType).toMatch(/^webgl2?$/)
    await expect(page.locator('#stage canvas')).toHaveCount(1)

    const luminance = await measureLuminance(page)
    expect(luminance.average).toBeGreaterThan(2)
    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('honours the device pixel ratio', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 800 },
      deviceScaleFactor: 2,
      hasTouch: false,
    })
    const page = await context.newPage()
    const watch = watchPage(page)
    await openHarness(page)

    const state = await readState(page)
    const box = await page.locator('#canvas').boundingBox()
    expect(state.pixelRatio).toBeGreaterThanOrEqual(1)
    expect(state.pixelRatio).toBeLessThanOrEqual(2)
    expect(state.context.pixelRatio).toBe(state.pixelRatio)
    expect(state.context.drawingBufferWidth).toBeCloseTo(
      Math.round(box?.width ?? 0) * state.pixelRatio,
      -1,
    )
    // The post-processing chain renders at the same resolution as the canvas.
    expect(state.postProcessingSize.bufferWidth).toBe(state.context.drawingBufferWidth)
    expect(state.postProcessingSize.bufferHeight).toBe(state.context.drawingBufferHeight)
    expect(state.postProcessingSize.cssWidth).toBe(Math.round(box?.width ?? 0))
    expect(watch.pageErrors).toEqual([])
    await context.close()
  })

  test('resizes the drawing buffer and camera aspect with the canvas', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    await page.evaluate(() => {
      const stage = document.getElementById('stage')
      if (stage !== null) {
        stage.style.width = '820px'
        stage.style.height = '300px'
      }
    })

    await expect
      .poll(async () => (await readState(page)).context.drawingBufferWidth, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(800)
    const buffer = await page.evaluate(
      () => window.citySceneHarness.pipeline.renderer.getContext().drawingBufferWidth,
    )
    expect(buffer).toBeGreaterThanOrEqual(800)
    const resized = await readState(page)
    expect(resized.cameraAspect).toBeGreaterThan(1)
    expect(resized.cameraAspect).toBeCloseTo(
      resized.context.drawingBufferWidth / resized.context.drawingBufferHeight,
      2,
    )
    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('drives the camera through pointer, wheel and keyboard input', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    const box = await page.locator('#canvas').boundingBox()
    expect(box).not.toBeNull()
    const centerX = (box?.x ?? 0) + (box?.width ?? 0) / 2
    const centerY = (box?.y ?? 0) + (box?.height ?? 0) / 2

    const before = await readState(page)
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX + 120, centerY + 40, { steps: 8 })
    await page.mouse.up()
    const afterDrag = await readState(page)
    expect(afterDrag.camera.orbit.azimuth).toBeLessThan(before.camera.orbit.azimuth)
    expect(afterDrag.camera.orbit.polar).toBeLessThan(before.camera.orbit.polar)

    await page.mouse.move(centerX, centerY)
    await page.mouse.wheel(0, 400)
    const afterWheel = await readState(page)
    expect(afterWheel.camera.orbit.radius).toBeGreaterThan(afterDrag.camera.orbit.radius)

    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(250)
    await page.keyboard.up('ArrowRight')
    const afterKeys = await readState(page)
    expect(afterKeys.camera.orbit.azimuth).toBeGreaterThan(afterWheel.camera.orbit.azimuth)

    // Keyboard-only navigation stays inside the clamped bounds.
    await page.evaluate(() => {
      const controls = window.citySceneHarness.pipeline.controls
      for (let index = 0; index < 60; index += 1) {
        controls.zoomBy(2)
      }
    })
    const clamped = await readState(page)
    const boundsMin = await page.evaluate(
      () => window.citySceneHarness.pipeline.controls.bounds.orbitRadius.min,
    )
    expect(clamped.camera.orbit.radius).toBeGreaterThanOrEqual(boundsMin)
    expect(clamped.camera.orbit.radius).toBeLessThanOrEqual(boundsMin + 0.5)

    // A preset restores a viewpoint by value.
    await page.evaluate(() => {
      window.citySceneHarness.pipeline.setCameraState({
        mode: 'street',
        street: { position: [4, 2.4, 18], heading: 0.35, pitch: -0.1 },
      })
    })
    const restored = await readState(page)
    expect(restored.cameraMode).toBe('street')
    expect(restored.camera.street.position[0]).toBeCloseTo(4, 3)
    expect(restored.camera.street.heading).toBeCloseTo(0.35, 3)
    expect(restored.camera.street.pitch).toBeCloseTo(-0.1, 3)

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('navigates with real touch input in a touch-enabled browser', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 900, height: 700 },
      hasTouch: true,
      isMobile: false,
    })
    const page = await context.newPage()
    const watch = watchPage(page)
    await openHarness(page)

    const box = await page.locator('#canvas').boundingBox()
    expect(box).not.toBeNull()
    const centerX = (box?.x ?? 0) + (box?.width ?? 0) / 2
    const centerY = (box?.y ?? 0) + (box?.height ?? 0) / 2
    const before = await readState(page)

    const client = await context.newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: centerX, y: centerY, id: 1 }],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: centerX + 90, y: centerY + 20, id: 1 }],
    })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    const after = await readState(page)
    expect(after.camera.orbit.azimuth).toBeLessThan(before.camera.orbit.azimuth)
    expect(after.camera.orbit.polar).toBeLessThan(before.camera.orbit.polar)

    // Two-finger pinch zoom through the same input pipeline.
    const beforePinch = await readState(page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: centerX - 60, y: centerY, id: 1 },
        { x: centerX + 60, y: centerY, id: 2 },
      ],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: centerX - 20, y: centerY, id: 1 },
        { x: centerX + 20, y: centerY, id: 2 },
      ],
    })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const afterPinch = await readState(page)
    expect(afterPinch.camera.orbit.radius).toBeGreaterThan(beforePinch.camera.orbit.radius)

    expect(watch.pageErrors).toEqual([])
    await context.close()
  })

  test('switches quality tiers and rebuilds the effect chain', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    const high = await readState(page)
    expect(high.quality).toBe('high')
    expect(high.effects).toEqual(['depthOfField', 'bloom', 'colorGrade', 'vignette'])
    expect(high.shadowMapSize).toBe(2048)
    expect(high.postProcessingActive).toBe(true)
    expect(high.postProcessingFailure).toBeNull()

    await page.evaluate(() => window.citySceneHarness.setQualityTier('medium'))
    const medium = await readState(page)
    expect(medium.quality).toBe('medium')
    expect(medium.effects).toEqual(['bloom', 'colorGrade', 'vignette'])
    expect(medium.shadowMapSize).toBe(1024)
    expect(medium.postProcessingActive).toBe(true)

    const framesBefore = (await readStats(page)).frames
    await page.evaluate(() => window.citySceneHarness.setQualityTier('low'))
    const low = await readState(page)
    expect(low.quality).toBe('low')
    expect(low.effects).toEqual([])
    expect(low.passOrder).toEqual([])
    expect(low.shadowMapSize).toBe(512)
    // The cheap tier falls back to direct rendering instead of throwing.
    expect(low.postProcessingActive).toBe(false)

    const luminance = await measureLuminance(page)
    expect(luminance.average).toBeGreaterThan(0)
    const framesAfter = (await readStats(page)).frames
    expect(framesAfter).toBeGreaterThan(framesBefore)

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('reports rolling frame time and average fps through instrumentation', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    await expect.poll(async () => (await readStats(page)).frames, { timeout: 15_000 }).toBeGreaterThan(20)
    const stats = await readStats(page)
    expect(Number.isFinite(stats.averageFrameTimeMs)).toBe(true)
    expect(stats.averageFrameTimeMs).toBeGreaterThan(0)
    expect(stats.averageFps).toBeGreaterThan(0)
    expect(stats.averageFps).toBeCloseTo(1000 / stats.averageFrameTimeMs, 1)
    expect(stats.budgetMs).toBeCloseTo(1000 / 60, 1)
    expect(stats.minFrameTimeMs).toBeGreaterThanOrEqual(0)
    expect(stats.maxFrameTimeMs).toBeGreaterThanOrEqual(stats.minFrameTimeMs)
    expect(stats.frames).toBe(stats.hookFrames)

    // Manual stepping drives the same instrumentation path.
    await page.evaluate(() => window.citySceneHarness.step(5))
    // The animation loop runs alongside the manual steps, so the frame count
    // must advance by at least the frames that were stepped by hand.
    await expect
      .poll(async () => (await readStats(page)).frames, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(stats.frames + 5)
    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('degrades gracefully when post-processing is switched off', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    await page.evaluate(() => window.citySceneHarness.setPostProcessing({ enabled: false }))
    const state = await readState(page)
    expect(state.postProcessingActive).toBe(false)
    expect(state.passOrder).toEqual([])

    const luminance = await measureLuminance(page)
    expect(luminance.average).toBeGreaterThan(2)

    await page.evaluate(() => window.citySceneHarness.setPostProcessing({ enabled: true }))
    const restored = await readState(page)
    expect(restored.postProcessingActive).toBe(true)
    expect(restored.passOrder).toEqual(['depthOfField', 'bloom', 'colorGrade', 'vignette'])

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('changes the rendered image when the lighting parameters change', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    const day = await page.evaluate(() => {
      const harness = window.citySceneHarness
      harness.setLighting(harness.lightingPresets.day ?? {})
      return harness.measureLuminance()
    })
    const dayState = await readState(page)

    const night = await page.evaluate(() => {
      const harness = window.citySceneHarness
      harness.setLighting({ ...(harness.lightingPresets.night ?? {}), night: true })
      return harness.measureLuminance()
    })
    const nightState = await readState(page)

    expect(dayState.sunIntensity).not.toBeCloseTo(nightState.sunIntensity, 3)
    expect(dayState.sunColor).not.toBe(nightState.sunColor)
    expect(dayState.background).not.toBe(nightState.background)
    expect(dayState.sunIntensity).toBeGreaterThan(nightState.sunIntensity)
    expect(day.average).toBeGreaterThan(night.average + 6)

    // A second palette (golden hour) lands between the two extremes.
    const golden = await page.evaluate(() => {
      const harness = window.citySceneHarness
      harness.setLighting({ ...(harness.lightingPresets.goldenHour ?? {}), night: false })
      return harness.measureLuminance()
    })
    const goldenState = await readState(page)
    expect(goldenState.sunColor).not.toBe(dayState.sunColor)
    expect(golden.average).toBeGreaterThan(night.average)

    expect(watch.pageErrors).toEqual([])
    expect(watch.consoleErrors).toEqual([])
  })

  test('recovers from a lost WebGL context', async ({ page }) => {
    const watch = watchPage(page)
    await openHarness(page)

    await page.evaluate(() => {
      const gl = window.citySceneHarness.pipeline.renderer.getContext()
      const extension = gl.getExtension('WEBGL_lose_context')
      if (extension === null) {
        throw new Error('WEBGL_lose_context is unavailable in this browser')
      }
      const scope = window as unknown as {
        __loseContext: () => void
        __restoreContext: () => void
      }
      scope.__loseContext = () => {
        extension.loseContext()
      }
      scope.__restoreContext = () => {
        extension.restoreContext()
      }
    })

    const framesBeforeLoss = (await readStats(page)).frames
    await page.evaluate(() => (window as unknown as { __loseContext: () => void }).__loseContext())
    await expect.poll(async () => (await readState(page)).contextLost, { timeout: 10_000 }).toBe(true)

    await page.evaluate(() => (window as unknown as { __restoreContext: () => void }).__restoreContext())
    await expect.poll(async () => (await readState(page)).contextLost, { timeout: 20_000 }).toBe(false)
    await expect
      .poll(async () => (await readStats(page)).frames, { timeout: 20_000 })
      .toBeGreaterThan(framesBeforeLoss + 5)

    const recovered = await readState(page)
    expect(recovered.context.available).toBe(true)
    expect(recovered.running).toBe(true)
    const luminance = await measureLuminance(page)
    expect(luminance.average).toBeGreaterThan(0)

    // A lost context may log GL warnings, but must never raise an uncaught error.
    expect(watch.pageErrors).toEqual([])
  })
})

