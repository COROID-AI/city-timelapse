// @vitest-environment jsdom
/**
 * timeline.composition.test.ts — composition test: the slider drives era
 * selection through EraSystem.selectEra across all five stops, including
 * arrow-key selection and the transition indicator/label handshake.
 */
import { describe, expect, it } from 'vitest';
import { EraSystem } from '../eras/eraSystem';
import { TimelineUI } from './timeline';

/** Slider order required by the product brief. */
const SLIDER_ORDER: readonly number[] = [1945, 1965, 1985, 2005, 2025];

/** Ticks the era system's clock until the tween settles. */
function driveToSettled(system: EraSystem, stepSeconds = 0.25, maxSteps = 500): void {
  let steps = 0;
  while (system.getState().phase === 'transitioning' && steps < maxSteps) {
    system.update(stepSeconds);
    steps += 1;
  }
}

interface Composition {
  container: HTMLElement;
  system: EraSystem;
  timeline: TimelineUI;
}

/** Real EraSystem + TimelineUI bound through the app-style onSelect wiring. */
function setup(): Composition {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const system = new EraSystem(1945, 0.5);
  const timeline = new TimelineUI({
    onSelect: (year) => system.selectEra(year),
  });
  timeline.mount(container);
  return { container, system, timeline };
}

describe('timeline composition', () => {
  it('renders a top slider with exactly the five era stops', () => {
    const { container } = setup();
    const stops = Array.from(container.querySelectorAll('[data-role="stop"]'));
    expect(stops).toHaveLength(5);
    expect(stops.map((stop) => stop.getAttribute('data-year'))).toEqual(
      SLIDER_ORDER.map(String),
    );
  });

  it('selecting each of the five stops drives EraSystem.selectEra and settles', () => {
    const { container, system } = setup();

    // Visit every stop in coil order (each click targets a different active era,
    // so every click is a real selection, including the journey back to 1945).
    const travel = [1965, 1985, 2005, 2025, 1945];
    for (const year of travel) {
      const stop = container.querySelector<HTMLElement>(`[data-year="${year}"]`);
      stop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Clicking a stop must drive the era system's selectEra immediately.
      expect(system.getState().next).toBe(year);

      driveToSettled(system);
      expect(system.getState()).toMatchObject({
        current: year,
        next: null,
        phase: 'idle',
      });
    }
  });

  it('arrow-key selection drives era selection through the composition', () => {
    const { container, system } = setup();
    const slider = container.querySelector<HTMLElement>('[data-role="slider"]')!;

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(system.getState().next).toBe(1965);
    driveToSettled(system);
    expect(system.getState().current).toBe(1965);

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(system.getState().next).toBe(2025);
    driveToSettled(system);
    expect(system.getState().current).toBe(2025);

    // Enter confirms the focused stop (no-op here: 2025 is already active).
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(system.getState().phase).toBe('idle');

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(system.getState().next).toBe(2005);
  });

  it('shows the era label and transition indicator from the live state', () => {
    const { container, system, timeline } = setup();
    const root = container.querySelector('.coroid-tl')!;

    container
      .querySelector<HTMLElement>('[data-year="1985"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(system.getState().next).toBe(1985);

    timeline.update(system.getState());
    // While blending, the label shows the source era and the status names the
    // destination; the animated transition indicator is visible.
    expect(container.querySelector('[data-role="year"]')?.textContent).toBe('1945');
    expect(container.querySelector('[data-role="status"]')?.textContent).toContain('1985');
    expect(root.classList.contains('is-transitioning')).toBe(true);

    driveToSettled(system);
    timeline.update(system.getState());
    expect(container.querySelector('[data-role="year"]')?.textContent).toBe('1985');
    expect(container.querySelector('[data-role="title"]')?.textContent).toBe('Neon-Soaked Night');
    expect(container.querySelector('[data-role="status"]')?.textContent).toBe('Settled');
    expect(root.classList.contains('is-transitioning')).toBe(false);
  });
});