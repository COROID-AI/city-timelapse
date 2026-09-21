/**
 * Behavioural tests for the top-pinned era timeline.
 *
 * The slider is rendered through `tests/support/render.tsx` against the *real*
 * era store (`createEraStore`) and the *real* era registry, so every assertion
 * here is about integrated behaviour: a DOM interaction, the store state it
 * wrote, and the DOM that the store subscription produced afterwards.
 *
 * Components are built with `createElement` rather than JSX because the plan's
 * verification commands target this exact `.ts` path.
 */

import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ERA_REGISTRY, getEra, type EraId } from '../../src/era'
import { createEraStore } from '../../src/state/eraStore'
import {
  Overlay,
  TimelineSlider,
  createUIControlsStore,
  formatYearList,
  resolveStepTarget,
  stepForTimelineKey,
  stopIndexFromPointer,
  type SceneStatus,
} from '../../src/ui'
import { act, fireEvent, renderWithProviders, screen } from '../support/render'

/** `DOMRect` stand-in, because jsdom lays nothing out and reports empty rects. */
function railRect(width: number, left = 0): DOMRect {
  return {
    x: left,
    y: 0,
    top: 0,
    left,
    right: left + width,
    bottom: 24,
    width,
    height: 24,
    toJSON: () => ({}),
  } as DOMRect
}

/**
 * jsdom implements no `PointerEvent`; without it the test utilities fall back to
 * a plain `Event`, which silently drops `clientX` and would make a drag test
 * pass for the wrong reason. This installs the minimum a pointer drag uses.
 */
function installPointerEvent(): void {
  if (typeof window.PointerEvent === 'function') {
    return
  }
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    readonly isPrimary: boolean

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? 'mouse'
      this.isPrimary = init.isPrimary ?? true
    }
  }
  Object.defineProperty(window, 'PointerEvent', {
    value: TestPointerEvent,
    writable: true,
    configurable: true,
  })
}

/** Renders the slider against a fresh, isolated real era store. */
function renderTimeline(initialEra: EraId = '1945') {
  const eraStore = createEraStore(initialEra)
  const view = renderWithProviders(createElement(TimelineSlider, { eraStore }))
  return { eraStore, ...view }
}

/** The rendered stop button for one era. */
function stopFor(eraId: EraId): HTMLElement {
  const stop = screen
    .getAllByTestId('timeline-stop')
    .find((element) => element.getAttribute('data-era-id') === eraId)
  if (stop === undefined) {
    throw new Error(`No timeline stop rendered for era '${eraId}'.`)
  }
  return stop
}

describe('TimelineSlider stops and readout', () => {
  it('renders exactly the five shipped eras, in ascending order', () => {
    renderTimeline()

    const stops = screen.getAllByTestId('timeline-stop')

    expect(stops).toHaveLength(ERA_REGISTRY.count)
    expect(stops.map((stop) => stop.textContent)).toEqual(['1945', '1965', '1985', '2005', '2025'])
    expect(stops.map((stop) => stop.getAttribute('data-era-id'))).toEqual([...ERA_REGISTRY.ids])
    expect(stops.map((stop) => Number(stop.getAttribute('data-era-year')))).toEqual([
      ...ERA_REGISTRY.years,
    ])
  })

  it('pops the year readout and era summary straight from the registry', () => {
    renderTimeline('1985')

    expect(screen.getByTestId('timeline-year-readout')).toHaveTextContent(getEra('1985').shortLabel)
    expect(screen.getByTestId('timeline-era-name')).toHaveTextContent(getEra('1985').label)
    expect(screen.getByTestId('timeline-era-summary')).toHaveTextContent(getEra('1985').summary)
  })

  it('marks exactly one stop active and flags the blend source', () => {
    const { eraStore } = renderTimeline('1945')

    expect(screen.getAllByTestId('timeline-stop').filter(isActiveStop)).toHaveLength(1)
    expect(stopFor('1945')).toHaveAttribute('aria-current', 'true')

    act(() => {
      eraStore.getState().selectEra('2005')
    })

    expect(screen.getAllByTestId('timeline-stop').filter(isActiveStop)).toHaveLength(1)
    expect(stopFor('2005')).toHaveAttribute('aria-current', 'true')
    expect(stopFor('1945')).not.toHaveAttribute('aria-current')
    expect(stopFor('1945')).toHaveAttribute('data-transition-source', 'true')
  })

  it('reflects store changes made outside React instead of local state', () => {
    const { eraStore } = renderTimeline('1945')

    act(() => {
      eraStore.getState().selectEra('2025')
    })

    expect(screen.getByTestId('timeline-year-readout')).toHaveTextContent('2025')
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-era-id', '2025')
    expect(stopFor('2025')).toHaveAttribute('data-active', 'true')
  })
})

