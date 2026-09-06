import type { EraId } from '../types';
import { ERA_IDS } from '../types';

/**
 * Top-anchored timeline slider.
 *
 * `createTimeline` mounts a glassmorphism top bar that lets the user pick one
 * of the five eras (1945 / 1965 / 1985 / 2005 / 2025) by clicking a stop,
 * dragging+snapping the thumb, or pressing arrow keys. It renders a live era
 * label, an animated year counter, and an era progress bar, and exposes a small
 * help/about panel documenting the controls.
 *
 * The slider is a pure input surface: it never touches the engine or registry.
 * On every selection it calls `onSelect(era, index)`; during an externally
 * driven transition the integration calls `setTransitioning(true)` to lock the
 * input and `setTransitioning(false)` to restore control.
 */

export type TimelineStop = {
  era: EraId;
  index: number;
  /** 0..1 position of the stop along the track. */
  ratio: number;
};

export interface TimelineOptions {
  /** Milliseconds the year counter spends counting up to its target. Default 450. */
  counterMs?: number;
}

export interface Timeline {
  /** Force the slider to reflect the given era (no onSelect is fired). */
  setEra(era: EraId): void;
  /** Lock (true) or unlock (false) user input, e.g. during a transition. */
  setTransitioning(transitioning: boolean): void;
  /** Remove the timeline DOM and cancel pending timers. */
  dispose(): void;
}

export interface TimelineHandlers {
  /** Fired when the user selects an era (click, drag-snap, or arrow key). */
  onSelect: (era: EraId, index: number) => void;
}

const STOP_LABELS: readonly EraId[] = ERA_IDS;

