/**
 * Timeline Slider HUD
 *
 * A polished, keyboard-accessible timeline control that lets the user select
 * any of the five era years (1945–2025). The slider is bound directly to the
 * {@link ALL_ERA_SPECS} registry so it always reflects the canonical era
 * ordering and labels.
 *
 * State ownership:
 *   The slider does NOT own era state. The parent (scene bootstrap) is the
 *   single source of truth. When the user interacts with the slider,
 *   {@link TimelineSliderOptions.onEraChange} is dispatched; the parent then
 *   calls {@link TimelineSlider.setEra} to reflect the now-current era back
 *   into the HUD.
 *
 * Accessibility:
 *   - The native `<input type="range">` provides arrow-key, Home/End, and
 *     Enter/Space support out of the box.
 *   - Each year label is a focusable `<button>` (Tab + Enter/Space).
 *   - ARIA labels and roles are set for screen readers.
 *
 * Non-blocking:
 *   The outer container has `pointer-events: none` so it never intercepts
 *   camera or pointer events outside its interactive hit area. Only the range
 *   input and year buttons receive pointer events.
 */

import {
  ALL_ERA_SPECS,
  ERA_ORDER,
  type EraId,
  type EraSpec,
  getEraSpec,
  isEraId,
} from '../eraRegistry';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for constructing a {@link TimelineSlider}. */
export interface TimelineSliderOptions {
  /**
   * Callback invoked when the user selects a new era via the slider or year
   * buttons. The slider does not own era state — the receiver is expected to
   * call {@link TimelineSlider.setEra} once the new era is applied.
   */
  onEraChange: (eraId: EraId) => void;

  /**
   * Optional element to mount the HUD into. Defaults to `document.body`.
   */
  container?: HTMLElement;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of discrete era stops on the slider. */
const ERA_COUNT = ERA_ORDER.length;

/** z-index shared with the rest of the HUD (camera hint uses 9999). */
const HUD_Z_INDEX = 9999;

// ---------------------------------------------------------------------------
// TimelineSlider
// ---------------------------------------------------------------------------

export class TimelineSlider {
  /** The root HUD element appended to the DOM. */
  private readonly root: HTMLDivElement;

  /** The native range input (0–4) driving era selection. */
  private readonly rangeInput: HTMLInputElement;

  /** The filled portion of the custom track, width-synced to the range value. */
  private readonly trackFill: HTMLDivElement;

  /** The thumb indicator that slides along the track. */
  private readonly trackThumb: HTMLDivElement;

  /** Clickable year label buttons, one per era. */
  private readonly yearButtons: HTMLButtonElement[] = [];

  /** Tick mark elements, one per era. */
  private readonly tickMarks: HTMLDivElement[] = [];

  /** Element displaying the current era's descriptive label. */
  private readonly eraLabel: HTMLDivElement;

  /** Element displaying the current era's description text. */
  private readonly eraDescription: HTMLDivElement;

  /** The era currently reflected in the HUD (not owned — set by parent). */
  private currentEraId: EraId;

  /** Callback invoked when the user selects a new era (parent owns state). */
  private readonly onEraChange: (eraId: EraId) => void;

  /** Bound event handlers (kept for clean removal in dispose()). */
  private readonly boundRangeInput: (e: Event) => void;
  private readonly boundRangeChange: (e: Event) => void;
  private readonly boundKeyDown: (e: KeyboardEvent) => void;

  /**
   * @param options Construction options.
   */
  constructor(options: TimelineSliderOptions) {
    this.currentEraId = ERA_ORDER[0];
    this.onEraChange = options.onEraChange;

    // ---- Root container ----
    this.root = document.createElement('div');
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Timeline era selector');
    // pointer-events: none on the container so camera/pointer events pass
    // through everywhere except the interactive children below.
    this.root.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'right: 0',
      'display: flex',
      'justify-content: center',
      'padding: 14px 16px 10px',
      'pointer-events: none',
      'z-index: ' + HUD_Z_INDEX,
      'user-select: none',
      '-webkit-user-select: none',
    ].join(';');

