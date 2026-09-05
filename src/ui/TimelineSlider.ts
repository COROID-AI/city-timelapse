/**
 * src/ui/TimelineSlider.ts — top timeline slider UI.
 *
 * Custom, framework-free slider bound to EraState. It renders the five era
 * stops (1945 → 2025) as labelled ticks on a fixed top-center track with a
 * draggable handle that snaps to the nearest stop on release; clicking a tick
 * (or anywhere on the track) jumps directly to the nearest stop. The handle is
 * a WAI-ARIA slider (role="slider", aria-valuenow, arrow/Home/End keys), so
 * the control is fully keyboard-operable.
 *
 * The handle glides between stops with the same ease-in-out curve and duration
 * as the scene morph (EraState.transitionMs — which main.ts also feeds to the
 * MorphEngine), so the knob lands exactly when the buildings morph, the SFX
 * crossfade completes and the camera glide arrives. Per-era typography and
 * colour are applied through the `data-era` attribute consumed by styles.css
 * (mirrored on <body> by main.ts for the whole UI shell).
 */

import { ERA_IDS, getEraSpec, type EraId } from '../eras';
import type { EraState } from '../state/EraState';
import { easeInOutCubic } from '../core/MorphEngine';

export interface TimelineSliderOptions {
  /** Parent element the slider is appended into. */
  container: HTMLElement;
  eraState: EraState;
  /** Called after an era change is committed. */
  onChange?: (era: EraId) => void;
}

