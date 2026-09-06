import type { EraId } from '../types';
import { subtitleFor } from './subtitles';

/**
 * Cinematic in-view transformation overlay.
 *
 * `createOverlay` mounts a full-viewport, pointer-events-disabled layer that
 * renders the big animated year label and the era subtitle during a transition.
 * It is owned by the integration: `showTransition` is called when a new era is
 * committed, `hide` when the morph completes, and `onUnlock` registers the
 * callback that the integration fires once the user is handed back control.
 */

export interface OverlayOptions {
  /** Milliseconds the overlay stays up during a transition. Default 1200. */
  durationMs?: number;
}

export interface Overlay {
  /** Show the transition overlay for the given era (label + subtitle). */
  showTransition(era: EraId): void;
  /** Hide the overlay immediately. */
  hide(): void;
  /** Register the callback fired when the transition ends and control is restored. */
  onUnlock(cb: () => void): void;
  /** Remove the overlay DOM and cancel pending timers. */
  dispose(): void;
}

const DEFAULT_DURATION_MS = 1200;

export function createOverlay(container: HTMLElement, options: OverlayOptions = {}): Overlay {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;

  const root = document.createElement('div');
  root.className = 'overlay';
  root.setAttribute('aria-hidden', 'true');
  root.hidden = true;

  const year = document.createElement('div');
  year.className = 'overlay-year';
  root.appendChild(year);

  const subtitle = document.createElement('div');
  subtitle.className = 'overlay-subtitle';
  root.appendChild(subtitle);

  container.appendChild(root);

  let unlockCb: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const hide = (): void => {
    clearTimer();
    root.hidden = true;
    root.classList.remove('overlay--visible');
  };

  const showTransition = (era: EraId): void => {
    clearTimer();
    // Re-trigger the CSS entrance animation by removing and re-adding the class.
    root.classList.remove('overlay--visible');
    // Force a reflow so the animation restarts cleanly on rapid era changes.
    void root.offsetWidth;
    year.textContent = era;
    subtitle.textContent = subtitleFor(era);
    root.hidden = false;
    root.classList.add('overlay--visible');

    timer = setTimeout(() => {
      timer = null;
      hide();
      unlockCb?.();
    }, durationMs);
  };

  const dispose = (): void => {
    clearTimer();
    unlockCb = null;
    root.remove();
  };

  return {
    showTransition,
    hide,
    onUnlock: (cb: () => void): void => {
      unlockCb = cb;
    },
    dispose,
  };
}