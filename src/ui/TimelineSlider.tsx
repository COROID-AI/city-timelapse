/**
 * Top-pinned five-stop era timeline.
 *
 * Interaction model
 * -----------------
 * - The rail reacts to a pointer anywhere on it: press or drag selects the
 *   nearest stop, so click and drag are the same code path.
 * - Each stop is a button (click, Enter, Space); clicking the stop you are
 *   already on commits an in-flight blend immediately.
 * - The `role="slider"` element answers Left/Right (and Up/Down) with a one-era
 *   step and Home/End with the timeline ends. Arrow keys pressed while a stop
 *   has focus do the same and move focus with the selection.
 *
 * State ownership
 * ---------------
 * The component owns no era state. It reads the selected era and the blend
 * weight from the era store through selector subscriptions (so a progress tick
 * re-renders this component only, and never allocates per frame) and writes
 * selection back through the store's own actions. Era labels, years and
 * summaries come from the era registry, never from per-year branches here.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react'
import { useStore } from 'zustand'
import { ERA_REGISTRY } from '../era'
import type { EraDefinition, EraId, EraRegistry } from '../era'
import {
  selectFromEra,
  selectIsTransitioning,
  selectProgress,
  selectSelectedEra,
  selectToEra,
  useEraStore,
} from '../state/eraStore'
import type { EraStore } from '../state/eraStore'
import { EraStop } from './EraStop'

/** Keyboard moves the timeline understands. */
export type TimelineStep = 'previous' | 'next' | 'first' | 'last'

/** Fraction of the rail a stop's centre sits at, clamped into 0..1. */
export function stopPosition(index: number, stopCount: number): number {
  if (stopCount <= 1) {
    return 0
  }
  return Math.min(1, Math.max(0, index)) / (stopCount - 1)
}

/**
 * Maps a pointer position onto the nearest stop index.
 *
 * Returns `null` when the rail has no measurable width (a hidden element, or a
 * DOM implementation that reports empty rects) so a stray event can never
 * select an era by accident.
 */
export function stopIndexFromPointer(
  rect: { readonly left: number; readonly width: number },
  clientX: number,
  stopCount: number,
): number | null {
  if (stopCount <= 0 || !Number.isFinite(clientX)) {
    return null
  }
  if (stopCount === 1) {
    return 0
  }
  if (!(rect.width > 0)) {
    return null
  }
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return Math.round(ratio * (stopCount - 1))
}

/** Keyboard step a key asks for, or `null` when the key is not a timeline key. */
export function stepForTimelineKey(key: string): TimelineStep | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return 'previous'
    case 'ArrowRight':
    case 'ArrowUp':
      return 'next'
    case 'Home':
      return 'first'
    case 'End':
      return 'last'
    default:
      return null
  }
}

/**
 * Era one step away from `eraId`, clamped to the ends of the registry.
 *
 * An era the registry does not know (a store seeded from another table) resolves
 * to the first era instead of throwing, so the UI can never hard-crash on data
 * the rest of the app accepted.
 */
export function resolveStepTarget(
  eraId: EraId,
  step: TimelineStep,
  registry: EraRegistry,
): EraId {
  if (!registry.isKnown(eraId)) {
    return registry.first.id
  }
  switch (step) {
    case 'previous':
      return registry.previous(eraId)?.id ?? registry.first.id
    case 'next':
      return registry.next(eraId)?.id ?? registry.last.id
    case 'first':
      return registry.first.id
    case 'last':
      return registry.last.id
  }
}

/** Registry record for an era id, falling back to the registry's first era. */
function definitionFor(registry: EraRegistry, eraId: EraId): EraDefinition {
  return registry.find(eraId) ?? registry.first
}

/** True when a pointer event started on a stop button, which selects on click. */
function isStopElement(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false
  }
  return target.closest('[data-era-stop]') !== null
}

export interface TimelineSliderProps {
  /** Era store to read and write; defaults to the application-wide store. */
  readonly eraStore?: EraStore
  /** Era registry supplying every label; defaults to the shipped registry. */
  readonly registry?: EraRegistry
  /** Extra class for embedding layouts. */
  readonly className?: string
}

