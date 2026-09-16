/**
 * timeline.ts — top-center era timeline slider (1945–2025).
 *
 * A reusable, accessible discrete slider with exactly five stops
 * (1945, 1965, 1985, 2005, 2025) that drives era selection through an
 * `onSelect` callback. It is deliberately controller-agnostic: the app
 * integration binds it to `EraSystem.selectEra(year)` and feeds the era
 * state back through `update(eraState)` so the label and the animated
 * transition indicator track the era system's transition state machine.
 *
 * Lifecycle
 * ---------
 * ```
 * const timeline = new TimelineUI({ onSelect: (year) => eraSystem.selectEra(year) });
 * timeline.mount(document.querySelector('#timeline-slot')!);
 * timeline.update(eraSystem.getState());   // reflect current/transition state
 * // ...the app drives eraSystem.update(dt) each frame, then
 * //    timeline.update(eraSystem.getState()) follows the tween...
 * timeline.dispose();
 * ```
 *
 * Accessibility
 * -------------
 * The slider is one focusable `role="slider"` control: arrow keys move
 * between stops (Home/End jump to the ends), Enter/Space confirm the focused
 * stop, and each stop remains a pointer/touch (click) target. A visible
 * focus ring plus `aria-valuenow` / `aria-valuetext` announce the active era.
 *
 * Rendering
 * ---------
 * The widget is self-contained: it injects its own scoped styles and never
 * depends on the app stylesheet, so it renders "top-center" whenever it is
 * mounted into a full-width slot (the HUD top bar).
 */
import { ERA_IDS, ERAS, type EraId, type EraSystemState } from '../eras/eraSystem';

/** Options for constructing a TimelineUI instance. */
export interface TimelineUIOptions {
  /** Invoked whenever the user selects an era stop. */
  readonly onSelect: (year: EraId) => void;
  /** Era stop ids in slider order; defaults to the five registry eras. */
  readonly eras?: readonly EraId[];
  /** Accent color for the active stop, fill and transition indicator. */
  readonly accentColor?: string;
}

const DEFAULT_ACCENT = '#4da3ff';

/** Self-contained, scoped styles so TimelineUI needs no app stylesheet. */
const STYLES = `
.coroid-tl {
  --tl-accent: #4da3ff;
  --tl-text: #e8eef5;
  --tl-muted: #93a1b3;
  --tl-border: rgba(255, 255, 255, 0.09);
  width: 100%;
  display: flex;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--tl-text);
}

.coroid-tl-inner {
  width: min(560px, 100%);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.coroid-tl-label {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  min-height: 20px;
}

.coroid-tl-year {
  min-width: 46px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 14px;
  color: var(--tl-accent);
}

.coroid-tl-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.coroid-tl-status {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tl-muted);
  border: 1px solid var(--tl-border);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.coroid-tl.is-transitioning .coroid-tl-status {
  color: var(--tl-accent);
  border-color: rgba(77, 163, 255, 0.4);
  animation: coroid-tl-status-pulse 1.1s ease-in-out infinite;
}

.coroid-tl-slider {
  position: relative;
  padding: 12px 0 6px;
  border-radius: 10px;
  cursor: pointer;
}

.coroid-tl-slider:focus,
.coroid-tl-slider:focus-visible {
  outline: 2px solid var(--tl-accent);
  outline-offset: 3px;
}

.coroid-tl-rail {
  position: relative;
  height: 30px;
}

.coroid-tl-track-line {
  position: absolute;
  top: 50%;
  left: 5px;
  right: 5px;
  height: 2px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}

.coroid-tl-fill {
  position: absolute;
  top: 50%;
  left: 5px;
  height: 2px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: var(--tl-accent);
  box-shadow: 0 0 8px rgba(77, 163, 255, 0.55);
  transition: width 220ms ease;
}

.coroid-tl-transit {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: var(--tl-accent);
  box-shadow: 0 0 10px 2px rgba(77, 163, 255, 0.5);
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 160ms ease, transform 160ms ease;
  pointer-events: none;
}

.coroid-tl.is-transitioning .coroid-tl-transit {
  opacity: 1;
  transform: scale(1);
  animation: coroid-tl-transit-pulse 0.9s ease-in-out infinite;
}

.coroid-tl-stops {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.coroid-tl-stop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: none;
  background: none;
  color: var(--tl-muted);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.coroid-tl-stop:focus-visible {
  outline: 2px solid var(--tl-accent);
  outline-offset: 3px;
  border-radius: 6px;
}

.coroid-tl-stop-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0f141b;
  border: 2px solid rgba(255, 255, 255, 0.25);
  box-sizing: border-box;
  transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.coroid-tl-stop:hover .coroid-tl-stop-dot {
  border-color: var(--tl-accent);
}

.coroid-tl-stop.is-active .coroid-tl-stop-dot {
  border-color: var(--tl-accent);
  background: var(--tl-accent);
  box-shadow: 0 0 10px 1px rgba(77, 163, 255, 0.65);
  transform: scale(1.15);
}

.coroid-tl-stop-label {
  font-size: 10px;
  letter-spacing: 0.05em;
}

@keyframes coroid-tl-transit-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px 1px rgba(77, 163, 255, 0.5);
  }
  50% {
    box-shadow: 0 0 16px 5px rgba(77, 163, 255, 0.8);
  }
}

@keyframes coroid-tl-status-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
`;