describe('TimelineSlider selection', () => {
  it('selects an era in the real store when a stop is clicked', async () => {
    const { eraStore, user } = renderTimeline('1945')

    await user.click(stopFor('1985'))

    expect(eraStore.getState()).toMatchObject({
      selectedEra: '1985',
      fromEra: '1945',
      toEra: '1985',
      progress: 0,
    })
    expect(screen.getByTestId('timeline-year-readout')).toHaveTextContent('1985')
  })

  it('steps one era per arrow key and clamps at both ends', async () => {
    const { eraStore, user } = renderTimeline('1945')
    const slider = screen.getByTestId('timeline-slider')

    act(() => {
      slider.focus()
    })

    await user.keyboard('{ArrowRight}')
    expect(eraStore.getState().selectedEra).toBe('1965')

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(eraStore.getState().selectedEra).toBe('2025')
    expect(document.activeElement).toBe(slider)

    await user.keyboard('{ArrowLeft}')
    expect(eraStore.getState().selectedEra).toBe('2005')

    await user.keyboard('{ArrowDown}')
    expect(eraStore.getState().selectedEra).toBe('1985')

    await user.keyboard('{ArrowUp}')
    expect(eraStore.getState().selectedEra).toBe('2005')
  })

  it('jumps to the ends with Home and End', async () => {
    const { eraStore, user } = renderTimeline('1985')

    act(() => {
      screen.getByTestId('timeline-slider').focus()
    })

    await user.keyboard('{End}')
    expect(eraStore.getState().selectedEra).toBe('2025')

    await user.keyboard('{Home}')
    expect(eraStore.getState().selectedEra).toBe('1945')
  })

  it('moves selection and focus together when a stop has focus', async () => {
    const { eraStore, user } = renderTimeline('1945')

    act(() => {
      stopFor('1945').focus()
    })

    await user.keyboard('{ArrowRight}')

    expect(eraStore.getState().selectedEra).toBe('1965')
    expect(document.activeElement).toBe(stopFor('1965'))
  })

  it('commits the active stop on Enter or Space without restarting the blend', async () => {
    const { eraStore, user } = renderTimeline('1945')

    act(() => {
      eraStore.getState().selectEra('1985')
    })
    act(() => {
      eraStore.getState().setProgress(0.5)
    })

    act(() => {
      stopFor('1985').focus()
    })
    await user.keyboard('{Enter}')

    expect(eraStore.getState()).toMatchObject({
      selectedEra: '1985',
      fromEra: '1985',
      toEra: '1985',
      progress: 0,
    })

    // The same commit path is reachable with Space, as the brief requires.
    act(() => {
      eraStore.getState().selectEra('2005')
    })
    act(() => {
      eraStore.getState().setProgress(0.5)
    })
    act(() => {
      stopFor('2005').focus()
    })
    await user.keyboard(' ')

    expect(eraStore.getState()).toMatchObject({
      selectedEra: '2005',
      fromEra: '2005',
      toEra: '2005',
      progress: 0,
    })
  })

  it('retargets instead of ignoring a selection made mid-transition', async () => {
    const { eraStore, user } = renderTimeline('1945')

    act(() => {
      eraStore.getState().selectEra('1985')
    })
    act(() => {
      eraStore.getState().setProgress(0.6)
    })

    await user.click(stopFor('2005'))

    expect(eraStore.getState()).toMatchObject({
      selectedEra: '2005',
      fromEra: '1985',
      toEra: '2005',
      progress: 0,
    })
  })
})

