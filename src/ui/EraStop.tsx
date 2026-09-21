/**
 * One year stop on the era timeline.
 *
 * A stop is a real `<button>`, so it is keyboard reachable by Tab, Enter/Space
 * activates it for free and assistive technology announces it as a control with
 * an accessible name that carries both the year and the era name. The buttons
 * live in a list *beside* the `role="slider"` element rather than inside it,
 * because ARIA slider children are presentational and would hide them.
 *
 * Geometry: a stop's centre sits at `index / (count - 1)` of the rail, which is
 * exactly the mapping `stopIndexFromPointer` in `TimelineSlider` uses, so a
 * pointer that lands on a stop picks the era under the finger and a drag that
 * ends on it agrees with the click that follows.
 */

import { type KeyboardEvent, type ReactElement } from 'react'
import type { EraDefinition, EraId } from '../era'

export interface EraStopProps {
  /** Registry record for this stop; every visible label comes from it. */
  readonly definition: EraDefinition
  /** Position of the stop on the rail, oldest era first. */
  readonly index: number
  /** Number of stops on the rail; drives the horizontal position. */
  readonly stopCount: number
  /** True for the era the store currently has selected. */
  readonly isActive: boolean
  /** True for the era an in-flight blend is leaving. */
  readonly isTransitionSource: boolean
  /** Called when the stop is activated by click, Enter or Space. */
  readonly onSelect: (eraId: EraId) => void
  /**
   * Arrow/Home/End handler owned by the parent slider, so all five stops behave
   * as one keyboard-navigable widget instead of five unrelated buttons.
   */
  readonly onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
  /** Lets the parent keep a ref so it can move focus after a keyboard step. */
  readonly registerRef?: (element: HTMLButtonElement | null) => void
}

/** Fraction of the rail the stop's centre sits at, clamped into 0..1. */
function stopOffset(index: number, stopCount: number): number {
  if (stopCount <= 1) {
    return 0
  }
  return Math.min(1, Math.max(0, index)) / (stopCount - 1)
}

/** A single year stop: dot, year label, active/transition state. */
export function EraStop({
  definition,
  index,
  stopCount,
  isActive,
  isTransitionSource,
  onSelect,
  onKeyDown,
  registerRef,
}: EraStopProps): ReactElement {
  const className = [
    'timeline__stop',
    isActive ? 'timeline__stop--active' : null,
    isTransitionSource ? 'timeline__stop--source' : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' ')

  return (
    <li className="timeline__stop-item" style={{ left: `${stopOffset(index, stopCount) * 100}%` }}>
      <button
        ref={registerRef}
        type="button"
        className={className}
        data-testid="timeline-stop"
        // `data-era-stop` marks this element as the rail's hit-test target;
        // `data-era-id` names the era, matching the timeline and HUD roots.
        data-era-stop={definition.id}
        data-era-id={definition.id}
        data-era-year={definition.year}
        data-active={isActive ? 'true' : 'false'}
        data-transition-source={isTransitionSource ? 'true' : 'false'}
        aria-current={isActive ? 'true' : undefined}
        aria-label={`${definition.year}: ${definition.label}`}
        title={`${definition.year} — ${definition.label}`}
        onClick={() => {
          onSelect(definition.id)
        }}
        onKeyDown={
          onKeyDown === undefined
            ? undefined
            : (event) => {
                onKeyDown(event, index)
              }
        }
      >
        <span className="timeline__stop-dot" aria-hidden="true" />
        <span className="timeline__stop-year">{definition.shortLabel}</span>
      </button>
    </li>
  )
}
