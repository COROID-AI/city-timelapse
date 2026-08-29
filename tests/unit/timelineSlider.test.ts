// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { DEFAULT_PLAY_STEP_SECONDS, createEraStateStore } from '../../src/engine/EraStateStore';
import type { EraStateStore } from '../../src/engine/EraStateStore';
import { ERA_IDS } from '../../src/engine/eras';
import type { EraId } from '../../src/engine/eras';
import { ERA_ACCENTS, TimelineSlider } from '../../src/ui/TimelineSlider';

/** Mounts a fresh slider bound to a fresh store inside a detached container. */
function mountSlider(options: { store?: EraStateStore; onEraChange?: (year: EraId) => void } = {}) {
  const store = options.store ?? createEraStateStore();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const slider = new TimelineSlider({ store, onEraChange: options.onEraChange });
  slider.mount(container);
  // happy-dom returns zero rects for detached elements, so give the track a
  // deterministic geometry to exercise the pointer-to-year math.
  const track = container.querySelector<HTMLElement>('[data-testid="timeline-track"]');
  if (track) {
    track.getBoundingClientRect = () =>
      ({
        left: 100,
        right: 500,
        top: 0,
        bottom: 44,
        width: 400,
        height: 44,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
  return { store, container, slider };
}

/** Fires a PointerEvent with the given clientX (happy-dom supports PointerEvent). */
function pointerEvent(type: string, clientX: number, pointerId = 1): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY: 10,
    pointerId,
    pointerType: 'mouse',
  });
}

/** The pixel X at which a track click selects the given era. */
function xForYear(container: HTMLElement, year: EraId): number {
  const track = container.querySelector<HTMLElement>('[data-testid="timeline-track"]');
  if (!track) throw new Error('track missing');
  const rect = track.getBoundingClientRect();
  const index = ERA_IDS.indexOf(year);
  return rect.left + (rect.width * index) / (ERA_IDS.length - 1);
}

describe('TimelineSlider — rendering', () => {
  it('renders five labeled stops 1945–2025 in a top-anchored panel', () => {
    const { container } = mountSlider();
    const root = container.querySelector<HTMLElement>('[data-testid="timeline-slider"]');
    expect(root).not.toBeNull();
    expect(root?.className).toContain('timeline-slider');

    const stops = Array.from(container.querySelectorAll('[data-testid^="timeline-stop-"]'));
    expect(stops).toHaveLength(5);
    expect(stops.map((s) => s.getAttribute('data-year'))).toEqual(['1945', '1965', '1985', '2005', '2025']);

    for (const year of ERA_IDS) {
      const stop = container.querySelector<HTMLElement>(`[data-testid="timeline-stop-${year}"]`);
      expect(stop?.textContent).toContain(year);
    }
  });

  it('initializes the handle on the store year (1945) with an accent', () => {
    const { container } = mountSlider();
    const handle = container.querySelector<HTMLElement>('[data-testid="timeline-handle"]');
    const progress = container.querySelector<HTMLElement>('[data-testid="timeline-progress"]');
    const root = container.querySelector<HTMLElement>('[data-testid="timeline-slider"]');
    expect(handle?.style.left).toBe('0%');
    expect(progress?.style.width).toBe('0%');
    expect(root?.style.getPropertyValue('--timeline-accent')).toBe(ERA_ACCENTS['1945']);
  });
});