/** Clamp a fraction into 0..1. */
export function clampPercent(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Fractional 0..1 track position of an era index. */
export function eraToPercent(index: number, count: number): number {
  if (count <= 1) {
    return 0;
  }
  return Math.min(1, Math.max(0, index / (count - 1)));
}

/** Index of the stop nearest to a fractional 0..1 track position. */
export function percentToEraIndex(percent: number, count: number): number {
  return Math.round(clampPercent(percent) * (count - 1));
}

export class TimelineSlider {
  private readonly eraState: EraState;
  private readonly onChange?: (era: EraId) => void;
  private readonly root: HTMLElement;
  private readonly yearEl: HTMLElement;
  private readonly descEl: HTMLElement;
  private readonly track: HTMLDivElement;
  private readonly handle: HTMLDivElement;
  private readonly ticks: HTMLButtonElement[] = [];
  private readonly unsubscribe: () => void;
  private currentIndex: number;
  private dragging = false;
  private dragPercent = 0;
  private glideHandle: number | null = null;

  constructor(options: TimelineSliderOptions) {
    this.eraState = options.eraState;
    this.onChange = options.onChange;
    this.currentIndex = this.eraState.index;

    this.root = document.createElement('div');
    this.root.className = 'timeline-slider';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Time period timeline');

    // Era readout: big year + period description (updates with the selection).
    const label = document.createElement('div');
    label.className = 'timeline-label';
    this.yearEl = document.createElement('div');
    this.yearEl.className = 'timeline-year';
    this.descEl = document.createElement('div');
    this.descEl.className = 'timeline-desc';
    label.append(this.yearEl, this.descEl);

    this.track = document.createElement('div');
    this.track.className = 'timeline-track';

    // Five labelled era stops.
    ERA_IDS.forEach((id, index) => {
      const spec = getEraSpec(id);
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'timeline-tick';
      tick.dataset.index = String(index);
      tick.setAttribute('aria-label', `Jump to ${spec.label}`);
      tick.textContent = spec.label;
      tick.style.left = `${eraToPercent(index, ERA_IDS.length) * 100}%`;
      tick.addEventListener('click', () => this.selectIndex(index));
      this.ticks.push(tick);
      this.track.appendChild(tick);
    });

    // Draggable handle (WAI-ARIA slider).
    this.handle = document.createElement('div');
    this.handle.className = 'timeline-handle';
    this.handle.setAttribute('role', 'slider');
    this.handle.setAttribute('tabindex', '0');
    this.handle.setAttribute('aria-valuemin', '0');
    this.handle.setAttribute('aria-valuemax', String(ERA_IDS.length - 1));
    this.handle.setAttribute('aria-valuenow', String(this.currentIndex));
    this.handle.setAttribute('aria-orientation', 'horizontal');
    this.handle.setAttribute('aria-label', 'Time period');
    this.track.appendChild(this.handle);

    // Pointer interaction: dragging anywhere on the track scrubs the handle and
    // snaps to the nearest stop on release; tick clicks commit on their own.
    this.track.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      if (event.target instanceof HTMLButtonElement) {
        return; // Ticks commit through their own click handlers.
      }
      this.beginDrag(event);
    });
    this.track.addEventListener('pointermove', (event) => {
      if (this.dragging) {
        this.updateFromPointer(event);
      }
    });
    this.track.addEventListener('pointerup', () => this.endDrag());
    this.track.addEventListener('pointercancel', () => this.endDrag());

    // Keyboard operation on the handle.
    this.handle.addEventListener('keydown', (event) => this.handleKey(event));
    // Prevent the browser from initiating a native element drag of the knob.
    this.handle.addEventListener('dragstart', (event) => event.preventDefault());

    this.root.append(label, this.track);
    options.container.appendChild(this.root);
    this.setHandlePercent(eraToPercent(this.currentIndex, ERA_IDS.length) * 100);
    this.renderEra(this.eraState.era);

    // Keep the handle/labels in sync with programmatic era changes (including
    // the global ←/→ shortcuts in main.ts) and glide to the new stop.
    this.unsubscribe = this.eraState.subscribe((era) => {
      const index = ERA_IDS.indexOf(era);
      this.currentIndex = index;
      this.renderEra(era);
      if (!this.dragging) {
        this.glideTo(index);
      }
    });
  }

  dispose(): void {
    if (this.glideHandle !== null) {
      cancelAnimationFrame(this.glideHandle);
      this.glideHandle = null;
    }
    this.unsubscribe();
    this.root.remove();
  }

  // --- Selection -------------------------------------------------------------

  /** Commit the stop at `index` (clamped); otherwise glide the knob home. */
  private selectIndex(index: number): void {
    const clamped = Math.min(ERA_IDS.length - 1, Math.max(0, index));
    this.dragging = false;
    this.handle.classList.remove('dragging');
    if (clamped !== this.currentIndex) {
      this.emit(ERA_IDS[clamped]);
    } else {
      // Same stop — glide the knob back to the stop (e.g. after a scrub
      // release that landed on the current era).
      this.glideTo(clamped);
    }
  }

  private emit(era: EraId): void {
    this.eraState.setEra(era);
    this.onChange?.(era);
  }

  // --- Pointer drag ----------------------------------------------------------

  private beginDrag(event: PointerEvent): void {
    if (this.glideHandle !== null) {
      cancelAnimationFrame(this.glideHandle);
      this.glideHandle = null;
    }
    this.dragging = true;
    this.handle.classList.add('dragging');
    try {
      this.track.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already released; drag still works via move/up listeners.
    }
    this.updateFromPointer(event);
  }

  private updateFromPointer(event: PointerEvent): void {
    const rect = this.track.getBoundingClientRect();
    const percent = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    this.dragPercent = clampPercent(percent);
    this.setHandlePercent(this.dragPercent * 100);
    // Live preview of the nearest stop (readout, theme, ARIA) while scrubbing.
    this.renderEra(ERA_IDS[percentToEraIndex(this.dragPercent, ERA_IDS.length)]);
  }

  private endDrag(): void {
    if (!this.dragging) {
      return;
    }
    const snap = percentToEraIndex(this.dragPercent, ERA_IDS.length);
    this.selectIndex(snap);
  }

  // --- Keyboard --------------------------------------------------------------

  private handleKey(event: KeyboardEvent): void {
    let next = this.currentIndex;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next -= 1;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next += 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = ERA_IDS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.selectIndex(next);
  }

  // --- Rendering -------------------------------------------------------------

  private renderEra(era: EraId): void {
    const spec = getEraSpec(era);
    const index = ERA_IDS.indexOf(era);
    this.yearEl.textContent = String(spec.year);
    this.descEl.textContent = spec.description;
    this.root.dataset.era = era;
    this.handle.setAttribute('aria-valuenow', String(index));
    this.handle.setAttribute('aria-valuetext', spec.label);
    this.ticks.forEach((tick, i) => {
      tick.classList.toggle('active', i === index);
    });
  }

  // --- Handle animation -------------------------------------------------------

  /** Position the handle/fill at a CSS percentage (0..100). */
  private setHandlePercent(pct100: number): void {
    this.handle.style.left = `${pct100}%`;
    this.track.style.setProperty('--fill-pct', `${pct100}%`);
  }

  /** Glide the handle to the stop position, eased like the scene morph. */
  private glideTo(index: number): void {
    this.glideToPercent(eraToPercent(index, ERA_IDS.length) * 100);
  }

  private glideToPercent(target: number): void {
    if (this.glideHandle !== null) {
      cancelAnimationFrame(this.glideHandle);
      this.glideHandle = null;
    }
    if (this.dragging) {
      return;
    }
    const startPct = parseFloat(this.handle.style.left);
    const start = Number.isFinite(startPct) ? startPct : 0;
    // Same duration as the shared morph timeline (EraState.transitionMs), so
    // the knob lands exactly when the scene transformation completes.
    const durationMs = Math.max(1, this.eraState.transitionMs);
    const startTime = performance.now();
    const step = (now: number): void => {
      if (this.dragging) {
        this.glideHandle = null;
        return;
      }
      const raw = Math.min(1, (now - startTime) / durationMs);
      const eased = easeInOutCubic(raw);
      this.setHandlePercent(start + (target - start) * eased);
      if (raw < 1) {
        this.glideHandle = requestAnimationFrame(step);
      } else {
        this.glideHandle = null;
        this.setHandlePercent(target);
      }
    };
    this.glideHandle = requestAnimationFrame(step);
  }
}