/**
 * Browser proof of the navigation, inspection, tour, shortcut and adaptive
 * quality layer, inside the *running* composed application.
 *
 * The unit and composition suites prove the maths and the wiring; this spec
 * drives the real page through the real extension slot:
 *
 * - all four extension modules register through `src/interaction/extensions/*.tsx`
 *   (their feature ids and their panels are present, and no composition file
 *   lists them);
 * - each named viewpoint moves the camera and leaves the era alone;
 * - clicking a real object through the composition's published
 *   inspection-targets surface opens an info card naming its category, owning
 *   layer and the era on screen, and `Esc` or a click on empty space releases it;
 * - the cinematic tour walks the sidewalk and any input stops it and restores the
 *   camera it started from;
 * - the keyboard map drives camera modes, viewpoints, era stepping and mute;
 * - the camera does not reset when the era changes;
 * - a manual tier chosen in the overlay suspends the adaptive controller, and
 *   handing quality back resumes it.
 *
 * Probes are how the spec clicks: the interaction surface publishes, per
 * category, the pixel a click resolves to that category at, computed from the
 * published measured bounds. The spec clicks there with the mouse, so the pick
 * path under test is the real one, not a shortcut. Reduced motion is switched on
 * before the era phases so the timeline steps cost a swap rather than a morph.
 */

import { expect, test, type Page } from '@playwright/test'
import { getEra } from '../src/era'

// Software rasterisation plus several era rebuilds is slow by nature.
test.describe.configure({ timeout: 280_000 })

/* -------------------------------------------------------------------------- */
/* Debug surfaces                                                             */
/* -------------------------------------------------------------------------- */

interface CameraStateShape {
  readonly mode: string
  readonly target: readonly number[]
  readonly orbit: { readonly azimuth: number; readonly polar: number; readonly radius: number }
  readonly street: {
    readonly position: readonly number[]
    readonly heading: number
    readonly pitch: number
  }
}

interface InspectorCardShape {
  readonly targetId: string
  readonly category: string
  readonly categoryLabel: string
  readonly layerId: string
  readonly layerLabel: string
  readonly eraId: string
  readonly description: string
}

interface ViewpointShape {
  readonly id: string
  readonly label: string
  readonly anchorName: string | null
  readonly eyeHeight: number
  readonly withinBounds: boolean
  readonly camera: CameraStateShape
}

interface ProbeShape {
  readonly targetId: string
  readonly category: string
  readonly layerId: string
  readonly label: string
  readonly x: number
  readonly y: number
}

interface InteractionSnapshot {
  readonly features: readonly string[]
  readonly eraId: string
  readonly qualityTier: string
  readonly camera: CameraStateShape
  readonly cameraMotion: { readonly kind: string; readonly progress: number } | null
  readonly viewpoints: readonly ViewpointShape[]
  readonly activeViewpoint: string | null
  readonly tour: {
    readonly active: boolean
    readonly available: boolean
    readonly routeName: string | null
    readonly stationCount: number
    readonly distance: number
  }
  readonly inspector: {
    readonly focusedId: string | null
    readonly focusedCategory: string | null
    readonly card: InspectorCardShape | null
  }
  readonly quality: {
    readonly tier: string
    readonly manualOverride: boolean
    readonly suspended: boolean
    readonly changes: number
    readonly lastReason: string
  }
  readonly viewport: { readonly width: number; readonly height: number }
  readonly frame: number
}

interface CompositionSnapshot {
  readonly eraId: string
  readonly transitioning: boolean
  readonly camera: CameraStateShape
  readonly inspection: {
    readonly count: number
    readonly anchorCount: number
    readonly objectCount: number
    readonly categories: readonly string[]
  }
  readonly mountedLayers: readonly string[]
  readonly loading: { readonly ready: boolean }
}

interface InteractionSurfaceShape {
  read(): InteractionSnapshot
  probes(options?: {
    readonly categories?: readonly string[]
    readonly perCategory?: number
  }): readonly ProbeShape[]
}

async function readInteraction(page: Page): Promise<InteractionSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapseInteraction?: InteractionSurfaceShape })
      .__cityTimelapseInteraction
    return (surface?.read() ?? null) as unknown as InteractionSnapshot | null
  })
}

