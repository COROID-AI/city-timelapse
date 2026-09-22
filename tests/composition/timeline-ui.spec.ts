/**
 * Composition spec: the overlay wired to the real era registry, the real era
 * store and the real ui-controls store.
 *
 * Nothing here is mocked. The point is to prove the integration contract the
 * next phase depends on:
 *
 * - every stop label, year and era summary rendered anywhere in the overlay
 *   comes from `src/era` registry data;
 * - selection goes *through* the era store's own actions and its selector
 *   subscriptions report the change;
 * - transition progress is clamped into 0..1 on screen exactly as the store
 *   clamps it;
 * - audio unlock, quality tier and reduced motion each write their value *and*
 *   their manual-override flag into `src/ui/uiStore.ts`, which is the only place
 *   that intent lives;
 * - the `src/ui` module graph imports neither `src/audio` nor `src/scene`, so the
 *   overlay cannot bypass the stores by talking to the engine or the pipeline.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ERA_DEFINITIONS, ERA_REGISTRY, getEra, type EraId } from '../../src/era'
import {
  createEraStore,
  subscribeToEraSelection,
  subscribeToTransitionProgress,
} from '../../src/state/eraStore'
import {
  Overlay,
  createUIControlsStore,
  formatYearList,
  resolveReducedMotion,
  selectAudioIntent,
  selectMotionIntent,
  selectQualityIntent,
  subscribeToQualityIntent,
  type QualityIntent,
  type SceneStatus,
} from '../../src/ui'
import { act, fireEvent, renderWithProviders, screen, within } from '../support/render'

/** Renders the overlay against fresh real stores. */
function renderOverlay(
  options: { readonly status?: SceneStatus; readonly dismissFirstUse?: boolean } = {},
) {
  const eraStore = createEraStore('1945')
  const uiStore = createUIControlsStore({
    overlayDismissed: options.dismissFirstUse ?? true,
  })
  const view = renderWithProviders(
    createElement(Overlay, { eraStore, uiStore, status: options.status ?? 'ready' }),
  )
  return { eraStore, uiStore, ...view }
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

/** `DOMRect` stand-in, because jsdom reports empty rects for everything. */
function railRect(width: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 24,
    width,
    height: 24,
    toJSON: () => ({}),
  } as DOMRect
}

/**
 * jsdom implements no `PointerEvent`; without it the test utilities fall back
 * to a plain `Event` that silently drops `clientX`, which would let a drag test
 * pass for the wrong reason.
 */
function installPointerEvent(): void {
  if (typeof window.PointerEvent === 'function') {
    return
  }
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  Object.defineProperty(window, 'PointerEvent', {
    value: TestPointerEvent,
    writable: true,
    configurable: true,
  })
}

