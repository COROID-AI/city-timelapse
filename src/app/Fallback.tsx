/**
 * Fallback surfaces: what the page shows when the block cannot be rendered.
 *
 * Two failures are possible in the composed experience, and neither may leave a
 * blank page or a dead UI:
 *
 * - **WebGL unavailable.** The renderer cannot create a context, so no 3D is
 *   drawn at all. The page still shows the block's shell, the timeline and the
 *   controls, with a clear explanation of what is missing.
 * - **A layer failed to build.** The renderer is alive but one era payload
 *   (storefronts, props, vehicles, atmosphere) threw while being built. The
 *   canvas would otherwise show an empty street, so a non-blocking banner names
 *   the layer and the rest of the page keeps working.
 *
 * Both surfaces are status regions (`role="status"` / `role="alert"`), never
 * modals, and they never swallow pointer events outside the retry button: the
 * viewer can still drag the timeline and change quality while the message is up.
 */

import type { CSSProperties, ReactElement } from 'react'

/** Why the block is degraded. */
export type FallbackReason = 'webgl-unavailable' | 'layer-failure' | 'unknown'

/** Copy shown when the browser cannot create a WebGL context. */
export const WEBGL_FALLBACK_TITLE = 'This browser cannot draw the block'

export const WEBGL_FALLBACK_MESSAGE =
  'WebGL is unavailable, so the 3D city block cannot be rendered on this device. The timeline still shows which period you asked for, and everything else on the page works.'

/** Copy shown when one era content layer failed to build. */
export const LAYER_FALLBACK_TITLE = 'Part of the block failed to build'

export const LAYER_FALLBACK_MESSAGE =
  'One period layer threw while it was being generated, so the block is showing the parts that did build. The timeline and the controls still work.'

/** Copy shown for an unexpected failure. */
export const UNKNOWN_FALLBACK_TITLE = 'The scene hit an unexpected problem'

export const UNKNOWN_FALLBACK_MESSAGE =
  'The block could not finish building. Reload to try again; the timeline and the controls stay usable.'

/** The prose one fallback renders. */
export interface FallbackCopy {
  readonly title: string
  readonly message: string
  /** Label of the retry affordance. */
  readonly retryLabel: string
}

/** Resolves the copy for one reason, naming the failed layer when known. */
export function fallbackCopy(reason: FallbackReason, layerId?: string | null): FallbackCopy {
  switch (reason) {
    case 'webgl-unavailable':
      return { title: WEBGL_FALLBACK_TITLE, message: WEBGL_FALLBACK_MESSAGE, retryLabel: 'Reload' }
    case 'layer-failure':
      return {
        title: LAYER_FALLBACK_TITLE,
        message:
          layerId === undefined || layerId === null || layerId.length === 0
            ? LAYER_FALLBACK_MESSAGE
            : `${LAYER_FALLBACK_MESSAGE} (layer: ${layerId})`,
        retryLabel: 'Rebuild',
      }
    case 'unknown':
      return { title: UNKNOWN_FALLBACK_TITLE, message: UNKNOWN_FALLBACK_MESSAGE, retryLabel: 'Reload' }
  }
}

/** Props of {@link CompositionFallback}. */
export interface CompositionFallbackProps {
  readonly reason: FallbackReason
  /** Layer slot that failed, for `layer-failure`. */
  readonly layerId?: string | null
  /** Overrides the resolved message (the composition's own error text). */
  readonly message?: string | null
  /** Technical detail line, e.g. the raw error message. */
  readonly detail?: string | null
  /** Shows a retry affordance when provided. */
  readonly onRetry?: (() => void) | undefined
  readonly className?: string
}

const BANNER_STYLE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: 'min(30rem, calc(100% - 2rem))',
  padding: '1rem 1.25rem',
  borderRadius: '0.9rem',
  background: 'rgba(10, 14, 24, 0.9)',
  border: '1px solid rgba(255, 190, 150, 0.35)',
  color: '#f4ecdf',
  font: '500 0.85rem/1.45 system-ui, sans-serif',
  textAlign: 'center',
  pointerEvents: 'none',
  zIndex: 5,
}

const BUTTON_STYLE: CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.4rem 0.9rem',
  borderRadius: '999px',
  border: '1px solid rgba(255, 220, 190, 0.5)',
  background: 'rgba(255, 220, 190, 0.12)',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  pointerEvents: 'auto',
}

/**
 * The fallback banner.
 *
 * `data-testid="scene-fallback"` is the handle the browser checks use; the
 * element sits above the canvas (or above its empty host) and explains the
 * degraded state without taking the page over.
 */
export function CompositionFallback({
  reason,
  layerId = null,
  message = null,
  detail = null,
  onRetry,
  className,
}: CompositionFallbackProps): ReactElement {
  const copy = fallbackCopy(reason, layerId)
  return (
    <div
      className={className}
      style={BANNER_STYLE}
      data-testid="scene-fallback"
      data-reason={reason}
      data-layer={layerId ?? ''}
      role={reason === 'layer-failure' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <strong data-testid="scene-fallback-title">{copy.title}</strong>
      <p style={{ margin: '0.4rem 0 0' }} data-testid="scene-fallback-message">
        {message ?? copy.message}
      </p>
      {detail === null ? null : (
        <p style={{ margin: '0.35rem 0 0', opacity: 0.72, fontSize: '0.75rem' }} data-testid="scene-fallback-detail">
          {detail}
        </p>
      )}
      {onRetry === undefined ? null : (
        <button type="button" style={BUTTON_STYLE} data-testid="scene-fallback-retry" onClick={onRetry}>
          {copy.retryLabel}
        </button>
      )}
    </div>
  )
}