async function requireInteraction(page: Page): Promise<InteractionSnapshot> {
  const snapshot = await readInteraction(page)
  if (snapshot === null) {
    throw new Error('The interaction surface is not on window.__cityTimelapseInteraction.')
  }
  return snapshot
}

async function readProbes(
  page: Page,
  categories: readonly string[] | null,
): Promise<readonly ProbeShape[]> {
  return page.evaluate((wanted: readonly string[] | null) => {
    const surface = (window as unknown as { __cityTimelapseInteraction?: InteractionSurfaceShape })
      .__cityTimelapseInteraction
    if (surface === undefined) {
      return []
    }
    return surface.probes(wanted === null ? { perCategory: 32 } : { categories: wanted, perCategory: 32 })
  }, categories)
}

async function readComposition(page: Page): Promise<CompositionSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (surface?.read() ?? null) as unknown as CompositionSnapshot | null
  })
}

function cameraKey(camera: CameraStateShape): string {
  return JSON.stringify(camera)
}

/** Waits until no authored camera move is in flight. */
async function waitForCameraSettled(page: Page): Promise<InteractionSnapshot> {
  await expect
    .poll(async () => (await readInteraction(page))?.cameraMotion === null, { timeout: 30_000 })
    .toBe(true)
  return requireInteraction(page)
}

/** Waits until an object is focused, returning the snapshot for assertions. */
async function waitForFocus(page: Page, targetId: string): Promise<InteractionSnapshot> {
  await expect
    .poll(async () => (await readInteraction(page))?.inspector.focusedId ?? null, { timeout: 20_000 })
    .toBe(targetId)
  return requireInteraction(page)
}

async function waitForRelease(page: Page): Promise<void> {
  await expect
    .poll(async () => (await readInteraction(page))?.inspector.focusedId ?? null, { timeout: 20_000 })
    .toBeNull()
}

/**
 * Makes the canvas reachable by the mouse, so a click really picks.
 *
 * The overlay re-enables pointer events on each of its panels, so the whole
 * subtree has to be disabled — the timeline otherwise covers the top of the
 * canvas, where a probe may legitimately sit.
 */
async function setCanvasClickable(page: Page, clickable: boolean): Promise<void> {
  await page.evaluate((enabled: boolean) => {
    document.getElementById('e2e-canvas-clicks')?.remove()
    if (!enabled) {
      return
    }
    const style = document.createElement('style')
    style.id = 'e2e-canvas-clicks'
    style.textContent =
      '.ui-overlay, .ui-overlay *, [data-testid$="-panel"], [data-testid$="-panel"] * { pointer-events: none !important; }'
    document.head.append(style)
  }, clickable)
}

/** Clicks a probe's pixel on the canvas. */
async function clickCanvasPoint(page: Page, x: number, y: number): Promise<void> {
  const canvas = await page.getByTestId('scene-canvas-surface').boundingBox()
  if (canvas === null) {
    throw new Error('The scene canvas is not visible.')
  }
  await page.mouse.click(canvas.x + x, canvas.y + y)
}