describe('TimelineSlider — click and drag input', () => {
  it('clicking a year stop calls setYear with that year', () => {
    const { store, container } = mountSlider();
    const stop = container.querySelector<HTMLElement>('[data-testid="timeline-stop-1985"]');
    stop?.click();
    expect(store.getSnapshot().selectedYear).toBe('1985');
  });

  it('clicking on the track snaps to the nearest year', () => {
    const { store, container } = mountSlider();
    const track = container.querySelector<HTMLElement>('[data-testid="timeline-track"]');
    track?.dispatchEvent(pointerEvent('pointerdown', xForYear(container, '2005')));
    expect(store.getSnapshot().selectedYear).toBe('2005');
  });

  it('dragging the handle along the track snaps to the nearest year', () => {
    const { store, container } = mountSlider();
    const track = container.querySelector<HTMLElement>('[data-testid="timeline-track"]');
    track?.dispatchEvent(pointerEvent('pointerdown', xForYear(container, '1945')));
    track?.dispatchEvent(pointerEvent('pointermove', xForYear(container, '1965')));
    track?.dispatchEvent(pointerEvent('pointerup', xForYear(container, '1965')));
    expect(store.getSnapshot().selectedYear).toBe('1965');
  });

  it('dragging beyond the last stop clamps to 2025', () => {
    const { store, container } = mountSlider();
    const track = container.querySelector<HTMLElement>('[data-testid="timeline-track"]');
    track?.dispatchEvent(pointerEvent('pointerdown', xForYear(container, '1945')));
    track?.dispatchEvent(pointerEvent('pointermove', 100_000));
    track?.dispatchEvent(pointerEvent('pointerup', 100_000));
    expect(store.getSnapshot().selectedYear).toBe('2025');
  });
});

describe('TimelineSlider — keyboard input', () => {
  const keyEvent = (key: string): KeyboardEvent =>
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  it('arrow keys step through the years', () => {
    const { store, container } = mountSlider();
    const root = container.querySelector<HTMLElement>('[data-testid="timeline-slider"]');
    root?.dispatchEvent(keyEvent('ArrowRight'));
    expect(store.getSnapshot().selectedYear).toBe('1965');
    root?.dispatchEvent(keyEvent('ArrowRight'));
    expect(store.getSnapshot().selectedYear).toBe('1985');
    root?.dispatchEvent(keyEvent('ArrowLeft'));
    expect(store.getSnapshot().selectedYear).toBe('1965');
  });

  it('number keys 1-5 select the corresponding year', () => {
    const { store, container } = mountSlider();
    const root = container.querySelector<HTMLElement>('[data-testid="timeline-slider"]');
    for (const [index, year] of ERA_IDS.entries()) {
      root?.dispatchEvent(keyEvent(String(index + 1)));
      expect(store.getSnapshot().selectedYear).toBe(year);
    }
  });

  it('Home and End jump to the first and last year', () => {
    const { store, container } = mountSlider();
    const root = container.querySelector<HTMLElement>('[data-testid="timeline-slider"]');
    root?.dispatchEvent(keyEvent('End'));
    expect(store.getSnapshot().selectedYear).toBe('2025');
    root?.dispatchEvent(keyEvent('Home'));
    expect(store.getSnapshot().selectedYear).toBe('1945');
  });

  it('arrow keys at the ends clamp without error', () => {
    const { store, container } = mountSlider();
    const root = container.querySelector<HTMLElement>('[data-testid="timeline-slider"]');
    root?.dispatchEvent(keyEvent('ArrowLeft'));
    expect(store.getSnapshot().selectedYear).toBe('1945');
    root?.dispatchEvent(keyEvent('End'));
    root?.dispatchEvent(keyEvent('ArrowRight'));
    expect(store.getSnapshot().selectedYear).toBe('2025');
  });
});