describe('overlay composed with the real era registry and era store', () => {
  it('renders every stop label and year from registry data', () => {
    renderOverlay()

    const stops = screen.getAllByTestId('timeline-stop')

    expect(stops).toHaveLength(ERA_REGISTRY.count)
    for (const definition of ERA_DEFINITIONS) {
      const stop = stopFor(definition.id)
      expect(stop).toHaveTextContent(definition.shortLabel)
      expect(stop).toHaveAttribute('aria-label', `${definition.year}: ${definition.label}`)
      expect(Number(stop.getAttribute('data-era-year'))).toBe(definition.year)
    }
  })

  it('reads the era name and summary for every era straight from the registry', () => {
    const { eraStore } = renderOverlay()

    for (const definition of ERA_DEFINITIONS) {
      act(() => {
        eraStore.getState().selectEra(definition.id)
      })

      expect(screen.getByTestId('timeline-year-readout')).toHaveTextContent(definition.shortLabel)
      expect(screen.getByTestId('timeline-era-name')).toHaveTextContent(definition.label)
      expect(screen.getByTestId('timeline-era-summary')).toHaveTextContent(definition.summary)
      expect(screen.getByTestId('hud-era-summary')).toHaveTextContent(definition.summary)
      expect(screen.getByTestId('hud-year')).toHaveTextContent(definition.shortLabel)
    }
  })

  it('selects eras through the real store actions and hears back through its subscriptions', async () => {
    const { eraStore, user } = renderOverlay()
    const selections: string[] = []
    const progressTicks: number[] = []
    const unsubscribeSelection = subscribeToEraSelection(eraStore, (eraId) => {
      selections.push(eraId)
    })
    const unsubscribeProgress = subscribeToTransitionProgress(eraStore, (progress) => {
      progressTicks.push(progress)
    })

    await user.click(stopFor('1985'))

    expect(selections).toEqual(['1985'])
    expect(eraStore.getState()).toMatchObject({
      selectedEra: '1985',
      fromEra: '1945',
      toEra: '1985',
      progress: 0,
    })
    expect(screen.getByTestId('timeline')).toHaveAttribute('data-era-id', '1985')

    act(() => {
      eraStore.getState().setProgress(0.35)
    })

    expect(progressTicks).toEqual([0.35])
    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute('aria-valuenow', '0.35')
    expect(screen.getByTestId('timeline-progress-fill').style.transform).toBe('scaleX(0.35)')
    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent('35%')

    act(() => {
      eraStore.getState().completeTransition()
    })

    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent(
      getEra('1985').shortLabel,
    )

    unsubscribeSelection()
    unsubscribeProgress()
  })

  it('drives the real store from click, drag and keyboard alike', async () => {
    installPointerEvent()
    const { eraStore, user } = renderOverlay()
    const rail = screen.getByTestId('timeline-rail')
    const slider = screen.getByTestId('timeline-slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(railRect(400))

    await user.click(stopFor('2025'))
    expect(eraStore.getState()).toMatchObject({
      selectedEra: '2025',
      fromEra: '1945',
      toEra: '2025',
    })

    fireEvent.pointerDown(rail, { clientX: 0 })
    expect(eraStore.getState()).toMatchObject({ selectedEra: '1945', fromEra: '2025' })

    fireEvent.pointerMove(window, { clientX: 300 })
    fireEvent.pointerUp(window, { clientX: 300 })
    expect(eraStore.getState()).toMatchObject({ selectedEra: '2005', fromEra: '1945' })
    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent('1945 → 2005')

    act(() => {
      slider.focus()
    })
    await user.keyboard('{End}')

    expect(eraStore.getState().selectedEra).toBe('2025')
    expect(screen.getByTestId('timeline-year-readout')).toHaveTextContent('2025')

    await user.keyboard('{Home}')

    expect(eraStore.getState().selectedEra).toBe('1945')
    expect(screen.getByTestId('timeline-year-readout')).toHaveTextContent('1945')
  })

  it('clamps displayed transition progress into 0..1 the way the store does', () => {
    const { eraStore } = renderOverlay()

    act(() => {
      eraStore.getState().selectEra('2025')
    })

    act(() => {
      eraStore.getState().setProgress(3.5)
    })
    expect(eraStore.getState().progress).toBe(1)
    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByTestId('timeline-progress-fill').style.transform).toBe('scaleX(1)')
    expect(screen.getByTestId('timeline-transition-label')).toHaveTextContent('100%')

    act(() => {
      eraStore.getState().setProgress(-0.5)
    })
    expect(eraStore.getState().progress).toBe(0)
    expect(screen.getByTestId('timeline-progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByTestId('timeline-progress-fill').style.transform).toBe('scaleX(0)')
  })
})

describe('overlay controls and the ui-controls store', () => {
  it('records audio unlock, mute, quality and motion intent with their flags', async () => {
    const { uiStore, user } = renderOverlay()

    expect(selectAudioIntent(uiStore.getState())).toEqual({
      muted: false,
      unlocked: false,
      active: false,
    })

    await user.click(screen.getByTestId('audio-unlock'))
    expect(uiStore.getState()).toMatchObject({ audioUnlocked: true, audioMuted: false })
    expect(selectAudioIntent(uiStore.getState())).toEqual({
      muted: false,
      unlocked: true,
      active: true,
    })

    await user.click(screen.getByTestId('audio-mute'))
    expect(uiStore.getState().audioMuted).toBe(true)
    expect(selectAudioIntent(uiStore.getState()).active).toBe(false)
    expect(screen.getByTestId('audio-mute')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByTestId('quality-low'))
    expect(uiStore.getState().requestedQualityTier).toBe('low')
    expect(selectQualityIntent(uiStore.getState())).toEqual({
      requestedTier: 'low',
      manualOverride: true,
    })

    // A manual choice must survive the adaptive controller, and clearing it must
    // hand the tier back.
    act(() => {
      uiStore.getState().applyAdaptiveQualityTier('high')
    })
    expect(uiStore.getState().requestedQualityTier).toBe('low')

    act(() => {
      uiStore.getState().clearQualityOverride()
      uiStore.getState().applyAdaptiveQualityTier('medium')
    })
    expect(uiStore.getState()).toMatchObject({
      requestedQualityTier: 'medium',
      qualityManualOverride: false,
    })

    await user.click(screen.getByTestId('motion-reduce'))
    expect(uiStore.getState()).toMatchObject({
      motionPreference: 'reduce',
      motionManualOverride: true,
    })
    expect(selectMotionIntent(uiStore.getState())).toEqual({
      preference: 'reduce',
      manualOverride: true,
    })
    expect(screen.getByTestId('ui-overlay')).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('publishes intent changes to store subscribers', () => {
    const { uiStore } = renderOverlay()
    const intents: QualityIntent[] = []
    const unsubscribe = subscribeToQualityIntent(uiStore, (intent) => {
      intents.push(intent)
    })

    act(() => {
      uiStore.getState().requestQualityTier('low')
    })
    act(() => {
      uiStore.getState().clearQualityOverride()
    })

    expect(intents).toEqual([
      { requestedTier: 'low', manualOverride: true },
      { requestedTier: 'low', manualOverride: false },
    ])

    unsubscribe()
  })

  it('is the only source of intent: it mirrors store state written outside React', () => {
    const { uiStore } = renderOverlay()

    act(() => {
      uiStore.getState().requestQualityTier('low')
      uiStore.getState().requestAudioUnlock()
      uiStore.getState().setLegendVisible(false)
    })

    expect(screen.getByTestId('quality-low')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('quality-high')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('quality-status')).toHaveTextContent(/manual/i)
    expect(screen.getByTestId('audio-status')).toHaveTextContent(/sound is on/i)
    expect(screen.getByTestId('legend-panel')).not.toBeVisible()
  })

  it('resolves a stored motion preference against the system setting', () => {
    expect(resolveReducedMotion('system', true)).toBe(true)
    expect(resolveReducedMotion('system', false)).toBe(false)
    expect(resolveReducedMotion('reduce', false)).toBe(true)
    expect(resolveReducedMotion('no-preference', true)).toBe(false)
  })
})

describe('overlay lifecycle states', () => {
  it('shows the loading state alone before the first frame', () => {
    renderOverlay({ status: 'loading', dismissFirstUse: false })

    expect(screen.getByTestId('overlay-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('overlay-first-use')).toBeNull()
    expect(screen.queryByTestId('overlay-error')).toBeNull()
    expect(screen.getByTestId('ui-overlay')).toHaveAttribute('data-scene-status', 'loading')
  })

  it('shows an error state with the message and an optional retry', async () => {
    const onRetry = vi.fn()
    const eraStore = createEraStore('1945')
    const uiStore = createUIControlsStore({ overlayDismissed: false })
    const { user } = renderWithProviders(
      createElement(Overlay, {
        eraStore,
        uiStore,
        status: 'error',
        errorMessage: 'GPU device lost while building the block.',
        onRetry,
      }),
    )

    const error = screen.getByTestId('overlay-error')

    expect(error).toHaveTextContent('GPU device lost while building the block.')
    expect(screen.queryByTestId('overlay-loading')).toBeNull()
    expect(screen.queryByTestId('overlay-first-use')).toBeNull()

    await user.click(within(error).getByTestId('overlay-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows the first-use panel once and remembers the dismissal', async () => {
    const { uiStore, user } = renderOverlay({ dismissFirstUse: false })

    const panel = screen.getByTestId('overlay-first-use')

    expect(panel).toHaveTextContent(formatYearList(ERA_REGISTRY.years))
    expect(panel).toHaveTextContent(formatYearList([1945, 1965, 1985, 2005, 2025]))
    expect(screen.queryByTestId('overlay-loading')).toBeNull()
    expect(screen.queryByTestId('overlay-error')).toBeNull()

    await user.click(screen.getByTestId('overlay-dismiss'))

    expect(screen.queryByTestId('overlay-first-use')).toBeNull()
    expect(uiStore.getState()).toMatchObject({ overlayVisible: false, overlayDismissed: true })
  })

  it('keeps the timeline, HUD, controls and legend mounted in every state', () => {
    renderOverlay({ status: 'loading' })

    expect(screen.getByTestId('timeline')).toBeInTheDocument()
    expect(screen.getByTestId('hud')).toBeInTheDocument()
    expect(screen.getByTestId('overlay-controls')).toBeInTheDocument()
    expect(screen.getByTestId('controls-legend')).toBeInTheDocument()
    expect(within(screen.getByTestId('hud')).getByTestId('hud-year')).toHaveTextContent('1945')
  })

  it('formats the registry year list without hard-coding the eras', () => {
    expect(formatYearList(ERA_REGISTRY.years)).toBe('1945, 1965, 1985, 2005 or 2025')
    expect(formatYearList([2025])).toBe('2025')
    expect(formatYearList([])).toBe('')
  })
})

describe('src/ui module graph', () => {
  it('imports neither the audio engine nor the render pipeline', () => {
    const graph = collectModuleGraph()

    expect(graph.files.length).toBeGreaterThanOrEqual(7)
    expect(graph.forbidden).toEqual([])
    expect(graph.firstParty.every(isSharedContract)).toBe(true)
  })
})

const SOURCE_DIR = resolve(process.cwd(), 'src')
const UI_DIR = resolve(SOURCE_DIR, 'ui')

/** First-party modules the overlay is allowed to depend on. */
const ALLOWED_FIRST_PARTY_DIRS = [
  resolve(SOURCE_DIR, 'era'),
  resolve(SOURCE_DIR, 'state'),
  resolve(SOURCE_DIR, 'lib'),
]

/** Bare specifiers that would mean the overlay reaches into the pipeline. */
function isForbiddenSpecifier(specifier: string, resolved: string): boolean {
  const path = resolved.split(sep).join('/')
  if (path.includes('/src/audio/') || path.includes('/src/scene/')) {
    return true
  }
  return (
    specifier === 'three' ||
    specifier.startsWith('@react-three/') ||
    specifier === 'postprocessing' ||
    specifier.startsWith('@react-three/postprocessing')
  )
}

function isSharedContract(resolved: string): boolean {
  return ALLOWED_FIRST_PARTY_DIRS.some((allowed) => resolved.startsWith(allowed))
}

/** Import specifiers of a TypeScript/TSX source file. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  const pattern = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2]
    if (specifier !== undefined) {
      specifiers.push(specifier)
    }
  }
  return specifiers
}

/** Resolves a relative specifier to a file on disk, or `null` when it is not one. */
function resolveModule(specifier: string, fromFile: string): string | null {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ]
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
}

/**
 * Walks the `src/ui` module graph: every first-party file it reaches, every
 * first-party file outside `src/ui`, and any forbidden dependency.
 */
function collectModuleGraph(): {
  readonly files: readonly string[]
  readonly firstParty: readonly string[]
  readonly forbidden: readonly string[]
} {
  const queue = readdirSync(UI_DIR)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .map((name) => resolve(UI_DIR, name))
  const visited = new Set<string>()
  const firstParty = new Set<string>()
  const forbidden = new Set<string>()

  while (queue.length > 0) {
    const file = queue.pop()
    if (file === undefined || visited.has(file)) {
      continue
    }
    visited.add(file)
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) {
        if (isForbiddenSpecifier(specifier, specifier)) {
          forbidden.add(specifier)
        }
        continue
      }
      const resolved = resolveModule(specifier, file)
      if (resolved === null || resolved.endsWith('.css')) {
        continue
      }
      if (isForbiddenSpecifier(specifier, resolved)) {
        forbidden.add(resolved)
        continue
      }
      if (resolved.startsWith(SOURCE_DIR) && !resolved.startsWith(UI_DIR)) {
        firstParty.add(resolved)
      }
      queue.push(resolved)
    }
  }

  return { files: [...visited], firstParty: [...firstParty], forbidden: [...forbidden] }
}
