// @vitest-environment jsdom
/**
 * timeline.test.ts — unit tests for TimelineUI rendering, interactivity and
 * lifecycle in the jsdom environment.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERAS, type EraSystemState } from '../eras/eraSystem';
import { TimelineUI, type TimelineUIOptions } from './timeline';

/** Slider order required by the product brief. */
const SLIDER_ORDER: readonly number[] = [1945, 1965, 1985, 2005, 2025];

function makeState(partial: Partial<EraSystemState> = {}): EraSystemState {
  return { current: 1945, next: null, progress: 0, phase: 'idle', ...partial };
}

interface Fixture {
  container: HTMLElement;
  onSelect: ReturnType<typeof vi.fn>;
  ui: TimelineUI;
}

function mountFixture(options: Partial<TimelineUIOptions> = {}): Fixture {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onSelect = vi.fn();
  const ui = new TimelineUI({ onSelect, ...options });
  ui.mount(container);
  return { container, onSelect, ui };
}

describe('TimelineUI rendering', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = mountFixture();
  });

  it('renders exactly the five era stops in slider order with labels', () => {
    const stops = Array.from(fixture.container.querySelectorAll('[data-role="stop"]'));
    expect(stops).toHaveLength(5);
    expect(stops.map((stop) => stop.getAttribute('data-year'))).toEqual(
      SLIDER_ORDER.map(String),
    );
    expect(stops.map((stop) => stop.textContent?.trim())).toEqual(
      SLIDER_ORDER.map(String),
    );
  });

  it('shows the current era label (year + era title) on mount', () => {
    expect(fixture.container.querySelector('[data-role="year"]')?.textContent).toBe('1945');
    expect(fixture.container.querySelector('[data-role="title"]')?.textContent).toBe(
      ERAS[1945].title,
    );
    expect(fixture.container.querySelector('[data-role="status"]')?.textContent).toBe('Settled');
  });

  it('exposes an accessible keyboard slider widget', () => {
    const slider = fixture.container.querySelector<HTMLElement>('[data-role="slider"]');
    expect(slider).not.toBeNull();
    expect(slider?.getAttribute('role')).toBe('slider');
    expect(slider?.getAttribute('tabindex')).toBe('0');
    expect(slider?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(slider?.getAttribute('aria-valuemin')).toBe('1');
    expect(slider?.getAttribute('aria-valuemax')).toBe('5');
    expect(slider?.getAttribute('aria-valuenow')).toBe('1');
    expect(slider?.getAttribute('aria-valuetext')).toContain('1945');
    expect(slider?.getAttribute('aria-valuetext')).toContain(ERAS[1945].title);

    slider?.focus();
    expect(document.activeElement).toBe(slider);
  });

  it('keeps row container empty when disposed', () => {
    fixture.ui.dispose();
    expect(fixture.container.querySelector('[data-role="stop"]')).toBeNull();
    expect(fixture.container.textContent).toBe('');
  });
});