/** The clickable probe closest to the middle of the frame. */
function probeNearestCentre(
  probes: readonly ProbeShape[],
  viewport: { readonly width: number; readonly height: number },
): ProbeShape | null {
  if (probes.length === 0) {
    return null
  }
  const cx = viewport.width / 2
  const cy = viewport.height / 2
  return probes.reduce((best, probe) =>
    Math.hypot(probe.x - cx, probe.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? probe : best,
  )
}

/* -------------------------------------------------------------------------- */
/* The journey                                                                */
/* -------------------------------------------------------------------------- */

test('navigation, inspection, tour, shortcuts and adaptive quality in the composed app', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  // `?tier=low` is a dev-only deep link: it also records a *manual* tier choice,
  // which is exactly the state the adaptive controller must defer to.
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readComposition(page))?.loading.ready ?? false, { timeout: 150_000 })
    .toBe(true)
  await expect
    .poll(async () => (await readInteraction(page))?.frame ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(0)

  /* ---------------------------------------------------------------------- */
  /* Every extension registered through the composition's slot              */
  /* ---------------------------------------------------------------------- */

  await expect
    .poll(async () => (await readInteraction(page))?.features ?? [], { timeout: 60_000 })
    .toEqual(['inspection', 'quality', 'tour', 'viewpoints'])
  await expect(page.getByTestId('viewpoint-panel')).toBeVisible()
  await expect(page.getByTestId('tour-panel')).toBeVisible()
  await expect(page.getByTestId('adaptive-quality')).toBeVisible()
  const composition = await readComposition(page)
  expect(composition?.inspection.count ?? 0).toBeGreaterThan(0)
  expect(composition?.inspection.anchorCount ?? 0).toBeGreaterThan(0)
  expect(composition?.mountedLayers).toEqual(
    expect.arrayContaining(['layout', 'atmosphere', 'storefronts', 'props', 'vehicles']),
  )

  // The first-use panel covers the middle of the screen; close it as a viewer would.
  if ((await page.getByTestId('overlay-dismiss').count()) > 0) {
    await page.getByTestId('overlay-dismiss').click()
  }

  // The interaction panels must not sit under the overlay's own panels, or the
  // viewer could see them but never click them.
  const panelIds = ['viewpoint-panel', 'tour-panel', 'adaptive-quality'] as const
  const overlayIds = ['timeline', 'hud', 'overlay-controls', 'controls-legend'] as const
  const overlayBoxes = (await Promise.all(overlayIds.map((id) => page.getByTestId(id).boundingBox()))).filter(
    (box): box is NonNullable<typeof box> => box !== null,
  )
  for (const id of panelIds) {
    const box = await page.getByTestId(id).boundingBox()
    expect(box, id).not.toBeNull()
    if (box === null) {
      continue
    }
    const viewportSize = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    expect(box.x, id).toBeGreaterThanOrEqual(0)
    expect(box.y, id).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, id).toBeLessThanOrEqual(viewportSize.width)
    expect(box.y + box.height, id).toBeLessThanOrEqual(viewportSize.height)
    for (const overlay of overlayBoxes) {
      const overlaps =
        box.x < overlay.x + overlay.width &&
        box.x + box.width > overlay.x &&
        box.y < overlay.y + overlay.height &&
        box.y + box.height > overlay.y
      expect(overlaps, `${id} overlaps the overlay`).toBe(false)
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Named viewpoints move the camera and leave the era alone               */
  /* ---------------------------------------------------------------------- */

  const mounted = await requireInteraction(page)
  expect(mounted.viewpoints.map((viewpoint) => viewpoint.id)).toEqual([
    'street-corner',
    'curb-crossing',
    'storefront-closeup',
    'rooftop',
    'aerial',
  ])
  for (const viewpoint of mounted.viewpoints) {
    expect(viewpoint.withinBounds, viewpoint.id).toBe(true)
    // Every framing but the aerial one is derived from a real layout anchor.
    if (viewpoint.id !== 'aerial') {
      expect(viewpoint.anchorName, viewpoint.id).not.toBeNull()
    }
  }
  expect(mounted.viewpoints.find((viewpoint) => viewpoint.id === 'aerial')?.eyeHeight ?? 0).toBeGreaterThan(40)

  const eraBeforeViewpoints = mounted.eraId
  let previousCamera = cameraKey(mounted.camera)
  for (const viewpoint of mounted.viewpoints) {
    await page.getByTestId(`viewpoint-${viewpoint.id}`).click()
    const settled = await waitForCameraSettled(page)
    expect(settled.activeViewpoint, viewpoint.id).toBe(viewpoint.id)
    expect(cameraKey(settled.camera), `${viewpoint.id} moved the camera`).not.toBe(previousCamera)
    // The camera settled on that viewpoint's own framing.
    const framing = settled.viewpoints.find((candidate) => candidate.id === viewpoint.id)
    expect(framing?.camera.orbit.radius ?? 0, viewpoint.id).toBeCloseTo(
      settled.camera.orbit.radius,
      3,
    )
    expect(settled.eraId, `${viewpoint.id} kept the era`).toBe(eraBeforeViewpoints)
    previousCamera = cameraKey(settled.camera)
  }
  expect((await readComposition(page))?.eraId).toBe(eraBeforeViewpoints)

  /* ---------------------------------------------------------------------- */
  /* Click-to-focus inspection through the published surface                */
  /* ---------------------------------------------------------------------- */

  await setCanvasClickable(page, true)
  const viewport = (await requireInteraction(page)).viewport

  // The surface publishes more kinds of focusable thing than this loop clicks.
  const allProbes = await readProbes(page, null)
  const probeCategories = [...new Set(allProbes.map((probe) => probe.category))]
  expect(probeCategories.length).toBeGreaterThan(4)
  for (const required of ['building', 'storefront', 'vehicle', 'prop']) {
    expect(probeCategories, `a clickable ${required}`).toContain(required)
  }

  const clicked: string[] = []
  for (const category of ['building', 'storefront', 'vehicle', 'prop']) {
    let probes = await readProbes(page, [category])
    if (probes.length === 0) {
      // Some categories sit better in a different framing; try a closer one.
      await page.getByTestId('viewpoint-street-corner').click()
      await waitForCameraSettled(page)
      probes = await readProbes(page, [category])
    }
    const probe = probeNearestCentre(probes, viewport)
    expect(probe, category).not.toBeNull()
    if (probe === null) {
      continue
    }
    await clickCanvasPoint(page, probe.x, probe.y)
    const focused = await waitForFocus(page, probe.targetId)
    const card = focused.inspector.card
    expect(card, category).not.toBeNull()
    expect(card?.category, category).toBe(category)
    expect(card?.layerId, category).toBe(probe.layerId)
    expect(card?.eraId, category).toBe(focused.eraId)
    expect(card?.description, category).toContain(getEra(focused.eraId).label)
    // On screen, naming the category, the owning layer and the era.
    await expect(page.getByTestId('inspector-card')).toBeVisible()
    await expect(page.getByTestId('inspector-category')).toHaveText(card?.categoryLabel ?? '')
    await expect(page.getByTestId('inspector-layer')).toContainText(card?.layerLabel ?? '')
    await expect(page.getByTestId('inspector-era')).toContainText(getEra(focused.eraId).shortLabel)
    clicked.push(category)

    if (category === 'building') {
      // Escape releases the focus and returns the camera.
      await page.keyboard.press('Escape')
      await waitForRelease(page)
      await expect(page.getByTestId('inspector-card')).toHaveCount(0)
      await waitForCameraSettled(page)
    }
  }
  expect(clicked).toEqual(['building', 'storefront', 'vehicle', 'prop'])

  // Clicking empty sky releases the focus too.
  const canvas = await page.getByTestId('scene-canvas-surface').boundingBox()
  expect(canvas).not.toBeNull()
  if (canvas !== null) {
    await clickCanvasPoint(page, canvas.width * 0.04, canvas.height * 0.05)
    await waitForRelease(page)
    await waitForCameraSettled(page)
  }
  await setCanvasClickable(page, false)

  /* ---------------------------------------------------------------------- */
  /* The cinematic tour                                                     */
  /* ---------------------------------------------------------------------- */

  const beforeTour = await waitForCameraSettled(page)
  expect(beforeTour.tour.available).toBe(true)
  expect(beforeTour.tour.stationCount).toBeGreaterThan(0)
  expect(beforeTour.tour.routeName).toContain('sidewalk')
  const tourStartCamera = cameraKey(beforeTour.camera)

  await page.getByTestId('tour-toggle').click()
  await expect
    .poll(async () => (await readInteraction(page))?.tour.active ?? false, { timeout: 30_000 })
    .toBe(true)
  // The autopilot moves: the camera changes and the route advances.
  await expect
    .poll(
      async () => {
        const snapshot = await readInteraction(page)
        return snapshot === null ? null : cameraKey(snapshot.camera)
      },
      { timeout: 60_000 },
    )
    .not.toBe(tourStartCamera)
  await expect
    .poll(async () => (await readInteraction(page))?.tour.distance ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(1)

  // Any input stops it and the camera comes back to where it started.
  await page.keyboard.press('KeyZ')
  await expect
    .poll(async () => (await readInteraction(page))?.tour.active ?? true, { timeout: 30_000 })
    .toBe(false)
  await waitForCameraSettled(page)
  await expect
    .poll(
      async () => {
        const snapshot = await readInteraction(page)
        return snapshot === null ? null : cameraKey(snapshot.camera)
      },
      { timeout: 30_000 },
    )
    .toBe(tourStartCamera)

  /* ---------------------------------------------------------------------- */
  /* Keyboard map, and the camera across an era switch                      */
  /* ---------------------------------------------------------------------- */

  // Camera modes and a viewpoint shortcut.
  await page.keyboard.press('KeyC')
  await expect
    .poll(async () => (await readInteraction(page))?.camera.mode ?? '', { timeout: 20_000 })
    .toBe('street')
  await page.keyboard.press('KeyO')
  await expect
    .poll(async () => (await readInteraction(page))?.camera.mode ?? '', { timeout: 20_000 })
    .toBe('orbit')
  await page.keyboard.press('Digit5')
  expect((await waitForCameraSettled(page)).activeViewpoint).toBe('aerial')

  // Mute.
  const mutedBefore = await page.getByTestId('audio-mute').getAttribute('aria-pressed')
  await page.keyboard.press('KeyN')
  await expect
    .poll(async () => page.getByTestId('audio-mute').getAttribute('aria-pressed'), { timeout: 20_000 })
    .not.toBe(mutedBefore)

  // From here on reduced motion makes each era step a swap, not a morph.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(async () => page.getByTestId('ui-overlay').getAttribute('data-reduced-motion'))
    .toBe('true')

  // Era stepping, then camera continuity across an era switch.
  const eraStart = (await requireInteraction(page)).eraId
  await page.keyboard.press('BracketRight')
  await expect
    .poll(async () => (await readInteraction(page))?.eraId ?? '', { timeout: 90_000 })
    .not.toBe(eraStart)
  await expect
    .poll(async () => (await readComposition(page))?.transitioning ?? true, { timeout: 90_000 })
    .toBe(false)
  const beforeEraSwitch = await requireInteraction(page)
  const cameraAcrossEra = cameraKey(beforeEraSwitch.camera)
  const targetEra = beforeEraSwitch.eraId === '2025' ? '1965' : '2025'
  await page.locator(`[data-testid="timeline-stop"][data-era-id="${targetEra}"]`).dispatchEvent('click')
  await expect
    .poll(async () => (await readComposition(page))?.eraId ?? '', { timeout: 120_000 })
    .toBe(targetEra)
  await expect
    .poll(async () => (await readComposition(page))?.transitioning ?? true, { timeout: 120_000 })
    .toBe(false)
  const afterEraSwitch = await requireInteraction(page)
  expect(afterEraSwitch.eraId).toBe(targetEra)
  expect(cameraKey(afterEraSwitch.camera), 'the camera did not reset on the era switch').toBe(
    cameraAcrossEra,
  )

  /* ---------------------------------------------------------------------- */
  /* Manual override precedence and the adaptive controller                 */
  /* ---------------------------------------------------------------------- */

  await page.getByTestId('quality-low').click()
  const manual = await requireInteraction(page)
  expect(manual.quality.manualOverride).toBe(true)
  expect(manual.quality.suspended).toBe(true)
  expect(manual.quality.tier).toBe('low')
  await expect(page.getByTestId('adaptive-quality')).toHaveAttribute('data-mode', 'manual')
  await expect(page.getByTestId('quality-status')).toHaveText(/manual/i)

  // The `Q` shortcut cycles the tier by hand, which keeps the override on.
  await page.keyboard.press('KeyQ')
  await expect
    .poll(async () => (await readInteraction(page))?.qualityTier ?? 'low', { timeout: 30_000 })
    .not.toBe('low')
  const cycled = await requireInteraction(page)
  expect(cycled.quality.manualOverride).toBe(true)
  expect(cycled.quality.suspended).toBe(true)

  // Back to a cheap tier, then hand quality back to the controller: it resumes.
  await page.getByTestId('quality-low').click()
  await expect
    .poll(async () => (await readInteraction(page))?.qualityTier ?? '', { timeout: 30_000 })
    .toBe('low')
  await page.getByTestId('quality-auto').click()
  await expect
    .poll(async () => (await readInteraction(page))?.quality.manualOverride ?? true, { timeout: 30_000 })
    .toBe(false)
  await expect
    .poll(async () => (await readInteraction(page))?.quality.suspended ?? true, { timeout: 30_000 })
    .toBe(false)
  await expect(page.getByTestId('adaptive-quality')).toHaveAttribute('data-mode', 'automatic')
  expect((await readInteraction(page))?.qualityTier).toBe('low')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
