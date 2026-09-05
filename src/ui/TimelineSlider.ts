/**
 * src/ui/TimelineSlider.ts — top timeline UI.
 *
 * Plain-DOM slider (no framework) bound to EraState through a change callback.
 * Native range input is keyboard-operable (arrow keys), shows the current era
 * label, and stays mounted as part of the app layout. Styling lives in
 * src/ui/styles.css.
 */

import { ERA_IDS, getEraSpec, type EraId } from '../eras';
import type { EraState } from '../state/EraState';

export interface TimelineSliderOptions {
  /** Parent element the slider is appended into. */
  container: HTMLElement;
  eraState: EraState;
  /** Called after an era change is committed. */
  onChange?: (era: EraId) => void;
}

export class TimelineSlider {
  private readonly eraState: EraState;
  private readonly onChange?: (era: EraId) => void;
  private readonly root: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly label: HTMLElement;
  private readonly unsubscribe: () => void;

  constructor(options: TimelineSliderOptions) {
    this.eraState = options.eraState;
    this.onChange = options.onChange;

    this.root = document.createElement('div');
    this.root.className = 'timeline-slider';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Time period timeline');

    this.label = document.createElement('div');
    this.label.className = 'timeline-label';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'timeline-btn';
    prev.textContent = '‹';
    prev.setAttribute('aria-label', 'Previous era');
    prev.addEventListener('click', () => {
      this.emit(this.eraState.index <= 0 ? ERA_IDS[0] : ERA_IDS[this.eraState.index - 1]);
    });

    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = '0';
    this.input.max = String(ERA_IDS.length - 1);
    this.input.step = '1';
    this.input.value = String(this.eraState.index);
    this.input.className = 'timeline-range';
    this.input.setAttribute('aria-label', 'Time period');
    this.input.addEventListener('input', () => {
      const idx = Number(this.input.value);
      this.emit(ERA_IDS[idx]);
    });

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'timeline-btn';
    next.textContent = '›';
    next.setAttribute('aria-label', 'Next era');
    next.addEventListener('click', () => {
      this.emit(
        ERA_IDS[Math.min(ERA_IDS.length - 1, this.eraState.index + 1)],
      );
    });

    this.root.append(this.label, prev, this.input, next);
    options.container.appendChild(this.root);
    this.renderLabel(this.eraState.era);

    // Keep the slider in sync with programmatic era changes.
    this.unsubscribe = this.eraState.subscribe((era) => {
      this.input.value = String(ERA_IDS.indexOf(era));
      this.renderLabel(era);
    });
  }

  private emit(era: EraId): void {
    this.eraState.setEra(era);
    this.onChange?.(era);
  }

  private renderLabel(era: EraId): void {
    const spec = getEraSpec(era);
    this.label.textContent = `${spec.label} — ${spec.description}`;
  }

  dispose(): void {
    this.unsubscribe();
    this.root.remove();
  }
}