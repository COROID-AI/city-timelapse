import './timelineSlider.css';
import { ERA_YEARS, type EraYear } from '../eras';

/** Callback invoked whenever the user selects an era via the slider. */
export type EraSelectionCallback = (year: EraYear) => void;

export interface TimelineSliderOptions {
  /** Existing DOM element the slider is mounted into. */
  container: HTMLElement;
  /** Era shown on startup (defaults to the first era, 1945). */
  initialYear?: EraYear;
  /** Called when the user clicks a year or drags the handle. */
  onSelect?: EraSelectionCallback;
}

/** Per-era accent color so the control feels era-appropriate. */
const ERA_ACCENTS: Record<EraYear, string> = {
  1945: '#d9b56a', // warm sepia gold
  1965: '#e08a5a', // retro amber
  1985: '#6fb3e8', // neon sky
  2005: '#7fd0a0', // digital mint
  2025: '#c792ea', // futuristic violet
};

const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/**
 * Top-of-screen timeline slider.
 *
 * A DOM overlay (never inside the WebGL canvas) exposing the five canonical
 * era years. Supports clicking a year or dragging a smooth handle. On user
 * selection it dispatches the era-selection callback that the transition
 * engine listens to; it never touches the engine or content modules directly.
 *
 * It also exposes {@link setYear} so the foundation's keyboard 1-5 hotkeys can
 * keep the slider position in sync without re-dispatching selection.
 */
export class TimelineSlider {
  private readonly container: HTMLElement;
  private readonly onSelect?: EraSelectionCallback;

  private readonly track: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly handle: HTMLElement;
  private readonly yearLabel: HTMLElement;
  private readonly markers: HTMLElement[] = [];

  private currentIndex: number;
  private dragging = false;
  private disposed = false;

  constructor(options: TimelineSliderOptions) {
    this.container = options.container;
    this.onSelect = options.onSelect;

    const initial = options.initialYear ?? ERA_YEARS[0];
    const initialIndex = ERA_YEARS.indexOf(initial);
    this.currentIndex = initialIndex >= 0 ? initialIndex : 0;

    this.container.classList.add('timeline-slider');
    this.container.innerHTML = `
      <div class="timeline-header">
        <div class="timeline-heading">
          <span class="timeline-eyebrow">City Time Period</span>
          <span class="timeline-title">Timeline</span>
        </div>
        <span class="timeline-year-label" aria-live="polite">${ERA_YEARS[this.currentIndex]}</span>
      </div>
      <div class="timeline-track"
           role="slider"
           tabindex="0"
           aria-label="Select time period"
           aria-valuemin="${ERA_YEARS[0]}"
           aria-valuemax="${ERA_YEARS[ERA_YEARS.length - 1]}"
           aria-valuenow="${ERA_YEARS[this.currentIndex]}"
           aria-valuetext="${ERA_YEARS[this.currentIndex]}">
        <div class="timeline-rail"></div>
        <div class="timeline-fill"></div>
        <div class="timeline-handle"></div>
        ${ERA_YEARS.map(
          (year, i) => `
          <button type="button"
                  class="timeline-marker"
                  data-index="${i}"
                  aria-label="Year ${year}">
            <span class="marker-dot"></span>
            <span class="marker-label">${year}</span>
          </button>`,
        ).join('')}
      </div>
      <div class="timeline-hint">
        <kbd>1</kbd>–<kbd>5</kbd> or drag the handle to change era
      </div>
    `;

    const track = this.container.querySelector<HTMLElement>('.timeline-track');
    const fill = this.container.querySelector<HTMLElement>('.timeline-fill');
    const handle = this.container.querySelector<HTMLElement>('.timeline-handle');
    const yearLabel = this.container.querySelector<HTMLElement>('.timeline-year-label');
    if (!track || !fill || !handle || !yearLabel) {
      throw new Error('TimelineSlider: failed to build slider DOM');
    }
    this.track = track;
    this.fill = fill;
    this.handle = handle;
    this.yearLabel = yearLabel;

    this.container
      .querySelectorAll<HTMLElement>('.timeline-marker')
      .forEach((marker) => this.markers.push(marker));

    this.bindEvents();
    this.updateUI(false);
  }

  /** Current era year shown by the slider. */
  get year(): EraYear {
    return ERA_YEARS[this.currentIndex];
  }

