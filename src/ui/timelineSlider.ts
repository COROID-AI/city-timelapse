/**
 * Top timeline slider HUD for the City Time Period Timelapse.
 *
 * Framework-free DOM overlay exposed through the `timeline-ui` shared interface
 * and mounted by scene-integration over the scene canvas. The HUD renders the
 * exact five timeline stops from `ERA_YEARS` (1945, 1965, 1985, 2005, 2025) as
 * a fixed bar pinned to the top of the viewport, with:
 *
 *  - a prominent year readout,
 *  - click / drag snapping between stops plus keyboard navigation
 *    (ArrowLeft / ArrowRight between adjacent years, Home / End to first/last),
 *  - an EraStore-driven current-stop highlight and transition progress
 *    indicator (animating while the store reports a transition in flight),
 *  - an AudioEngine-backed mute toggle, and
 *  - a controls help overlay ('?' key or button; Esc / close to dismiss).
 *
 * The module never touches canvas/WebGL and never constructs an AudioContext:
 * every sound hook (mute state, click feedback) routes through the provided
 * audio surface, which the real `AudioEngine` satisfies structurally.
 */

import { clamp } from '../lib/math';
import { type EraStore, type EraStoreSnapshot } from '../era/state';
import { ERA_YEARS, type EraId } from '../era/types';
import { createHelpOverlay } from './helpOverlay';
import './hud.css';

/**
 * Minimal audio surface the HUD depends on. `AudioEngine` (src/audio) matches
 * this structurally, so the HUD stays decoupled from the Web Audio graph.
 */
export interface TimelineSliderAudio {
  isMuted(): boolean;
  mute(rampDuration?: number): void;
  unmute(rampDuration?: number): void;
  toggleMute(rampDuration?: number): boolean;
  playClick(frequency?: number, duration?: number): unknown;
}

/** Constructor options for `createTimelineSlider`. */
export interface TimelineSliderOptions {
  /** Container the HUD mounts into (typically the app root over the canvas). */
  container: HTMLElement;
  /** Era store driving highlight, readout and transition progress. */
  store: EraStore;
  /** Audio engine (or compatible stub) for mute state and click feedback. */
  audio: TimelineSliderAudio;
  /** Invoked when a user selection publishes a genuine era change. */
  onSelect?: (era: EraId) => void;
}

