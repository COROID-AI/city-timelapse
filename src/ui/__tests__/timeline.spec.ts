// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import type { EraId } from '../../types';
import { createTimeline, type Timeline } from '../timeline';

/**
 * Unit tests for `createTimeline` in a jsdom environment. These assert the
 * slider's own behavior: exactly five stops in order, click / arrow / drag
 * selection, progress bar reflection, year label + counter animation, the
 * transitioning lock, and the help panel.
 */

const STOPS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

/** jsdom lacks PointerEvent; provide a minimal polyfill used by the drag tests. */
function installPointerSupport(): void {
  if (typeof (globalThis as Record<string, unknown>).PointerEvent === 'undefined') {
    (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    };
  }
  // Element pointer-capture stubs are not implemented in jsdom.
  const proto = Element.prototype as unknown as {
    setPointerCapture?: (id: number) => void;
    releasePointerCapture?: (id: number) => void;
    hasPointerCapture?: (id: number) => boolean;
  };
  if (!proto.setPointerCapture) proto.setPointerCapture = () => undefined;
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => undefined;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
}

function mount(): { container: HTMLElement; timeline: Timeline; selections: { era: EraId; index: number }[] } {
  installPointerSupport();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const selections: { era: EraId; index: number }[] = [];
  const timeline = createTimeline(container, {
    onSelect: (era, index) => selections.push({ era, index }),
  });
  return { container, timeline, selections };
}

function query(container: HTMLElement, sel: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}

describe('createTimeline', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders exactly five stops in chronological order', () => {
    const { container } = mount();
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    expect(stops).toHaveLength(5);
    expect(stops.map((s) => s.textContent)).toEqual(STOPS);
    expect(stops.map((s) => s.dataset.era)).toEqual(STOPS);
  });

  it('starts at the first era (1945)', () => {
    const { container } = mount();
    expect(query(container, '.timeline-label').textContent).toBe('1945');
    expect(query(container, '.timeline-track').getAttribute('aria-valuenow')).toBe('0');
    expect(query(container, '.timeline-stop').classList.contains('is-active')).toBe(true);
  });

  it('fires onSelect with the era id when a stop is clicked', () => {
    const { container, selections } = mount();
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    stops[3].click();
    expect(selections).toEqual([{ era: '2005', index: 3 }]);
    expect(query(container, '.timeline-label').textContent).toBe('2005');
  });

  it('walks stops with arrow keys and returns', () => {
    const { container, selections } = mount();
    const track = query(container, '.timeline-track');
    const press = (key: string) => track.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    press('ArrowRight');
    press('ArrowRight');
    expect(selections[selections.length - 1]).toEqual({ era: '1985', index: 2 });

    press('ArrowRight');
    press('ArrowRight');
    expect(selections[selections.length - 1]).toEqual({ era: '2025', index: 4 });

    // Stay clamped at the end.
    press('ArrowRight');
    expect(selections[selections.length - 1]).toEqual({ era: '2025', index: 4 });

    press('ArrowLeft');
    expect(selections[selections.length - 1]).toEqual({ era: '2005', index: 3 });

    press('ArrowLeft');
    press('ArrowLeft');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(selections[selections.length - 1]).toEqual({ era: '1945', index: 0 });
  });

  it('snaps the thumb to the nearest stop on drag', () => {
    const { container, selections } = mount();
    const track = query(container, '.timeline-track');

    // Stub geometry so pointer math resolves deterministically.
    viStubTrackRect(track, 0, 400);
    const pointerId = 7;
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 250, pointerId, bubbles: true }));
    // 250/400 => ratio 0.625 => index round(0.625*4)=3 (2005).
    expect(selections[selections.length - 1]).toEqual({ era: '2005', index: 3 });

    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, pointerId, bubbles: true }));
    // 60/400 => 0.15 => index round(0.6)=1 (1965).
    expect(selections[selections.length - 1]).toEqual({ era: '1965', index: 1 });
  });

  it('reflects the selected stop on the progress bar', () => {
    const { container } = mount();
    const progress = query(container, '.timeline-progress');
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    stops[4].click();
    expect(progress.style.width).toBe('100%');
    stops[0].click();
    expect(progress.style.width).toBe('0%');
    stops[2].click();
    expect(progress.style.width).toBe('50%');
  });

  it('animates the year counter toward the selected year', async () => {
    const { container } = mount();
    const year = query(container, '.timeline-year');
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    stops[4].click();
    // Counter starts mid-animation; eventually settles on the target.
    await new Promise((r) => setTimeout(r, 700));
    expect(year.textContent).toBe('2025');
  });

  it('locks input while transitioning and unlocks after', () => {
    const { container, timeline, selections } = mount();
    timeline.setTransitioning(true);
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    stops[2].click();
    expect(selections).toHaveLength(0);
    expect(query(container, '.timeline-track').getAttribute('aria-disabled')).toBe('true');

    timeline.setTransitioning(false);
    stops[2].click();
    expect(selections).toEqual([{ era: '1985', index: 2 }]);
  });

  it('setEra moves the slider without firing onSelect', () => {
    const { container, timeline, selections } = mount();
    timeline.setEra('2025');
    expect(selections).toHaveLength(0);
    expect(query(container, '.timeline-label').textContent).toBe('2025');
  });

  it('opens and closes the help panel', () => {
    const { container } = mount();
    const toggle = query(container, '.timeline-help-toggle');
    const help = query(container, '.timeline-help');
    expect(help.hidden).toBe(true);
    toggle.click();
    expect(help.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(help.hidden).toBe(true);
  });

  it('dispose removes the timeline from the DOM', () => {
    const { container, timeline } = mount();
    timeline.dispose();
    expect(container.querySelector('.timeline')).toBeNull();
  });
});

/** Stub getBoundingClientRect so drag math is independent of layout. */
function viStubTrackRect(track: HTMLElement, left: number, width: number): void {
  track.getBoundingClientRect = () =>
    ({ left, width, right: left + width, top: 0, bottom: 0, height: 28, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
}