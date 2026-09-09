/**
 * Central Timeline UI Module for City Time Period Timelapse.
 *
 * Implements the top-centered five-year slider (1945, 1965, 1985, 2005, 2025)
 * bound to the TimelineController, HUD, and start overlay.
 *
 * Produces the `createTimelineUI` export matching lifecycle:
 * instantiate -> attach -> update -> dispose.
 */

import type { TimelineChannel } from '../era/types';
import {
  ERAS,
  type EraId,
  eraToYearNumber,
  getEraByIndex,
  getEraIndex,
} from '../era/years';
import type { TimelineController, TimelineState } from '../state/timelineStore';
import { eraDescriptors } from './eraDescriptors';
import { createHud, type HudCallbacks, type HudInstance, type PoiId } from './hud';
import { createStartOverlay, type StartOverlay, type StartOverlayOptions } from './startOverlay';
import './timeline.css';

export type { PoiId, HudCallbacks, StartOverlayOptions };

export interface TimelineUICallbacks extends HudCallbacks, StartOverlayOptions {
  /**
   * Called when a discrete year jump is triggered by click, snap, or keyboard.
   */
  onYearRequested?: (year: EraId) => void;

  /**
   * Called continuously while the user is live-scrubbing the slider.
   */
  onScrub?: (progress: number, channel: TimelineChannel) => void;
}

export interface TimelineUI {
  readonly root: HTMLElement;
  readonly sliderElement: HTMLElement;
  readonly trackElement: HTMLElement;
  readonly thumbElement: HTMLElement;
  readonly hud: HudInstance;
  readonly hudElement: HTMLElement;
  readonly overlay: StartOverlay | null;
  readonly overlayElement: HTMLElement | null;
  readonly controller: TimelineController;

  /**
   * Re-attaches or mounts elements to a container if not already attached.
   */
  attach(container?: HTMLElement): void;

  /**
   * Per-frame update hook matching the EraSystem lifecycle.
   */
  update(channel?: TimelineChannel, deltaSeconds?: number): void;

  /**
   * Sets mute state on the HUD.
   */
  setMuted(muted: boolean): void;

  /**
   * Sets active POI chip on the HUD.
   */
  setActivePoi(poiId: PoiId | null): void;

  /**
   * Dismisses the start overlay if present.
   */
  dismissStartOverlay(): void;

  /**
   * Cleans up all DOM elements, event listeners, and store subscriptions.
   */
  dispose(): void;
}

/**
 * Calculates normalized timeline progress (0.0 to 1.0) for a given EraId.
 */
export function eraToProgress(era: EraId): number {
  const idx = getEraIndex(era);
  if (idx < 0) return 0;
  return idx / (ERAS.length - 1);
}

/**
 * Converts a normalized progress value (0.0 to 1.0) to the nearest EraId.
 */
export function progressToNearestEra(progress: number): EraId {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const idx = Math.min(ERAS.length - 1, Math.max(0, Math.round(clamped * (ERAS.length - 1))));
  return ERAS[idx] ?? ERAS[0];
}

/**
 * Creates and mounts the complete Timeline UI system:
 * top slider, start overlay, and HUD.
 */
