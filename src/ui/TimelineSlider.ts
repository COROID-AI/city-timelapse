/**
 * Timeline slider UI.
 *
 * Top-anchored glassmorphism panel with five discrete era stops (1945, 1965,
 * 1985, 2005, 2025). The slider is the primary interaction surface for the
 * city timelapse:
 *
 *  - Click a year stop (or click anywhere on the track) to select it.
 *  - Drag the handle along the track; it snaps to the nearest year.
 *  - Press ArrowLeft/ArrowRight (or ArrowUp/ArrowDown) to step, Home/End to
 *    jump, and number keys 1-5 to select a year directly.
 *  - The play/pause button toggles the store's auto-advance mode.
 *
 * Every selection flows through `EraStateStore.setYear()` so all subsystems
 * (transformation engine, camera, SFX, scene modules) react consistently —
 * the slider never mutates scene state directly. The slider subscribes to the
 * store and re-syncs its handle, active stop, labels, and accent color
 * whenever the year changes programmatically (play mode, dev hooks): two-way
 * binding.
 *
 * The optional `onEraChange` callback lets the composition root trigger
 * `CameraController.flyTo(year)` for a cinematic vantage move when the user
 * changes the era from this slider.
 */
import './TimelineSlider.css';
import { ERA_IDS, getEraSpec } from '../engine/eras';
import type { EraId } from '../engine/eras';
import { eraStateStore } from '../engine/EraStateStore';
import type { EraState, EraStateStore } from '../engine/EraStateStore';

/** Options accepted by the TimelineSlider constructor. */
export interface TimelineSliderOptions {
  /** Store to bind to; defaults to the shared singleton `eraStateStore`. */
  readonly store?: EraStateStore;
  /** Invoked when the user changes the era through this slider. */
  readonly onEraChange?: (year: EraId) => void;
}