    // ---- Inner panel (the visible HUD bar) ----
    const panel = document.createElement('div');
    panel.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'gap: 6px',
      'padding: 10px 22px 12px',
      'background: rgba(0,0,0,0.65)',
      'color: #fff',
      'font-family: sans-serif',
      'border-radius: 0 0 14px 14px',
      'backdrop-filter: blur(6px)',
      '-webkit-backdrop-filter: blur(6px)',
      'box-shadow: 0 4px 18px rgba(0,0,0,0.45)',
      'pointer-events: auto',
      'min-width: 520px',
      'max-width: 92vw',
    ].join(';');

    // ---- Header row: title + current era label ----
    const headerRow = document.createElement('div');
    headerRow.style.cssText = [
      'display: flex',
      'align-items: baseline',
      'gap: 12px',
      'width: 100%',
      'justify-content: center',
    ].join(';');

    const title = document.createElement('span');
    title.textContent = 'TIMELINE';
    title.style.cssText = [
      'font-size: 10px',
      'font-weight: 700',
      'letter-spacing: 2.5px',
      'color: rgba(255,255,255,0.55)',
    ].join(';');

    this.eraLabel = document.createElement('div');
    this.eraLabel.style.cssText = [
      'font-size: 16px',
      'font-weight: 700',
      'letter-spacing: 0.5px',
      'color: #fff',
      'transition: color 0.25s ease',
    ].join(';');

    headerRow.appendChild(title);
    headerRow.appendChild(this.eraLabel);
    panel.appendChild(headerRow);

    // ---- Slider track wrapper ----
    // The native range input is visually hidden but fully functional &
    // keyboard-accessible; a custom track is rendered on top for polish.
    const trackWrapper = document.createElement('div');
    trackWrapper.style.cssText = [
      'position: relative',
      'width: 100%',
      'height: 32px',
      'display: flex',
      'align-items: center',
    ].join(';');

    // Custom track background
    const trackBg = document.createElement('div');
    trackBg.style.cssText = [
      'position: absolute',
      'left: 0',
      'right: 0',
      'top: 50%',
      'transform: translateY(-50%)',
      'height: 5px',
      'border-radius: 3px',
      'background: rgba(255,255,255,0.18)',
    ].join(';');
    trackWrapper.appendChild(trackBg);

    // Filled portion of the track
    this.trackFill = document.createElement('div');
    this.trackFill.style.cssText = [
      'position: absolute',
      'left: 0',
      'top: 50%',
      'transform: translateY(-50%)',
      'height: 5px',
      'border-radius: 3px',
      'background: linear-gradient(90deg, #4a90d9, #7ec8e3)',
      'transition: width 0.2s ease, background 0.3s ease',
      'pointer-events: none',
    ].join(';');
    trackWrapper.appendChild(this.trackFill);

    // Tick marks — one per era, positioned at each stop
    for (let i = 0; i < ERA_COUNT; i++) {
      const tick = document.createElement('div');
      const pct = (i / (ERA_COUNT - 1)) * 100;
      tick.style.cssText = [
        'position: absolute',
        `left: ${pct}%`,
        'top: 50%',
        'transform: translate(-50%, -50%)',
        'width: 11px',
        'height: 11px',
        'border-radius: 50%',
        'background: rgba(255,255,255,0.35)',
        'border: 2px solid rgba(0,0,0,0.4)',
        'transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
        'pointer-events: none',
      ].join(';');
      trackWrapper.appendChild(tick);
      this.tickMarks.push(tick);
    }