/** Interactable handle returned by `createTimelineSlider`. */
export interface TimelineSlider {
  /** Mounted HUD root element (the fixed top bar container). */
  readonly element: HTMLElement;
  /** The timeline stops in ascending order — `ERA_YEARS`. */
  readonly years: readonly EraId[];
  /** Currently selected era, per the store. */
  readonly currentEra: EraId;
  /** True while the store reports an in-flight transition. */
  readonly isTransitioning: boolean;
  /** Latest transition progress in [0, 1] (0 when settled). */
  readonly transitionProgress: number;
  /** Whether the audio engine is currently muted. */
  readonly muted: boolean;
  /** Whether the help overlay is open. */
  readonly helpVisible: boolean;
  /**
   * Select `era` through the store. Returns true only when the era actually
   * changed (and the onSelect callback fired). Requests for the current era
   * are idempotent no-ops.
   */
  selectEra(era: EraId): boolean;
  /** Toggle the audio mute state; returns the new muted state. */
  toggleMute(): boolean;
  /** Open or close the controls help overlay. */
  setHelpVisible(visible: boolean): void;
  /** Detach listeners, unsubscribing from the store, and remove the DOM. */
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG child node with the given attributes. */
function svgChild(tag: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

/** Inline SVG speaker glyph (on or muted) — no icon fonts or network assets. */
function speakerIcon(muted: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(muted ? 'hud-icon-speaker-off' : 'hud-icon-speaker-on');

  const body = svgChild('rect', {
    x: '7',
    y: '6',
    width: '10',
    height: '12',
    rx: '2.5',
    fill: 'currentColor',
  });
  svg.append(body);

  if (muted) {
    const slash = svgChild('path', {
      d: 'M6.5 18.5 L17.5 6.5',
      stroke: 'currentColor',
      'stroke-width': '2.4',
      'stroke-linecap': 'round',
    });
    svg.append(slash);
  } else {
    const grille = svgChild('path', {
      d: 'M7 12 H17',
      stroke: 'currentColor',
      'stroke-width': '1.5',
    });
    svg.append(grille);
    const ripples: ReadonlyArray<readonly [string, string]> = [
      ['3.8', '9'],
      ['3.8', '15'],
      ['20.2', '9'],
      ['20.2', '15'],
    ];
    for (const [cx, cy] of ripples) {
      svg.append(
        svgChild('circle', {
          cx,
          cy,
          r: '1.7',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.4',
        }),
      );
    }
  }
  return svg;
}

/** Set or clear the `hidden` attribute (works for HTML and SVG elements alike). */
function setHidden(element: Element, hidden: boolean): void {
  if (hidden) {
    element.setAttribute('hidden', '');
  } else {
    element.removeAttribute('hidden');
  }
}

/**
 * Build and mount the top timeline slider HUD.
 *
 * User selections publish through `store.requestEra(...)`; the `onSelect`
 * callback fires only when that publish changed the era. Keyboard navigation
 * targets the ARIA slider track and the stop buttons; pointer dragging snaps
 * to the nearest of the five stops.
 */
export function createTimelineSlider(options: TimelineSliderOptions): TimelineSlider {
  if (typeof document === 'undefined') {
    throw new Error('createTimelineSlider requires a DOM environment.');
  }

  const { container, store, audio, onSelect } = options;
  const years = ERA_YEARS;

  let disposed = false;
  let transitioning = false;
  let transitionProgress = 0;

  // --- DOM -------------------------------------------------------------------
  const host = document.createElement('div');
  host.className = 'hud-root';
  host.dataset.hud = 'timeline';

  const bar = document.createElement('header');
  bar.className = 'hud-bar';
  bar.dataset.hudBar = '';

  const brand = document.createElement('span');
  brand.className = 'hud-brand';
  const brandMark = document.createElement('span');
  brandMark.className = 'hud-brand-mark';
  brandMark.setAttribute('aria-hidden', 'true');
  const brandText = document.createElement('span');
  brandText.className = 'hud-brand-text';
  brandText.textContent = 'City Timelapse';
  brand.append(brandMark, brandText);

  const sliderGroup = document.createElement('div');
  sliderGroup.className = 'hud-slider';
  sliderGroup.dataset.hudSlider = '';

  const track = document.createElement('div');
  track.className = 'hud-track';
  track.dataset.hudTrack = '';
  track.tabIndex = 0;
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', 'Era timeline');
  track.setAttribute('aria-orientation', 'horizontal');
  track.setAttribute('aria-valuemin', String(years[0]));
  track.setAttribute('aria-valuemax', String(years[years.length - 1]));
  track.setAttribute('aria-valuenow', String(years[0]));
  track.setAttribute('aria-valuetext', `Year ${years[0]}`);

  const rail = document.createElement('span');
  rail.className = 'hud-rail';
  rail.setAttribute('aria-hidden', 'true');

  const progressFill = document.createElement('span');
  progressFill.className = 'hud-progress-fill';
  progressFill.dataset.hudProgress = '';
  progressFill.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('span');
  thumb.className = 'hud-thumb';
  thumb.dataset.hudThumb = '';
  thumb.setAttribute('aria-hidden', 'true');

  const stops = years.map((year) => {
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'hud-stop';
    stop.dataset.hudStop = '';
    stop.dataset.year = String(year);
    stop.textContent = String(year);
    stop.setAttribute('aria-label', `Select era ${year}`);
    stop.addEventListener('click', () => {
      selectEra(year);
    });
    stop.addEventListener('keydown', handleKey);
    return stop;
  });

  track.append(rail, progressFill, thumb, ...stops);
  sliderGroup.append(track);

  const readout = document.createElement('output');
  readout.className = 'hud-readout';
  readout.dataset.hudReadout = '';
  readout.setAttribute('aria-live', 'polite');
  readout.setAttribute('aria-label', 'Selected era year');
  const readoutLabel = document.createElement('span');
  readoutLabel.className = 'hud-readout-label';
  readoutLabel.textContent = 'ERA';
  const readoutYear = document.createElement('span');
  readoutYear.className = 'hud-readout-year';
  readoutYear.dataset.hudReadoutYear = '';
  readout.append(readoutLabel, readoutYear);

  const transitionStatus = document.createElement('span');
  transitionStatus.className = 'hud-transition-status';
  transitionStatus.dataset.hudTransitionStatus = '';
  setHidden(transitionStatus, true);

  const meta = document.createElement('div');
  meta.className = 'hud-meta';
  meta.append(readout, transitionStatus);

  const muteButton = document.createElement('button');
  muteButton.type = 'button';
  muteButton.className = 'hud-icon-button hud-mute';
  muteButton.dataset.hudMute = '';
  muteButton.setAttribute('aria-label', 'Mute sound');
  muteButton.setAttribute('aria-pressed', 'false');
  const speakerOn = speakerIcon(false);
  const speakerOff = speakerIcon(true);
  setHidden(speakerOff, true);
  muteButton.append(speakerOn, speakerOff);

  const helpButton = document.createElement('button');
  helpButton.type = 'button';
  helpButton.className = 'hud-icon-button hud-help';
  helpButton.dataset.hudHelp = '';
  helpButton.textContent = '?';
  helpButton.setAttribute('aria-label', 'Show controls help');
  helpButton.setAttribute('aria-expanded', 'false');
  helpButton.title = 'Controls help (?)';

  bar.append(brand, sliderGroup, meta, muteButton, helpButton);
  host.append(bar);
  container.append(host);

  // --- Help overlay -----------------------------------------------------------
  const help = createHelpOverlay({
    years: ERA_YEARS,
    onVisibilityChange: (openState) => {
      helpButton.setAttribute('aria-expanded', openState ? 'true' : 'false');
    },
  });
  host.append(help.element);

  // --- Selection ---------------------------------------------------------------
  function selectEra(era: EraId): boolean {
    if (disposed) {
      return false;
    }
    const before = store.current;
    store.requestEra(era);
    if (store.current === before) {
      return false;
    }
    onSelect?.(store.current);
    audio.playClick();
    return true;
  }

  function stopByYear(year: EraId): HTMLButtonElement | null {
    for (const stop of stops) {
      if (stop.dataset.year === String(year)) {
        return stop;
      }
    }
    return null;
  }

  function focusStopFor(year: EraId): void {
    stopByYear(year)?.focus();
  }

  // --- Store-driven reflection --------------------------------------------------
  function reflect(snapshot: EraStoreSnapshot): void {
    const current = snapshot.current;
    const transition = snapshot.transition;

    for (const stop of stops) {
      const isCurrent = stop.dataset.year === String(current);
      if (isCurrent) {
        stop.classList.add('is-current');
      } else {
        stop.classList.remove('is-current');
      }
      stop.setAttribute('aria-current', isCurrent ? 'true' : 'false');
    }

    const index = years.indexOf(current);
    const fraction = index / (years.length - 1);
    thumb.style.left = `${fraction * 100}%`;
    readoutYear.textContent = String(current);
    track.setAttribute('aria-valuenow', String(current));
    track.setAttribute('aria-valuetext', `Year ${current}`);

    transitioning = transition !== null;
    transitionProgress = transition?.progress ?? 0;

    if (transition !== null) {
      const fromIndex = years.indexOf(transition.from);
      const toIndex = years.indexOf(transition.to);
      const fromFraction = fromIndex / (years.length - 1);
      const toFraction = toIndex / (years.length - 1);
      const left = Math.min(fromFraction, toFraction) * 100;
      const width = Math.abs(toFraction - fromFraction) * transition.progress * 100;
      progressFill.style.left = `${left}%`;
      progressFill.style.width = `${width}%`;
      setHidden(transitionStatus, false);
      transitionStatus.textContent =
        `${transition.from} → ${transition.to} · ${Math.round(transition.progress * 100)}%`;
      bar.classList.add('is-transitioning');
    } else {
      progressFill.style.left = '0%';
      progressFill.style.width = '0%';
      setHidden(transitionStatus, true);
      bar.classList.remove('is-transitioning');
    }
  }

  const unsubscribe = store.subscribe(reflect);
  reflect(store.getSnapshot());

  // --- Keyboard navigation -------------------------------------------------------
  function isTextEntry(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return true;
    }
    return target.isContentEditable;
  }

  function handleKey(event: KeyboardEvent): void {
    if (isTextEntry(event)) {
      return;
    }
    let nextIndex: number = -1;
    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = years.indexOf(store.current) - 1;
        break;
      case 'ArrowRight':
        nextIndex = years.indexOf(store.current) + 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = years.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (nextIndex < 0 || nextIndex >= years.length) {
      return;
    }
    const target = years[nextIndex];
    if (target === undefined) {
      return;
    }
    selectEra(target);
    focusStopFor(target);
  }

  track.addEventListener('keydown', handleKey);

  // --- Pointer click / drag snapping ----------------------------------------------
  interface DragState {
    active: boolean;
    lastIndex: number;
  }
  const drag: DragState = { active: false, lastIndex: -1 };

  /** Map a client x coordinate to the nearest stop index (-1 when unmappable). */
  function indexForClientX(x: number): number {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return -1;
    }
    const fraction = clamp((x - rect.left) / rect.width, 0, 1);
    return Math.round(fraction * (years.length - 1));
  }