describe('TimelineSlider drag and click on the track', () => {
  it('selects the era under the pointer and follows a drag', () => {
    installPointerEvent()
    const { eraStore } = renderTimeline('1945')
    const rail = screen.getByTestId('timeline-rail')
    const slider = screen.getByTestId('timeline-slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(railRect(400))

    fireEvent.pointerDown(rail, { clientX: 110 })
    expect(eraStore.getState().selectedEra).toBe('1965')

    fireEvent.pointerMove(window, { clientX: 210 })
    expect(eraStore.getState().selectedEra).toBe('1985')

    fireEvent.pointerMove(window, { clientX: 399 })
    expect(eraStore.getState().selectedEra).toBe('2025')

    fireEvent.pointerUp(window, { clientX: 399 })
    expect(rail).toHaveAttribute('data-dragging', 'false')

    // A drag past the release point must not keep selecting.
    fireEvent.pointerMove(window, { clientX: 10 })
    expect(eraStore.getState().selectedEra).toBe('2025')
  })

  it('ignores a pointer press on a rail that cannot be measured', () => {
    const { eraStore } = renderTimeline('1945')

    fireEvent.pointerDown(screen.getByTestId('timeline-rail'), { clientX: 200 })

    expect(eraStore.getState().selectedEra).toBe('1945')
  })

  it('maps the rail onto the five stops and refuses to guess without a width', () => {
    expect(stopIndexFromPointer({ left: 0, width: 400 }, 0, 5)).toBe(0)
    expect(stopIndexFromPointer({ left: 0, width: 400 }, 110, 5)).toBe(1)
    expect(stopIndexFromPointer({ left: 0, width: 400 }, 200, 5)).toBe(2)
    expect(stopIndexFromPointer({ left: 0, width: 400 }, 400, 5)).toBe(4)
    expect(stopIndexFromPointer({ left: 0, width: 400 }, -50, 5)).toBe(0)
    expect(stopIndexFromPointer({ left: 0, width: 0 }, 100, 5)).toBeNull()
    expect(stopIndexFromPointer({ left: 0, width: 400 }, Number.NaN, 5)).toBeNull()
  })
})

describe('TimelineSlider transition progress', () => {
  it('shows the blend source, weight and settled state from the store', () => {
    const { eraStore } = renderTimeline('1945')

    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent('1945')

    act(() => {
      eraStore.getState().selectEra('1985')
    })

    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent('1945 → 1985')

    act(() => {
      eraStore.getState().setProgress(0.42)
    })

    const bar = screen.getByTestId('timeline-progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0.42')
    expect(bar).toHaveAttribute('aria-valuemax', '1')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('1945'))
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('1985'))
    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent('42%')
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-transitioning', 'true')

    act(() => {
      eraStore.getState().completeTransition()
    })

    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent('1985')
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-transitioning', 'false')
  })

  it('clamps out-of-range progress into the displayed 0..1 range', () => {
    const { eraStore } = renderTimeline('1945')

    act(() => {
      eraStore.getState().selectEra('1965')
    })

    act(() => {
      eraStore.getState().setProgress(4)
    })
    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute('aria-valuenow', '1')

    act(() => {
      eraStore.getState().setProgress(-3)
    })
    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('0% of the way from 1945 to 1965'),
    )
  })
})