describe('TimelineSlider — two-way store binding', () => {
  it('handle, progress, labels, and accent re-sync when setYear is called programmatically', () => {
    const { store, container } = mountSlider();
    const handle = container.querySelector<HTMLElement>('[data-testid="timeline-handle"]');
    const progress = container.querySelector<HTMLElement>('[data-testid="timeline-progress"]');
    const yearLabel = container.querySelector<HTMLElement>('[data-testid="timeline-year-label"]');
    const root = container.querySelector<HTMLElement>('[data-testid="timeline-slider"]');

    store.setYear('2005');
    expect(handle?.style.left).toBe('75%');
    expect(progress?.style.width).toBe('75%');
    expect(yearLabel?.textContent).toBe('2005');
    expect(root?.style.getPropertyValue('--timeline-accent')).toBe(ERA_ACCENTS['2005']);
    expect(
      container.querySelector<HTMLElement>('[data-testid="timeline-stop-2005"]')?.classList.contains('is-active'),
    ).toBe(true);
    expect(
      container.querySelector<HTMLElement>('[data-testid="timeline-stop-1945"]')?.classList.contains('is-active'),
    ).toBe(false);

    store.setYear('1945');
    expect(handle?.style.left).toBe('0%');
    expect(yearLabel?.textContent).toBe('1945');
  });

  it('programmatic setYear does not invoke the onEraChange camera callback', () => {
    const onEraChange = vi.fn();
    const { store } = mountSlider({ onEraChange });
    store.setYear('1985');
    expect(onEraChange).not.toHaveBeenCalled();
  });

  it('user selection invokes onEraChange (camera fly-to hook)', () => {
    const onEraChange = vi.fn();
    const { container } = mountSlider({ onEraChange });
    container
      .querySelector<HTMLElement>('[data-testid="timeline-stop-1965"]')
      ?.click();
    expect(onEraChange).toHaveBeenCalledWith('1965');
  });
});

describe('TimelineSlider — play/pause auto-advance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('play button toggles the store auto-advance mode', () => {
    const { store, container } = mountSlider();
    const play = container.querySelector<HTMLButtonElement>('[data-testid="timeline-play"]');
    expect(store.getSnapshot().isPlaying).toBe(false);
    play?.click();
    expect(store.getSnapshot().isPlaying).toBe(true);
    expect(play?.classList.contains('is-playing')).toBe(true);
    expect(play?.getAttribute('aria-label')).toBe('Pause era timelapse');

    play?.click();
    expect(store.getSnapshot().isPlaying).toBe(false);
    expect(play?.classList.contains('is-playing')).toBe(false);
    expect(play?.getAttribute('aria-label')).toBe('Play era timelapse');
  });

  it('while playing, the slider dwell-walks all five years with visible handle movement', () => {
    const { store, container } = mountSlider();
    const handle = container.querySelector<HTMLElement>('[data-testid="timeline-handle"]');
    const play = container.querySelector<HTMLButtonElement>('[data-testid="timeline-play"]');
    const stepMs = DEFAULT_PLAY_STEP_SECONDS * 1000;

    play?.click();
    const seen: EraId[] = [store.getSnapshot().selectedYear];
    store.subscribe((state) => seen.push(state.selectedYear));

    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(stepMs);
    }

    expect(seen).toEqual(ERA_IDS);
    expect(store.getSnapshot().isPlaying).toBe(false);

    // The store walk drives the bound handle: it must have moved to 100%.
    expect(handle?.style.left).toBe('100%');
    expect(store.getSnapshot().selectedYear).toBe('2025');
  });

  it('stopping play mid-walk leaves a consistent non-playing state', () => {
    const { store, container } = mountSlider();
    const play = container.querySelector<HTMLButtonElement>('[data-testid="timeline-play"]');
    play?.click();
    vi.advanceTimersByTime(DEFAULT_PLAY_STEP_SECONDS * 1000);
    expect(store.getSnapshot().selectedYear).toBe('1965');
    play?.click();
    expect(store.getSnapshot().isPlaying).toBe(false);
    const frozen = store.getSnapshot().selectedYear;
    vi.advanceTimersByTime(DEFAULT_PLAY_STEP_SECONDS * 1000 * 4);
    expect(store.getSnapshot().selectedYear).toBe(frozen);
  });
});

describe('TimelineSlider — lifecycle', () => {
  it('dispose unsubscribes, removes DOM, and later setYear does not throw', () => {
    const { store, container, slider } = mountSlider();
    slider.dispose();
    expect(container.querySelector('[data-testid="timeline-slider"]')).toBeNull();
    expect(() => store.setYear('2025')).not.toThrow();
  });
});