/**
 * Help legend for the timeline, audio, quality and motion controls.
 *
 * Every line of copy lives in {@link CONTROL_LEGEND} rather than in JSX: the
 * legend is the one place the app explains its own controls, and keeping it as
 * data lets a test assert that navigation, audio, quality and motion are all
 * covered without matching rendered prose.
 *
 * Visibility is owned by the ui-controls store (`legendVisible`), so the same
 * toggle state can be restored or hidden by another surface.
 */

import { useId, useMemo, type ReactElement } from 'react'
import { useStore } from 'zustand'
import { selectLegendVisible, useUIControlsStore } from './uiStore'
import type { UIControlsStore } from './uiStore'

/** Control families the legend documents. */
export type LegendGroup = 'navigation' | 'audio' | 'quality' | 'motion'

/** Group headings, in the order they are rendered. */
export const LEGEND_GROUP_ORDER: readonly LegendGroup[] = ['navigation', 'audio', 'quality', 'motion']

/** Heading shown above each group. */
export const LEGEND_GROUP_LABELS: Readonly<Record<LegendGroup, string>> = {
  navigation: 'Navigating time',
  audio: 'Sound',
  quality: 'Quality',
  motion: 'Motion',
}

/** One documented control: what the viewer presses and what it does. */
export interface LegendEntry {
  /** Stable key, also the React key. */
  readonly id: string
  /** Control family this entry documents. */
  readonly group: LegendGroup
  /** Key or control the viewer uses, e.g. `Arrow keys` or `Drag the track`. */
  readonly keys: string
  /** What the control does. */
  readonly description: string
}

/** The legend table: the single source of the help copy. */
export const CONTROL_LEGEND: readonly LegendEntry[] = [
  {
    id: 'timeline-tab',
    group: 'navigation',
    keys: 'Tab',
    description: 'Move focus into the timeline slider; a visible ring shows where focus is.',
  },
  {
    id: 'timeline-arrows',
    group: 'navigation',
    keys: 'Arrow keys (or Up / Down)',
    description: 'Step one era older or newer; the block rebuilds as you go.',
  },
  {
    id: 'timeline-ends',
    group: 'navigation',
    keys: 'Home / End',
    description: 'Jump straight to the oldest or newest era on the timeline.',
  },
  {
    id: 'timeline-point',
    group: 'navigation',
    keys: 'Click a year or drag the track',
    description: 'Pick any year directly; dragging retargets mid-transition.',
  },
  {
    id: 'timeline-commit',
    group: 'navigation',
    keys: 'Enter / Space',
    description: 'Commit the focused year and finish its transition immediately.',
  },
  {
    id: 'audio-enable',
    group: 'audio',
    keys: 'Enable sound',
    description: 'Unlock the period soundscape for this visit; browsers block audio until you ask.',
  },
  {
    id: 'audio-mute',
    group: 'audio',
    keys: 'Mute',
    description: 'Silence or restore the ambience without losing the soundscape choice.',
  },
  {
    id: 'quality-tier',
    group: 'quality',
    keys: 'High / Medium / Low',
    description: 'Choose the detail level; picking one by hand stops automatic quality changes.',
  },
  {
    id: 'motion-preference',
    group: 'motion',
    keys: 'Follow system / Reduce motion / Full motion',
    description: 'Control whether an era change animates or swaps instantly.',
  },
]

/** Groups the table by family, in legend order. */
export function groupLegendEntries(
  entries: readonly LegendEntry[],
): readonly { readonly group: LegendGroup; readonly entries: readonly LegendEntry[] }[] {
  return LEGEND_GROUP_ORDER.map((group) => ({
    group,
    entries: entries.filter((entry) => entry.group === group),
  })).filter((section) => section.entries.length > 0)
}

export interface ControlsLegendProps {
  /** UI controls store owning the legend visibility; defaults to the app store. */
  readonly uiStore?: UIControlsStore
  /** Overrides the legend table, mainly for tests. */
  readonly entries?: readonly LegendEntry[]
  /** Extra class for embedding layouts. */
  readonly className?: string
}

/** Collapsible help legend describing navigation, sound, quality and motion. */
export function ControlsLegend({
  uiStore,
  entries = CONTROL_LEGEND,
  className,
}: ControlsLegendProps): ReactElement {
  const store = uiStore ?? useUIControlsStore
  const legendVisible = useStore(store, selectLegendVisible)
  const panelId = `controls-legend-panel-${useId()}`
  const sections = useMemo(() => groupLegendEntries(entries), [entries])

  const rootClassName = ['legend', className].filter((value): value is string => Boolean(value)).join(' ')

  return (
    <section
      className={rootClassName}
      data-testid="controls-legend"
      role="region"
      aria-label="Controls help"
      data-expanded={legendVisible ? 'true' : 'false'}
    >
      <header className="legend__header">
        <h2 className="legend__title">Controls</h2>
        <button
          type="button"
          className="ui-button ui-button--ghost"
          data-testid="legend-toggle"
          aria-expanded={legendVisible}
          aria-controls={panelId}
          onClick={() => {
            store.getState().toggleLegend()
          }}
        >
          {legendVisible ? 'Hide help' : 'Show help'}
        </button>
      </header>
      <div className="legend__panel" id={panelId} data-testid="legend-panel" hidden={!legendVisible}>
        {sections.map((section) => (
          <div className="legend__group" key={section.group} data-legend-group={section.group}>
            <h3 className="legend__group-title">{LEGEND_GROUP_LABELS[section.group]}</h3>
            <dl className="legend__list">
              {section.entries.map((entry) => (
                <div className="legend__entry" key={entry.id}>
                  <dt className="legend__keys">
                    <kbd>{entry.keys}</kbd>
                  </dt>
                  <dd className="legend__description">{entry.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
