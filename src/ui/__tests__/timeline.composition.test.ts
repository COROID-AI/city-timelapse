import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimelineController } from '../../state/timelineStore';
import { createTimelineUI } from '../timelineUI';

describe('Timeline UI Composition', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('mounts with a real TimelineController and synchronizes initial state', () => {
    const controller = createTimelineController({ initialEra: '1945' });
    const ui = createTimelineUI(root, controller);

    expect(ui.sliderElement).toBeDefined();
    expect(ui.hudElement).toBeDefined();
    expect(ui.overlayElement).toBeDefined();

    // Check initial stops
    const stop1945 = ui.sliderElement.querySelector<HTMLButtonElement>('[data-year="1945"]');
    expect(stop1945?.classList.contains('is-active')).toBe(true);

    // Check ARIA slider attributes
    expect(ui.thumbElement.getAttribute('aria-valuenow')).toBe('1945');
    expect(ui.thumbElement.getAttribute('role')).toBe('slider');

    ui.dispose();
    controller.dispose();
  });

  it('clicking 1985 calls setYear and triggers onYearRequested callback', () => {
    const controller = createTimelineController({ initialEra: '1945' });
    const onYearRequested = vi.fn();
    const ui = createTimelineUI(root, controller, { onYearRequested });

    const stop1985 = ui.sliderElement.querySelector<HTMLButtonElement>('[data-year="1985"]');
    expect(stop1985).toBeDefined();

    stop1985?.click();

    expect(onYearRequested).toHaveBeenCalledWith('1985');
    expect(controller.getState().currentEra).toBe('1985');
    expect(stop1985?.classList.contains('is-active')).toBe(true);
    expect(ui.thumbElement.getAttribute('aria-valuenow')).toBe('1985');

    ui.dispose();
    controller.dispose();
  });

  it('dragging sets scrubTo across 0..1 and snaps to nearest era on release', () => {
    const controller = createTimelineController({ initialEra: '1945' });
    const onScrub = vi.fn();
    const onYearRequested = vi.fn();
    const ui = createTimelineUI(root, controller, { onScrub, onYearRequested });

    // Mock getBoundingClientRect on trackWrapper
    vi.spyOn(ui.trackElement, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 28,
      right: 500,
      bottom: 78,
      x: 100,
      y: 50,
      toJSON: () => {},
    });

    // 1. Pointerdown at clientX = 300 -> (300 - 100) / 400 = 0.5 (1985)
    ui.trackElement.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 300,
        bubbles: true,
      }),
    );

    expect(controller.getState().isScrubbing).toBe(true);
    expect(onScrub).toHaveBeenCalled();
    const lastScrub = onScrub.mock.calls[onScrub.mock.calls.length - 1];
    expect(lastScrub[0]).toBeCloseTo(0.5, 2);
    expect(ui.thumbElement.style.left).toBe('50%');

    // 2. Pointermove at clientX = 400 -> (400 - 100) / 400 = 0.75 (2005)
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 400,
        bubbles: true,
      }),
    );

    expect(controller.getState().isScrubbing).toBe(true);
    expect(ui.thumbElement.style.left).toBe('75%');

    // 3. Pointerup at clientX = 400 -> snaps to 2005
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 400,
        bubbles: true,
      }),
    );

    expect(controller.getState().isScrubbing).toBe(false);
    expect(controller.getState().currentEra).toBe('2005');
    expect(onYearRequested).toHaveBeenCalledWith('2005');

    ui.dispose();
    controller.dispose();
  });

  it('keys 1-5 and arrow keys jump years and step through eras', () => {
    const controller = createTimelineController({ initialEra: '1945' });
    const onYearRequested = vi.fn();
    const ui = createTimelineUI(root, controller, { onYearRequested });

    // Press '3' -> jumps to 1985
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1985');
    expect(onYearRequested).toHaveBeenCalledWith('1985');

    // Press '5' -> jumps to 2025
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
    expect(controller.getState().currentEra).toBe('2025');

    // Press '2' -> jumps to 1965
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1965');

    // Press '4' -> jumps to 2005
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
    expect(controller.getState().currentEra).toBe('2005');

    // Press '1' -> jumps to 1945
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1945');

    // ArrowRight -> step forward to 1965
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1965');

    // ArrowLeft -> step backward to 1945
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1945');

    ui.dispose();
    controller.dispose();
  });

  it('activates shimmer during tween transitions and clears upon completion', () => {
    const controller = createTimelineController({ transitionDuration: 1.0 });
    const ui = createTimelineUI(root, controller);

    controller.setYear('1985', { duration: 1.0 });
    expect(controller.getState().isTransitioning).toBe(true);
    expect(ui.sliderElement.classList.contains('is-transitioning')).toBe(true);

    // Halfway through tween
    controller.update(0.5);
    expect(controller.getState().isTransitioning).toBe(true);
    expect(ui.sliderElement.classList.contains('is-transitioning')).toBe(true);

    // Complete tween
    controller.update(0.6);
    expect(controller.getState().isTransitioning).toBe(false);
    expect(ui.sliderElement.classList.contains('is-transitioning')).toBe(false);
    expect(ui.thumbElement.getAttribute('aria-valuenow')).toBe('1985');

    ui.dispose();
    controller.dispose();
  });

  it('start overlay invokes onStart callback on click', () => {
    const controller = createTimelineController();
    const onStart = vi.fn();
    const ui = createTimelineUI(root, controller, { onStart });

    expect(ui.overlay).toBeDefined();
    expect(ui.overlay?.isVisible()).toBe(true);

    ui.overlay?.button.click();
    expect(onStart).toHaveBeenCalledTimes(1);

    ui.dispose();
    controller.dispose();
  });

  it('POI chips and mute button update HUD state and trigger callbacks', () => {
    const controller = createTimelineController();
    const onSelectPoi = vi.fn();
    const onToggleMute = vi.fn();
    const ui = createTimelineUI(root, controller, { onSelectPoi, onToggleMute });

    // POI selection
    const rooftopBtn = ui.hud.poiButtons.get('rooftop');
    rooftopBtn?.click();
    expect(onSelectPoi).toHaveBeenCalledWith('rooftop');
    expect(rooftopBtn?.classList.contains('is-active')).toBe(true);

    // Mute button
    ui.hud.muteButton.click();
    expect(onToggleMute).toHaveBeenCalledWith(true);
    expect(ui.hud.muteButton.getAttribute('aria-pressed')).toBe('true');

    ui.dispose();
    controller.dispose();
  });

  it('dispose unbinds DOM elements and event listeners cleanly', () => {
    const controller = createTimelineController();
    const onYearRequested = vi.fn();
    const ui = createTimelineUI(root, controller, { onYearRequested });

    expect(root.children.length).toBeGreaterThan(0);

    ui.dispose();
    expect(root.children.length).toBe(0);

    // Subsequent events on window should not trigger callbacks
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(onYearRequested).not.toHaveBeenCalled();

    // Subsequent controller updates should not throw
    expect(() => {
      controller.setYear('2005');
      controller.update(1.0);
    }).not.toThrow();

    controller.dispose();
  });
});
