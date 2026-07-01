/** The five selectable years, in chronological order. */
export const PERIOD_YEARS = [1945, 1965, 1985, 2005, 2025] as const;
export type PeriodYear = (typeof PERIOD_YEARS)[number];

export type PeriodChangeHandler = (year: PeriodYear, index: number) => void;

export interface TimelineHandle {
  element: HTMLElement;
  /** Programmatically move the slider to the given year. */
  setValue: (year: PeriodYear) => void;
  /** Remove the overlay and detach all listeners. */
  dispose: () => void;
}

/** Eased slide duration between two stops (within the 300–600ms window). */
const TWEEN_MS = 420;
/** easeInOut cubic curve used for thumb + fill animation. */
const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.55, 1)';
/** Debounce window before the era change is dispatched to listeners. */
const DISPATCH_DEBOUNCE_MS = 120;

/** Maps a stop index (0–4) to a 0–100% position along the rail. */
const indexToPercent = (index: number): number =>
  PERIOD_YEARS.length <= 1 ? 0 : (index / (PERIOD_YEARS.length - 1)) * 100;

/** Clamps an index to the valid range of stops. */
const clampIndex = (index: number): number =>
  Math.max(0, Math.min(PERIOD_YEARS.length - 1, index));

/**
 * Builds a fixed, glassmorphic timeline overlay pinned to the top of the screen.
 *
 * The control is a 5-stop state machine: a draggable, keyboard-accessible thumb
 * that snaps to the years 1945–2025. The visible year badge updates instantly
 * on every input, while the external `onChange` dispatch is debounced so rapid
 * gestures coalesce into a single `setActiveEra` call. Sliding between stops is
 * animated with a 420ms easeInOut tween.
 */
export function createTimeline(
  container: HTMLElement,
  initial: PeriodYear,
  onChange: PeriodChangeHandler,
): TimelineHandle {
  const overlay = document.createElement('div');
  overlay.className = 'timeline-overlay';

  // ---- Header: title + prominent year badge ----
  const head = document.createElement('div');
  head.className = 'timeline-head';

  const title = document.createElement('div');
  title.className = 'timeline-title';
  title.textContent = 'TIMELINE';

  const badge = document.createElement('div');
  badge.className = 'timeline-badge';
  badge.textContent = String(initial);

  head.append(title, badge);

  // ---- Slider rail ----
  const rail = document.createElement('div');
  rail.className = 'timeline-rail';

  const track = document.createElement('div');
  track.className = 'timeline-track';

  const fill = document.createElement('div');
  fill.className = 'timeline-fill';

  // The draggable, focusable thumb — the keyboard-accessible control surface.
  const thumb = document.createElement('div');
  thumb.className = 'timeline-thumb';
  thumb.setAttribute('role', 'slider');
  thumb.tabIndex = 0;
  thumb.setAttribute('aria-label', 'Timeline year selector');
  thumb.setAttribute('aria-valuemin', '0');
  thumb.setAttribute('aria-valuemax', String(PERIOD_YEARS.length - 1));

  track.append(fill, thumb);

  // ---- Tick marks + labelled stops ----
  const ticks = document.createElement('div');
  ticks.className = 'timeline-ticks';

  const labels = document.createElement('div');
  labels.className = 'timeline-labels';

  const stopButtons: HTMLButtonElement[] = [];

  // ---- State machine ----
  let currentIndex = clampIndex(PERIOD_YEARS.indexOf(initial));

  /** Debounced dispatch of the committed era to external listeners. */
  let dispatchTimer: number | undefined;
  const scheduleDispatch = (index: number): void => {
    window.clearTimeout(dispatchTimer);
    dispatchTimer = window.setTimeout(() => {
      onChange(PERIOD_YEARS[index], index);
    }, DISPATCH_DEBOUNCE_MS);
  };

  /** Position the thumb + fill; animated unless suppressed (e.g. while dragging). */
  const positionThumb = (index: number, animate: boolean): void => {
    const pct = `${indexToPercent(index)}%`;
    const transition = animate
      ? `left ${TWEEN_MS}ms ${EASE_IN_OUT}`
      : 'none';
    thumb.style.transition = transition;
    fill.style.transition = `width ${TWEEN_MS}ms ${EASE_IN_OUT}`.replace(
      TWEEN_MS.toString(),
      animate ? String(TWEEN_MS) : '0',
    );
    thumb.style.left = pct;
    fill.style.width = pct;
  };

  /** Repaint all visual affordances for a stop (no dispatch). */
  const render = (index: number, animate: boolean): void => {
    currentIndex = index;
    thumb.setAttribute('aria-valuenow', String(index));
    thumb.setAttribute('aria-valuetext', String(PERIOD_YEARS[index]));
    positionThumb(index, animate);
    badge.textContent = String(PERIOD_YEARS[index]);
    stopButtons.forEach((btn, i) =>
      btn.classList.toggle('is-active', i === index),
    );
  };

  /** Commit a new stop: render + schedule the debounced dispatch. */
  const commit = (index: number, animate: boolean): void => {
    render(index, animate);
    scheduleDispatch(index);
  };

  PERIOD_YEARS.forEach((year, index) => {
    const tick = document.createElement('span');
    tick.className = 'timeline-tick';
    ticks.appendChild(tick);

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'timeline-label';
    label.textContent = String(year);
    label.setAttribute('aria-label', `Select year ${year}`);
    label.addEventListener('click', () => {
      if (index !== currentIndex) commit(index, true);
      thumb.focus();
    });
    labels.appendChild(label);
    stopButtons.push(label);
  });

  // ---- Pointer (drag / click-to-snap) ----
  let dragging = false;

  const indexFromClientX = (clientX: number): number => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return currentIndex;
    const ratio = (clientX - rect.left) / rect.width;
    return clampIndex(Math.round(ratio * (PERIOD_YEARS.length - 1)));
  };

  const onPointerDown = (event: PointerEvent) => {
    dragging = true;
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture unsupported — fall back to window tracking */
    }
    render(indexFromClientX(event.clientX), false);
    scheduleDispatch(currentIndex);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const next = indexFromClientX(event.clientX);
    if (next !== currentIndex) {
      render(next, false);
      scheduleDispatch(next);
    }
  };

  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      track.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
  };

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // ---- Keyboard: arrows step ±1 era, Home/End jump to ends ----
  const onKeyDown = (event: KeyboardEvent) => {
    let next = currentIndex;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = currentIndex - 1;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = currentIndex + 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = PERIOD_YEARS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    next = clampIndex(next);
    if (next !== currentIndex) commit(next, true);
  };
  thumb.addEventListener('keydown', onKeyDown);

  rail.append(track, ticks, labels);
  overlay.append(head, rail);
  container.appendChild(overlay);

  // Paint the initial selection without animation or dispatch.
  render(currentIndex, false);

  const setValue = (year: PeriodYear): void => {
    const index = PERIOD_YEARS.indexOf(year);
    if (index < 0) return;
    commit(index, true);
  };

  const dispose = (): void => {
    window.clearTimeout(dispatchTimer);
    track.removeEventListener('pointerdown', onPointerDown);
    track.removeEventListener('pointermove', onPointerMove);
    track.removeEventListener('pointerup', endDrag);
    track.removeEventListener('pointercancel', endDrag);
    thumb.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  return { element: overlay, setValue, dispose };
}