/**
 * Top-center era timeline slider bound to an `onSelect` era callback.
 *
 * Lifecycle: `new TimelineUI(options)` → `mount(container)` → `update(state)`
 * (repeat) → `dispose()`.
 */
export class TimelineUI {
  private readonly onSelect: (year: EraId) => void;
  private readonly eras: readonly EraId[];
  private readonly accentColor: string;

  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private sliderEl: HTMLElement | null = null;
  private stops: HTMLElement[] = [];
  private yearEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private fillEl: HTMLElement | null = null;
  private transitEl: HTMLElement | null = null;

  /** Index of the active stop (mirrors `EraSystemState.current` after update). */
  private valueIndex = 0;
  private lastState: EraSystemState | null = null;
  private disposed = false;

  constructor(options: TimelineUIOptions) {
    if (typeof options.onSelect !== 'function') {
      throw new Error('TimelineUI requires an onSelect callback.');
    }
    const eras = options.eras !== undefined && options.eras.length > 0 ? options.eras : ERA_IDS;
    this.onSelect = options.onSelect;
    this.eras = eras;
    this.accentColor = options.accentColor ?? DEFAULT_ACCENT;
  }

  /**
   * Build the slider DOM inside `container`. Throws when called while already
   * mounted or after `dispose()`.
   */
  mount(container: HTMLElement): void {
    if (this.disposed) {
      throw new Error('TimelineUI has been disposed and cannot be mounted again.');
    }
    if (this.root) {
      throw new Error('TimelineUI is already mounted; call dispose() before mounting again.');
    }
    if (!(container instanceof HTMLElement)) {
      throw new Error('TimelineUI.mount requires an HTMLElement container.');
    }

    this.container = container;
    const root = document.createElement('div');
    root.className = 'coroid-tl';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'City era timeline');
    root.style.setProperty('--tl-accent', this.accentColor);
    root.innerHTML = this.buildMarkup();
    container.appendChild(root);
    this.root = root;
    this.bind();

