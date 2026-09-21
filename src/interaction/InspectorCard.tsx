/**
 * The inspection info card: what the viewer is looking at, in period terms.
 *
 * A presentational component with no state and no store access — it renders an
 * {@link InspectorCardModel} built by the inspection module, so the wording,
 * the category and the era all come from the registry rather than from JSX. The
 * card is keyboard-reachable (`role="dialog"`, a labelled close button) and
 * announces itself politely, so opening it never steals focus mid-camera-move.
 *
 * Styles are inline on purpose: this phase owns `src/interaction/**` and nothing
 * else, so it must not add to the overlay's stylesheet.
 */

import type { CSSProperties, ReactElement } from 'react'
import type { InspectorCardModel } from './inspector'

const CARD_STYLE: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
  transform: 'translateX(-50%)',
  zIndex: 20,
  width: 'min(520px, calc(100vw - 32px))',
  display: 'grid',
  gap: '6px',
  padding: '14px 16px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(120, 150, 200, 0.32)',
  background: 'rgba(9, 13, 22, 0.9)',
  color: '#e8edf7',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.42)',
  backdropFilter: 'blur(10px)',
  font: 'inherit',
  pointerEvents: 'auto',
}

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
}

const CATEGORY_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '0.72rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#6fd3ff',
}

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#f4f7ff',
}

const BODY_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '0.86rem',
  lineHeight: 1.45,
  color: '#c3cee3',
}

const META_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 10px',
  margin: 0,
  fontSize: '0.76rem',
  color: '#9dabc7',
}

const CLOSE_STYLE: CSSProperties = {
  border: '1px solid rgba(120, 150, 200, 0.4)',
  borderRadius: '8px',
  background: 'transparent',
  color: '#e8edf7',
  font: 'inherit',
  fontSize: '0.78rem',
  padding: '4px 10px',
  cursor: 'pointer',
}

export interface InspectorCardProps {
  readonly card: InspectorCardModel
  /** Releases the focus; the controller returns the camera. */
  readonly onClose: () => void
}

/**
 * Era-aware object card: category, owning layer, period and the era's own
 * vocabulary for whatever was clicked.
 */
export function InspectorCard({ card, onClose }: InspectorCardProps): ReactElement {
  const titleId = `inspector-card-title-${card.targetId}`
  return (
    <section
      style={CARD_STYLE}
      role="dialog"
      aria-labelledby={titleId}
      aria-live="polite"
      data-testid="inspector-card"
      data-target-id={card.targetId}
      data-category={card.category}
      data-layer-id={card.layerId}
      data-era-id={card.eraId}
    >
      <header style={HEADER_STYLE}>
        <p style={CATEGORY_STYLE} data-testid="inspector-category">
          {card.categoryLabel}
        </p>
        <button
          type="button"
          style={CLOSE_STYLE}
          data-testid="inspector-close"
          onClick={onClose}
          aria-label="Close object details"
        >
          Close (Esc)
        </button>
      </header>
      <h2 id={titleId} style={TITLE_STYLE} data-testid="inspector-title">
        {card.title}
      </h2>
      <p style={BODY_STYLE} data-testid="inspector-description">
        {card.description}
      </p>
      <p style={META_STYLE}>
        <span data-testid="inspector-layer">{`Layer: ${card.layerLabel}`}</span>
        <span data-testid="inspector-era">{`Era: ${card.eraShortLabel} · ${card.eraLabel}`}</span>
        <span data-testid="inspector-origin">{`Source: ${card.origin === 'anchor' ? 'layout anchor' : 'scene object'}`}</span>
      </p>
      {card.periodDetail.length > 0 ? (
        <p style={META_STYLE} data-testid="inspector-period-detail">
          {card.periodDetail}
        </p>
      ) : null}
    </section>
  )
}
