/**
 * Era HUD: the always-visible readout for the period on screen.
 *
 * The timeline slider states *where* the viewer is on the timeline; the HUD
 * states *what* is there — year, era name, the week-by-week summary from the
 * registry and how far the current blend has travelled. It is pure output: it
 * reads the era store with selector subscriptions and owns no state of its own.
 *
 * The year is announced politely (`aria-live="polite"`) so a screen-reader user
 * hears the destination year when an era change lands, without the live region
 * firing on every progress tick (only the era ids and progress *text* change the
 * rendered string, and the status line is stable while a blend is settled).
 */

import { useMemo, type ReactElement } from 'react'
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

/** Registry record for an era id, falling back to the registry's first era. */
function definitionFor(registry: EraRegistry, eraId: EraId): EraDefinition {
  return registry.find(eraId) ?? registry.first
}

export interface HudProps {
  /** Era store to read; defaults to the application-wide store. */
  readonly eraStore?: EraStore
  /** Era registry supplying the display copy; defaults to the shipped table. */
  readonly registry?: EraRegistry
  /** Extra class for embedding layouts. */
  readonly className?: string
}

/** Year, era name, summary and blend status for the selected era. */
export function Hud({ eraStore, registry = ERA_REGISTRY, className }: HudProps): ReactElement {
  const store = eraStore ?? useEraStore
  const selectedEra = useStore(store, selectSelectedEra)
  const fromEra = useStore(store, selectFromEra)
  const toEra = useStore(store, selectToEra)
  const progress = useStore(store, selectProgress)
  const isTransitioning = useStore(store, selectIsTransitioning)

  // Re-derived only when the era pair changes, never per frame.
  const activeDefinition = useMemo(() => definitionFor(registry, selectedEra), [registry, selectedEra])
  const fromDefinition = useMemo(() => definitionFor(registry, fromEra), [registry, fromEra])
  const toDefinition = useMemo(() => definitionFor(registry, toEra), [registry, toEra])

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  const statusText = isTransitioning
    ? `Blending ${fromDefinition.shortLabel} → ${toDefinition.shortLabel} · ${percent}%`
    : `Settled on ${toDefinition.shortLabel}`

  const rootClassName = ['hud', className].filter((value): value is string => Boolean(value)).join(' ')

  return (
    <aside
      className={rootClassName}
      data-testid="hud"
      data-era-id={activeDefinition.id}
      data-transitioning={isTransitioning ? 'true' : 'false'}
      data-era-year={activeDefinition.year}
      aria-label="Current period"
    >
      <p className="hud__year" data-testid="hud-year" aria-live="polite">
        {activeDefinition.shortLabel}
      </p>
      <p className="hud__era" data-testid="hud-era-label">
        {activeDefinition.label}
      </p>
      <p className="hud__summary" data-testid="hud-era-summary">
        {activeDefinition.summary}
      </p>
      <p className="hud__status" data-testid="hud-transition-status">
        {statusText}
      </p>
    </aside>
  )
}
