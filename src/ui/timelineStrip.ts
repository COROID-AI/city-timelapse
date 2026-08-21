import type { EraTransitionState, TimelineController } from '../core/TimelineController';
import { ERA_IDS, getEraIndex, isEraId } from '../eras/types';
import type { EraId } from '../eras/types';

/** Short blurbs shown until the era-content tasks land their full registry. */
const ERA_BLURBS: Readonly<Record<EraId, string>> = {
  '1945': 'Post-war rebuild — brick low-rises and rationed streets.',
  '1965': 'Mid-century boom — pastel facades and chrome cruisers.',
  '1985': 'Neon decade — concrete towers under sodium glare.',
  '2005': 'Glass boom — SUVs, big-box retail, digital billboards.',
  '2025': 'Present day — EVs, LED media walls, smart grids.',
};

export interface TimelineStripHandle {
  readonly root: HTMLElement;
  /** Detach DOM listeners and the controller subscription. */
  dispose(): void;
}

interface StripElements {
  readonly slider: HTMLInputElement;
  readonly labels: HTMLButtonElement[];
  readonly readout: HTMLElement;
}

function queryElements(root: HTMLElement): StripElements {
  const slider = root.querySelector<HTMLInputElement>('#timeline-slider');
  if (!slider) {
    throw new Error('timelineStrip: missing #timeline-slider element');
  }
  const readout = root.querySelector<HTMLElement>('#era-readout');
  if (!readout) {
    throw new Error('timelineStrip: missing #era-readout element');
  }
  const labels = Array.from(root.querySelectorAll<HTMLButtonElement>('.timeline-label'));
  if (labels.length !== ERA_IDS.length) {
    throw new Error(`timelineStrip: expected ${ERA_IDS.length} .timeline-label buttons`);
  }
  return { slider, labels, readout };
}

/**
 * Wire the top timeline strip to the TimelineController: slider drags and
 * era label clicks push selections into the controller, and every controller
 * emission (including per-frame transition ticks) is reflected back onto the
 * slider position, active label and readout text.
 */
export function initTimelineStrip(
  controller: TimelineController,
  root: HTMLElement = document.body,
): TimelineStripHandle {
  const { slider, labels, readout } = queryElements(root);
  slider.min = '0';
  slider.max = String(ERA_IDS.length - 1);

  const onSliderInput = (): void => {
    const index = Number.parseInt(slider.value, 10);
    if (Number.isInteger(index) && index >= 0 && index < ERA_IDS.length) {
      controller.setEra(ERA_IDS[index]);
    }
  };

  const boundLabels: Array<[HTMLButtonElement, () => void]> = [];
  for (const label of labels) {
    const onClick = (): void => {
      const era = label.dataset.era;
      if (isEraId(era)) {
        controller.setEra(era);
      }
    };
    label.addEventListener('click', onClick);
    boundLabels.push([label, onClick]);
  }

  const sync = (state: EraTransitionState): void => {
    slider.value = String(getEraIndex(state.to));
    for (const label of labels) {
      const active = label.dataset.era === state.to;
      label.classList.toggle('is-active', active);
      if (active) {
        label.setAttribute('aria-current', 'true');
      } else {
        label.removeAttribute('aria-current');
      }
    }
    readout.textContent = state.settled
      ? `${state.to} — ${ERA_BLURBS[state.to]}`
      : `${state.from} \u2192 ${state.to} \u2026`;
  };

  slider.addEventListener('input', onSliderInput);
  const unsubscribe = controller.subscribe(sync);

  return {
    root,
    dispose(): void {
      unsubscribe();
      slider.removeEventListener('input', onSliderInput);
      for (const [label, onClick] of boundLabels) {
        label.removeEventListener('click', onClick);
      }
      readout.textContent = '';
    },
  };
}
