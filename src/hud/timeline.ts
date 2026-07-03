/**
 * Timeline slider HUD for the City Time Period Timelapse.
 *
 * This module renders a polished, top-of-screen timeline control that is
 * **directly bound to the `ERA_REGISTRY`** — the single source of truth for
 * every decade. The slider exposes all five era options (1945, 1965, 1985,
 * 2005, 2025), updates the active era on change, and visually reflects the
 * current year with a label, description, and era-specific accent colour.
 *
 * The HUD is pure DOM/CSS (no framework dependency) and communicates era
 * changes to the rest of the application via a typed callback
 * (`TimelineEraChangeHandler`). This keeps the module decoupled from the scene
 * and audio systems — the bootstrap wires the callback to whatever needs to
 * react (visuals, traffic, pedestrians, audio).
 *
 * Design notes:
 * - The slider is a native `<input type="range">` for accessibility &
 *   keyboard support, styled with a custom track.
 * - Era tick marks are rendered as discrete clickable buttons below the
 *   slider so users can jump directly to any year.
 * - A year readout and era label update in real time as the slider moves.
 */

import type { EraId, EraSpec } from '../eras/types.js';
import { ERA_IDS, ERA_REGISTRY, getEra } from '../eras/types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Callback invoked whenever the active era changes.
 *
 * @param eraId    The newly selected era id.
 * @param era      The full {@link EraSpec} for the new era.
 * @param prev     The previous era id (or `null` on the first set).
 */
export type TimelineEraChangeHandler = (
  eraId: EraId,
  era: EraSpec,
  prev: EraId | null,
) => void;

/** Configuration options for the {@link TimelineHud}. */
export interface TimelineHudOptions {
  /** The container element to mount the HUD into (defaults to `document.body`). */
  container?: HTMLElement;
  /** Initial era id to display. Default: the first entry in the registry. */
  initialEra?: EraId;
}

// ---------------------------------------------------------------------------
// Era accent colours
// ---------------------------------------------------------------------------

/**
 * A distinct accent colour per era for visual feedback on the HUD.
 * These are drawn from each era's palette to keep them period-appropriate.
 */
const ERA_ACCENT: Readonly<Record<EraId, string>> = {
  '1945': '#8a6d3b',
  '1965': '#c8102e',
  '1985': '#ff00ff',
  '2005': '#1f3a5f',
  '2025': '#3a5f3a',
};

// ---------------------------------------------------------------------------
// TimelineHud class
// ---------------------------------------------------------------------------

/**
 * A top-of-screen timeline slider HUD bound to the {@link ERA_REGISTRY}.
 *
 * Usage:
 * ```ts
 * const hud = new TimelineHud({ container: document.body });
 * hud.onEraChange((id, era, prev) => {
 *   mixer.setEra(id);
 *   sceneComposer.setEra(era);
 * });
 * hud.setEra('1985'); // programmatic update
 * hud.dispose();        // cleanup
 * ```
 */
export class TimelineHud {
  /** The root DOM element of the HUD. */
  private readonly root: HTMLElement;
  /** The range input element. */
  private readonly slider: HTMLInputElement;
  /** The large year readout. */
  private readonly yearLabel: HTMLElement;
  /** The era title (e.g. "Mid-Century"). */
  private readonly eraLabel: HTMLElement;
  /** The era description paragraph. */
  private readonly description: HTMLElement;
  /** The accent bar that changes colour per era. */
  private readonly accentBar: HTMLElement;
  /** Tick-mark buttons (one per era). */
  private readonly ticks: HTMLButtonElement[] = [];
  /** The currently active era index (0–4). */
  private currentIndex = 0;
  /** Registered era-change handlers. */
  private readonly handlers = new Set<TimelineEraChangeHandler>();
  /** Bound listeners (for removal on dispose). */
  private readonly _onSliderInput = (): void => this.handleSliderInput();
  private readonly _onSliderChange = (): void => this.handleSliderChange();
  private readonly _onKeyDown = (e: KeyboardEvent): void => this.handleKeyDown(e);
  private disposed = false;