/** Era-appropriate accent colors, one per year (set as --timeline-accent). */
export const ERA_ACCENTS: Readonly<Record<EraId, string>> = {
  '1945': '#d9a05b', // post-war sepia amber
  '1965': '#6fd3c7', // mid-century pastel mint
  '1985': '#ff5cc8', // eighties neon magenta
  '2005': '#4f9dff', // millennium digital blue
  '2025': '#2ee6d6', // contemporary LED teal
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const STOP_COUNT = ERA_IDS.length;

/** Converts an era index to a track percentage (0..100). */
const indexToPercent = (index: number): number =>
  STOP_COUNT <= 1 ? 0 : (index / (STOP_COUNT - 1)) * 100;

/** True when the pressed key is a plain digit 1..5 (no modifiers). */
const isDigitShortcut = (event: KeyboardEvent): boolean =>
  !event.metaKey && !event.ctrlKey && !event.altKey && /^[1-5]$/.test(event.key);

/**
 * DOM timeline slider bound to an EraStateStore. Mount with `mount(container)`
 * and release with `dispose()`.
 */
export class TimelineSlider {
  private readonly store: EraStateStore;
  private readonly onEraChange: ((year: EraId) => void) | undefined;

  private root: HTMLElement | null = null;
  private handle: HTMLElement | null = null;
  private track: HTMLElement | null = null;
  private progress: HTMLElement | null = null;
  private yearLabel: HTMLElement | null = null;
  private eraLabel: HTMLElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private playIcon: HTMLElement | null = null;
  private readonly stopButtons = new Map<EraId, HTMLButtonElement>();
  private readonly stopClickHandlers = new Map<EraId, () => void>();

  private unsubscribeStore: (() => void) | null = null;
  private dragPointerId: number | null = null;
  private disposed = false;

  constructor(options: TimelineSliderOptions = {}) {
    this.store = options.store ?? eraStateStore;
    this.onEraChange = options.onEraChange;
  }

  /** Builds the slider DOM and appends it to `container`. */
  mount(container: HTMLElement): void {
    if (this.disposed || this.root !== null) return;
    const root = this.buildDom();
    container.appendChild(root);
    this.root = root;
    this.bindEvents();
    this.unsubscribeStore = this.store.subscribe(this.handleStoreChange);
    this.renderState(this.store.getSnapshot());
  }

  /** Detaches listeners, unsubscribes, and removes the DOM. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.unbindEvents();
    this.root?.remove();
    this.root = null;
    this.handle = null;
    this.track = null;
    this.progress = null;
    this.yearLabel = null;
    this.eraLabel = null;
    this.playButton = null;
    this.playIcon = null;
    this.stopButtons.clear();
    this.stopClickHandlers.clear();
    this.dragPointerId = null;
  }

  /** Current store snapshot (useful for tests and dev hooks). */
  getState(): EraState {
    return this.store.getSnapshot();
  }

  // -------------------------------------------------------------------------
  // DOM construction
  // -------------------------------------------------------------------------

  private buildDom(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'timeline-slider';
    root.dataset.testid = 'timeline-slider';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'City era timeline');

    const panel = document.createElement('div');
    panel.className = 'timeline-panel';
    root.appendChild(panel);

    // Header: current year + play/pause.
    const header = document.createElement('div');
    header.className = 'timeline-header';
    panel.appendChild(header);

    const current = document.createElement('div');
    current.className = 'timeline-current';
    header.appendChild(current);

    const yearLabel = document.createElement('span');
    yearLabel.className = 'timeline-year-label';
    yearLabel.dataset.testid = 'timeline-year-label';
    current.appendChild(yearLabel);
    this.yearLabel = yearLabel;

    const eraLabel = document.createElement('span');
    eraLabel.className = 'timeline-era-label';
    current.appendChild(eraLabel);
    this.eraLabel = eraLabel;

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'timeline-play';
    playButton.dataset.testid = 'timeline-play';
    playButton.setAttribute('aria-label', 'Play era timelapse');
    const playIcon = document.createElement('span');
    playIcon.className = 'timeline-play-icon';
    playIcon.setAttribute('aria-hidden', 'true');
    playButton.appendChild(playIcon);
    const playText = document.createElement('span');
    playText.className = 'timeline-play-text';
    playButton.appendChild(playText);
    header.appendChild(playButton);
    this.playButton = playButton;
    this.playIcon = playIcon;

    // Track: rail, progress fill, handle, and discrete stops.
    const track = document.createElement('div');
    track.className = 'timeline-track';
    track.dataset.testid = 'timeline-track';
    panel.appendChild(track);
    this.track = track;

    const rail = document.createElement('div');
    rail.className = 'timeline-rail';
    track.appendChild(rail);

    const progress = document.createElement('div');
    progress.className = 'timeline-progress';
    progress.dataset.testid = 'timeline-progress';
    track.appendChild(progress);
    this.progress = progress;

    const handle = document.createElement('div');
    handle.className = 'timeline-handle';
    handle.dataset.testid = 'timeline-handle';
    handle.setAttribute('role', 'slider');
    handle.tabIndex = 0;
    handle.setAttribute('aria-valuemin', '1');
    handle.setAttribute('aria-valuemax', String(STOP_COUNT));
    handle.setAttribute('aria-label', 'Select era year');
    track.appendChild(handle);
    this.handle = handle;

    const stops = document.createElement('div');
    stops.className = 'timeline-stops';
    track.appendChild(stops);

    for (const [index, year] of ERA_IDS.entries()) {
      const stop = document.createElement('button');
      stop.type = 'button';
      stop.className = 'timeline-stop';
      stop.dataset.year = year;
      stop.dataset.testid = `timeline-stop-${year}`;
      stop.style.left = `${indexToPercent(index)}%`;
      stop.setAttribute('aria-label', `Select era ${year}`);
      stop.setAttribute('aria-pressed', 'false');

      const dot = document.createElement('span');
      dot.className = 'timeline-stop-dot';
      stop.appendChild(dot);

      const label = document.createElement('span');
      label.className = 'timeline-stop-label';
      label.textContent = year;
      stop.appendChild(label);

      stops.appendChild(stop);
      this.stopButtons.set(year, stop);
    }

    // Keyboard hint.
    const hint = document.createElement('p');
    hint.className = 'timeline-hint';
    hint.textContent = 'Drag · Click · ← → arrows · 1–5 keys';
    panel.appendChild(hint);

    return root;
  }

  // -------------------------------------------------------------------------
  // Store binding (two-way)
  // -------------------------------------------------------------------------

  private handleStoreChange = (state: EraState): void => {
    this.renderState(state);
  };

  /** Re-renders handle position, active stop, labels, and accent from state. */
  private renderState(state: EraState): void {
    const year = state.selectedYear;
    const index = ERA_IDS.indexOf(year);
    const percent = indexToPercent(index);
    const spec = getEraSpec(year);
    const accent = ERA_ACCENTS[year];

    if (this.root) {
      this.root.style.setProperty('--timeline-accent', accent);
    }
    if (this.handle) {
      this.handle.style.left = `${percent}%`;
      this.handle.setAttribute('aria-valuenow', String(index + 1));
      this.handle.setAttribute('aria-valuetext', `${year} (${spec.label})`);
    }
    if (this.progress) {
      this.progress.style.width = `${percent}%`;
    }
    if (this.yearLabel) {
      this.yearLabel.textContent = year;
    }
    if (this.eraLabel) {
      this.eraLabel.textContent = spec.label;
    }
    for (const [stopYear, stop] of this.stopButtons) {
      const active = stopYear === year;
      stop.classList.toggle('is-active', active);
      stop.setAttribute('aria-pressed', String(active));
    }
    if (this.playButton) {
      const playing = state.isPlaying;
      this.playButton.classList.toggle('is-playing', playing);
      this.playButton.setAttribute('aria-pressed', String(playing));
      this.playButton.setAttribute('aria-label', playing ? 'Pause era timelapse' : 'Play era timelapse');
      const text = this.playButton.querySelector('.timeline-play-text');
      if (text) {
        text.textContent = playing ? 'Pause' : 'Play';
      }
      if (this.playIcon) {
        this.playIcon.innerHTML = playing
          ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
          : '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      }
    }
  }

  // -------------------------------------------------------------------------
  // User input
  // -------------------------------------------------------------------------

  private setYearFromIndex(index: number): void {
    const clamped = clamp(index, 0, STOP_COUNT - 1);
    const year = ERA_IDS[clamped];
    if (year === this.store.getSnapshot().selectedYear) return;
    this.store.setYear(year);
    this.onEraChange?.(year);
  }

  private selectAtClientX(clientX: number): void {
    const track = this.track;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const index = Math.round(ratio * (STOP_COUNT - 1));
    this.setYearFromIndex(index);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button')) return;
    event.preventDefault();
    this.dragPointerId = event.pointerId;
    try {
      this.track?.setPointerCapture?.(event.pointerId);
    } catch {
      /* pointer capture unavailable (e.g. happy-dom) */
    }
    this.selectAtClientX(event.clientX);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.disposed || this.dragPointerId === null || event.pointerId !== this.dragPointerId) return;
    this.selectAtClientX(event.clientX);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.disposed || this.dragPointerId === null || event.pointerId !== this.dragPointerId) return;
    this.dragPointerId = null;
    try {
      this.track?.releasePointerCapture?.(event.pointerId);
    } catch {
      /* pointer capture unavailable */
    }
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.dragPointerId) {
      this.dragPointerId = null;
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || event.metaKey || event.ctrlKey || event.altKey) return;
    const currentIndex = ERA_IDS.indexOf(this.store.getSnapshot().selectedYear);
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = currentIndex + 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = STOP_COUNT - 1;
        break;
      default:
        if (isDigitShortcut(event)) {
          nextIndex = Number(event.key) - 1;
        }
    }

    if (nextIndex !== null && nextIndex >= 0 && nextIndex < STOP_COUNT && nextIndex !== currentIndex) {
      event.preventDefault();
      this.setYearFromIndex(nextIndex);
    }
  };

  private handlePlayClick = (): void => {
    if (this.disposed) return;
    if (this.store.getSnapshot().isPlaying) {
      this.store.stop();
    } else {
      this.store.play();
    }
    // The store does not notify subscribers for play()/stop() state changes
    // (only setYear notifies), so re-render the button state immediately.
    this.renderState(this.store.getSnapshot());
  };

  private handleStopClick = (year: EraId): void => {
    if (this.disposed) return;
    this.setYearFromIndex(ERA_IDS.indexOf(year));
  };

  // -------------------------------------------------------------------------
  // Event binding
  // -------------------------------------------------------------------------

  private bindEvents(): void {
    this.track?.addEventListener('pointerdown', this.handlePointerDown);
    this.track?.addEventListener('pointermove', this.handlePointerMove);
    this.track?.addEventListener('pointerup', this.handlePointerUp);
    this.track?.addEventListener('pointercancel', this.handlePointerCancel);
    this.root?.addEventListener('keydown', this.handleKeyDown);
    this.playButton?.addEventListener('click', this.handlePlayClick);
    for (const [year, stop] of this.stopButtons) {
      const handler = (): void => this.handleStopClick(year);
      this.stopClickHandlers.set(year, handler);
      stop.addEventListener('click', handler);
    }
  }

  private unbindEvents(): void {
    this.track?.removeEventListener('pointerdown', this.handlePointerDown);
    this.track?.removeEventListener('pointermove', this.handlePointerMove);
    this.track?.removeEventListener('pointerup', this.handlePointerUp);
    this.track?.removeEventListener('pointercancel', this.handlePointerCancel);
    this.root?.removeEventListener('keydown', this.handleKeyDown);
    this.playButton?.removeEventListener('click', this.handlePlayClick);
    for (const [year, stop] of this.stopButtons) {
      const handler = this.stopClickHandlers.get(year);
      if (handler) {
        stop.removeEventListener('click', handler);
      }
    }
  }
}