export function createTimeline(
  container: HTMLElement,
  { onSelect }: TimelineHandlers,
  options: TimelineOptions = {},
): Timeline {
  const counterMs = options.counterMs ?? 450;
  const count = STOP_LABELS.length;

  // --- DOM construction -----------------------------------------------------
  const root = document.createElement('div');
  root.className = 'timeline';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Time period selector');

  const title = document.createElement('span');
  title.className = 'timeline-title';
  title.textContent = 'Era';
  root.appendChild(title);

  const label = document.createElement('span');
  label.className = 'timeline-label';
  label.setAttribute('aria-live', 'polite');
  label.textContent = STOP_LABELS[0];
  root.appendChild(label);

  const yearCounter = document.createElement('span');
  yearCounter.className = 'timeline-year';
  yearCounter.setAttribute('aria-hidden', 'true');
  yearCounter.textContent = STOP_LABELS[0];
  root.appendChild(yearCounter);

  const track = document.createElement('div');
  track.className = 'timeline-track';
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', 'Timeline slider');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(count - 1));
  track.setAttribute('aria-valuenow', '0');
  track.setAttribute('aria-valuetext', STOP_LABELS[0]);
  track.setAttribute('tabindex', '0');

  const progress = document.createElement('div');
  progress.className = 'timeline-progress';
  track.appendChild(progress);

  const stops = document.createElement('div');
  stops.className = 'timeline-stops';
  track.appendChild(stops);

  const stopEls: HTMLElement[] = [];
  STOP_LABELS.forEach((era, index) => {
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'timeline-stop';
    stop.dataset.era = era;
    stop.dataset.index = String(index);
    stop.setAttribute('aria-label', `Go to ${era}`);
    stop.textContent = era;
    stopEls.push(stop);
    stops.appendChild(stop);
  });

  const thumb = document.createElement('div');
  thumb.className = 'timeline-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  track.appendChild(thumb);

  root.appendChild(track);

  const helpToggle = document.createElement('button');
  helpToggle.type = 'button';
  helpToggle.className = 'timeline-help-toggle';
  helpToggle.setAttribute('aria-expanded', 'false');
  helpToggle.setAttribute('aria-controls', 'timeline-help');
  helpToggle.textContent = '?';
  helpToggle.setAttribute('aria-label', 'Help and about');
  root.appendChild(helpToggle);

  const help = document.createElement('div');
  help.id = 'timeline-help';
  help.className = 'timeline-help';
  help.hidden = true;
  help.innerHTML =
    '<h2 class="timeline-help-title">Controls</h2>' +
    '<ul class="timeline-help-list">' +
    '<li>Click a year stop to jump to that era.</li>' +
    '<li>Drag the thumb — it snaps to the nearest year.</li>' +
    '<li>Focus the slider and press <kbd>←</kbd>/<kbd>→</kbd> to walk the years.</li>' +
    '</ul>' +
    '<p class="timeline-help-about">City Time Period Timelapse — five eras, one block, 1945–2025.</p>';
  root.appendChild(help);

  container.appendChild(root);

  // --- State ----------------------------------------------------------------
  let currentIndex = 0;
  let transitioning = false;
  let counterTimer: ReturnType<typeof setTimeout> | null = null;
  let rafHandle: number | null = null;

  // --- Rendering helpers ----------------------------------------------------
  const setThumbPosition = (index: number): void => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    thumb.style.left = `${ratio * 100}%`;
    progress.style.width = `${ratio * 100}%`;
  };

  const render = (index: number): void => {
    currentIndex = index;
    const era = STOP_LABELS[index];
    label.textContent = era;
    track.setAttribute('aria-valuenow', String(index));
    track.setAttribute('aria-valuetext', era);
    setThumbPosition(index);
    stopEls.forEach((el, i) => {
      const active = i === index;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    startYearCounter(era);
  };

  const clearCounter = (): void => {
    if (counterTimer !== null) {
      clearTimeout(counterTimer);
      counterTimer = null;
    }
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  };

  const startYearCounter = (era: EraId): void => {
    clearCounter();
    const target = Number(era);
    const start = Number(yearCounter.textContent) || target;
    const startTime = Date.now();

    const step = (): void => {
      const t = Math.min(1, (Date.now() - startTime) / counterMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + (target - start) * eased);
      yearCounter.textContent = String(value);
      if (t < 1) {
        rafHandle = requestAnimationFrame(step);
      } else {
        rafHandle = null;
        yearCounter.textContent = era;
      }
    };
    rafHandle = requestAnimationFrame(step);
    counterTimer = setTimeout(() => {
      counterTimer = null;
      yearCounter.textContent = era;
    }, counterMs + 60);
  };

  // --- Selection ------------------------------------------------------------
  const select = (index: number): void => {
    if (transitioning || index === currentIndex) return;
    render(index);
    onSelect(STOP_LABELS[index], index);
  };

  // --- Input wiring ---------------------------------------------------------
  stopEls.forEach((el, index) => {
    el.addEventListener('click', () => select(index));
  });

  track.addEventListener('keydown', (e) => {
    if (transitioning) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(Math.min(count - 1, currentIndex + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(Math.max(0, currentIndex - 1));
    }
  });

  // Dragging: pointer capture on the track, snapping to the nearest stop.
  let dragging = false;
  const trackRect = (): DOMRect => track.getBoundingClientRect();
  const ratioFromClientX = (clientX: number): number => {
    const rect = trackRect();
    const w = rect.width || 1;
    return Math.min(1, Math.max(0, (clientX - rect.left) / w));
  };
  const indexFromClientX = (clientX: number): number => {
    const ratio = ratioFromClientX(clientX);
    return Math.round(ratio * (count - 1));
  };

  track.addEventListener('pointerdown', (e) => {
    if (transitioning) return;
    dragging = true;
    track.setPointerCapture(e.pointerId);
    select(indexFromClientX(e.clientX));
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging || transitioning) return;
    select(indexFromClientX(e.clientX));
  });
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  helpToggle.addEventListener('click', () => {
    const open = help.hidden;
    help.hidden = !open;
    helpToggle.setAttribute('aria-expanded', String(open));
  });

  // --- API ------------------------------------------------------------------
  const setEra = (era: EraId): void => {
    const index = STOP_LABELS.indexOf(era);
    if (index === -1) return;
    if (index !== currentIndex) render(index);
  };

  const setTransitioning = (t: boolean): void => {
    transitioning = t;
    track.setAttribute('aria-disabled', String(t));
  };

  const dispose = (): void => {
    clearCounter();
    root.remove();
  };

  // Initial paint.
  render(0);

  return { setEra, setTransitioning, dispose };
}