  function onDragMove(event: PointerEvent): void {
    if (!drag.active) {
      return;
    }
    const index = indexForClientX(event.clientX);
    const era = years[index];
    if (index < 0 || era === undefined || index === drag.lastIndex) {
      return;
    }
    drag.lastIndex = index;
    selectEra(era);
  }

  function endDrag(): void {
    if (!drag.active) {
      return;
    }
    drag.active = false;
    drag.lastIndex = -1;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }

  function beginDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const index = indexForClientX(event.clientX);
    const era = years[index];
    if (index < 0 || era === undefined) {
      return;
    }
    drag.active = true;
    drag.lastIndex = index;
    selectEra(era);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    event.preventDefault();
  }

  track.addEventListener('pointerdown', (event: PointerEvent) => {
    // Stop buttons handle their own clicks; dragging starts on rail / thumb.
    const source = event.target instanceof Element ? event.target : null;
    if (source?.closest('[data-hud-stop]')) {
      return;
    }
    beginDrag(event);
  });

  // --- Mute toggle ---------------------------------------------------------------
  function syncMute(): void {
    const muted = audio.isMuted();
    muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteButton.dataset.muted = muted ? 'true' : 'false';
    muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    muteButton.title = muted ? 'Unmute sound' : 'Mute sound';
    setHidden(speakerOn, muted);
    setHidden(speakerOff, !muted);
  }

  function toggleMute(): boolean {
    const muted = audio.toggleMute();
    syncMute();
    audio.playClick();
    return muted;
  }

  muteButton.addEventListener('click', () => {
    toggleMute();
  });
  syncMute();

  // --- Help toggle ('?' key, button) and Escape dismissal ---------------------------
  function toggleHelp(): void {
    if (help.isOpen()) {
      help.close();
    } else {
      help.open();
    }
  }

  helpButton.addEventListener('click', toggleHelp);

  function handleGlobalKey(event: KeyboardEvent): void {
    if (isTextEntry(event)) {
      return;
    }
    if (event.key === 'Escape') {
      if (help.isOpen()) {
        event.preventDefault();
        event.stopPropagation();
        help.close();
      }
      return;
    }
    if (event.key === '?') {
      event.preventDefault();
      toggleHelp();
    }
  }
  window.addEventListener('keydown', handleGlobalKey);

  // --- Public API ------------------------------------------------------------------
  function setHelpVisible(visible: boolean): void {
    if (disposed || visible === help.isOpen()) {
      return;
    }
    if (visible) {
      help.open();
    } else {
      help.close();
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    unsubscribe();
    window.removeEventListener('keydown', handleGlobalKey);
    endDrag();
    help.dispose();
    host.remove();
  }

  return {
    element: host,
    years,
    get currentEra() {
      return store.current;
    },
    get isTransitioning() {
      return transitioning;
    },
    get transitionProgress() {
      return transitionProgress;
    },
    get muted() {
      return audio.isMuted();
    },
    get helpVisible() {
      return help.isOpen();
    },
    selectEra,
    toggleMute,
    setHelpVisible,
    dispose,
  };
}