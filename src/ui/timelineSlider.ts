import { EraState } from '../types/era';
import { eraRegistry } from '../state/eraRegistry';
import { CANONICAL_ERAS } from '../types/city';
import { createEraTitleReadout, EraTitleReadout } from './eraTitleReadout';
import { createEraCyclePlayMode, EraCyclePlayMode } from './eraCyclePlayMode';

/**
 * TimelineSlider: the polished top control that snaps between the five
 * canonical years and drives EraState.
 *
 * Features:
 *  - A prominent era title readout ("1945 — Post-War", "2025 — Smart City").
 *  - Five labeled year stops with tick marks at each stop.
 *  - Animated slide-snap between stops (the thumb eases toward the active stop).
 *  - Keyboard accessibility: Left/Right/Up/Down arrows and Home/End move
 *    between years; the container is a focusable `role="slider"` with ARIA
 *    valuemin/valuemax/valuenow and a visible focus ring.
 *  - An optional play/pause "cycle eras" button.
 *  - The slider remains the single EraState driver; the overlay never
 *    intercepts canvas input except on the control itself.
 *
 * The slider accepts an optional title readout so tests can inject a stub and
 * assert the wiring; it defaults to the real readout.
 */
export interface TimelineSlider {
  /** The root DOM element of the slider. */
  readonly element: HTMLDivElement;
  /** The era title readout (year — era label). */
  readonly readout: EraTitleReadout;
  /** The play/pause cycle button. */
  readonly playMode: EraCyclePlayMode;
  /** The five year stop buttons, in ascending order. */
  readonly yearButtons: readonly HTMLButtonElement[];
  /** Re-sync highlight and thumb from the current era state. */
  sync(): void;
  /** Dispose: remove listeners and children. */
  dispose(): void;
}

export interface TimelineSliderOptions {
  /** Optional injected title readout (for tests). Defaults to the real one. */
  readout?: EraTitleReadout;
}

/** A single year stop, exposed for tests. */
export interface YearStop {
  year: number;
  label: string;
}

/** The five canonical year stops. */
export const YEAR_STOPS: readonly YearStop[] = Object.freeze(
  CANONICAL_ERAS.map((year) => {
    const meta = eraRegistry.find(year);
    return Object.freeze({ year, label: meta ? meta.label : String(year) });
  }),
);

export function createTimelineSlider(
  overlay: HTMLElement,
  eraState: EraState,
  options: TimelineSliderOptions = {},
): TimelineSlider {
  const container = document.createElement('div');
  container.className = 'timeline';

  const readout = options.readout ?? createEraTitleReadout(eraState);
  container.appendChild(readout.element);

  const controls = document.createElement('div');
  controls.className = 'timeline-controls';

  // The focusable track. Using a single `role="slider"` element with arrow-key
  // handling keeps the control keyboard-accessible while the year buttons
  // remain individually clickable / tabbable for pointer and touch users.
  const track = document.createElement('div');
  track.className = 'timeline-track';
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', 'Era timeline');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(CANONICAL_ERAS.length - 1));
  track.setAttribute('aria-valuetext', '');
  track.setAttribute('tabindex', '0');

  const yearButtons: HTMLButtonElement[] = [];

  CANONICAL_ERAS.forEach((year) => {
    const meta = eraRegistry.find(year);
    const button = document.createElement('button');
    button.className = 'timeline-year';
    button.type = 'button';
    button.dataset.year = String(year);
    button.textContent = meta ? meta.label : String(year);
    button.addEventListener('click', () => {
      eraState.setYear(year);
    });
    track.appendChild(button);
    yearButtons.push(button);
  });

  // The animated thumb that glides between stops.
  const thumb = document.createElement('div');
  thumb.className = 'timeline-thumb';
  track.appendChild(thumb);

  controls.appendChild(track);
  container.appendChild(controls);

  // Play/pause button hosted next to the track.
  const playMode = createEraCyclePlayMode(eraState, controls);

  // --- Keyboard navigation ---
  const moveTo = (index: number) => {
    const clamped = Math.max(0, Math.min(CANONICAL_ERAS.length - 1, index));
    eraState.setYear(CANONICAL_ERAS[clamped]);
  };

  const handleKey = (event: KeyboardEvent) => {
    const currentIndex = CANONICAL_ERAS.indexOf(eraState.year);
    let index: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        index = currentIndex + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        index = currentIndex - 1;
        break;
      case 'Home':
        index = 0;
        break;
      case 'End':
        index = CANONICAL_ERAS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    moveTo(index);
  };

  track.addEventListener('keydown', handleKey);

  // --- Sync highlight, thumb, and ARIA values ---
  const sync = () => {
    const current = eraState.year;
    const index = CANONICAL_ERAS.indexOf(current);
    yearButtons.forEach((btn, i) => {
      btn.classList.toggle('active', i === index);
    });
    const total = CANONICAL_ERAS.length - 1;
    const percent = total === 0 ? 0 : (index / total) * 100;
    thumb.style.left = `${percent}%`;
    track.setAttribute('aria-valuenow', String(index));
    const meta = eraRegistry.find(current);
    track.setAttribute('aria-valuetext', meta ? meta.description : String(current));
  };

  const unsubscribe = eraState.subscribe(sync);
  sync();

  overlay.appendChild(container);

  return {
    element: container,
    readout,
    playMode,
    yearButtons,
    sync,
    dispose() {
      unsubscribe();
      playMode.dispose();
      if (options.readout === undefined) {
        readout.dispose();
      }
      container.remove();
    },
  };
}