  /**
   * Move the slider to the given era (used by the foundation's keyboard
   * hotkey sync). Updates the visual position only — it does not re-dispatch
   * the era-selection event, so it never causes a selection loop.
   */
  setYear(year: EraYear): void {
    const index = ERA_YEARS.indexOf(year);
    if (index < 0 || index === this.currentIndex) {
      return;
    }
    this.currentIndex = index;
    this.updateUI(true);
  }

  /** Remove all listeners and detach the slider DOM. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.track.removeEventListener('pointerdown', this.handlePointerDown);
    this.track.removeEventListener('pointermove', this.handlePointerMove);
    this.track.removeEventListener('pointerup', this.handlePointerUp);
    this.track.removeEventListener('pointercancel', this.handlePointerUp);
    this.track.removeEventListener('keydown', this.handleKeyDown);
    this.markers.forEach((marker) => {
      marker.removeEventListener('click', this.handleMarkerClick);
    });
    this.container.innerHTML = '';
    this.container.classList.remove('timeline-slider');
  }

  // --- internals -------------------------------------------------------------

  private bindEvents(): void {
    this.track.addEventListener('pointerdown', this.handlePointerDown);
    this.track.addEventListener('pointermove', this.handlePointerMove);
    this.track.addEventListener('pointerup', this.handlePointerUp);
    this.track.addEventListener('pointercancel', this.handlePointerUp);
    this.track.addEventListener('keydown', this.handleKeyDown);
    this.markers.forEach((marker) => {
      marker.addEventListener('click', this.handleMarkerClick);
    });
  }

  private handleMarkerClick = (event: Event): void => {
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    const index = Number(button.dataset.index);
    this.selectIndex(index, true);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    // Only left button / touch starts a drag.
    if (event.button !== 0 && event.pointerType !== 'touch') {
      return;
    }
    event.preventDefault();
    this.dragging = true;
    this.container.classList.add('is-dragging');
    this.track.setPointerCapture(event.pointerId);
    this.updateFromClientX(event.clientX);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }
    this.updateFromClientX(event.clientX);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.container.classList.remove('is-dragging');
    if (this.track.hasPointerCapture(event.pointerId)) {
      this.track.releasePointerCapture(event.pointerId);
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    let next = this.currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = clamp(this.currentIndex + 1, 0, ERA_YEARS.length - 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = clamp(this.currentIndex - 1, 0, ERA_YEARS.length - 1);
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = ERA_YEARS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    this.selectIndex(next, true);
  };

  private updateFromClientX(clientX: number): void {
    const rect = this.track.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const index = Math.round(ratio * (ERA_YEARS.length - 1));
    this.selectIndex(index, false);
  };

  /** Set the active index, update visuals, and dispatch selection if changed. */
  private selectIndex(index: number, animate: boolean): void {
    const clamped = clamp(index, 0, ERA_YEARS.length - 1);
    if (clamped === this.currentIndex) {
      return;
    }
    this.currentIndex = clamped;
    this.updateUI(animate);
    this.onSelect?.(ERA_YEARS[clamped]);
  }

  private updateUI(animate: boolean): void {
    const fraction = this.currentIndex / (ERA_YEARS.length - 1);
    const percent = fraction * 100;
    const year = ERA_YEARS[this.currentIndex];
    const accent = ERA_ACCENTS[year];

    // Handle position (left) + fill progress (scaleX for GPU-friendly anim).
    this.handle.style.left = `${percent}%`;
    this.fill.style.transform = `scaleX(${fraction})`;

    // Era-appropriate accent for handle, fill, active marker and label.
    this.handle.style.setProperty('--ts-accent', accent);
    this.fill.style.setProperty('--ts-accent', accent);
    this.container.style.setProperty('--ts-accent', accent);
    this.container.style.setProperty('--ts-accent-rgb', this.hexToRgb(accent));

    this.yearLabel.textContent = String(year);
    this.track.setAttribute('aria-valuenow', String(year));
    this.track.setAttribute('aria-valuetext', String(year));

    this.markers.forEach((marker, i) => {
      marker.classList.toggle('is-active', i === this.currentIndex);
    });

    // When dragging we keep the handle glued to the cursor (no transition);
    // otherwise it glides smoothly to the snapped year.
    this.container.classList.toggle('is-dragging', !animate && this.dragging);
  }

  private hexToRgb(hex: string): string {
    const value = parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `${r}, ${g}, ${b}`;
  }
}
