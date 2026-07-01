import { PeriodYear, YEARS } from './eras/types';

/**
 * Timeline UI controller. Manages the 5 ticks, the draggable knob,
 * arrow-key navigation, and emits era-change events.
 */
export class Timeline {
  private root: HTMLElement;
  private ticks: Map<PeriodYear, HTMLButtonElement> = new Map();
  private fill: HTMLElement;
  private knob: HTMLElement;
  private knobYear: HTMLElement;
  private current: PeriodYear = 1945;
  private onChangeCb?: (year: PeriodYear) => void;

  constructor(root: HTMLElement) {
    this.root = root;
    this.fill = root.querySelector<HTMLElement>('#timeline-fill')!;
    this.knob = root.querySelector<HTMLElement>('#timeline-knob')!;
    this.knobYear = root.querySelector<HTMLElement>('#knob-year')!;

    YEARS.forEach((y) => {
      const btn = root.querySelector<HTMLButtonElement>(`.tick[data-year="${y}"]`);
      if (btn) this.ticks.set(y, btn);
    });

    this.ticks.forEach((btn, y) => {
      btn.addEventListener('click', () => this.setYear(y, true));
    });

    this.setYear(1945, false);
  }

  public onChange(cb: (year: PeriodYear) => void): void {
    this.onChangeCb = cb;
  }

  public setYear(year: PeriodYear, emit: boolean): void {
    this.current = year;
    this.knobYear.textContent = String(year);
    // knob position as percentage along track
    const idx = YEARS.indexOf(year);
    const pct = (idx / (YEARS.length - 1)) * 100;
    this.knob.style.left = `${pct}%`;
    this.fill.style.width = `${pct}%`;
    // highlight active tick
    this.ticks.forEach((btn, y) => {
      btn.classList.toggle('active', y === year);
    });
    if (emit) this.onChangeCb?.(year);
  }

  public get year(): PeriodYear {
    return this.current;
  }

  public next(): void {
    const idx = YEARS.indexOf(this.current);
    const nextYear = YEARS[Math.min(idx + 1, YEARS.length - 1)] ?? this.current;
    this.setYear(nextYear, true);
  }

  public prev(): void {
    const idx = YEARS.indexOf(this.current);
    const prevYear = YEARS[Math.max(idx - 1, 0)] ?? this.current;
    this.setYear(prevYear, true);
  }
}
