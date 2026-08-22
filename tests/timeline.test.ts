// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimelineSlider } from '../src/ui/timeline';
import type { TimelineSliderHandle } from '../src/ui/timeline';
import { ERA_IDS } from '../src/eras';
import type { EraId } from '../src/eras';

const EXPECTED_YEARS = ['1945', '1965', '1985', '2005', '2025'] as const;

interface Harness {
  container: HTMLElement;
  onEraChange: ReturnType<typeof vi.fn<(id: EraId) => void>>;
  handle: TimelineSliderHandle;
}

let harnesses: Harness[] = [];

function mount(): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onEraChange = vi.fn<(id: EraId) => void>();
  const handle = createTimelineSlider(container, onEraChange);
  const harness: Harness = { container, onEraChange, handle };
  harnesses.push(harness);
  return harness;
}

function stopButtons(scope: ParentNode = document): HTMLButtonElement[] {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>('.era-timeline-stop'));
}

function activeStopIds(): string[] {
  return stopButtons()
    .filter((button) => button.classList.contains('is-active'))
    .map((button) => button.dataset.eraId as string);
}

function thumb(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-testid="era-timeline-thumb"]') as HTMLElement;
}

function railEl(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-testid="era-timeline-rail"]') as HTMLElement;
}

function keydown(element: Element, key: string): void {
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

function pointerEvent(type: string, clientX: number): MouseEvent {
  // MouseEvent carries clientX in every DOM implementation; the component only
  // reads coordinates, so this stays portable across jsdom/happy-dom/browsers.
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
}

function rect(left: number, width: number): DOMRect {
  return {
    left,
    right: left + width,
    top: 0,
    bottom: 56,
    width,
    height: 56,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as unknown as DOMRect;
}

beforeEach(() => {
  harnesses = [];
});

afterEach(() => {
  for (const { handle } of harnesses) handle.dispose();
  harnesses = [];
  document.body.innerHTML = '';
});

describe('createTimelineSlider rendering', () => {
  it('pins an era-timeline root into the container with injected styles', () => {
    const { container, handle } = mount();
    expect(container.contains(handle.root)).toBe(true);
    expect(handle.root.dataset.testid).toBe('era-timeline');

    const styles = document.getElementById('era-timeline-styles');
    expect(styles).not.toBeNull();
    expect(styles?.textContent).toContain('position: fixed');
    expect(styles?.textContent).toContain('top: 14px');
  });

  it('renders exactly five labeled stops in chronological order', () => {
    mount();
    const buttons = stopButtons();
    expect(buttons).toHaveLength(5);
    expect(buttons.map((b) => b.textContent)).toEqual([...EXPECTED_YEARS]);
    expect(buttons.map((b) => b.dataset.eraId)).toEqual([...ERA_IDS]);
  });

  it('exposes a slider role whose aria-valuenow starts at 1945 and highlights the first stop', () => {
    mount();
    const slider = thumb();
    expect(slider.getAttribute('role')).toBe('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('1945');
    expect(slider.getAttribute('aria-valuemax')).toBe('2025');
    expect(slider.getAttribute('aria-valuenow')).toBe('1945');
    expect(activeStopIds()).toEqual(['1945']);
  });

  it('does not fire onEraChange until the user interacts', () => {
    const { onEraChange } = mount();
    expect(onEraChange).not.toHaveBeenCalled();
  });
});

describe('clicking stops', () => {
  it('fires onEraChange with the matching EraId for every stop', () => {
    const { onEraChange } = mount();
    const buttons = stopButtons();

    EXPECTED_YEARS.forEach((year, i) => {
      buttons[i].click();
      expect(onEraChange).toHaveBeenNthCalledWith(i + 1, year);
    });
    expect(onEraChange).toHaveBeenCalledTimes(5);
  });

  it('moves the visual highlight to the clicked stop', () => {
    mount();
    const buttons = stopButtons();
    buttons[3].click(); // 2005
    expect(activeStopIds()).toEqual(['2005']);
    expect(thumb().getAttribute('aria-valuenow')).toBe('2005');
  });
});

describe('setEra programmatic control', () => {
  it('highlights the requested chip without re-triggering onEraChange', () => {
    const { onEraChange, handle } = mount();
    handle.setEra('1985');

    expect(onEraChange).not.toHaveBeenCalled();
    expect(handle.getEra()).toBe('1985');
    expect(activeStopIds()).toEqual(['1985']);

    const buttons = stopButtons();
    expect(buttons[2].getAttribute('aria-current')).toBe('true');
    expect(buttons[0].getAttribute('aria-current')).toBe('false');
    expect(thumb().getAttribute('aria-valuenow')).toBe('1985');

    // Highlight travels with subsequent calls, still silently.
    handle.setEra('2025');
    expect(onEraChange).not.toHaveBeenCalled();
    expect(activeStopIds()).toEqual(['2025']);
  });

  it('throws on an unknown era id', () => {
    const { handle } = mount();
    expect(() => handle.setEra('2055' as EraId)).toThrow(/Unknown era/i);
  });
});

describe('keyboard accessibility on chips', () => {
  it('moves focus between stops with arrow keys without changing the era', () => {
    const { onEraChange } = mount();
    const buttons = stopButtons();
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);

    keydown(buttons[0], 'ArrowRight');
    expect(document.activeElement).toBe(buttons[1]);
    keydown(buttons[1], 'ArrowRight');
    expect(document.activeElement).toBe(buttons[2]);
    keydown(buttons[2], 'ArrowLeft');
    expect(document.activeElement).toBe(buttons[1]);
    keydown(buttons[1], 'End');
    expect(document.activeElement).toBe(buttons[4]);
    keydown(buttons[4], 'Home');
    expect(document.activeElement).toBe(buttons[0]);
    expect(onEraChange).not.toHaveBeenCalled();
  });

  it('activates the focused stop with Enter and Space', () => {
    const { onEraChange } = mount();
    const buttons = stopButtons();

    buttons[2].focus();
    keydown(buttons[2], 'Enter');
    expect(onEraChange).toHaveBeenCalledTimes(1);
    expect(onEraChange).toHaveBeenNthCalledWith(1, '1985');

    buttons[4].focus();
    keydown(buttons[4], ' ');
    expect(onEraChange).toHaveBeenCalledTimes(2);
    expect(onEraChange).toHaveBeenNthCalledWith(2, '2025');
    expect(activeStopIds()).toEqual(['2025']);
  });
});

describe('thumb slider semantics', () => {
  it('commits adjacent eras with arrow keys and keeps focus on the thumb', () => {
    const { onEraChange } = mount();
    const slider = thumb();
    slider.focus();

    keydown(slider, 'ArrowRight');
    expect(onEraChange).toHaveBeenNthCalledWith(1, '1965');
    expect(slider.getAttribute('aria-valuenow')).toBe('1965');
    expect(document.activeElement).toBe(slider);

    keydown(slider, 'ArrowLeft');
    expect(onEraChange).toHaveBeenNthCalledWith(2, '1945');
    expect(slider.getAttribute('aria-valuenow')).toBe('1945');

    keydown(slider, 'End');
    expect(onEraChange).toHaveBeenNthCalledWith(3, '2025');
    expect(slider.getAttribute('aria-valuenow')).toBe('2025');
    expect(onEraChange).toHaveBeenCalledTimes(3);
  });

  it('re-selects the current era on Enter/Space', () => {
    const { onEraChange } = mount();
    const slider = thumb();
    slider.focus();
    keydown(slider, 'Enter');
    expect(onEraChange).toHaveBeenCalledWith('1945');
    keydown(slider, ' ');
    expect(onEraChange).toHaveBeenCalledTimes(2);
  });
});

describe('dragging along the track', () => {
  function stubRailGeometry(): void {
    vi.spyOn(railEl(), 'getBoundingClientRect').mockImplementation(() => rect(100, 400));
  }

  it('snaps the thumb to the nearest stop and fires onEraChange on release', () => {
    const { onEraChange } = mount();
    stubRailGeometry();
    const slider = thumb();

    slider.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(onEraChange).not.toHaveBeenCalled(); // drag only, not committed yet

    window.dispatchEvent(pointerEvent('pointermove', 430));
    expect(slider.style.left).toBe('82.5%'); // free-follows the pointer mid-drag
    expect(thumb().classList.contains('is-dragging')).toBe(true);

    window.dispatchEvent(pointerEvent('pointerup', 430));
    // fraction 0.825 * 4 → nearest index 3 → 2005
    expect(onEraChange).toHaveBeenCalledTimes(1);
    expect(onEraChange).toHaveBeenNthCalledWith(1, '2005');
    expect(slider.getAttribute('aria-valuenow')).toBe('2005');
    expect(activeStopIds()).toEqual(['2005']);
    expect(slider.classList.contains('is-dragging')).toBe(false);
  });

  it('rounds to the closest stop in either direction', () => {
    const { onEraChange } = mount();
    stubRailGeometry();
    const slider = thumb();

    slider.dispatchEvent(pointerEvent('pointerdown', 100));
    window.dispatchEvent(pointerEvent('pointermove', 260)); // fraction .45 → index 2 (1985)
    window.dispatchEvent(pointerEvent('pointerup', 260));
    expect(onEraChange).toHaveBeenNthCalledWith(1, '1985');

    slider.dispatchEvent(pointerEvent('pointerdown', 100));
    window.dispatchEvent(pointerEvent('pointermove', 130)); // fraction 0.075 · 4 ≈ 0.3 → snaps back to 1945
    window.dispatchEvent(pointerEvent('pointerup', 130));
    expect(onEraChange).toHaveBeenNthCalledWith(2, '1945');
    expect(onEraChange).toHaveBeenCalledTimes(2);
  });

  it('tapping the track (not a chip) jumps to the nearest stop', () => {
    const { onEraChange } = mount();
    stubRailGeometry();

    railEl().dispatchEvent(pointerEvent('pointerdown', 330));
    window.dispatchEvent(pointerEvent('pointerup', 330));
    // fraction 0.575 * 4 = 2.3 → nearest index 2 → 1985
    expect(onEraChange).toHaveBeenCalledTimes(1);
    expect(onEraChange).toHaveBeenCalledWith('1985');
    expect(activeStopIds()).toEqual(['1985']);
  });

  it('springs back without committing when the drag is cancelled', () => {
    const { onEraChange, handle } = mount();
    stubRailGeometry();
    const slider = thumb();

    slider.dispatchEvent(pointerEvent('pointerdown', 100));
    window.dispatchEvent(pointerEvent('pointermove', 480));
    window.dispatchEvent(new Event('pointercancel'));

    expect(onEraChange).not.toHaveBeenCalled();
    expect(handle.getEra()).toBe('1945');
    expect(slider.style.left).toBe('0%'); // restored to the committed stop
    expect(slider.classList.contains('is-dragging')).toBe(false);
  });
});

describe('dispose', () => {
  it('removes the DOM and detaches listeners', () => {
    const { container, onEraChange, handle } = mount();
    const buttons = stopButtons(container);

    handle.dispose();
    expect(container.querySelector('[data-testid="era-timeline"]')).toBeNull();

    // Detached node: aborted listeners must not fire the callback or throw.
    expect(() => buttons[1].click()).not.toThrow();
    expect(onEraChange).not.toHaveBeenCalled();
  });
});