export function createTimelineUI(
  root: HTMLElement,
  controller: TimelineController,
  callbacks: TimelineUICallbacks = {},
): TimelineUI {
  if (!root || !(root instanceof HTMLElement)) {
    throw new TypeError('createTimelineUI requires a valid HTMLElement root container');
  }
  if (!controller || typeof controller.subscribe !== 'function') {
    throw new TypeError('createTimelineUI requires a valid TimelineController instance');
  }

  let currentRoot: HTMLElement = root;
  let disposed = false;
  let isDragging = false;

  // 1. Build Top Slider DOM
  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'timelapse-timeline-top';
  sliderContainer.setAttribute('data-testid', 'timeline-top');

  const card = document.createElement('div');
  card.className = 'timeline-card';

  const trackWrapper = document.createElement('div');
  trackWrapper.className = 'timeline-track-wrapper';

  const track = document.createElement('div');
  track.className = 'timeline-track';

  const fill = document.createElement('div');
  fill.className = 'timeline-fill';

  const shimmer = document.createElement('div');
  shimmer.className = 'timeline-shimmer';

  track.appendChild(fill);
  track.appendChild(shimmer);

  // Tick marks
  const ticksContainer = document.createElement('div');
  ticksContainer.className = 'timeline-ticks';
  const tickElements = new Map<EraId, HTMLElement>();

  for (let i = 0; i < ERAS.length; i++) {
    const era = ERAS[i];
    const tick = document.createElement('div');
    tick.className = 'timeline-tick';
    const pct = (i / (ERAS.length - 1)) * 100;
    tick.style.left = `${pct}%`;
    tick.dataset.era = era;
    ticksContainer.appendChild(tick);
    tickElements.set(era, tick);
  }

  // Thumb handle (ARIA slider)
  const thumb = document.createElement('div');
  thumb.className = 'timeline-thumb';
  thumb.setAttribute('role', 'slider');
  thumb.setAttribute('tabindex', '0');
  thumb.setAttribute('aria-label', 'Timeline Era');
  thumb.setAttribute('aria-valuemin', '1945');
  thumb.setAttribute('aria-valuemax', '2025');
  thumb.setAttribute('aria-valuenow', '1945');
  thumb.setAttribute('aria-valuetext', eraDescriptors['1945']);

  trackWrapper.appendChild(track);
  trackWrapper.appendChild(ticksContainer);
  trackWrapper.appendChild(thumb);

  // Labeled Stops Row
  const stopsContainer = document.createElement('div');
  stopsContainer.className = 'timeline-stops';
  const stopButtons = new Map<EraId, HTMLButtonElement>();

  for (let i = 0; i < ERAS.length; i++) {
    const era = ERAS[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'timeline-stop';
    btn.dataset.year = era;
    btn.setAttribute('aria-label', `Select year ${era}`);
    btn.textContent = era;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.setYear(era);
      callbacks.onYearRequested?.(era);
    });

    stopsContainer.appendChild(btn);
    stopButtons.set(era, btn);
  }

  card.appendChild(trackWrapper);
  card.appendChild(stopsContainer);
  sliderContainer.appendChild(card);

  currentRoot.appendChild(sliderContainer);

  // 2. Build HUD
  const hudInstance = createHud(currentRoot, {
    onToggleMute: callbacks.onToggleMute,
    onSelectPoi: callbacks.onSelectPoi,
  });

  // 3. Build Start Overlay
  let overlayInstance: StartOverlay | null = null;
  overlayInstance = createStartOverlay(currentRoot, {
    title: callbacks.title,
    subtitle: callbacks.subtitle,
    buttonText: callbacks.buttonText,
    onStart: callbacks.onStart,
  });

  // -------------------------------------------------------------------------
  // State Sync & DOM update
  // -------------------------------------------------------------------------
  function applyState(state: TimelineState): void {
    if (disposed) return;

    const progress = state.globalProgress;
    const pct = `${Math.max(0, Math.min(100, progress * 100))}%`;

    fill.style.width = pct;
    thumb.style.left = pct;

    const numericYear = eraToYearNumber(state.currentEra as EraId);
    thumb.setAttribute('aria-valuenow', String(numericYear));
    thumb.setAttribute(
      'aria-valuetext',
      eraDescriptors[state.currentEra as EraId] ?? `Year ${state.currentEra}`,
    );

    // Shimmer toggle
    const isTransitioning = state.isTransitioning || (state.isScrubbing && !isDragging);
    sliderContainer.classList.toggle('is-transitioning', isTransitioning);
    card.classList.toggle('is-transitioning', isTransitioning);
    track.classList.toggle('is-transitioning', isTransitioning);

    // Active stops & ticks
    for (const [era, btn] of stopButtons.entries()) {
      const isActive = era === state.currentEra;
      btn.classList.toggle('is-active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'step');
      } else {
        btn.removeAttribute('aria-current');
      }
    }

    for (const [era, tick] of tickElements.entries()) {
      tick.classList.toggle('is-active', era === state.currentEra);
    }

    // HUD update
    hudInstance.update(state.channel, state);
  }

  // Subscribe to TimelineController
  const unsubscribeStore = controller.subscribe((_channel, state) => {
    applyState(state);
  });

  // -------------------------------------------------------------------------
  // Pointer & Drag Interaction (Scrubbing)
  // -------------------------------------------------------------------------
  function computeProgressFromClientX(clientX: number): number {
    const rect = trackWrapper.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : trackWrapper.offsetWidth || 300;
    const left = rect.left;
    const offset = clientX - left;
    return Math.max(0, Math.min(1, offset / width));
  }

  function handlePointerDown(e: PointerEvent): void {
    if (disposed) return;
    isDragging = true;
    thumb.classList.add('is-dragging');
    controller.startScrub();

    const progress = computeProgressFromClientX(e.clientX);
    controller.scrubTo(progress);
    callbacks.onScrub?.(progress, controller.getChannel());

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!isDragging || disposed) return;
    const progress = computeProgressFromClientX(e.clientX);
    controller.scrubTo(progress);
    callbacks.onScrub?.(progress, controller.getChannel());
  }

  function handlePointerUp(_e: PointerEvent): void {
    if (!isDragging || disposed) return;
    isDragging = false;
    thumb.classList.remove('is-dragging');

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);

    // Snapping to nearest era on release
    controller.endScrub(true);
    const finalEra = controller.getState().currentEra;
    callbacks.onYearRequested?.(finalEra);
  }

  trackWrapper.addEventListener('pointerdown', handlePointerDown);

  // -------------------------------------------------------------------------
  // Keyboard Navigation
  // -------------------------------------------------------------------------
  function handleSliderKeyDown(e: KeyboardEvent): void {
    if (disposed) return;

    let handled = false;
    const key = e.key;

    if (key === 'ArrowRight' || key === 'ArrowUp' || key === 'PageUp') {
      controller.step(1);
      callbacks.onYearRequested?.(controller.getState().currentEra);
      handled = true;
    } else if (key === 'ArrowLeft' || key === 'ArrowDown' || key === 'PageDown') {
      controller.step(-1);
      callbacks.onYearRequested?.(controller.getState().currentEra);
      handled = true;
    } else if (key === 'Home') {
      controller.setYear('1945');
      callbacks.onYearRequested?.('1945');
      handled = true;
    } else if (key === 'End') {
      controller.setYear('2025');
      callbacks.onYearRequested?.('2025');
      handled = true;
    } else if (['1', '2', '3', '4', '5'].includes(key)) {
      const idx = Number.parseInt(key, 10) - 1;
      const targetEra = getEraByIndex(idx);
      if (targetEra) {
        controller.setYear(targetEra);
        callbacks.onYearRequested?.(targetEra);
        handled = true;
      }
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleWindowKeyDown(e: KeyboardEvent): void {
    if (disposed) return;

    // Ignore if focus is in an input or textarea
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const key = e.key;
    if (['1', '2', '3', '4', '5'].includes(key)) {
      const idx = Number.parseInt(key, 10) - 1;
      const targetEra = getEraByIndex(idx);
      if (targetEra) {
        controller.setYear(targetEra);
        callbacks.onYearRequested?.(targetEra);
      }
    } else if (key === 'ArrowLeft' && document.activeElement !== thumb) {
      controller.step(-1);
      callbacks.onYearRequested?.(controller.getState().currentEra);
    } else if (key === 'ArrowRight' && document.activeElement !== thumb) {
      controller.step(1);
      callbacks.onYearRequested?.(controller.getState().currentEra);
    }
  }

  thumb.addEventListener('keydown', handleSliderKeyDown);
  trackWrapper.addEventListener('keydown', handleSliderKeyDown);
  window.addEventListener('keydown', handleWindowKeyDown);

  return {
    root: currentRoot,
    sliderElement: sliderContainer,
    trackElement: trackWrapper,
    thumbElement: thumb,
    hud: hudInstance,
    hudElement: hudInstance.element,
    overlay: overlayInstance,
    overlayElement: overlayInstance?.element ?? null,
    controller,

    attach(container?: HTMLElement) {
      if (container && container !== currentRoot) {
        currentRoot = container;
        currentRoot.appendChild(sliderContainer);
        currentRoot.appendChild(hudInstance.element);
        if (overlayInstance && overlayInstance.isVisible()) {
          currentRoot.appendChild(overlayInstance.element);
        }
      }
    },

    update(_channel?: TimelineChannel, _deltaSeconds?: number) {
      if (disposed) return;
      applyState(controller.getState());
    },

    setMuted(muted: boolean) {
      hudInstance.setMuted(muted);
    },

    setActivePoi(poiId: PoiId | null) {
      hudInstance.setActivePoi(poiId);
    },

    dismissStartOverlay() {
      overlayInstance?.dismiss();
    },

    dispose() {
      if (disposed) return;
      disposed = true;

      unsubscribeStore();

      trackWrapper.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      thumb.removeEventListener('keydown', handleSliderKeyDown);
      trackWrapper.removeEventListener('keydown', handleSliderKeyDown);
      window.removeEventListener('keydown', handleWindowKeyDown);

      hudInstance.dispose();
      overlayInstance?.dispose();

      if (sliderContainer.parentNode) {
        sliderContainer.parentNode.removeChild(sliderContainer);
      }
    },
  };
}
