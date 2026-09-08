/**
 * Unit tests for the pure HUD state-diff helpers in `src/hud/hudState.ts`.
 *
 * The focus is the per-frame minimal DOM diffing contract: text/style values
 * are only flagged as changed when they actually differ, and the pure
 * formatters produce the exact readouts the overlay displays.
 */

import {
  countdownLabel,
  createDiffTracker,
  formatLap,
  formatSpeed,
  formatTime,
  tintPercent,
} from '../../src/hud/hudState';

describe('createDiffTracker', () => {
  it('flags a value on first sight and after a change', () => {
    const t = createDiffTracker();
    // First record of a key always reports a change.
    expect(t.record('speed', '120')).toBe(true);
    // Identical value -> no change (suppresses the DOM write).
    expect(t.record('speed', '120')).toBe(false);
    // Changed value -> change again.
    expect(t.record('speed', '121')).toBe(true);
  });

  it('tracks distinct keys independently', () => {
    const t = createDiffTracker();
    t.record('a', 1);
    t.record('b', 2);
    expect(t.record('a', 1)).toBe(false);
    expect(t.record('b', 2)).toBe(false);
  });

  it('distinguishes truthy/typo-adjacent values e.g. 0 vs 0.0 by strictness', () => {
    const t = createDiffTracker();
    expect(t.record('w', 0)).toBe(true);
    expect(t.record('w', 0)).toBe(false);
    // A different primitive type is a change even if it loosely compares equal.
    expect(t.record('w', '0')).toBe(true);
  });
});

describe('formatSpeed', () => {
  it('scales world units to a rounded integer km/h', () => {
    expect(formatSpeed(0)).toBe('0');
    expect(formatSpeed(33.333)).toBe('120');
    expect(formatSpeed(22.222)).toBe('80');
  });

  it('clamps negative speed to zero', () => {
    expect(formatSpeed(-5)).toBe('0');
  });
});

describe('formatTime', () => {
  it('formats mm:ss.mmm from milliseconds', () => {
    expect(formatTime(0)).toBe('00:00.000');
    expect(formatTime(1000)).toBe('00:01.000');
    expect(formatTime(83456)).toBe('01:23.456');
    expect(formatTime(745999)).toBe('12:25.999');
  });

  it('clamps negative input to zero', () => {
    expect(formatTime(-50)).toBe('00:00.000');
  });
});

describe('formatLap', () => {
  it('renders current/total (1-based)', () => {
    expect(formatLap(1, 3)).toBe('1/3');
    expect(formatLap(0, 3)).toBe('1/3'); // clamps below 1
    expect(formatLap(3, 3)).toBe('3/3');
  });

  it('clamps above total and handles a zero total', () => {
    expect(formatLap(9, 3)).toBe('3/3');
    expect(formatLap(2, 0)).toBe('2/3');
  });
});

describe('countdownLabel', () => {
  it('maps remaining time to 3-2-1 then GO', () => {
    expect(countdownLabel(3)).toBe('3');
    expect(countdownLabel(2.4)).toBe('3');
    expect(countdownLabel(2)).toBe('2');
    expect(countdownLabel(1)).toBe('1');
    expect(countdownLabel(0.2)).toBe('1');
    expect(countdownLabel(0)).toBe('GO');
    expect(countdownLabel(-1)).toBe('GO');
  });
});

describe('tintPercent', () => {
  it('maps a [0,1] ratio to a 0..100 percentage', () => {
    expect(tintPercent(0)).toBe(0);
    expect(tintPercent(0.5)).toBe(50);
    expect(tintPercent(1)).toBe(100);
  });

  it('clamps out-of-range values', () => {
    expect(tintPercent(-0.5)).toBe(0);
    expect(tintPercent(1.5)).toBe(100);
  });
});