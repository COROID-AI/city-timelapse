import { EraState } from '../types/era';
import { eraRegistry } from '../state/eraRegistry';

/**
 * Short, human-facing era names used by the prominent title readout.
 *
 * The era registry stores a one-line `description` per era; the readout wants
 * a punchy two-word label rendered as `"1945 — Post-War"`. Keeping the mapping
 * here (rather than editing the shared registry) preserves the foundation
 * contract while giving the polished top control its own voice.
 */
const ERA_TITLES: Readonly<Record<number, string>> = Object.freeze({
  1945: 'Post-War',
  1965: 'Mid-Century',
  1985: 'Neon Era',
  2005: 'Digital Age',
  2025: 'Smart City',
});

/**
 * A prominent era title readout. Displays the selected year and its era label,
 * e.g. `"1945 — Post-War"` or `"2025 — Smart City"`, and stays in sync with the
 * EraState store. Exposed as `aria-live` so assistive tech announces changes.
 */
export interface EraTitleReadout {
  /** The rendered readout element. */
  readonly element: HTMLDivElement;
  /** Re-render from the current era state. */
  sync(): void;
  /** Dispose: unsubscribe and remove the element. */
  dispose(): void;
}

/** Resolve the short title for a year, falling back to the registry description. */
export function eraTitleFor(year: number): string {
  return ERA_TITLES[year] ?? eraRegistry.find(year)?.description ?? '';
}

export function createEraTitleReadout(eraState: EraState): EraTitleReadout {
  const element = document.createElement('div');
  element.className = 'era-title-readout';
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-label', 'Current era');

  const update = () => {
    const meta = eraRegistry.find(eraState.year);
    const title = ERA_TITLES[eraState.year] ?? meta?.description ?? '';
    element.textContent = `${eraState.year} — ${title}`;
  };
  update();

  const unsubscribe = eraState.subscribe(update);

  return {
    element,
    sync: update,
    dispose() {
      unsubscribe();
      element.remove();
    },
  };
}