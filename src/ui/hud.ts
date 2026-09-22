/**
 * Active-era HUD — the compact readout above the slider that names the era
 * the city currently inhabits and visualizes morph progress while a
 * transition is running.
 *
 * Presentation-only: the parent timeline UI feeds it plain state, so this
 * module never mutates timeline or scene objects. The one core dependency is
 * the pure `nearestEraYear`/`clamp01` helpers used to resolve display copy
 * for out-of-range input.
 */

import { clamp01, nearestEraYear, type EraYear } from '../era/timeline';

/**
 * Human-readable name for each era stop. These strings are UI copy — the
 * timeline core deliberately stays domain-free — and they surface in the HUD
 * readout and in the slider's `aria-valuetext`.
 */
export const ERA_NAMES: Readonly<Record<EraYear, string>> = {
  1945: 'Postwar Rebuild',
  1965: 'Mid-Century Boom',
  1985: 'Neon Decade',
  2005: 'Digital Dawn',
  2025: 'Near Future',
};

/**
 * Era-tinted accent colors, one warm-to-cool progression per stop. The
 * timeline root re-applies the active accent as `--era-accent`, so tracks,
 * glow, and focus rings shift hue with the selected period while the glass
 * surfaces keep text legible over any era lighting.
 */
export const ERA_ACCENTS: Readonly<Record<EraYear, string>> = {
  1945: '#e6b25e', // sepia brass
  1965: '#57d6c0', // mid-century teal
  1985: '#ff5ea8', // neon magenta
  2005: '#5aa9ff', // digital blue
  2025: '#a084ff', // near-future violet
};

/** Era display name for any (possibly out-of-range) year. */
export function eraNameForYear(year: number): string {
  return ERA_NAMES[nearestEraYear(year)];
}

/** Era accent color for any (possibly out-of-range) year. */
export function eraAccentForYear(year: number): string {
  return ERA_ACCENTS[nearestEraYear(year)];
}

/** Snapshot the HUD renders; plain data so it stays framework-agnostic. */
export interface EraHUDState {
  /** Active (selected) era year shown large in the readout. */
  readonly year: number;
  /** Display name of the active era. */
  readonly eraName: string;
  /** True while a morph is in flight. */
  readonly transitioning: boolean;
  /** Eased transition progress in 0..1 (1 while idle). */
  readonly progress: number;
}

/** Imperative handle for rendering and tearing down the HUD. */
export interface EraHUD {
  readonly element: HTMLElement;
  /** Repaint the readout; identical consecutive states are skipped. */
  render(state: EraHUDState): void;
  /** Remove the HUD element from the DOM. */
  dispose(): void;
}

/**
 * Build the HUD element (detached). Structure:
 *
 * ```html
 * <div class="era-hud" role="group" aria-label="Active era">
 *   <span class="era-hud__eyebrow">Active era</span>
 *   <div class="era-hud__readout" aria-live="polite">year + name</div>
 *   <div role="progressbar" hidden>…fill…</div>
 * </div>
 * ```
 *
 * The readout is an `aria-live="polite"` region so screen readers announce
 * era changes when a selection is made; the progress bar is exposed with
 * standard progressbar semantics and hidden while the timeline is idle.
 */
export function createEraHUD(doc: Document = document): EraHUD {
  const element = doc.createElement('div');
  element.className = 'era-hud';
  element.setAttribute('data-testid', 'era-hud');
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Active era');

  const eyebrow = doc.createElement('span');
  eyebrow.className = 'era-hud__eyebrow';
  eyebrow.textContent = 'Active era';

  const readout = doc.createElement('div');
  readout.className = 'era-hud__readout';
  readout.setAttribute('aria-live', 'polite');

  const year = doc.createElement('span');
  year.className = 'era-hud__year';
  year.setAttribute('data-testid', 'era-hud-year');

  const name = doc.createElement('span');
  name.className = 'era-hud__name';
  name.setAttribute('data-testid', 'era-hud-name');

  readout.append(year, name);

  const progress = doc.createElement('div');
  progress.className = 'era-hud__progress';
  progress.setAttribute('data-testid', 'era-hud-progress');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Era transition progress');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  progress.setAttribute('aria-valuenow', '100');
  progress.hidden = true;

  const fill = doc.createElement('span');
  fill.className = 'era-hud__progress-fill';
  progress.appendChild(fill);

  element.append(eyebrow, readout, progress);

  let renderedKey: string | null = null;

  return {
    element,
    render(state: EraHUDState): void {
      const percent = Math.round(clamp01(state.progress) * 100);
      const key = `${state.year}|${state.eraName}|${state.transitioning ? 1 : 0}|${percent}`;
      if (key === renderedKey) return;
      renderedKey = key;

      year.textContent = String(state.year);
      name.textContent = state.eraName;
      progress.setAttribute('aria-valuenow', String(percent));
      // Composited transform instead of animating width (layout thrash).
      fill.style.transform = `scaleX(${clamp01(state.progress)})`;
      progress.hidden = !state.transitioning;
    },
    dispose(): void {
      renderedKey = null;
      element.remove();
    },
  };
}
