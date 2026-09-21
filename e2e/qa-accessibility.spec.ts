/**
 * Keyboard and assistive-technology accessibility of the timeline and overlay.
 *
 * The plan is explicit that this is not satisfied by automated colour-contrast
 * checks: the timeline has to be reachable and *operable* by keyboard alone, with
 * correct ARIA semantics and visible focus. This spec therefore does the things a
 * keyboard-only viewer would do, in the running application:
 *
 * - **First use is dismissible.** The introductory panel is a labelled dialog and
 *   its button works from the keyboard.
 * - **Everything is reachable by Tab.** The spec tabs through the page collecting
 *   what each stop focuses, and asserts the timeline slider, the year stops, the
 *   sound controls, all three quality tiers, the motion controls and the help
 *   legend are all in the tab order — and that the slider draws a visible focus
 *   ring when it holds focus.
 * - **The slider exposes slider semantics.** `role="slider"` with a name, an
 *   orientation, `aria-valuemin`/`aria-valuemax`/`aria-valuenow` that track the
 *   selected year, `aria-valuetext` naming the period, and `aria-describedby`
 *   pointing at real copy. The transition readout is a `progressbar` with its own
 *   value text, and the stops are real buttons with accessible names, the active
 *   one marked `aria-current`.
 * - **All five years are reachable by keyboard alone.** `Home`, four ArrowRight
 *   presses and `End` walk the timeline; after every key the year readout, the
 *   debug surface's era and the slider's `aria-valuenow`/`aria-valuetext` must
 *   agree. Enter on the active stop is a no-op rather than a surprise.
 * - **The info card is labelled and dismissible.** Clicking a real object opens a
 *   `role="dialog"` card with a labelled close button, and `Escape` — a keyboard
 *   action — releases it.
 *
 * Everything visited is written to `tests/qa/artifacts/era-accessibility.json`.
 */

import { expect, test, type Page } from '@playwright/test'
import { ERA_IDS, getEra } from '../src/era'
import type { EraId } from '../src/era'
import { writeJsonArtifact } from '../tests/qa/pixelBaseline'

test.describe.configure({ timeout: 280_000 })

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface FocusInfo {
  readonly testId: string | null
  readonly eraId: string | null
  readonly role: string | null
  readonly name: string | null
  readonly outlineStyle: string
  readonly outlineWidth: string
}

async function focused(page: Page): Promise<FocusInfo | null> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (!(element instanceof HTMLElement)) {
      return null
    }
    const style = getComputedStyle(element)
    return {
      testId: element.getAttribute('data-testid'),
      eraId: element.getAttribute('data-era-id'),
      role: element.getAttribute('role'),
      name: element.getAttribute('aria-label') ?? (element.textContent ?? '').trim().slice(0, 48),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    }
  })
}

interface DebugSnapshot {
  readonly eraId: EraId
  readonly transitioning: boolean
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

interface Probe {
  readonly targetId: string
  readonly category: string
  readonly x: number
  readonly y: number
}

async function readProbes(page: Page): Promise<readonly Probe[]> {
  return page.evaluate(() => {
    const surface = (
      window as unknown as {
        __cityTimelapseInteraction?: { probes(options?: unknown): unknown }
      }
    ).__cityTimelapseInteraction
    return (surface?.probes({ perCategory: 24 }) ?? []) as Probe[]
  })
}

interface InteractionSnapshot {
  readonly inspector: { readonly focusedId: string | null; readonly card: unknown }
}

async function readInteraction(page: Page): Promise<InteractionSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapseInteraction?: { read(): unknown } })
      .__cityTimelapseInteraction
    return (surface?.read() ?? null) as unknown as InteractionSnapshot | null
  })
}

