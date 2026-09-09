import { describe, expect, it, vi } from 'vitest';
import { createTimelineController } from '../timelineStore';

describe('TimelineController', () => {
  it('initializes with default 1945 state', () => {
    const controller = createTimelineController();
    const state = controller.getState();

    expect(state.currentEra).toBe('1945');
    expect(state.isTransitioning).toBe(false);
    expect(state.isScrubbing).toBe(false);
    expect(state.globalProgress).toBe(0);
    expect(state.channel).toEqual({
      fromEra: '1945',
      toEra: '1945',
      t: 0,
    });
  });

  it('initializes with custom initial era', () => {
    const controller = createTimelineController({ initialEra: '1985' });
    const state = controller.getState();

    expect(state.currentEra).toBe('1985');
    expect(state.globalProgress).toBe(0.5);
    expect(state.channel).toEqual({
      fromEra: '1985',
      toEra: '1985',
      t: 0,
    });
  });

  it('immediately updates state when setYear is called with immediate: true', () => {
    const controller = createTimelineController();
    controller.setYear('2005', { immediate: true });

    const state = controller.getState();
    expect(state.currentEra).toBe('2005');
    expect(state.isTransitioning).toBe(false);
    expect(state.channel).toEqual({
      fromEra: '2005',
      toEra: '2005',
      t: 0,
    });
  });

  it('starts a tween transition when setYear is called', () => {
    const controller = createTimelineController({ transitionDuration: 1.0 });
    controller.setYear('1965');

    const state = controller.getState();
    expect(state.currentEra).toBe('1965');
    expect(state.isTransitioning).toBe(true);
    expect(state.channel.fromEra).toBe('1945');
    expect(state.channel.toEra).toBe('1965');
    expect(state.channel.t).toBe(0);
  });

  it('advances tween during update() ticks', () => {
    const controller = createTimelineController({ transitionDuration: 1.0 });
    controller.setYear('1965', { duration: 1.0 });

    // Midpoint: 0.5s into 1.0s duration -> cubic easeInOut(0.5) is 0.5
    controller.update(0.5);
    let channel = controller.getChannel();
    expect(controller.getState().isTransitioning).toBe(true);
    expect(channel.fromEra).toBe('1945');
    expect(channel.toEra).toBe('1965');
    expect(channel.t).toBeCloseTo(0.5, 5);

    // Quarter point: 0.25s into 1.0s duration -> 4*(0.25^3) = 0.0625
    controller.setYear('1985', { duration: 1.0 });
    controller.update(0.25);
    channel = controller.getChannel();
    expect(channel.t).toBeCloseTo(0.0625, 5);

    // Complete remaining duration
    controller.update(0.75);
    expect(controller.getState().isTransitioning).toBe(false);
    expect(controller.getChannel()).toEqual({
      fromEra: '1985',
      toEra: '1985',
      t: 0,
    });
  });

  it('handles non-adjacent era transitions', () => {
    const controller = createTimelineController();
    controller.setYear('2025', { duration: 1.0 });

    const state = controller.getState();
    expect(state.channel.fromEra).toBe('1945');
    expect(state.channel.toEra).toBe('2025');

    controller.update(1.5); // long enough to finish multi-step
    expect(controller.getState().isTransitioning).toBe(false);
    expect(controller.getChannel()).toEqual({
      fromEra: '2025',
      toEra: '2025',
      t: 0,
    });
  });

  it('supports live scrubbing via numeric global progress (0..1)', () => {
    const controller = createTimelineController();
    controller.startScrub();
    expect(controller.getState().isScrubbing).toBe(true);

    // Scrub to 25% (exactly 1965)
    controller.scrubTo(0.25);
    expect(controller.getChannel()).toEqual({
      fromEra: '1965',
      toEra: '1985',
      t: 0,
    });
    expect(controller.getState().currentEra).toBe('1965');

    // Scrub midway between 1985 and 2005 (around 0.625)
    controller.scrubTo(0.625);
    expect(controller.getChannel().fromEra).toBe('1985');
    expect(controller.getChannel().toEra).toBe('2005');
    expect(controller.getChannel().t).toBeCloseTo(0.5, 5);

    // End scrub with snapping
    controller.endScrub(true);
    expect(controller.getState().isScrubbing).toBe(false);
    expect(controller.getState().currentEra).toBe('2005');
    expect(controller.getChannel()).toEqual({
      fromEra: '2005',
      toEra: '2005',
      t: 0,
    });
  });

  it('supports direct channel scrubbing via { fromEra, toEra, t }', () => {
    const controller = createTimelineController();
    controller.scrubTo({ fromEra: '1965', toEra: '2005', t: 0.7 });

    const channel = controller.getChannel();
    expect(channel.fromEra).toBe('1965');
    expect(channel.toEra).toBe('2005');
    expect(channel.t).toBe(0.7);
    expect(controller.getState().currentEra).toBe('2005');
  });

  it('steps through eras sequentially (+1 / -1)', () => {
    const controller = createTimelineController({ initialEra: '1965' });

    // Step forward -> 1985
    const steppedForward = controller.step(1);
    expect(steppedForward).toBe(true);
    expect(controller.getState().currentEra).toBe('1985');

    // Step backward -> 1965
    const steppedBackward = controller.step(-1);
    expect(steppedBackward).toBe(true);
    expect(controller.getState().currentEra).toBe('1965');

    // Step backward -> 1945
    controller.step(-1);
    expect(controller.getState().currentEra).toBe('1945');

    // Boundary reached: cannot step before 1945
    const stepBeforeStart = controller.step(-1);
    expect(stepBeforeStart).toBe(false);
    expect(controller.getState().currentEra).toBe('1945');

    // Step to end: 2025
    controller.setYear('2025', { immediate: true });
    const stepPastEnd = controller.step(1);
    expect(stepPastEnd).toBe(false);
    expect(controller.getState().currentEra).toBe('2025');
  });

  it('notifies subscribers immediately and on updates', () => {
    const controller = createTimelineController();
    const listener = vi.fn();

    const unsubscribe = controller.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.setYear('1985', { immediate: true });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    controller.setYear('2005', { immediate: true });
    expect(listener).toHaveBeenCalledTimes(2); // no more notifications
  });

  it('catches subscriber errors without throwing in the store', () => {
    const controller = createTimelineController();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    controller.subscribe(() => {
      throw new Error('Subscriber error');
    });

    expect(() => {
      controller.setYear('1965', { immediate: true });
    }).not.toThrow();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('handles dispose cleanly', () => {
    const controller = createTimelineController();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.dispose();
    controller.setYear('2005');
    controller.update(1.0);

    // After dispose, no further transitions or updates run
    expect(controller.getState().currentEra).toBe('1945');
  });

  it('throws on invalid EraId in setYear', () => {
    const controller = createTimelineController();
    // @ts-expect-error testing invalid argument
    expect(() => controller.setYear('invalid_era')).toThrow(/Invalid era/);
  });
});
