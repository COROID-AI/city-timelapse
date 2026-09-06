/**
 * Top timeline slider HUD.
 *
 * Renders a horizontal timeline across the top of the screen with a
 * selectable tick + label for each supported year. Selecting a year (via
 * click or left/right arrow keys) dispatches a `yearChange` CustomEvent on
 * the host element that a scene module can subscribe to.
 *
 * Lifecycle: `bootstrap` (constructor) -> `update` (setYear / setActiveYear)
 * -> `dispose` (removes listeners and DOM).
 */
import { ERA_KEYS } from '../data/eraRegistry';
import type { EraKey } from '../data/eraDefinition';

/** Name of the CustomEvent dispatched whenever the active year changes. */
export const YEAR_CHANGE_EVENT = 'yearChange';

/** Detail payload carried by the yearChange event. */
export interface YearChangeDetail {
  year: EraKey;
}

/**
 * The TimelineHud manages its own DOM subtree inside the host element.
 * It is framework-free and dispatches standard DOM CustomEvents so any
 * scene module can subscribe with a plain `addEventListener`.
 */
export class TimelineHud {
  readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly ticks: Map<EraKey, HTMLButtonElement> = new Map();
  private activeYear: EraKey;

  constructor(host: HTMLElement, initialYear: EraKey = ERA_KEYS[0]) {
    this.host = host;
    this.activeYear = initialYear;

    this.root = document.createElement('div');
    this.root.className = 'timeline-hud';

    const track = document.createElement('div');
    track.className = 'timeline-track';

    for (const year of ERA_KEYS) {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'timeline-tick';
      tick.dataset.year = String(year);
      tick.setAttribute('aria-label', `Year ${year}`);

      const label = document.createElement('span');
      label.className = 'timeline-label';
      label.textContent = String(year);
      tick.appendChild(label);

      tick.addEventListener('click', () => {
        this.setActiveYear(year);
      });

      this.ticks.set(year, tick);
      track.appendChild(tick);
    }

    this.root.appendChild(track);
    host.appendChild(this.root);

    // Keyboard arrow navigation (Left/Right) across the five years.
    this.handleKeydown = this.handleKeydown.bind(this);
    window.addEventListener('keydown', this.handleKeydown);

    this.renderActive();
  }

  /** Current active year. */
  get year(): EraKey {
    return this.activeYear;
  }

  /**
   * Programmatically set the active year and dispatch a yearChange event.
   * No-op when the year is unchanged.
   */
  setActiveYear(year: EraKey): void {
    if (year === this.activeYear) {
      return;
    }
    this.activeYear = year;
    this.renderActive();
    this.dispatchYearChange();
  }

  /** Alias of setActiveYear used as the `update` lifecycle hook. */
  update(year: EraKey): void {
    this.setActiveYear(year);
  }

  /** Remove all DOM and window listeners. */
  dispose(): void {
    window.removeEventListener('keydown', this.handleKeydown);
    this.ticks.clear();
    this.root.remove();
  }

  private dispatchYearChange(): void {
    const detail: YearChangeDetail = { year: this.activeYear };
    this.host.dispatchEvent(
      new CustomEvent<YearChangeDetail>(YEAR_CHANGE_EVENT, {
        detail,
        bubbles: true,
      }),
    );
  }

  private renderActive(): void {
    for (const [year, tick] of this.ticks) {
      const active = year === this.activeYear;
      tick.classList.toggle('active', active);
      tick.setAttribute('aria-pressed', String(active));
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    // Avoid hijacking arrow keys while the user is focused in an input.
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const idx = ERA_KEYS.indexOf(this.activeYear);
    let next: EraKey;
    if (event.key === 'ArrowLeft') {
      next = ERA_KEYS[Math.max(0, idx - 1)];
    } else {
      next = ERA_KEYS[Math.min(ERA_KEYS.length - 1, idx + 1)];
    }
    if (next !== this.activeYear) {
      event.preventDefault();
      this.setActiveYear(next);
      // Keep focus on the newly active tick for accessibility.
      this.ticks.get(next)?.focus();
    }
  }
}