    // Initialize the visible label/indicator, then reflect any state that was
    // provided through update() before mount.
    this.renderSelection();
    if (this.lastState) {
      this.renderState(this.lastState);
    } else if (this.statusEl) {
      this.statusEl.textContent = 'Settled';
    }
  }

  /**
   * Reflect the era system's state: label = current era, animated transition
   * indicator while a tween is running. A no-op after `dispose()` or before
   * `mount()` (the latest state is applied on mount).
   */
  update(state: EraSystemState): void {
    if (this.disposed) return;
    this.lastState = state;
    if (!this.root) return;
    this.renderState(state);
  }

  /** Remove the DOM, detach listeners and release state. Terminal. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root?.removeEventListener('keydown', this.handleKeyDown);
    this.sliderEl?.removeEventListener('click', this.handleRailClick);
    for (const stop of this.stops) {
      stop.removeEventListener('click', this.handleStopClick);
    }
    if (this.root && this.container && this.root.parentNode === this.container) {
      this.container.removeChild(this.root);
    }
    this.container = null;
    this.root = null;
    this.sliderEl = null;
    this.yearEl = null;
    this.titleEl = null;
    this.statusEl = null;
    this.fillEl = null;
    this.transitEl = null;
    this.stops = [];
    this.lastState = null;
  }

  /* ----------------------------- DOM building ----------------------------- */

  private buildMarkup(): string {
    const stopCount = this.eras.length;
    const stops = this.eras
      .map((year, index) => {
        const active = index === this.valueIndex ? ' is-active' : '';
        return (
          `<button type="button" class="coroid-tl-stop${active}" data-role="stop" ` +
          `data-year="${year}" tabindex="-1" aria-label="Select era ${year}">` +
          `<span class="coroid-tl-stop-dot" aria-hidden="true"></span>` +
          `<span class="coroid-tl-stop-label">${year}</span>` +
          `</button>`
        );
      })
      .join('');
    return (
      `<style>${STYLES}</style>` +
      `<div class="coroid-tl-inner">` +
      `<div class="coroid-tl-label">` +
      `<span class="coroid-tl-year" data-role="year"></span>` +
      `<span class="coroid-tl-title" data-role="title"></span>` +
      `<span class="coroid-tl-status" data-role="status"></span>` +
      `</div>` +
      `<div class="coroid-tl-slider" data-role="slider" role="slider" tabindex="0" ` +
      `aria-label="City era timeline" aria-orientation="horizontal" ` +
      `aria-valuemin="1" aria-valuemax="${stopCount}" ` +
      `aria-valuenow="${this.valueIndex + 1}" aria-valuetext="">` +
      `<div class="coroid-tl-rail">` +
      `<div class="coroid-tl-track-line" aria-hidden="true"></div>` +
      `<div class="coroid-tl-fill" data-role="fill" aria-hidden="true"></div>` +
      `<div class="coroid-tl-transit" data-role="transit" aria-hidden="true"></div>` +
      `<div class="coroid-tl-stops">${stops}</div>` +
      `</div>` +
      `</div>` +
      `</div>`
    );
  }

  private bind(): void {
    const root = this.root;
    if (!root) return;
    this.sliderEl = root.querySelector<HTMLElement>('[data-role="slider"]');
    this.yearEl = root.querySelector<HTMLElement>('[data-role="year"]');
    this.titleEl = root.querySelector<HTMLElement>('[data-role="title"]');
    this.statusEl = root.querySelector<HTMLElement>('[data-role="status"]');
    this.fillEl = root.querySelector<HTMLElement>('[data-role="fill"]');
    this.transitEl = root.querySelector<HTMLElement>('[data-role="transit"]');
    this.stops = Array.from(root.querySelectorAll<HTMLElement>('[data-role="stop"]'));

    // Keyboard handling lives on the root so arrows work whether focus is on
    // the slider control or on a stop button (focusable after pointer use).
    root.addEventListener('keydown', this.handleKeyDown);
    this.sliderEl?.addEventListener('click', this.handleRailClick);
    for (const stop of this.stops) {
      stop.addEventListener('click', this.handleStopClick);
    }
  }

  /* ------------------------------- handlers ------------------------------- */

  private handleStopClick = (event: MouseEvent): void => {
    const button = event.currentTarget as HTMLElement;
    const index = this.stops.indexOf(button);
    if (index === -1) return;
    const year = this.eras[index];
    if (index !== this.valueIndex) {
      this.valueIndex = index;
      this.renderSelection();
    }
    this.onSelect(year);
  };

  /** Clicking the rail (not a stop) selects the nearest stop. */
  private handleRailClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('[data-role="stop"]')) return;
    const slider = this.sliderEl;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    if (rect.width <= 0) return; // not laid out (e.g. jsdom)
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(fraction * (this.eras.length - 1));
    if (index === this.valueIndex) return;
    const year = this.eras[index];
    this.valueIndex = index;
    this.renderSelection();
    this.onSelect(year);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    const last = this.eras.length - 1;
    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = Math.min(last, this.valueIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = Math.max(0, this.valueIndex - 1);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = last;
        break;
      case 'Enter':
      case ' ':
        // Confirm the focused stop (EraSystem no-ops when already active).
        event.preventDefault();
        this.onSelect(this.eras[this.valueIndex]);
        return;
      default:
        return;
    }
    if (nextIndex === null || nextIndex === this.valueIndex) return;
    event.preventDefault();
    this.valueIndex = nextIndex;
    this.renderSelection();
    this.onSelect(this.eras[nextIndex]);
  };

  /* -------------------------------- rendering ----------------------------- */

  private renderSelection(): void {
    const year = this.eras[this.valueIndex] ?? ERA_IDS[0];
    const definition = ERAS[year];
    const stopCount = this.eras.length;
    this.stops.forEach((stop, index) => {
      stop.classList.toggle('is-active', index === this.valueIndex);
    });
    this.sliderEl?.setAttribute('aria-valuenow', String(this.valueIndex + 1));
    this.sliderEl?.setAttribute(
      'aria-valuetext',
      `${year} — ${definition.title}, stop ${this.valueIndex + 1} of ${stopCount}`,
    );
    if (this.yearEl) this.yearEl.textContent = String(year);
    if (this.titleEl) this.titleEl.textContent = definition.title;
    if (this.fillEl) this.fillEl.style.width = `${this.fillPercentForIndex(this.valueIndex)}%`;
  }

  private renderState(state: EraSystemState): void {
    this.valueIndex = this.indexOfEra(state.current);
    this.renderSelection();

    const transitioning = state.phase === 'transitioning' && state.next !== null;
    this.root?.classList.toggle('is-transitioning', transitioning);
    if (this.statusEl) {
      this.statusEl.textContent =
        transitioning && state.next !== null ? `Transitioning to ${state.next}` : 'Settled';
    }
    if (this.transitEl) {
      if (transitioning && state.next !== null) {
        const fromIndex = this.indexOfEra(state.current);
        const toIndex = this.indexOfEra(state.next);
        const eased = fromIndex + (toIndex - fromIndex) * state.progress;
        this.transitEl.style.left = `${this.fillPercentForIndex(eased)}%`;
      } else {
        // Rested state: park the indicator on the active stop (hidden until
        // the next transition begins).
        this.transitEl.style.left = `${this.fillPercentForIndex(this.valueIndex)}%`;
      }
    }
  }

  private indexOfEra(year: EraId): number {
    const index = this.eras.indexOf(year);
    return index === -1 ? 0 : index;
  }

  private fillPercentForIndex(index: number): number {
    const maxIndex = this.eras.length - 1;
    if (maxIndex <= 0) return 0;
    const clamped = Math.min(1, Math.max(0, index / maxIndex));
    return clamped * 100;
  }
}