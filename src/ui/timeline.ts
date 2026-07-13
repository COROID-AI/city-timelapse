// =============================================================================
// City Timelapse — Timeline Slider UI
//
// A fixed, top-of-viewport DOM timeline with six era stops (1945 → 2055).
// The slider is pure HTML/CSS overlaid on the WebGL canvas — no Three.js UI.
//
// Interactions:
//   • Drag the thumb          — follows the pointer, snaps to nearest era on release.
//   • Click an era label      — animated jump to that era.
//   • Arrow / Home / End keys — move by one era / jump to first or last.
//   • Click the rail          — animated jump to nearest era at that point.
//
// Writes to EraState.setEraId() on every user action and reads
// EraState.subscribe() to keep the thumb, progress bar, year indicator, and
// ARIA attributes in sync — including during animated ~1.5 s transitions.
// =============================================================================

import { ERA_IDS, ERA_REGISTRY, getEraSpec, type EraId } from '../eras';
import type { EraState } from '../scene/EraState';

// ---------------------------------------------------------------------------
// Styles (injected once as a <style> element)
// ---------------------------------------------------------------------------

const TIMELINE_CSS = `
.city-timeline {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  padding: 14px 48px 16px;
  background: linear-gradient(
    to bottom,
    rgba(6, 10, 22, 0.82) 0%,
    rgba(6, 10, 22, 0.48) 65%,
    rgba(6, 10, 22, 0) 100%
  );
  backdrop-filter: blur(12px) saturate(1.3);
  -webkit-backdrop-filter: blur(12px) saturate(1.3);
  box-sizing: border-box;
}

.city-timeline__track {
  position: relative;
  height: 52px;
  max-width: 1200px;
  margin: 0 auto;
  pointer-events: auto;
  touch-action: none;
}

.city-timeline__rail {
  position: absolute;
  top: 18px;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

.city-timeline__progress {
  position: absolute;
  top: 18px;
  left: 0;
  height: 4px;
  background: linear-gradient(
    to right,
    rgba(90, 160, 255, 0.4),
    rgba(130, 200, 255, 0.95)
  );
  border-radius: 2px;
  pointer-events: none;
}

.city-timeline__stop {
  position: absolute;
  top: 18px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.city-timeline__tick {
  width: 10px;
  height: 10px;
  margin-top: -5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.4);
  transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.city-timeline__stop--active .city-timeline__tick {
  background: rgb(130, 200, 255);
  border-color: rgb(190, 225, 255);
  box-shadow: 0 0 14px rgba(100, 180, 255, 0.7);
}

.city-timeline__label {
  appearance: none;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  padding: 3px 8px;
  margin-top: 10px;
  border-radius: 5px;
  transition: color 0.2s ease, background 0.2s ease;
  white-space: nowrap;
  pointer-events: auto;
}

.city-timeline__label:hover {
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.07);
}

.city-timeline__label--active {
  color: rgb(180, 220, 255);
}

.city-timeline__label:focus-visible {
  outline: 2px solid rgba(100, 180, 255, 0.8);
  outline-offset: 2px;
}

.city-timeline__thumb {
  position: absolute;
  top: 18px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 35%,
    rgb(205, 232, 255),
    rgb(80, 150, 230)
  );
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.4),
    0 0 18px rgba(100, 180, 255, 0.5);
  cursor: grab;
  touch-action: none;
  transform: translate(-50%, -50%);
  transition: box-shadow 0.2s ease, transform 0.1s ease;
}

.city-timeline__thumb--dragging {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.18);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.5),
    0 0 28px rgba(100, 180, 255, 0.75);
}

.city-timeline__thumb:focus-visible {
  outline: 2px solid rgba(100, 180, 255, 1);
  outline-offset: 4px;
}

.city-timeline__year {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.96);
  background: rgba(6, 10, 22, 0.9);
  padding: 4px 12px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(100, 180, 255, 0.25);
}

@media (max-width: 1024px) {
  .city-timeline {
    padding: 12px 24px 14px;
  }
}

@media (max-width: 900px) {
  .city-timeline {
    padding: 10px 16px 12px;
  }
  .city-timeline__label {
    font-size: 10px;
    padding: 2px 5px;
    letter-spacing: 0;
  }
  .city-timeline__year {
    font-size: 11px;
    padding: 3px 8px;
  }
  .city-timeline__thumb {
    width: 18px;
    height: 18px;
  }
  .city-timeline__tick {
    width: 8px;
    height: 8px;
    margin-top: -4px;
  }
}

@media (max-width: 768px) {
  .city-timeline {
    padding: 8px 10px 10px;
  }
  .city-timeline__label {
    font-size: 9px;
    padding: 1px 3px;
  }
}
`;

