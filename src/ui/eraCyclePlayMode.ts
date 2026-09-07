import { EraState } from '../types/era';
import { CANONICAL_ERAS } from '../types/city';

/**
 * eraCyclePlayMode: an optional "cycle eras" play button that steps through the
 * five canonical years automatically. The play mode is a pure driver of
 * EraState — it never renders its own readout or highlight, so it cannot drift
 * from the store. Pressing play again pauses; the button reflects its state.
 */
export interface EraCyclePlayMode {
  /** The play/pause toggle button. */
  readonly button: HTMLButtonElement;
  /** Whether play mode is currently advancing eras. */
  readonly playing: boolean;
  /** Start advancing eras. No-op if already playing. */
  play(): void;
  /** Stop advancing eras. */
  pause(): void;
  /** Toggle play/pause. */
  toggle(): void;
  /** Dispose: stop the timer and remove the button. */
  dispose(): void;
}

/** Interval between era steps in milliseconds. */
const STEP_MS = 2200;

export function createEraCyclePlayMode(
  eraState: EraState,
  host: HTMLElement,
): EraCyclePlayMode {
  const button = document.createElement('button');
  button.className = 'era-play';
  button.type = 'button';
  button.setAttribute('aria-label', 'Cycle eras');
  button.textContent = 'Play';

  let playing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const step = () => {
    const current = eraState.year;
    const index = CANONICAL_ERAS.indexOf(current);
    const next = CANONICAL_ERAS[(index + 1) % CANONICAL_ERAS.length];
    eraState.setYear(next);
  };

  const startTimer = () => {
    timer = setTimeout(() => {
      step();
      timer = setTimeout(step, STEP_MS);
    }, STEP_MS);
  };

  const play = () => {
    if (playing) return;
    playing = true;
    button.textContent = 'Pause';
    button.setAttribute('aria-label', 'Pause era cycling');
    button.classList.add('active');
    startTimer();
  };

  const pause = () => {
    if (!playing) return;
    playing = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    button.textContent = 'Play';
    button.setAttribute('aria-label', 'Cycle eras');
    button.classList.remove('active');
  };

  const toggle = () => (playing ? pause() : play());

  button.addEventListener('click', toggle);

  host.appendChild(button);

  return {
    button,
    get playing() {
      return playing;
    },
    play,
    pause,
    toggle,
    dispose() {
      pause();
      button.remove();
    },
  };
}

/** Convenience alias kept for callers that prefer a class-style name. */
export { createEraCyclePlayMode as EraCyclePlayMode };