describe('timeline keyboard mapping', () => {
  it('recognises only the documented keys', () => {
    expect(stepForTimelineKey('ArrowLeft')).toBe('previous')
    expect(stepForTimelineKey('ArrowDown')).toBe('previous')
    expect(stepForTimelineKey('ArrowRight')).toBe('next')
    expect(stepForTimelineKey('ArrowUp')).toBe('next')
    expect(stepForTimelineKey('Home')).toBe('first')
    expect(stepForTimelineKey('End')).toBe('last')
    expect(stepForTimelineKey('PageUp')).toBeNull()
    expect(stepForTimelineKey('a')).toBeNull()
  })

  it('resolves steps against the registry and clamps at the ends', () => {
    expect(resolveStepTarget('1945', 'previous', ERA_REGISTRY)).toBe('1945')
    expect(resolveStepTarget('1945', 'next', ERA_REGISTRY)).toBe('1965')
    expect(resolveStepTarget('2025', 'next', ERA_REGISTRY)).toBe('2025')
    expect(resolveStepTarget('1985', 'first', ERA_REGISTRY)).toBe('1945')
    expect(resolveStepTarget('1985', 'last', ERA_REGISTRY)).toBe('2025')
  })
})

describe('overlay lifecycle states', () => {
  /** Renders the whole overlay so the states can be checked against it. */
  function renderState(
    options: {
      readonly status?: SceneStatus
      readonly dismissFirstUse?: boolean
      readonly errorMessage?: string | null
      readonly onRetry?: () => void
    } = {},
  ) {
    const eraStore = createEraStore('1945')
    const uiStore = createUIControlsStore({ overlayDismissed: options.dismissFirstUse ?? true })
    const view = renderWithProviders(
      createElement(Overlay, {
        eraStore,
        uiStore,
        status: options.status ?? 'ready',
        errorMessage: options.errorMessage ?? null,
        onRetry: options.onRetry,
      }),
    )
    return { eraStore, uiStore, ...view }
  }

  it('renders the loading state alone before the first frame', () => {
    renderState({ status: 'loading', dismissFirstUse: false })

    expect(screen.getByTestId('overlay-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('overlay-first-use')).toBeNull()
    expect(screen.queryByTestId('overlay-error')).toBeNull()
    expect(screen.getByTestId('timeline')).toBeInTheDocument()
    expect(screen.getByTestId('ui-overlay')).toHaveAttribute('data-scene-status', 'loading')
  })

  it('renders the error state with its retry action and nothing stacked on it', async () => {
    const onRetry = vi.fn()
    const { user } = renderState({
      status: 'error',
      dismissFirstUse: false,
      errorMessage: 'WebGL context lost while building the block.',
      onRetry,
    })

    const error = screen.getByTestId('overlay-error')

    expect(error).toHaveTextContent('WebGL context lost while building the block.')
    expect(screen.queryByTestId('overlay-loading')).toBeNull()
    expect(screen.queryByTestId('overlay-first-use')).toBeNull()
    expect(screen.getByTestId('timeline')).toBeInTheDocument()

    await user.click(screen.getByTestId('overlay-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('explains itself when the scene fails without a supplied message', () => {
    renderState({ status: 'error' })

    expect(screen.getByTestId('overlay-error')).toHaveTextContent(/webgl is unavailable/i)
    expect(screen.queryByTestId('overlay-retry')).toBeNull()
  })

  it('renders the first-use panel once and remembers the dismissal', async () => {
    const { uiStore, user } = renderState({ dismissFirstUse: false })

    const panel = screen.getByTestId('overlay-first-use')

    expect(panel).toHaveTextContent(formatYearList(ERA_REGISTRY.years))
    expect(screen.queryByTestId('overlay-loading')).toBeNull()
    expect(screen.queryByTestId('overlay-error')).toBeNull()

    // The timeline stays mounted and usable while the panel is up.
    await user.click(stopFor('1985'))
    expect(screen.getByTestId('timeline-year-readout')).toHaveTextContent('1985')
    expect(uiStore.getState().overlayDismissed).toBe(false)

    await user.click(screen.getByTestId('overlay-dismiss'))

    expect(screen.queryByTestId('overlay-first-use')).toBeNull()
    expect(uiStore.getState()).toMatchObject({ overlayVisible: false, overlayDismissed: true })
    expect(screen.getByTestId('timeline')).toBeInTheDocument()
  })
})

/** True for the stop the UI currently marks as active. */
function isActiveStop(stop: HTMLElement): boolean {
  return stop.getAttribute('data-active') === 'true'
}
