/**
 * Accessibility contract of the timeline, HUD and overlay.
 *
 * These tests assert the things a screen-reader or keyboard-only viewer depends
 * on: slider semantics with a year-bearing value, an accessible name for every
 * control, visible focus rings from the real stylesheet, a non-empty help
 * legend, a polite year announcement, and reduced-motion handling.
 *
 * The stylesheet assertions inject `src/ui/styles.css` into jsdom and read the
 * computed style back, so "visible focus" is checked against the shipped CSS
 * rather than against a copy of it in the test.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { afterAll, describe, expect, it } from 'vitest'
import { getEra, type EraId } from '../../src/era'
import { createEraStore } from '../../src/state/eraStore'
import {
  LEGEND_GROUP_LABELS,
  LEGEND_GROUP_ORDER,
  Overlay,
  TimelineSlider,
  createUIControlsStore,
  type SceneStatus,
} from '../../src/ui'
import { act, renderWithProviders, screen, within } from '../support/render'

/**
 * The shipped stylesheet, read from disk (Vitest replaces CSS *imports* with an
 * empty module, so the file is read directly) — the style assertions below are
 * therefore made against the real CSS, not a copy kept in this test.
 */
const STYLESHEET_PATH = resolve(process.cwd(), 'src/ui/styles.css')
const stylesheetText = readFileSync(STYLESHEET_PATH, 'utf8')

let injectedStylesheet: HTMLStyleElement | null = null

/**
 * Declaration block of the shipped rule for `selector`.
 *
 * jsdom matches no `:focus`/`:focus-visible` pseudo-class in
 * `getComputedStyle`, so a focus ring cannot be computed here; reading the
 * shipped rule keeps the assertion tied to the CSS that actually ships.
 */
function outlineRuleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blocks = [...stylesheetText.matchAll(new RegExp(`[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`, 'g'))]
    .map((match) => match[1] ?? '')
    .filter((block) => /\boutline\b/.test(block))
  if (blocks.length === 0) {
    throw new Error(`The shipped stylesheet declares no outline for '${selector}'.`)
  }
  return blocks.join('\n')
}

/** Injects the shipped stylesheet once per file, so computed styles are real. */
function installStylesheet(): void {
  if (injectedStylesheet !== null) {
    return
  }
  const element = document.createElement('style')
  element.setAttribute('data-testid', 'ui-stylesheet')
  element.textContent = stylesheetText
  document.head.appendChild(element)
  injectedStylesheet = element
}

afterAll(() => {
  injectedStylesheet?.remove()
  injectedStylesheet = null
})

/** Renders the slider alone against fresh stores. */
function renderSlider(initialEra: EraId = '1945') {
  const eraStore = createEraStore(initialEra)
  const view = renderWithProviders(createElement(TimelineSlider, { eraStore }))
  return { eraStore, ...view }
}

/** Renders the whole overlay with the first-use panel already dismissed. */
function renderOverlay(status: SceneStatus = 'ready') {
  const eraStore = createEraStore('1945')
  const uiStore = createUIControlsStore({ overlayDismissed: true })
  const view = renderWithProviders(createElement(Overlay, { eraStore, uiStore, status }))
  return { eraStore, uiStore, ...view }
}