let styleElement: HTMLStyleElement | null = null;

/** Inject the timeline CSS into <head> exactly once. */
function ensureStyles(): void {
  if (styleElement) return;
  styleElement = document.createElement('style');
  styleElement.id = 'city-timeline-styles';
  styleElement.textContent = TIMELINE_CSS;
  document.head.appendChild(styleElement);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// ---------------------------------------------------------------------------
// Timeline mount
// ---------------------------------------------------------------------------

/**
 * Mount the timeline slider at the top of the viewport.
 *
 * Creates a fixed-position DOM bar with six era labels, a draggable thumb,
 * a progress fill, and a year indicator. All user actions write to
 * {@link EraState.setEraId}; a subscription keeps visuals synced during
 * animated transitions.
 *
 * @param eraState  Shared era state controller.
 * @returns         Cleanup function — removes DOM, listeners, and subscription.
 */
export function mountTimeline(eraState: EraState): () => void {
  ensureStyles();

  // --- DOM construction ----------------------------------------------------

  const container = document.createElement('div');
  container.className = 'city-timeline';

  const track = document.createElement('div');
  track.className = 'city-timeline__track';

  const rail = document.createElement('div');
  rail.className = 'city-timeline__rail';

  const progress = document.createElement('div');
  progress.className = 'city-timeline__progress';

  // Era stops: tick + clickable label for each era (chronological order)
  const stops: HTMLDivElement[] = [];
  const labels: HTMLButtonElement[] = [];

  ERA_REGISTRY.forEach((spec, index) => {
    const positionPct = (index / (ERA_IDS.length - 1)) * 100;

    const stop = document.createElement('div');
    stop.className = 'city-timeline__stop';
    stop.style.left = `${positionPct}%`;

    const tick = document.createElement('div');
    tick.className = 'city-timeline__tick';

    const label = document.createElement('button');
    label.className = 'city-timeline__label';
    label.type = 'button';
    label.dataset.era = spec.id;
    label.textContent = String(spec.year);
    label.setAttribute('aria-label', `${spec.year} — ${spec.label}`);

    stop.appendChild(tick);
    stop.appendChild(label);
    track.appendChild(stop);
    stops.push(stop);
    labels.push(label);
  });

  // Thumb (the draggable slider handle)
  const thumb = document.createElement('div');
  thumb.className = 'city-timeline__thumb';
  thumb.setAttribute('role', 'slider');
  thumb.setAttribute('tabindex', '0');
  thumb.setAttribute('aria-label', 'City era selector');
  thumb.setAttribute('aria-orientation', 'horizontal');
  thumb.setAttribute('aria-valuemin', String(ERA_REGISTRY[0].year));
  thumb.setAttribute(
    'aria-valuemax',
    String(ERA_REGISTRY[ERA_REGISTRY.length - 1].year),
  );

  const yearBadge = document.createElement('span');
  yearBadge.className = 'city-timeline__year';
  thumb.appendChild(yearBadge);

  track.appendChild(rail);
  track.appendChild(progress);
  track.appendChild(thumb);
  container.appendChild(track);
  document.body.appendChild(container);

  // --- Interaction state ---------------------------------------------------

  let dragging = false;
  let dragT = 0;

  // --- Visual update -------------------------------------------------------

  /**
   * Sync every visual element to the given era and normalized position.
   * Called from the EraState subscriber (during animations) and directly
   * during drag (with the pointer-derived `t`).
   */
  function updateVisuals(eraId: EraId, t: number): void {
    const pct = `${t * 100}%`;
    thumb.style.left = pct;
    progress.style.width = pct;

    const spec = getEraSpec(eraId);
    yearBadge.textContent = String(spec.year);
    thumb.setAttribute('aria-valuenow', String(spec.year));
    thumb.setAttribute('aria-valuetext', `${spec.year} ${spec.label}`);

    const activeIndex = ERA_IDS.indexOf(eraId);
    for (let i = 0; i < stops.length; i++) {
      stops[i].classList.toggle('city-timeline__stop--active', i === activeIndex);
      labels[i].classList.toggle('city-timeline__label--active', i === activeIndex);
    }
  }

  // Initialise from current EraState
  updateVisuals(eraState.getEraId(), eraState.getT());

  // --- EraState subscription ----------------------------------------------

  const unsubscribe = eraState.subscribe((update) => {
    if (!dragging) {
      updateVisuals(update.eraId, update.t);
    }
  });

  // --- Pointer → normalized t ---------------------------------------------

  function pointerToT(clientX: number): number {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }

  function nearestEraIndex(t: number): number {
    const last = ERA_IDS.length - 1;
    if (last <= 0) return 0;
    return clamp(Math.round(t * last), 0, last);
  }

  // --- Thumb drag (pointer events with capture) ---------------------------

  function onThumbPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    dragT = pointerToT(e.clientX);
    thumb.classList.add('city-timeline__thumb--dragging');
    try {
      thumb.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture may fail if already captured */
    }
    // Show nearest era during drag for immediate feedback
    updateVisuals(ERA_IDS[nearestEraIndex(dragT)], dragT);
  }

  function onThumbPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    dragT = pointerToT(e.clientX);
    updateVisuals(ERA_IDS[nearestEraIndex(dragT)], dragT);
  }

  function onThumbPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('city-timeline__thumb--dragging');
    try {
      thumb.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    // Snap to nearest era instantly — the thumb is already at that position
    eraState.setEraId(ERA_IDS[nearestEraIndex(dragT)], { durationMs: 0 });
  }

  thumb.addEventListener('pointerdown', onThumbPointerDown);
  thumb.addEventListener('pointermove', onThumbPointerMove);
  thumb.addEventListener('pointerup', onThumbPointerUp);
  thumb.addEventListener('pointercancel', onThumbPointerUp);

  // --- Keyboard (Arrow / Home / End) --------------------------------------

  function onKeyDown(e: KeyboardEvent): void {
    const current = ERA_IDS.indexOf(eraState.getEraId());
    let next = current;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, current - 1);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(ERA_IDS.length - 1, current + 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = ERA_IDS.length - 1;
        break;
      default:
        return; // ignore unhandled keys
    }

    if (next !== current) {
      e.preventDefault();
      eraState.setEraId(ERA_IDS[next]);
    }
  }

  thumb.addEventListener('keydown', onKeyDown);

  // --- Label clicks (animated jump) ---------------------------------------

  const labelHandlers: Array<(e: MouseEvent) => void> = labels.map(
    (label, index) => {
      const handler = (e: MouseEvent): void => {
        e.preventDefault();
        eraState.setEraId(ERA_IDS[index]);
        thumb.focus();
      };
      label.addEventListener('click', handler);
      return handler;
    },
  );

  // --- Rail click (jump to nearest era at click position) -----------------

  function onTrackPointerDown(e: PointerEvent): void {
    const target = e.target as HTMLElement | null;
    // Only react to clicks on the rail or track itself — not labels or thumb
    if (
      !target ||
      (!target.classList.contains('city-timeline__rail') &&
        !target.classList.contains('city-timeline__track'))
    ) {
      return;
    }
    const t = pointerToT(e.clientX);
    eraState.setEraId(ERA_IDS[nearestEraIndex(t)]);
  }

  track.addEventListener('pointerdown', onTrackPointerDown);

  // --- Cleanup -------------------------------------------------------------

  return () => {
    thumb.removeEventListener('pointerdown', onThumbPointerDown);
    thumb.removeEventListener('pointermove', onThumbPointerMove);
    thumb.removeEventListener('pointerup', onThumbPointerUp);
    thumb.removeEventListener('pointercancel', onThumbPointerUp);
    thumb.removeEventListener('keydown', onKeyDown);
    track.removeEventListener('pointerdown', onTrackPointerDown);
    labels.forEach((label, i) =>
      label.removeEventListener('click', labelHandlers[i]),
    );
    unsubscribe();
    container.remove();
  };
}