/** Lets the pointer reach the canvas past the overlay panels, as a viewer's click must. */
async function setCanvasClickable(page: Page, clickable: boolean): Promise<void> {
  await page.evaluate((enabled: boolean) => {
    document.getElementById('qa-canvas-clicks')?.remove()
    if (!enabled) {
      return
    }
    const style = document.createElement('style')
    style.id = 'qa-canvas-clicks'
    style.textContent =
      '.ui-overlay, .ui-overlay *, [data-testid$="-panel"], [data-testid$="-panel"] * { pointer-events: none !important; }'
    document.head.append(style)
  }, clickable)
}

/* -------------------------------------------------------------------------- */
/* The journey                                                                */
/* -------------------------------------------------------------------------- */

test('the timeline and overlay are fully keyboard operable with correct ARIA semantics', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?tier=low', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, { timeout: 150_000, intervals: [250, 500, 1000] })
    .toBe(true)

  /* ---------------------------------------------------------------------- */
  /* First use is a labelled dialog, dismissible from the keyboard          */
  /* ---------------------------------------------------------------------- */

  const firstUse = page.getByTestId('overlay-first-use')
  await expect(firstUse).toBeVisible()
  await expect(firstUse).toHaveAttribute('role', 'dialog')
  await expect(firstUse).toHaveAccessibleName(/getting started/i)
  const dismiss = page.getByTestId('overlay-dismiss')
  await expect(dismiss).toHaveAccessibleName(/\S/)
  await dismiss.focus()
  expect((await focused(page))?.testId, 'the dismiss button takes focus').toBe('overlay-dismiss')
  await page.keyboard.press('Enter')
  await expect(firstUse).toHaveCount(0)

  /* ---------------------------------------------------------------------- */
  /* Overlay controls are labelled groups with accessible names             */
  /* ---------------------------------------------------------------------- */

  const controls = page.getByTestId('overlay-controls')
  await expect(controls).toHaveAttribute('role', 'group')
  await expect(controls).toHaveAccessibleName(/experience controls/i)
  // The fieldsets take their accessible name from their own legend element.
  await expect(page.getByTestId('quality-controls')).toHaveAccessibleName(/quality/i)
  await expect(page.getByTestId('motion-controls')).toHaveAccessibleName(/motion/i)
  await expect(page.getByTestId('audio-unlock')).toHaveAccessibleName(/enable sound/i)
  await expect(page.getByTestId('audio-mute')).toHaveAccessibleName(/mute/i)
  await expect(page.getByTestId('quality-high')).toHaveAccessibleName(/high/i)
  await expect(page.getByTestId('quality-medium')).toHaveAccessibleName(/medium/i)
  await expect(page.getByTestId('quality-low')).toHaveAccessibleName(/low/i)
  await expect(page.getByTestId('motion-system')).toHaveAccessibleName(/follow system/i)
  // The press state of every toggle is exposed, not just its label.
  await expect(page.getByTestId('audio-mute')).toHaveAttribute('aria-pressed', /true|false/)
  await expect(page.getByTestId('quality-high')).toHaveAttribute('aria-pressed', /true|false/)
  await expect(page.getByTestId('motion-system')).toHaveAttribute('aria-pressed', /true|false/)

  const legend = page.getByTestId('controls-legend')
  await expect(legend).toHaveAttribute('role', 'region')
  await expect(legend).toHaveAccessibleName(/controls help/i)
  const legendToggle = page.getByTestId('legend-toggle')
  expect(await legendToggle.getAttribute('aria-controls'), 'the toggle names the panel it controls').toBeTruthy()

  /* ---------------------------------------------------------------------- */
  /* Tab reachability, and a visible focus ring                             */
  /* ---------------------------------------------------------------------- */

  const required = [
    'timeline-slider',
    'timeline-stop',
    'audio-unlock',
    'audio-mute',
    'quality-high',
    'quality-medium',
    'quality-low',
    'motion-system',
    'legend-toggle',
  ] as const

  const visited = new Set<string>()
  const order: (FocusInfo | null)[] = []
  let sliderFocus: FocusInfo | null = null
  // Start the walk from the top of the document rather than from whatever the
  // previous assertion happened to leave focused.
  await page.evaluate(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement) {
      active.blur()
    }
  })
  for (let press = 0; press < 45; press += 1) {
    await page.keyboard.press('Tab')
    const focus = await focused(page)
    order.push(focus)
    if (focus?.testId !== null && focus?.testId !== undefined) {
      visited.add(focus.testId)
    }
    if (focus?.testId === 'timeline-slider' && sliderFocus === null) {
      sliderFocus = focus
    }
    if (required.every((id) => visited.has(id))) {
      break
    }
  }

  for (const id of required) {
    expect([...visited], `${id} is reachable by Tab`).toContain(id)
  }
  expect(sliderFocus, 'the timeline slider is in the tab order').not.toBeNull()
  expect(sliderFocus?.outlineStyle, 'focused slider draws a solid outline').toBe('solid')
  expect(Number.parseFloat(sliderFocus?.outlineWidth ?? '0'), 'the focus ring is visible').toBeGreaterThanOrEqual(2)

  /* ---------------------------------------------------------------------- */
  /* The help legend opens and closes from the keyboard                     */
  /* ---------------------------------------------------------------------- */

  const expandedBefore = await legendToggle.getAttribute('aria-expanded')
  const legendPanel = page.getByTestId('legend-panel')
  const startedHidden = await legendPanel.isHidden()
  await legendToggle.focus()
  expect((await focused(page))?.testId, 'the legend toggle takes focus').toBe('legend-toggle')
  await page.keyboard.press('Enter')
  await expect(legendToggle).not.toHaveAttribute('aria-expanded', expandedBefore ?? '')
  if (startedHidden) {
    await expect(legendPanel, 'Enter opens the panel it controls').toBeVisible()
  } else {
    await expect(legendPanel, 'Enter closes the panel it controls').toBeHidden()
  }
  await page.keyboard.press('Enter')
  await expect(legendToggle).toHaveAttribute('aria-expanded', expandedBefore ?? 'false')

  /* ---------------------------------------------------------------------- */
  /* Slider semantics                                                       */
  /* ---------------------------------------------------------------------- */

  const timeline = page.getByTestId('timeline')
  const slider = page.getByTestId('timeline-slider')
  await expect(timeline).toHaveAccessibleName(/era timeline/i)
  await expect(slider).toHaveAttribute('role', 'slider')
  await expect(slider).toHaveAccessibleName(/timeline year/i)
  await expect(slider).toHaveAttribute('aria-orientation', 'horizontal')
  await expect(slider).toHaveAttribute('aria-valuemin', '0')
  await expect(slider).toHaveAttribute('aria-valuemax', String(ERA_IDS.length - 1))

  const describedBy = await slider.getAttribute('aria-describedby')
  expect(describedBy, 'the slider is described by its own summary copy').toBeTruthy()
  await expect(page.locator(`#${describedBy ?? 'missing'}`)).not.toHaveCount(0)

  const progressbar = page.getByTestId('timeline-progressbar')
  await expect(progressbar).toHaveAttribute('role', 'progressbar')
  await expect(progressbar).toHaveAttribute('aria-valuemin', '0')
  await expect(progressbar).toHaveAttribute('aria-valuemax', '1')
  await expect(progressbar).toHaveAccessibleName(/progress/i)

  for (const eraId of ERA_IDS) {
    const era = getEra(eraId)
    await expect(
      page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`),
      `${eraId} stop has an accessible name`,
    ).toHaveAccessibleName(new RegExp(`${era.year}: `))
  }
  await expect(
    page.locator('[data-testid="timeline-stop"][data-era-id="1945"]'),
    'the active stop is marked for assistive technology',
  ).toHaveAttribute('aria-current', 'true')

  /* ---------------------------------------------------------------------- */
  /* Keyboard-only traversal of all five years                              */
  /* ---------------------------------------------------------------------- */

  const ariaAt = async (eraId: EraId, index: number): Promise<void> => {
    await waitForEra(page, eraId)
    const era = getEra(eraId)
    await expect(page.getByTestId('timeline-year-readout'), `${eraId} readout`).toHaveText(era.shortLabel)
    await expect(page.getByTestId('hud-year'), `${eraId} hud`).toHaveText(era.shortLabel)
    await expect(timeline, `${eraId} timeline`).toHaveAttribute('data-era-id', eraId)
    await expect(slider, `${eraId} slider value`).toHaveAttribute('aria-valuenow', String(index))
    await expect(slider, `${eraId} slider value text`).toHaveAttribute(
      'aria-valuetext',
      `${era.shortLabel} — ${era.label}`,
    )
    await expect(
      page.locator(`[data-testid="timeline-stop"][data-era-id="${eraId}"]`),
      `${eraId} stop is current`,
    ).toHaveAttribute('aria-current', 'true')
  }

  await slider.focus()
  expect((await focused(page))?.testId).toBe('timeline-slider')

  await page.keyboard.press('Home')
  await ariaAt('1945', 0)

  for (let index = 1; index < ERA_IDS.length; index += 1) {
    await page.keyboard.press('ArrowRight')
    const eraId = ERA_IDS[index]
    if (eraId !== undefined) {
      await ariaAt(eraId, index)
    }
  }

  await page.keyboard.press('End')
  await ariaAt('2025', ERA_IDS.length - 1)

  await page.keyboard.press('ArrowLeft')
  await ariaAt('2005', ERA_IDS.length - 2)

  // Enter on the active stop settles rather than moving the selection.
  const activeStop = page.locator('[data-testid="timeline-stop"][data-era-id="2005"]')
  await activeStop.focus()
  await page.keyboard.press('Enter')
  await ariaAt('2005', ERA_IDS.length - 2)

  /* ---------------------------------------------------------------------- */
  /* The info card is labelled and dismissible from the keyboard            */
  /* ---------------------------------------------------------------------- */

  const canvas = page.getByTestId('scene-canvas-surface')
  const box = await canvas.boundingBox()
  expect(box, 'the scene canvas is laid out').not.toBeNull()
  const probes = await readProbes(page)
  expect(probes.length, 'the interaction surface publishes pick probes').toBeGreaterThan(0)
  const centre = { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 }
  const nearest = probes.reduce((best, probe) =>
    Math.hypot(probe.x - centre.x, probe.y - centre.y) < Math.hypot(best.x - centre.x, best.y - centre.y)
      ? probe
      : best,
  )

  await setCanvasClickable(page, true)
  await page.mouse.click((box?.x ?? 0) + nearest.x, (box?.y ?? 0) + nearest.y)
  const card = page.getByTestId('inspector-card')
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('role', 'dialog')
  await expect(card).toHaveAccessibleName(/\S/)
  await expect(card.getByTestId('inspector-close')).toHaveAccessibleName(/\S/)
  await expect(page.getByTestId('inspector-category')).not.toHaveText(/^\s*$/)
  await expect
    .poll(async () => (await readInteraction(page))?.inspector.focusedId ?? null, { timeout: 30_000 })
    .toBe(nearest.targetId)

  // Escape is the documented keyboard release.
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)
  await setCanvasClickable(page, false)

  const artifact = writeJsonArtifact('era-accessibility.json', {
    generatedAt: new Date().toISOString(),
    tabOrder: order.map((focus) => focus?.testId ?? (focus === null ? null : 'unnamed')),
    visitedTestIds: [...visited],
    requiredTestIds: [...required],
    slider: {
      role: 'slider',
      orientation: 'horizontal',
      valueMin: 0,
      valueMax: ERA_IDS.length - 1,
      describedBy,
    },
    keyboardTraversal: ERA_IDS,
    focusedCard: nearest.targetId,
  })
  expect(artifact).toContain('era-accessibility.json')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