describe('timeline slider semantics', () => {
  it('exposes slider semantics with a year-bearing value text', () => {
    renderSlider()

    const slider = screen.getByRole('slider')

    expect(slider).toHaveAccessibleName('Timeline year')
    expect(slider).toHaveAttribute('aria-orientation', 'horizontal')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', String(4))
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('1945'))
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining(getEra('1945').label))
    expect(slider.getAttribute('aria-valuetext')).not.toBe(slider.getAttribute('aria-valuenow'))

    const min = Number(slider.getAttribute('aria-valuemin'))
    const max = Number(slider.getAttribute('aria-valuemax'))
    const now = Number(slider.getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThanOrEqual(min)
    expect(now).toBeLessThanOrEqual(max)
  })

  it('describes the slider with the era summary from the registry', () => {
    renderSlider('1985')

    const slider = screen.getByRole('slider')
    const describedBy = slider.getAttribute('aria-describedby')

    expect(describedBy).toBeTruthy()
    const summary = document.getElementById(describedBy ?? '')
    expect(summary).not.toBeNull()
    expect(summary).toHaveTextContent(getEra('1985').summary)
  })

  it('keeps the slider value in step with the store', async () => {
    const { eraStore, user } = renderSlider('1945')
    const slider = screen.getByRole('slider')

    act(() => {
      slider.focus()
    })
    await user.keyboard('{ArrowRight}')

    expect(eraStore.getState().selectedEra).toBe('1965')
    expect(slider).toHaveAttribute('aria-valuenow', '1')
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('1965'))

    await user.keyboard('{End}')

    expect(slider).toHaveAttribute('aria-valuenow', '4')
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('2025'))
  })

  it('labels every stop with its year and era name and marks the active one', () => {
    renderSlider('2005')

    const stops = screen.getAllByTestId('timeline-stop')

    expect(stops).toHaveLength(5)
    expect(stops.map((stop) => stop.getAttribute('aria-label'))).toEqual([
      '1945: Postwar Recovery',
      '1965: Mid-Century Boom',
      '1985: Neon Downtown',
      '2005: Digital Turn',
      '2025: Electric Present',
    ])
    expect(screen.getByRole('button', { name: '1985: Neon Downtown' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2005: Digital Turn' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    // Exactly one slider on the widget: the stops are buttons, not anonymous sliders.
    expect(screen.getAllByRole('slider')).toHaveLength(1)
  })

  it('is reachable with Tab and operable with the keyboard alone', async () => {
    const { eraStore, user } = renderSlider('1945')

    await user.tab()
    expect(screen.getByTestId('timeline-slider')).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(eraStore.getState().selectedEra).toBe('1965')

    await user.keyboard('{Home}')
    expect(eraStore.getState().selectedEra).toBe('1945')
  })

  it('names the timeline region and the progress bar it contains', () => {
    const { eraStore } = renderSlider('1945')

    const region = screen.getByRole('region', { name: 'Era timeline' })
    const progress = within(region).getByRole('progressbar')

    expect(progress).toHaveAccessibleName('Era transition progress')
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '1')

    act(() => {
      eraStore.getState().selectEra('2005')
    })
    act(() => {
      eraStore.getState().setProgress(0.25)
    })

    expect(within(region).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0.25')
    expect(within(region).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('1945'),
    )
  })

  it('gives the slider and every stop a visible focus ring', () => {
    installStylesheet()
    renderSlider()

    expect(outlineRuleFor('.timeline__slider:focus')).toMatch(/outline:\s*2px solid/)
    expect(outlineRuleFor('.timeline__slider:focus')).toMatch(/outline-offset/)
    expect(outlineRuleFor('.timeline__stop:focus')).toMatch(/outline:\s*2px solid/)
    expect(outlineRuleFor('.ui-button:focus')).toMatch(/outline:\s*2px solid/)

    const slider = screen.getByTestId('timeline-slider')
    expect(slider).toHaveAttribute('tabindex', '0')
    act(() => {
      slider.focus()
    })
    expect(document.activeElement).toBe(slider)

    const stop = screen.getAllByTestId('timeline-stop')[1]
    if (stop === undefined) {
      throw new Error('Expected a second timeline stop.')
    }
    expect(stop.tagName).toBe('BUTTON')
    act(() => {
      stop.focus()
    })
    expect(document.activeElement).toBe(stop)
    expect(document.activeElement).not.toBe(slider)
  })

  it('pins the timeline to the top of the viewport', () => {
    installStylesheet()
    renderSlider()

    const timeline = screen.getByTestId('timeline')
    const computed = window.getComputedStyle(timeline)

    expect(computed.position).toBe('fixed')
    expect(computed.top).toBe('0px')
  })

  it('announces the current year politely in the HUD', () => {
    installStylesheet()
    renderOverlay()

    const year = screen.getByTestId('hud-year')

    expect(year).toHaveAttribute('aria-live', 'polite')
    expect(year).toHaveTextContent('1945')
    expect(screen.getByTestId('hud-era-summary')).toHaveTextContent(getEra('1945').summary)
  })
})

describe('help legend', () => {
  it('renders a non-empty legend region covering every control family', () => {
    renderOverlay()

    const legend = screen.getByRole('region', { name: 'Controls help' })
    expect(legend).toBeVisible()

    const text = legend.textContent ?? ''
    expect(text.trim().length).toBeGreaterThan(0)
    expect(text).toMatch(/arrow keys/i)
    expect(text).toMatch(/home \/ end/i)
    expect(text).toMatch(/sound/i)
    expect(text).toMatch(/quality/i)
    expect(text).toMatch(/motion/i)

    for (const group of LEGEND_GROUP_ORDER) {
      expect(within(legend).getByText(LEGEND_GROUP_LABELS[group])).toBeInTheDocument()
    }
  })

  it('collapses and expands through the ui-controls store', async () => {
    const { uiStore, user } = renderOverlay()
    const toggle = screen.getByTestId('legend-toggle')

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('legend-panel')).toBeVisible()

    await user.click(toggle)

    expect(uiStore.getState().legendVisible).toBe(false)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('legend-panel')).not.toBeVisible()

    act(() => {
      uiStore.getState().setLegendVisible(true)
    })

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('legend-panel')).toBeVisible()
  })
})

describe('overlay controls', () => {
  it('names every control and reports its pressed state', () => {
    const { uiStore } = renderOverlay()

    expect(screen.getByRole('group', { name: 'Experience controls' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Quality' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Motion' })).toBeInTheDocument()

    expect(screen.getByTestId('audio-unlock')).toHaveAccessibleName('Enable sound')
    expect(screen.getByTestId('audio-unlock')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('audio-mute')).toHaveAccessibleName('Mute')
    expect(screen.getByTestId('audio-mute')).toHaveAttribute('aria-pressed', 'false')

    expect(screen.getByTestId(`quality-${uiStore.getState().requestedQualityTier}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByTestId('motion-system')).toHaveAttribute('aria-pressed', 'true')
  })

  it('mirrors the stored intent into pressed states and the reduced-motion flag', () => {
    const { uiStore } = renderOverlay()

    expect(screen.getByTestId('ui-overlay')).toHaveAttribute('data-reduced-motion', 'false')

    act(() => {
      uiStore.getState().requestAudioUnlock()
    })
    act(() => {
      uiStore.getState().requestQualityTier('low')
    })
    act(() => {
      uiStore.getState().setMotionPreference('reduce')
    })

    expect(screen.getByTestId('audio-unlock')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('quality-low')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('quality-high')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('motion-reduce')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('ui-overlay')).toHaveAttribute('data-reduced-motion', 'true')
    expect(screen.getByTestId('motion-status')).toHaveTextContent(/manual/i)
  })

  it('announces audio state instead of relying on colour alone', async () => {
    const { user } = renderOverlay()

    expect(screen.getByTestId('audio-status')).toHaveTextContent(/enable/i)

    await user.click(screen.getByTestId('audio-unlock'))
    expect(screen.getByTestId('audio-status')).toHaveTextContent(/sound is on/i)

    await user.click(screen.getByTestId('audio-mute'))
    expect(screen.getByTestId('audio-status')).toHaveTextContent(/muted/i)
  })
})
