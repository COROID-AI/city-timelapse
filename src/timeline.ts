/** The five selectable years, in chronological order. */
export const PERIOD_YEARS = [1945, 1965, 1985, 2005, 2025] as const;
export type PeriodYear = (typeof PERIOD_YEARS)[number];

export type PeriodChangeHandler = (year: PeriodYear, index: number) => void;

export interface TimelineHandle {
  element: HTMLElement;
  /** Programmatically move the slider to the given year. */
  setValue: (year: PeriodYear) => void;
  /** Remove the overlay and detach all listeners. */
  dispose: () => void;
}

/**
 * Builds a fixed-position timeline overlay: a range slider plus one labelled
 * button per year. Any change — dragging the slider or clicking a year — fires
 * `onChange` with the selected year and its index.
 */
export function createTimeline(
  container: HTMLElement,
  initial: PeriodYear,
  onChange: PeriodChangeHandler,
): TimelineHandle {
  const overlay = document.createElement('div');
  overlay.className = 'timeline-overlay';

  const title = document.createElement('div');
  title.className = 'timeline-title';
  title.textContent = 'TIMELINE';

  const current = document.createElement('div');
  current.className = 'timeline-current';
  current.textContent = String(initial);

  const slider = document.createElement('input');
  slider.className = 'timeline-slider';
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(PERIOD_YEARS.length - 1);
  slider.step = '1';
  slider.value = String(PERIOD_YEARS.indexOf(initial));
  slider.setAttribute('aria-label', 'Timeline year selector');

  const labels = document.createElement('div');
  labels.className = 'timeline-labels';

  // Track the label buttons so the active stop can be highlighted.
  const labelButtons: HTMLButtonElement[] = [];

  const setActive = (index: number) => {
    labelButtons.forEach((btn, i) =>
      btn.classList.toggle('is-active', i === index),
    );
  };

  const emit = (index: number) => {
    const year = PERIOD_YEARS[index];
    current.textContent = String(year);
    setActive(index);
    onChange(year, index);
  };

  PERIOD_YEARS.forEach((year, index) => {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'timeline-label';
    label.textContent = String(year);
    label.setAttribute('aria-label', `Select year ${year}`);
    label.addEventListener('click', () => {
      slider.value = String(index);
      emit(index);
    });
    labels.appendChild(label);
    labelButtons.push(label);
  });

  const onInput = () => emit(Number(slider.value));
  slider.addEventListener('input', onInput);

  // Highlight the initial selection.
  setActive(PERIOD_YEARS.indexOf(initial));

  overlay.append(title, current, slider, labels);
  container.appendChild(overlay);

  const setValue = (year: PeriodYear) => {
    const index = PERIOD_YEARS.indexOf(year);
    if (index < 0) return;
    slider.value = String(index);
    current.textContent = String(year);
    setActive(index);
  };

  const dispose = () => {
    slider.removeEventListener('input', onInput);
    overlay.remove();
  };

  return { element: overlay, setValue, dispose };
}
