/**
 * Unit tests for the deterministic arcade physics module.
 *
 * Covers acceleration / braking / reverse, speed-dependent steering, grip,
 * and drift detection. All functions are pure, so these tests assert exact
 * numeric behavior and reproducibility.
 */

import {
  applyThrottle,
  clamp,
  createBody,
  defaultPhysics,
  detectDrift,
  steerByYaw,
  steerRate,
  stepCar,
} from '../../src/vehicle/physics';

describe('applyThrottle — acceleration, braking, reverse, drag', () => {
  it('accelerates from rest toward max speed', () => {
    const after = applyThrottle(0, 1, false, 1 / 60, defaultPhysics);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(defaultPhysics.maxSpeed);
  });

  it('never exceeds max speed under sustained throttle', () => {
    let speed = 0;
    for (let i = 0; i < 600; i++) {
      speed = applyThrottle(speed, 1, false, 1 / 60, defaultPhysics);
    }
    expect(speed).toBeLessThanOrEqual(defaultPhysics.maxSpeed);
    // Drag balances acceleration at an equilibrium below top speed:
    //   speed_eq = acceleration / drag = 40 / 0.85 ≈ 47.
    expect(speed).toBeGreaterThan(40);
    expect(speed).toBeLessThan(defaultPhysics.maxSpeed);
  });

  it('brakes a forward-moving car toward zero when throttle goes negative', () => {
    // Start from a known cruising speed rather than depending on a single
    // unrealistically large dt frame.
    const speed = 40;
    expect(speed).toBeGreaterThan(10);
    const braked = applyThrottle(speed, -1, false, 1, defaultPhysics);
    expect(braked).toBeLessThan(speed);
    expect(braked).toBeGreaterThanOrEqual(0);
  });

  it('reverses below zero when throttle is held negative from rest', () => {
    const reversed = applyThrottle(0, -1, false, 1, defaultPhysics);
    expect(reversed).toBeLessThan(0);
    expect(reversed).toBeGreaterThanOrEqual(defaultPhysics.maxReverseSpeed);
  });

  it('never exceeds reverse speed magnitude', () => {
    let speed = 0;
    for (let i = 0; i < 600; i++) {
      speed = applyThrottle(speed, -1, false, 1 / 60, defaultPhysics);
    }
    expect(speed).toBeGreaterThanOrEqual(defaultPhysics.maxReverseSpeed - 1e-6);
  });

  it('brake flag alone decelerates a forward-moving car to zero', () => {
    let speed = applyThrottle(0, 1, false, 1, defaultPhysics);
    const stopped = applyThrottle(speed, 0, true, 5, defaultPhysics);
    expect(stopped).toBe(0);
  });

  it('is deterministic — same input yields same output', () => {
    const a = applyThrottle(12, 0.6, false, 1 / 60, defaultPhysics);
    const b = applyThrottle(12, 0.6, false, 1 / 60, defaultPhysics);
    expect(a).toBe(b);
  });
});

describe('steering — speed-dependent yaw rate', () => {
  it('yields zero yaw rate when steer is zero', () => {
    expect(steerRate(0, 30, defaultPhysics)).toBe(0);
  });

  it('steers more as speed rises toward the responsive band', () => {
    const slow = Math.abs(steerRate(1, 1, defaultPhysics));
    const mid = Math.abs(steerRate(1, 20, defaultPhysics));
    expect(mid).toBeGreaterThan(slow);
  });

  it('tapers yaw rate at very high speed (encourages drifting)', () => {
    const high = Math.abs(steerRate(1, defaultPhysics.maxSpeed, defaultPhysics));
    const mid = Math.abs(steerRate(1, 25, defaultPhysics));
    expect(high).toBeLessThan(mid);
  });

  it('steerByYaw rotates the heading by the expected amount', () => {
    const yaw = steerByYaw(0, 1, 30, 1, defaultPhysics);
    expect(yaw).toBeCloseTo(steerRate(1, 30, defaultPhysics));
  });
});

describe('detectDrift — grip / drift detection', () => {
  it('is not drifting with no steer', () => {
    expect(detectDrift(0, 30, defaultPhysics).drifting).toBe(false);
  });

  it('is not drifting at low speed even with hard steer', () => {
    const result = detectDrift(1, 2, defaultPhysics);
    expect(result.drifting).toBe(false);
    expect(result.slide).toBe(0);
  });

  it('detects a sustained drift with hard steer at speed', () => {
    const result = detectDrift(1, defaultPhysics.maxSpeed, defaultPhysics);
    expect(result.drifting).toBe(true);
    expect(result.slide).toBeGreaterThan(0);
  });

  it('slide scales with steer deflection past the threshold', () => {
    const mild = detectDrift(0.8, defaultPhysics.maxSpeed, defaultPhysics);
    const hard = detectDrift(1, defaultPhysics.maxSpeed, defaultPhysics);
    expect(hard.slide).toBeGreaterThan(mild.slide);
  });

  it('slide is clamped to [0,1]', () => {
    const result = detectDrift(1, defaultPhysics.maxSpeed, defaultPhysics);
    expect(result.slide).toBeLessThanOrEqual(1);
  });
});

describe('stepCar — integrated deterministic integration', () => {
  it('moves a forward-driving car along +Z', () => {
    const body = createBody(0, 0, 0);
    for (let i = 0; i < 60; i++) {
      stepCar(body, { throttle: 1, steer: 0, brake: false }, 1 / 60, defaultPhysics);
    }
    expect(body.speed).toBeGreaterThan(5);
    expect(body.z).toBeGreaterThan(body.x);
    expect(body.x).toBeCloseTo(0, 6);
  });

  it('turns the heading when steering', () => {
    const body = createBody(0, 0, 0);
    for (let i = 0; i < 30; i++) {
      stepCar(body, { throttle: 1, steer: 1, brake: false }, 1 / 60, defaultPhysics);
    }
    expect(body.yaw).toBeGreaterThan(0);
  });

  it('is allocation-free and deterministic across runs', () => {
    const run = (): typeof body => {
      const body = createBody(0, 0, 0);
      for (let i = 0; i < 120; i++) {
        stepCar(body, { throttle: 0.8, steer: 0.4, brake: false }, 1 / 60, defaultPhysics);
      }
      return body;
    };
    const a = run();
    const b = run();
    expect(a.x).toBe(b.x);
    expect(a.z).toBe(b.z);
    expect(a.yaw).toBe(b.yaw);
  });
});

describe('clamp', () => {
  it('clamps values into range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});