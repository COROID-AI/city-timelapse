import { EraState } from '../types/era';
import { eraRegistry } from '../state/eraRegistry';
import { CANONICAL_ERAS } from '../types/city';

/**
 * TimelineSlider: the top UI slider that snaps between the five canonical
 * years and drives EraState. Renders into the overlay root.
 */
export interface TimelineSlider {
  /** The root DOM element of the slider. */
  readonly element: HTMLDivElement;
  /** Re-sync highlight from the current era state. */
  sync(): void;
  /** Dispose: remove listeners. */
  dispose(): void;
}

export function createTimelineSlider(
  overlay: HTMLElement,
  eraState: EraState,
): TimelineSlider {
  const container = document.createElement('div');
  container.className = 'timeline';

  const track = document.createElement('div');
  track.className = 'timeline-track';
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', 'Era timeline');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(CANONICAL_ERAS.length - 1));

  const yearButtons: HTMLButtonElement[] = [];

  CANONICAL_ERAS.forEach((year, _index) => {
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

  container.appendChild(track);

  const sync = () => {
    const current = eraState.year;
    const index = CANONICAL_ERAS.indexOf(current);
    yearButtons.forEach((btn, i) => {
      btn.classList.toggle('active', i === index);
    });
    track.setAttribute('aria-valuenow', String(index));
  };

  const unsubscribe = eraState.subscribe(sync);
  sync();

  overlay.appendChild(container);

  return {
    element: container,
    sync,
    dispose() {
      unsubscribe();
      container.remove();
    },
  };
}