    // Sliding thumb indicator (visual only — the range input handles input)
    this.trackThumb = document.createElement('div');
    this.trackThumb.style.cssText = [
      'position: absolute',
      'top: 50%',
      'transform: translate(-50%, -50%)',
      'width: 20px',
      'height: 20px',
      'border-radius: 50%',
      'background: #fff',
      'border: 3px solid #4a90d9',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.5)',
      'transition: left 0.2s ease, border-color 0.3s ease, box-shadow 0.2s ease',
      'pointer-events: none',
      'z-index: 2',
    ].join(';');
    trackWrapper.appendChild(this.trackThumb);

    // Native range input — transparent overlay for full keyboard a11y
    this.rangeInput = document.createElement('input');
    this.rangeInput.type = 'range';
    this.rangeInput.min = '0';
    this.rangeInput.max = String(ERA_COUNT - 1);
    this.rangeInput.step = '1';
    this.rangeInput.value = '0';
    this.rangeInput.setAttribute('aria-label', 'Select era year');
    this.rangeInput.style.cssText = [
      'position: absolute',
      'left: -10px',
      'right: -10px',
      'top: 0',
      'bottom: 0',
      'width: calc(100% + 20px)',
      'height: 100%',
      'margin: 0',
      'opacity: 0',
      'cursor: pointer',
      'z-index: 3',
    ].join(';');
    trackWrapper.appendChild(this.rangeInput);

    panel.appendChild(trackWrapper);

    // ---- Year label buttons row ----
    const labelsRow = document.createElement('div');
    labelsRow.style.cssText = [
      'display: flex',
      'justify-content: space-between',
      'width: 100%',
      'margin-top: 2px',
    ].join(';');

    for (let i = 0; i < ERA_COUNT; i++) {
      const spec = ALL_ERA_SPECS[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(spec.year);
      btn.dataset.eraId = spec.eraId;
      btn.setAttribute('aria-label', `Select era ${spec.year}: ${spec.label}`);
      btn.style.cssText = [
        'flex: 1',
        'text-align: center',
        'background: none',
        'border: none',
        'color: rgba(255,255,255,0.5)',
        'font-family: sans-serif',
        'font-size: 13px',
        'font-weight: 600',
        'padding: 4px 0',
        'cursor: pointer',
        'transition: color 0.2s ease, transform 0.15s ease',
        'outline: none',
      ].join(';');
      labelsRow.appendChild(btn);
      this.yearButtons.push(btn);
    }

    panel.appendChild(labelsRow);

    // ---- Era description ----
    this.eraDescription = document.createElement('div');
    this.eraDescription.style.cssText = [
      'font-size: 12px',
      'color: rgba(255,255,255,0.6)',
      'text-align: center',
      'max-width: 480px',
      'line-height: 1.4',
      'margin-top: 2px',
      'transition: color 0.25s ease',
    ].join(';');
    panel.appendChild(this.eraDescription);

    this.root.appendChild(panel);

    // ---- Event wiring ----
    this.boundRangeInput = (e: Event) => this.onRangeInput(e);
    this.boundRangeChange = (e: Event) => this.onRangeChange(e);
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);

    this.rangeInput.addEventListener('input', this.boundRangeInput);
    this.rangeInput.addEventListener('change', this.boundRangeChange);

    for (const btn of this.yearButtons) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.eraId;
        if (id && isEraId(id)) {
          this.dispatchChange(id);
        }
      });
      btn.addEventListener('keydown', this.boundKeyDown);
    }

    // ---- Mount ----
    const mount = options.container ?? document.body;
    mount.appendChild(this.root);

    // Render the initial (first-era) state.
    this.applyEraVisuals(this.currentEraId);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Reflect a new current era into the HUD.
   *
   * The slider does not own era state — the parent calls this to indicate
   * which era is now active (e.g. after applying a transition). This updates
   * the slider position, highlight, label, and description without dispatching
   * {@link TimelineSliderOptions.onEraChange}.
   *
   * @param eraId The era that is now current.
   */
  setEra(eraId: EraId): void {
    this.applyEraVisuals(eraId);
  }

  /**
   * Remove the HUD from the DOM and detach all event listeners.
   */
  dispose(): void {
    this.rangeInput.removeEventListener('input', this.boundRangeInput);
    this.rangeInput.removeEventListener('change', this.boundRangeChange);
    for (const btn of this.yearButtons) {
      btn.removeEventListener('keydown', this.boundKeyDown);
    }
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  // -------------------------------------------------------------------------
  // Internal — event handlers
  // -------------------------------------------------------------------------

  /**
   * Handle live dragging of the range input. We only commit a change when the
   * value lands exactly on an era stop (which it always does since step=1 and
   * the range spans 0–4). We dispatch on `input` so the scene begins
   * transitioning as soon as the user settles on a stop.
   */
  private onRangeInput(_e: Event): void {
    const idx = this.parseRangeIndex();
    const eraId = ERA_ORDER[idx];
    if (eraId !== this.currentEraId) {
      this.dispatchChange(eraId);
    }
  }

  /** No-op change handler (kept for completeness / future commit-on-release). */
  private onRangeChange(_e: Event): void {
    // Intentionally empty — selection is committed in onRangeInput.
  }

  /**
   * Keyboard handler for year-label buttons: Left/Right arrows move focus and
   * selection between adjacent eras; Enter/Space confirms (native button
   * behaviour handles Enter/Space, so we only intercept arrows here).
   */
  private onKeyDown(e: KeyboardEvent): void {
    const idx = this.currentRangeIndex();
    let targetIdx = -1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      targetIdx = Math.max(0, idx - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      targetIdx = Math.min(ERA_COUNT - 1, idx + 1);
    } else if (e.key === 'Home') {
      targetIdx = 0;
    } else if (e.key === 'End') {
      targetIdx = ERA_COUNT - 1;
    }
    if (targetIdx >= 0 && targetIdx !== idx) {
      e.preventDefault();
      const eraId = ERA_ORDER[targetIdx];
      this.dispatchChange(eraId);
      // Move focus to the newly-selected year button for screen-reader flow.
      this.yearButtons[targetIdx].focus();
    }
  }

  // -------------------------------------------------------------------------
  // Internal — visual updates
  // -------------------------------------------------------------------------

  /**
   * Dispatch {@link onEraChange} and immediately reflect the new era visually
   * so the HUD feels responsive even before the parent calls {@link setEra}.
   */
  private dispatchChange(eraId: EraId): void {
    this.applyEraVisuals(eraId);
    this.onEraChange(eraId);
  }

  /**
   * Update all visual elements to reflect `eraId` as the current era.
   */
  private applyEraVisuals(eraId: EraId): void {
    this.currentEraId = eraId;
    const idx = ERA_ORDER.indexOf(eraId);
    const spec: EraSpec = getEraSpec(eraId);

    // Sync the native range input value.
    this.rangeInput.value = String(idx);

    // Track fill + thumb position.
    const pct = (idx / (ERA_COUNT - 1)) * 100;
    this.trackFill.style.width = pct + '%';
    this.trackThumb.style.left = pct + '%';

    // Era-derived accent colour (from the sky bottom colour) for a thematic tie-in.
    const accent = spec.sky.bottomColor;
    this.trackFill.style.background = `linear-gradient(90deg, ${accent}, ${spec.sky.topColor})`;
    this.trackThumb.style.borderColor = accent;

    // Tick marks: highlight up to and including the current era.
    for (let i = 0; i < this.tickMarks.length; i++) {
      const tick = this.tickMarks[i];
      const isActive = i === idx;
      const isPassed = i < idx;
      if (isActive) {
        tick.style.background = '#fff';
        tick.style.transform = 'translate(-50%, -50%) scale(1.45)';
        tick.style.boxShadow = `0 0 8px ${accent}`;
      } else if (isPassed) {
        tick.style.background = accent;
        tick.style.transform = 'translate(-50%, -50%) scale(1)';
        tick.style.boxShadow = 'none';
      } else {
        tick.style.background = 'rgba(255,255,255,0.3)';
        tick.style.transform = 'translate(-50%, -50%) scale(1)';
        tick.style.boxShadow = 'none';
      }
    }

    // Year buttons: highlight the active year.
    for (let i = 0; i < this.yearButtons.length; i++) {
      const btn = this.yearButtons[i];
      const active = i === idx;
      btn.style.color = active ? '#fff' : 'rgba(255,255,255,0.45)';
      btn.style.transform = active ? 'scale(1.12)' : 'scale(1)';
      btn.setAttribute('aria-pressed', String(active));
    }

    // Label + description.
    this.eraLabel.textContent = spec.label;
    this.eraLabel.style.color = accent;
    this.eraDescription.textContent = spec.description;
  }

  /** Read the range input's current integer index, clamped to valid bounds. */
  private parseRangeIndex(): number {
    const raw = parseInt(this.rangeInput.value, 10);
    if (Number.isNaN(raw)) return 0;
    return Math.max(0, Math.min(ERA_COUNT - 1, raw));
  }

  /** Index of the era currently reflected in the HUD. */
  private currentRangeIndex(): number {
    return ERA_ORDER.indexOf(this.currentEraId);
  }
}