/** Top-pinned five-stop year slider with readout and transition progress. */
export function TimelineSlider({
  eraStore,
  registry = ERA_REGISTRY,
  className,
}: TimelineSliderProps): ReactElement {
  const store = eraStore ?? useEraStore

  // One selector per value: a progress tick re-renders the progress display
  // without touching the memoised stop list or the era copy.
  const selectedEra = useStore(store, selectSelectedEra)
  const fromEra = useStore(store, selectFromEra)
  const toEra = useStore(store, selectToEra)
  const progress = useStore(store, selectProgress)
  const isTransitioning = useStore(store, selectIsTransitioning)

  const stopCount = registry.definitions.length
  // Stop geometry and era copy are derived from the registry and the era pair,
  // so they are recomputed on era change only — never per frame.
  const stopDefinitions = useMemo(() => registry.definitions, [registry])
  const activeDefinition = useMemo(() => definitionFor(registry, selectedEra), [registry, selectedEra])
  const fromDefinition = useMemo(() => definitionFor(registry, fromEra), [registry, fromEra])
  const toDefinition = useMemo(() => definitionFor(registry, toEra), [registry, toEra])

  const activeIndex = Math.max(0, registry.indexOf(activeDefinition.id))
  const summaryId = `timeline-era-summary-${useId()}`
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const stopRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [dragging, setDragging] = useState(false)

  /** Activates a stop: selection, or an immediate commit when already active. */
  const commitEra = useCallback(
    (eraId: EraId) => {
      const state = store.getState()
      if (state.selectedEra !== eraId) {
        state.selectEra(eraId)
        return
      }
      if (state.fromEra !== state.toEra) {
        // Enter/Space (or a click) on the active stop settles the blend now.
        state.completeTransition()
      }
    },
    [store],
  )

  /** Retargets selection during a drag without settling an in-flight blend. */
  const retargetEra = useCallback(
    (eraId: EraId) => {
      const state = store.getState()
      if (state.selectedEra !== eraId) {
        state.selectEra(eraId)
      }
    },
    [store],
  )

  const stepTo = useCallback(
    (step: TimelineStep, focus: 'slider' | 'stop') => {
      const current = store.getState().selectedEra
      const target = resolveStepTarget(current, step, registry)
      if (target !== current) {
        retargetEra(target)
      }
      if (focus === 'stop') {
        stopRefs.current[registry.indexOf(target)]?.focus()
      }
    },
    [registry, retargetEra, store],
  )

  const handleSliderKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = stepForTimelineKey(event.key)
      if (step === null) {
        return
      }
      event.preventDefault()
      stepTo(step, 'slider')
    },
    [stepTo],
  )

  const handleStopKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = stepForTimelineKey(event.key)
      if (step === null) {
        return
      }
      event.preventDefault()
      stepTo(step, 'stop')
    },
    [stepTo],
  )

  const selectAtClientX = useCallback(
    (clientX: number) => {
      const slider = sliderRef.current
      if (slider === null) {
        return
      }
      const index = stopIndexFromPointer(slider.getBoundingClientRect(), clientX, stopCount)
      if (index === null) {
        return
      }
      const target = stopDefinitions[index]
      if (target !== undefined) {
        retargetEra(target.id)
      }
    },
    [retargetEra, stopCount, stopDefinitions],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isStopElement(event.target)) {
        // The stop's own click handler selects it; do not steal its focus.
        return
      }
      sliderRef.current?.focus()
      setDragging(true)
      selectAtClientX(event.clientX)
    },
    [selectAtClientX],
  )

  // A drag keeps tracking on the window, so releasing outside the rail still
  // ends the gesture and the last position under the pointer wins.
  useEffect(() => {
    if (!dragging) {
      return undefined
    }
    const handlePointerMove = (event: PointerEvent): void => {
      selectAtClientX(event.clientX)
    }
    const handlePointerEnd = (): void => {
      setDragging(false)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [dragging, selectAtClientX])

  const clampedProgress = Math.min(1, Math.max(0, progress))
  const percent = Math.round(clampedProgress * 100)
  const progressValueText = isTransitioning
    ? `${percent}% of the way from ${fromDefinition.shortLabel} to ${toDefinition.shortLabel}`
    : `Settled on ${toDefinition.shortLabel}`

  const rootClassName = ['timeline', className].filter((value): value is string => Boolean(value)).join(' ')

  return (
    <section
      className={rootClassName}
      data-testid="timeline"
      data-era-id={activeDefinition.id}
      data-transitioning={isTransitioning ? 'true' : 'false'}
      aria-label="Era timeline"
    >
      <div className="timeline__readout">
        <p className="timeline__now">
          <span className="timeline__now-year" data-testid="timeline-year-readout">
            {activeDefinition.shortLabel}
          </span>
          <span className="timeline__now-label" data-testid="timeline-era-name">
            {activeDefinition.label}
          </span>
        </p>
        <p className="timeline__summary" id={summaryId} data-testid="timeline-era-summary">
          {activeDefinition.summary}
        </p>
        <p className="timeline__progress" data-testid="timeline-progress">
          <span
            className="timeline__progressbar"
            role="progressbar"
            data-testid="timeline-progressbar"
            aria-label="Era transition progress"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={clampedProgress}
            aria-valuetext={progressValueText}
          >
            <span
              className="timeline__progress-fill"
              data-testid="timeline-progress-fill"
              aria-hidden="true"
              style={{ transform: `scaleX(${clampedProgress})` }}
            />
          </span>
          <span className="timeline__progress-label" data-testid="timeline-transition-label">
            {isTransitioning
              ? `${fromDefinition.shortLabel} → ${toDefinition.shortLabel} · ${percent}%`
              : toDefinition.shortLabel}
          </span>
        </p>
      </div>

      <div
        className="timeline__rail"
        data-testid="timeline-rail"
        data-dragging={dragging ? 'true' : 'false'}
        onPointerDown={handlePointerDown}
      >
        <div
          ref={sliderRef}
          className="timeline__slider"
          data-testid="timeline-slider"
          role="slider"
          tabIndex={0}
          aria-label="Timeline year"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, stopCount - 1)}
          aria-valuenow={activeIndex}
          aria-valuetext={`${activeDefinition.shortLabel} — ${activeDefinition.label}`}
          aria-describedby={summaryId}
          onKeyDown={handleSliderKeyDown}
        >
          <span className="timeline__line" aria-hidden="true" />
          <span
            className="timeline__knob"
            aria-hidden="true"
            style={{ left: `${stopPosition(activeIndex, stopCount) * 100}%` }}
          />
        </div>
        <ol className="timeline__stops" data-testid="timeline-stops">
          {stopDefinitions.map((definition, index) => (
            <EraStop
              key={definition.id}
              definition={definition}
              index={index}
              stopCount={stopCount}
              isActive={definition.id === activeDefinition.id}
              isTransitionSource={isTransitioning && definition.id === fromEra}
              onSelect={commitEra}
              onKeyDown={handleStopKeyDown}
              registerRef={(element) => {
                stopRefs.current[index] = element
              }}
            />
          ))}
        </ol>
      </div>
    </section>
  )
}
