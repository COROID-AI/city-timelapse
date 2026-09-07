import { describe, expect, it } from 'vitest';
import { createPerformanceMonitor } from '../../src/render/performanceMonitor';
import {
  DEFAULT_HYSTERESIS,
  nextTier,
  profileForTier,
} from '../../src/render/qualityProfile';

/**
 * Fake renderer hooks that record every applied quality profile so tests can
 * assert exactly what the monitor pushed into a renderer.
 */
function makeHooks() {
  const applied: Array<{ ratio: number; shadow: number; distance: number }> = [];
  const hooks = {
    setPixelRatio: (ratio: number) => {
      applied.push({
        ratio,
        shadow: applied.length ? applied[applied.length - 1].shadow : 0,
        distance: applied.length ? applied[applied.length - 1].distance : 0,
      });
    },
    setShadowMapResolution: (shadow: number) => {
      applied.push({
        ratio: applied.length ? applied[applied.length - 1].ratio : 0,
        shadow,
        distance: applied.length ? applied[applied.length - 1].distance : 0,
      });
    },
    setDrawDistance: (distance: number) => {
      applied.push({
        ratio: applied.length ? applied[applied.length - 1].ratio : 0,
        shadow: applied.length ? applied[applied.length - 1].shadow : 0,
        distance,
      });
    },
  };
  return { applied, hooks };
}

/**
 * Drive a monitor through a sequence of sustained frame times and assert the
 * tier reached. Uses the real monitor with a no-op hooks object.
 */
function driveToTier(
  dtSeconds: number,
  frames: number,
): { monitor: ReturnType<typeof createPerformanceMonitor>; tier: string } {
  const monitor = createPerformanceMonitor({ hooks: makeHooks().hooks });
  for (let i = 0; i < frames; i++) {
    monitor.update(dtSeconds);
  }
  return { monitor, tier: monitor.tier };
}

describe('FPS sampler', () => {
  it('computes instantaneous FPS from delta time', () => {
    const monitor = createPerformanceMonitor({ hooks: makeHooks().hooks });
    // 16.6ms frame => ~60 FPS.
    monitor.update(0.0166);
    expect(monitor.fps).toBeCloseTo(60, 0);
  });

  it('smooths the FPS with an exponential moving average', () => {
    const monitor = createPerformanceMonitor({ hooks: makeHooks().hooks });
    // Seed at 60 FPS, then push a slower frame (20 FPS). The reported FPS
    // should move toward 20 but not snap to it in one frame.
    monitor.update(0.0166);
    const before = monitor.fps;
    monitor.update(0.05);
    const after = monitor.fps;
    expect(before).toBeGreaterThan(after);
    expect(after).toBeGreaterThan(20);
    expect(after).toBeLessThan(60);
  });

  it('ignores non-positive delta times', () => {
    const monitor = createPerformanceMonitor({ hooks: makeHooks().hooks });
    monitor.update(0.0166);
    const reference = monitor.fps;
    monitor.update(0);
    monitor.update(-0.1);
    expect(monitor.fps).toBe(reference);
  });

  it('reports a tier of high by default', () => {
    const monitor = createPerformanceMonitor({ hooks: makeHooks().hooks });
    expect(monitor.tier).toBe('high');
  });
});

describe('hysteresis thresholds', () => {
  it('steps down below the step-down threshold', () => {
    // 20 FPS is well below 45 => step down.
    expect(nextTier('high', 20)).toBe('medium');
    expect(nextTier('medium', 20)).toBe('low');
  });

  it('steps up above the step-up threshold', () => {
    // 120 FPS is well above 55 => step up.
    expect(nextTier('medium', 120)).toBe('high');
    expect(nextTier('low', 120)).toBe('medium');
  });

  it('retains the tier inside the dead band (no oscillation)', () => {
    const mid = (DEFAULT_HYSTERESIS.stepDownFps + DEFAULT_HYSTERESIS.stepUpFps) / 2;
    expect(nextTier('high', mid)).toBe('high');
    expect(nextTier('medium', mid)).toBe('medium');
    expect(nextTier('low', mid)).toBe('low');
  });

  it('does not oscillate on a borderline FPS just below the step-up threshold', () => {
    // 50 FPS is above step-down (45) but below step-up (55): stable.
    expect(nextTier('medium', 50)).toBe('medium');
    expect(nextTier('low', 50)).toBe('low');
    // A high tier at 50 FPS is still above step-down, so it stays high.
    expect(nextTier('high', 50)).toBe('high');
  });

  it('steps one tier at a time, never jumping straight to low', () => {
    expect(nextTier('high', 15)).toBe('medium');
    expect(nextTier('medium', 15)).toBe('low');
  });
});

describe('quality profile transitions', () => {
  it('defines the full three-tier ladder with the expected knobs', () => {
    const high = profileForTier('high');
    const medium = profileForTier('medium');
    const low = profileForTier('low');
    expect(high.pixelRatio).toBe(1.0);
    expect(high.shadowMapResolution).toBeGreaterThan(medium.shadowMapResolution);
    expect(medium.shadowMapResolution).toBeGreaterThan(low.shadowMapResolution);
    expect(high.drawDistance).toBeGreaterThan(medium.drawDistance);
    expect(medium.drawDistance).toBeGreaterThan(low.drawDistance);
    // Each tier reduces all three cost knobs.
    expect(medium.pixelRatio).toBeLessThan(high.pixelRatio);
    expect(low.pixelRatio).toBeLessThan(medium.pixelRatio);
  });

  it('applies the high profile on construction when hooks are provided', () => {
    const { applied, hooks } = makeHooks();
    createPerformanceMonitor({ hooks });
    const high = profileForTier('high');
    expect(applied).toContainEqual({
      ratio: high.pixelRatio,
      shadow: high.shadowMapResolution,
      distance: high.drawDistance,
    });
  });

  it('steps down through the ladder under sustained low FPS', () => {
    const { monitor } = driveToTier(0.05, 60); // ~20 FPS sustained
    expect(monitor.tier).toBe('low');
  });

  it('re-upgrades when headroom returns', () => {
    const { monitor } = driveToTier(0.05, 60); // => low
    expect(monitor.tier).toBe('low');
    for (let i = 0; i < 120; i++) {
      monitor.update(0.008); // ~125 FPS sustained
    }
    expect(monitor.tier).toBe('high');
  });
});