describe('TimelineUI interactivity', () => {
  it('fires era selection on a stop click (pointer/tap activation)', () => {
    const { container, onSelect } = mountFixture();
    const stop1985 = container.querySelector<HTMLElement>('[data-year="1985"]');
    stop1985?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1985);
  });

  it('moves between stops with arrow keys and fires era selection', () => {
    const { container, onSelect } = mountFixture();
    const slider = container.querySelector<HTMLElement>('[data-role="slider"]')!;

    const press = (key: string): void => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    };

    press('ArrowRight');
    expect(onSelect).toHaveBeenLastCalledWith(1965);
    press('ArrowRight');
    expect(onSelect).toHaveBeenLastCalledWith(1985);
    press('ArrowLeft');
    expect(onSelect).toHaveBeenLastCalledWith(1965);
    press('ArrowDown');
    expect(onSelect).toHaveBeenLastCalledWith(1985);
    press('ArrowUp');
    expect(onSelect).toHaveBeenLastCalledWith(1965);

    press('End');
    expect(onSelect).toHaveBeenLastCalledWith(2025);
    press('Home');
    expect(onSelect).toHaveBeenLastCalledWith(1945);
  });

  it('does not fire at the slider edges and confirms with Enter/Space', () => {
    const { container, onSelect } = mountFixture();
    const slider = container.querySelector<HTMLElement>('[data-role="slider"]')!;

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onSelect).not.toHaveBeenCalled();

    // Move to 1965 with the arrow, then confirm the focused stop.
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith(1965);
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith(1965);

    onSelect.mockClear();
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith(1965);

    // Reaching the last stop with ArrowRight is a no-op.
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith(2025);
    onSelect.mockClear();
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the selected stop as active after interaction', () => {
    const { container } = mountFixture();
    container
      .querySelector<HTMLElement>('[data-year="2005"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const active = container.querySelector('[data-role="stop"].is-active');
    expect(active?.getAttribute('data-year')).toBe('2005');
  });
});

describe('TimelineUI update(eraState)', () => {
  it('renders the current era label from the era state', () => {
    const { container, ui } = mountFixture();
    ui.update(makeState({ current: 2005, next: null, phase: 'idle', progress: 0 }));
    expect(container.querySelector('[data-role="year"]')?.textContent).toBe('2005');
    expect(container.querySelector('[data-role="title"]')?.textContent).toBe(ERAS[2005].title);
  });

  it('shows an animated transition indicator while a tween is running', () => {
    const { container, ui } = mountFixture();
    const root = container.querySelector('.coroid-tl')!;
    const transit = container.querySelector<HTMLElement>('[data-role="transit"]')!;

    ui.update(makeState({ current: 2005, next: 2025, progress: 0.5, phase: 'transitioning' }));

    expect(root.classList.contains('is-transitioning')).toBe(true);
    expect(container.querySelector('[data-role="status"]')?.textContent).toContain('2025');
    // Source era label stays while the block blends toward the destination.
    expect(container.querySelector('[data-role="year"]')?.textContent).toBe('2005');
    // Indicator parks between stop 4 (2005) and stop 5 (2025) at eased progress.
    expect(transit.style.left).toMatch(/^\d+(\.\d+)?%$/);
    expect(transit.style.left === '87.5%').toBe(true);

    ui.update(makeState({ current: 2025, next: null, phase: 'idle', progress: 0 }));
    expect(root.classList.contains('is-transitioning')).toBe(false);
    expect(container.querySelector('[data-role="status"]')?.textContent).toBe('Settled');
    expect(container.querySelector('[data-role="year"]')?.textContent).toBe('2025');
  });

  it('accepts update() before mount and applies the state on mount', () => {
    const container = document.createElement('div');
    const onSelect = vi.fn();
    const ui = new TimelineUI({ onSelect });
    ui.update(makeState({ current: 1985, next: null, phase: 'idle', progress: 0 }));
    ui.mount(container);
    expect(container.querySelector('[data-role="year"]')?.textContent).toBe('1985');
  });
});

describe('TimelineUI lifecycle', () => {
  it('throws when mounted twice without dispose', () => {
    const { container, ui } = mountFixture();
    expect(() => ui.mount(container)).toThrow(/already mounted/i);
    const second = document.createElement('div');
    expect(() => ui.mount(second)).toThrow(/already mounted/i);
  });

  it('removes its DOM and becomes inert after dispose', () => {
    const { container, ui, onSelect } = mountFixture();
    const root = container.querySelector('.coroid-tl')!;
    ui.dispose();
    expect(container.contains(root)).toBe(false);

    // update() after dispose is a safe no-op.
    expect(() => ui.update(makeState({ current: 1965 }))).not.toThrow();
    expect(() => ui.dispose()).not.toThrow();

    const stop1985 = container.querySelector<HTMLElement>('[data-year="1985"]');
    expect(stop1985).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});