/**
 * Tests for the TrafficLightController — verifies the configurable period, the
 * green → yellow → red cycle, the exposed phase API, and the inverse
 * complementary phase that vehicles obey.
 */
import { describe, expect, it } from 'vitest';
import {
  createTrafficLightController,
  DEFAULT_SIGNAL_CYCLE_MS,
} from '../trafficLight.js';

describe('TrafficLightController — configuration', () => {
  it('starts on green', () => {
    const ctrl = createTrafficLightController();
    expect(ctrl.getPhase()).toBe('green');
  });

  it('reports the configured cycle period', () => {
    const ctrl = createTrafficLightController({ cycleMs: 8000 });
    expect(ctrl.getCycleMs()).toBe(8000);
  });

  it('defaults to the standard cycle period', () => {
    const ctrl = createTrafficLightController();
    expect(ctrl.getCycleMs()).toBe(DEFAULT_SIGNAL_CYCLE_MS);
  });
});

describe('TrafficLightController — phase cycling', () => {
  it('progresses green → yellow → red → green across one full cycle', () => {
    const cycleMs = 10_000;
    const ctrl = createTrafficLightController({
      cycleMs,
      greenFraction: 0.5,
      yellowFraction: 0.1,
    });
    // green for 0..5000
    ctrl.update(0);
    expect(ctrl.getPhase()).toBe('green');
    ctrl.update(4999);
    expect(ctrl.getPhase()).toBe('green');
    // yellow for 5000..6000
    ctrl.update(1);
    expect(ctrl.getPhase()).toBe('yellow');
    ctrl.update(999);
    expect(ctrl.getPhase()).toBe('yellow');
    // red for 6000..10000
    ctrl.update(1);
    expect(ctrl.getPhase()).toBe('red');
    ctrl.update(3998);
    expect(ctrl.getPhase()).toBe('red');
    // wraps back to green at the cycle boundary
    ctrl.update(2);
    expect(ctrl.getPhase()).toBe('green');
  });

  it('continues cycling across multiple periods', () => {
    const ctrl = createTrafficLightController({
      cycleMs: 1000,
      greenFraction: 0.5,
      yellowFraction: 0.1,
    });
    ctrl.update(2100); // 2.1 cycles → 100ms into green phase of third cycle
    expect(ctrl.getPhase()).toBe('green');
  });

  it('reset() returns the controller to green', () => {
    const ctrl = createTrafficLightController({ cycleMs: 1000 });
    ctrl.update(900); // deep into red
    expect(ctrl.getPhase()).toBe('red');
    ctrl.reset();
    expect(ctrl.getPhase()).toBe('green');
  });
});

describe('TrafficLightController — complementary phase', () => {
  it('complementary phase is red while primary is green or yellow', () => {
    const ctrl = createTrafficLightController({ cycleMs: 10_000 });
    ctrl.update(0);
    expect(ctrl.getPhase()).toBe('green');
    expect(ctrl.getComplementaryPhase()).toBe('red');

    ctrl.reset();
    ctrl.update(4800); // yellow (default fractions: green 0–4200, yellow 4200–5400)
    expect(ctrl.getPhase()).toBe('yellow');
    expect(ctrl.getComplementaryPhase()).toBe('red');
  });

  it('complementary phase is green while primary is red', () => {
    const ctrl = createTrafficLightController({ cycleMs: 10_000 });
    ctrl.update(8000); // red
    expect(ctrl.getPhase()).toBe('red');
    expect(ctrl.getComplementaryPhase()).toBe('green');
  });

  it('exposes a phase API type of green|yellow|red', () => {
    const ctrl = createTrafficLightController();
    const valid = new Set(['green', 'yellow', 'red']);
    for (let i = 0; i < 20; i++) {
      ctrl.update(500);
      expect(valid).toContain(ctrl.getPhase());
      expect(valid).toContain(ctrl.getComplementaryPhase());
    }
  });
});