  /**
   * @param options  Configuration (see {@link TimelineHudOptions}).
   */
  constructor(options: TimelineHudOptions = {}) {
    const container = options.container ?? document.body;
    const initial = options.initialEra ?? ERA_IDS[0];
    this.currentIndex = ERA_IDS.indexOf(initial);
    if (this.currentIndex < 0) this.currentIndex = 0;

    this.root = this.buildDom();
    container.appendChild(this.root);

    // Cache element references
    this.slider = this.root.querySelector<HTMLInputElement>('#tl-slider')!;
    this.yearLabel = this.root.querySelector<HTMLElement>('#tl-year')!;
    this.eraLabel = this.root.querySelector<HTMLElement>('#tl-era')!;
    this.description = this.root.querySelector<HTMLElement>('#tl-desc')!;
    this.accentBar = this.root.querySelector<HTMLElement>('#tl-accent')!;
    this.ticks.push(
      ...Array.from(this.root.querySelectorAll<HTMLButtonElement>('.tl-tick')),
    );

    // Wire events
    this.slider.addEventListener('input', this._onSliderInput);
    this.slider.addEventListener('change', this._onSliderChange);
    this.root.addEventListener('keydown', this._onKeyDown);
    for (let i = 0; i < this.ticks.length; i++) {
      const idx = i;
      this.ticks[i]!.addEventListener('click', () => this.selectIndex(idx));
    }

    // Render initial state without firing handlers
    this.renderState();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Register a handler that fires when the user selects a new era.
   * @returns A disposer function that removes the handler.
   */
  onEraChange(handler: TimelineEraChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Programmatically set the active era.
   *
   * Fires registered handlers (with the previous era id) unless `silent` is
   * `true`.
   *
   * @param eraId   The era to switch to.
   * @param silent  If true, do not fire change handlers.
   */
  setEra(eraId: EraId, silent = false): void {
    const idx = ERA_IDS.indexOf(eraId);
    if (idx < 0) return;
    this.selectIndex(idx, silent);
  }

  /** The currently active era id. */
  get eraId(): EraId {
    return ERA_IDS[this.currentIndex]!;
  }

  /** The currently active {@link EraSpec}. */
  get era(): EraSpec {
    return ERA_REGISTRY[this.currentIndex]!;
  }

  /**
   * Cycle to the next era (wraps around to the first).
   * @param silent  If true, do not fire change handlers.
   */
  next(silent = false): void {
    const idx = (this.currentIndex + 1) % ERA_IDS.length;
    this.selectIndex(idx, silent);
  }

  /**
   * Cycle to the previous era (wraps around to the last).
   * @param silent  If true, do not fire change handlers.
   */
  prev(silent = false): void {
    const idx = (this.currentIndex - 1 + ERA_IDS.length) % ERA_IDS.length;
    this.selectIndex(idx, silent);
  }

  /** Show the HUD (if previously hidden). */
  show(): void {
    this.root.style.display = '';
  }

  /** Hide the HUD (keeps it in the DOM). */
  hide(): void {
    this.root.style.display = 'none';
  }

  /** Remove the HUD from the DOM and clean up listeners. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.slider.removeEventListener('input', this._onSliderInput);
    this.slider.removeEventListener('change', this._onSliderChange);
    this.root.removeEventListener('keydown', this._onKeyDown);
    this.handlers.clear();
    this.root.remove();
  }

  // -------------------------------------------------------------------------
  // Internal: state management
  // -------------------------------------------------------------------------

  /**
   * Select an era by index, update the slider position, render state, and
   * fire handlers.
   */
  private selectIndex(index: number, silent = false): void {
    if (index < 0 || index >= ERA_IDS.length) return;
    if (index === this.currentIndex && silent) {
      this.renderState();
      return;
    }
    const prev = this.currentIndex >= 0 ? ERA_IDS[this.currentIndex]! : null;
    this.currentIndex = index;
    this.slider.value = String(index);
    this.renderState();
    if (!silent) {
      const eraId = ERA_IDS[index]!;
      const era = getEra(eraId);
      for (const handler of this.handlers) {
        handler(eraId, era, prev);
      }
    }
  }

  /** Update all visual elements to reflect `this.currentIndex`. */
  private renderState(): void {
    const era = ERA_REGISTRY[this.currentIndex]!;
    const accent = ERA_ACCENT[era.id];

    this.yearLabel.textContent = String(era.year);
    this.eraLabel.textContent = era.label;
    this.description.textContent = era.description;
    this.accentBar.style.backgroundColor = accent;
    this.eraLabel.style.color = accent;

    // Update slider CSS variable for the filled portion
    const pct = (this.currentIndex / (ERA_IDS.length - 1)) * 100;
    this.slider.style.setProperty('--tl-fill', `${pct}%`);
    this.slider.style.setProperty('--tl-accent', accent);
    this.slider.setAttribute('aria-valuenow', era.id);
    this.slider.setAttribute('aria-valuetext', `${era.year} ${era.label}`);

    // Update tick states
    for (let i = 0; i < this.ticks.length; i++) {
      const tick = this.ticks[i]!;
      const active = i === this.currentIndex;
      tick.setAttribute('aria-pressed', String(active));
      if (active) {
        tick.classList.add('tl-tick--active');
        tick.style.borderColor = accent;
        tick.style.color = accent;
      } else {
        tick.classList.remove('tl-tick--active');
        tick.style.borderColor = '';
        tick.style.color = '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /** Handle live slider dragging (updates labels without committing). */
  private handleSliderInput(): void {
    const idx = parseInt(this.slider.value, 10);
    if (idx === this.currentIndex) return;
    // Update immediately for responsive feel during drag
    this.currentIndex = idx;
    this.renderState();
  }

  /** Handle slider release — commit the era change and fire handlers. */
  private handleSliderChange(): void {
    const idx = parseInt(this.slider.value, 10);
    // We already updated currentIndex in input; now fire handlers with prev
    // Since input may have stepped through multiple values, we fire for the
    // final committed value with the original-era as prev tracked separately.
    // To keep it simple: re-fire based on current.
    const eraId = ERA_IDS[idx]!;
    const era = getEra(eraId);
    // We need the prev value — track it before renderState changed it.
    // Actually handleSliderInput already set currentIndex. We'll compute prev
    // from the slider's data attribute stored on input.
    const prevAttr = this.slider.dataset.prevEra ?? null;
    const prev = prevAttr as EraId | null;
    this.slider.dataset.prevEra = eraId;
    for (const handler of this.handlers) {
      handler(eraId, era, prev);
    }
  }

  /** Keyboard support for arrow-key navigation between eras. */
  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        this.prev();
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        this.next();
        break;
      case 'Home':
        e.preventDefault();
        this.selectIndex(0);
        break;
      case 'End':
        e.preventDefault();
        this.selectIndex(ERA_IDS.length - 1);
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------
  // DOM construction
  // -------------------------------------------------------------------------

  /**
   * Build the complete HUD DOM tree and inject styles.
   * @returns The root `<div>` element.
   */
  private buildDom(): HTMLElement {
    // Inject styles once
    if (!document.getElementById('timeline-hud-styles')) {
      const style = document.createElement('style');
      style.id = 'timeline-hud-styles';
      style.textContent = TIMELINE_CSS;
      document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.className = 'timeline-hud';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Era timeline');
    root.tabIndex = 0;

    // Build tick marks from the registry
    const ticksHtml = ERA_REGISTRY.map((era, i) => {
      return `<button class="tl-tick" data-era="${era.id}" aria-pressed="${i === this.currentIndex}"><span class="tl-tick-year">${era.year}</span><span class="tl-tick-label">${era.label}</span></button>`;
    }).join('');

    root.innerHTML = `
      <div class="tl-accent-bar" id="tl-accent"></div>
      <div class="tl-content">
        <div class="tl-info">
          <span class="tl-year" id="tl-year">1945</span>
          <span class="tl-era-label" id="tl-era">War's End</span>
        </div>
        <div class="tl-slider-wrap">
          <input type="range" id="tl-slider" class="tl-slider"
            min="0" max="${ERA_IDS.length - 1}" step="1"
            value="${this.currentIndex}"
            aria-label="Select era"
            aria-valuemin="0"
            aria-valuemax="${ERA_IDS.length - 1}"
          />
          <div class="tl-ticks">${ticksHtml}</div>
        </div>
        <p class="tl-desc" id="tl-desc"></p>
      </div>
    `;

    return root;
  }
}

// ---------------------------------------------------------------------------
// CSS (injected as a single stylesheet)
// ---------------------------------------------------------------------------

const TIMELINE_CSS = `
.timeline-hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: auto;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #f5f5f7;
  user-select: none;
}

.tl-accent-bar {
  height: 3px;
  width: 100%;
  background: #8a6d3b;
  transition: background-color 0.5s ease;
}

.tl-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 20px 12px;
  background: linear-gradient(to bottom, rgba(10, 12, 18, 0.92), rgba(10, 12, 18, 0.75));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.tl-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.tl-year {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 2px;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
  transition: color 0.5s ease;
}

.tl-era-label {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  opacity: 0.85;
  transition: color 0.5s ease;
}

.tl-slider-wrap {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tl-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right,
    var(--tl-accent, #8a6d3b) 0%,
    var(--tl-accent, #8a6d3b) var(--tl-fill, 0%),
    rgba(255,255,255,0.15) var(--tl-fill, 0%),
    rgba(255,255,255,0.15) 100%
  );
  outline: none;
  cursor: pointer;
  transition: background 0.3s ease;
}

.tl-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--tl-accent, #8a6d3b);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  cursor: grab;
  transition: transform 0.15s ease, border-color 0.3s ease;
}

.tl-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.2);
}

.tl-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--tl-accent, #8a6d3b);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  cursor: grab;
  transition: transform 0.15s ease, border-color 0.3s ease;
}

.tl-slider::-moz-range-thumb:active {
  cursor: grabbing;
  transform: scale(1.2);
}

.tl-ticks {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.tl-tick {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 2px;
  background: transparent;
  border: none;
  border-top: 2px solid rgba(255,255,255,0.2);
  border-radius: 0;
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  cursor: pointer;
  transition: color 0.3s ease, border-color 0.3s ease;
  font-family: inherit;
}

.tl-tick:hover {
  color: rgba(255,255,255,0.9);
  border-top-color: rgba(255,255,255,0.5);
}

.tl-tick--active {
  color: #fff;
}

.tl-tick-year {
  font-weight: 700;
  font-size: 12px;
}

.tl-tick-label {
  font-size: 9px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.tl-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255,255,255,0.6);
  text-align: center;
  max-width: 600px;
  min-height: 36px;
  transition: opacity 0.3s ease;
}

@media (max-width: 640px) {
  .tl-year { font-size: 24px; }
  .tl-era-label { font-size: 12px; }
  .tl-tick-label { display: none; }
  .tl-desc { display: none; }
}
`;
