/**
 * Adaptive-quality manager tests: drive `QualityManager.update(dt)` with
 * synthetic frame-time sequences (exact dyadic deltas, so window sums are
 * bit-exact) and assert gradual stepping, hysteresis, manual override,
 * level→settings mappings and disposal semantics.
 */

import { describe, expect, it } from 'vitest';
import {
  CONSECUTIVE_WINDOWS_REQUIRED,
  DEFAULT_MAX_PIXEL_RATIO,
  DETAIL_TIER,
  FPS_WINDOW_SECONDS,
  HIGH_FPS_THRESHOLD,
  LOW_FPS_THRESHOLD,
  MAX_SAMPLED_DELTA_SECONDS,
  PIXEL_RATIO_SCALE,
  QUALITY_LEVELS,
  QualityManager,
  SHADOW_MAP_SIZE,
} from '../src/scene/quality';
import type { DetailTier, QualityLevel } from '../src/scene/quality';

// Exact binary fractions keep accumulated window sums bit-exact:
// 16fps → dt 1/16 (32 frames / 2 s window), 64fps → dt 1/64 (128 frames),
// 32fps → dt 1/32 (64 frames, sits in the healthy 30–55 band).
const DT_SLOW = 0.0625;
const SLOW_FRAMES_PER_WINDOW = 32;
const DT_FAST = 0.015625;
const FAST_FRAMES_PER_WINDOW = 128;
const DT_HEALTHY = 0.03125;

/** Feed `frames` identical deltas into the manager. */
function pumpFrames(manager: QualityManager, dt: number, frames: number): void {
  for (let i = 0; i < frames; i += 1) {
    manager.update(dt);
  }
}

function makeCollector(): { events: QualityLevel[] } {
  return { events: [] };
}

describe('QualityManager level → settings mapping', () => {
  it('maps every level to its pixel-ratio clamp, shadow size and detail tier', () => {
    for (const level of QUALITY_LEVELS) {
      const manager = new QualityManager({
        devicePixelRatio: 1,
        initialLevel: level,
      });
      expect(manager.getLevel()).toBe(level);
      expect(manager.getTier()).toBe(DETAIL_TIER[level]);
      expect(manager.getShadowMapSize()).toBe(SHADOW_MAP_SIZE[level]);
      expect(manager.getPixelRatio()).toBeCloseTo(
        Math.min(PIXEL_RATIO_SCALE[level], DEFAULT_MAX_PIXEL_RATIO),
        12,
      );
    }
  });

  it('clamps the pixel ratio against the configured ceiling', () => {
    // DPR 3 with the default ceiling of 2: high and medium both cap at 2.
    const hiDpi = new QualityManager({ devicePixelRatio: 3, initialLevel: 'high' });
    expect(hiDpi.getPixelRatio()).toBe(2);
    hiDpi.setLevel('medium');
    expect(hiDpi.getPixelRatio()).toBe(2); // 3 * 0.75 = 2.25 → capped
    hiDpi.setLevel('low');
    expect(hiDpi.getPixelRatio()).toBe(1.5); // 3 * 0.5

    // DPR 2: high renders native-capped, medium/low scale down.
    const standard = new QualityManager({ devicePixelRatio: 2 });
    expect(standard.getPixelRatio()).toBe(2);
    standard.setLevel('medium');
    expect(standard.getPixelRatio()).toBe(1.5);
    standard.setLevel('low');
    expect(standard.getPixelRatio()).toBe(1);

    // A tighter custom ceiling wins over the level scale.
    const tight = new QualityManager({
      devicePixelRatio: 2,
      maxPixelRatio: 1.25,
    });
    expect(tight.getPixelRatio()).toBe(1.25);
  });

  it('falls back to DPR 1 in environments without devicePixelRatio', () => {
    const manager = new QualityManager();
    expect(manager.getLevel()).toBe('high');
    expect(manager.getPixelRatio()).toBe(1);
  });

  it('documents its timing contract constants', () => {
    expect(FPS_WINDOW_SECONDS).toBe(2);
    expect(CONSECUTIVE_WINDOWS_REQUIRED).toBe(2);
    expect(LOW_FPS_THRESHOLD).toBe(30);
    expect(HIGH_FPS_THRESHOLD).toBe(55);
    expect(DEFAULT_MAX_PIXEL_RATIO).toBe(2);
  });

  it('rejects unknown levels and invalid ratios', () => {
    expect(
      () => new QualityManager({ initialLevel: 'cinematic' as QualityLevel }),
    ).toThrow(RangeError);
    expect(() => new QualityManager({ devicePixelRatio: 0 })).toThrow(RangeError);
    expect(() => new QualityManager({ maxPixelRatio: Number.NaN })).toThrow(
      RangeError,
    );
    const manager = new QualityManager();
    expect(() => manager.setLevel('ultra' as QualityLevel)).toThrow(/unknown quality level/i);
  });
});

describe('QualityManager automatic step-down', () => {
  it('drops one level only after two consecutive sub-30fps windows', () => {
    const collector = makeCollector();
    const manager = new QualityManager({ onChange: (level) => collector.events.push(level) });
    expect(manager.getLevel()).toBe('high');

    // One full slow window (32 frames @16fps = 2 s): evidence, but no step yet.
    pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW);
    expect(manager.getLevel()).toBe('high');
    expect(collector.events).toEqual([]);

    // Second consecutive slow window → gradual single notch down.
    pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW);
    expect(manager.getLevel()).toBe('medium');
    expect(collector.events).toEqual(['medium']);
    expect(manager.getShadowMapSize()).toBe(SHADOW_MAP_SIZE.medium);
    expect(manager.getTier()).toBe(DETAIL_TIER.medium);

    // The counter restarted after the step: one more bad window must NOT
    // cascade straight to low.
    pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW);
    expect(manager.getLevel()).toBe('medium');

    // …but the next consecutive pair finishes the descent.
    pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW);
    expect(manager.getLevel()).toBe('low');
    expect(collector.events).toEqual(['medium', 'low']);

    // Pinned at the floor: further slowdowns neither throw nor re-notify.
    pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW * 4);
    expect(manager.getLevel()).toBe('low');
    expect(collector.events).toEqual(['medium', 'low']);
  });

  it('recovers one level at a time after two consecutive >55fps windows', () => {
    const manager = new QualityManager({ devicePixelRatio: 1, initialLevel: 'low' });

    // 255 fast frames close only one window (128 frames each).
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW * 2 - 1);
    expect(manager.getLevel()).toBe('low');

    // Second consecutive fast window → low → medium.
    manager.update(DT_FAST);
    expect(manager.getLevel()).toBe('medium');
    expect(manager.getPixelRatio()).toBe(0.75);

    // Fresh count after the upgrade: another full pair reaches high…
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW * 2 - 1);
    expect(manager.getLevel()).toBe('medium');
    manager.update(DT_FAST);
    expect(manager.getLevel()).toBe('high');

    // …and high is the ceiling.
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW * 4);
    expect(manager.getLevel()).toBe('high');
  });
});

describe('QualityManager hysteresis', () => {
  it('ignores alternating slow/fast windows', () => {
    const collector = makeCollector();
    const manager = new QualityManager({ onChange: (level) => collector.events.push(level) });

    for (let cycle = 0; cycle < 4; cycle += 1) {
      pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW);
      pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW);
    }

    expect(manager.getLevel()).toBe('high');
    expect(collector.events).toEqual([]);
  });

  it('holds the level steady in the healthy 30–55fps band', () => {
    const manager = new QualityManager();
    // Ten windows at exactly 32fps average.
    pumpFrames(manager, DT_HEALTHY, 64 * 10);
    expect(manager.getLevel()).toBe('high');
  });
});

describe('QualityManager delta hygiene', () => {
  it('discards invalid and hitch-sized deltas so suspensions fake nothing', () => {
    const manager = new QualityManager({ devicePixelRatio: 1, initialLevel: 'low' });

    manager.update(0);
    manager.update(-DT_FAST);
    manager.update(Number.NaN);
    manager.update(Number.POSITIVE_INFINITY);
    manager.update(MAX_SAMPLED_DELTA_SECONDS + 0.01);

    // Exactly one clean fast window follows: if any garbage had polluted the
    // accumulator, these frames would have closed phantom windows and stepped.
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW);
    expect(manager.getLevel()).toBe('low');

    // A single long hitch mid-stream is dropped, not folded into the window:
    // window two still averages 64fps across its 128 real frames, and one
    // fast window alone cannot upgrade.
    pumpFrames(manager, DT_FAST, 100);
    manager.update(1.5);
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW - 101);
    expect(manager.getLevel()).toBe('low');

    // That closed window was the consecutive SECOND fast one (the counter
    // persisted across the discarded hitch), so the next closure upgrades —
    // proving the hitch neither corrupted the average nor reset progress.
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW);
    expect(manager.getLevel()).toBe('medium');
  });
});

describe('QualityManager manual override', () => {
  it('pins the level and blocks automatic stepping until resumed', () => {
    const manager = new QualityManager({ devicePixelRatio: 1 });
    manager.setLevel('high'); // explicit pin at the default look
    expect(manager.isAutomatic()).toBe(false);
    expect(manager.getLevel()).toBe('high');

    // Sustained heavy load: no automatic downgrades while pinned.
    pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW * 6);
    expect(manager.getLevel()).toBe('high');

    // Manual overrides may jump multiple levels at once.
    manager.setLevel('low');
    expect(manager.getLevel()).toBe('low');
    expect(manager.getPixelRatio()).toBe(0.5);
    expect(manager.getShadowMapSize()).toBe(SHADOW_MAP_SIZE.low);
    expect(manager.getTier()).toBe(DETAIL_TIER.low satisfies DetailTier);

    // Fast machine now — still pinned.
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW * 6);
    expect(manager.getLevel()).toBe('low');

    // Resuming auto restarts monitoring from a clean baseline (the six pinned
    // windows contributed nothing): one window of evidence is not enough, the
    // second consecutive one steps back UP from the floor.
    manager.resumeAuto();
    expect(manager.isAutomatic()).toBe(true);
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW);
    expect(manager.getLevel()).toBe('low');
    pumpFrames(manager, DT_FAST, FAST_FRAMES_PER_WINDOW - 1);
    expect(manager.getLevel()).toBe('low');
    manager.update(DT_FAST);
    expect(manager.getLevel()).toBe('medium');
    expect(manager.getPixelRatio()).toBe(0.75);
  });

  it('does not notify when setting the already-active level', () => {
    const collector = makeCollector();
    const manager = new QualityManager({ onChange: (level) => collector.events.push(level) });

    manager.setLevel('high');
    expect(collector.events).toEqual([]);
    expect(manager.isAutomatic()).toBe(false);

    manager.setLevel('low');
    expect(collector.events).toEqual(['low']);
  });
});

describe('QualityManager dispose', () => {
  it('freezes the instance and detaches the change callback idempotently', () => {
    const collector = makeCollector();
    const manager = new QualityManager({ initialLevel: 'medium', onChange: (level) => collector.events.push(level) });

    manager.dispose();
    expect(() => manager.dispose()).not.toThrow();

    expect(manager.getLevel()).toBe('medium');
    expect(manager.isAutomatic()).toBe(false);

    expect(() => {
      manager.update(DT_SLOW);
      manager.update(DT_FAST);
    }).not.toThrow();
    manager.setLevel('low'); // neutralized, not applied
    manager.resumeAuto(); // neutralized

    expect(manager.getLevel()).toBe('medium');
    expect(manager.isAutomatic()).toBe(false);
    pumpFrames(manager, DT_SLOW, SLOW_FRAMES_PER_WINDOW * 4);
    expect(manager.getLevel()).toBe('medium');
    expect(collector.events).toEqual([]);
    expect(manager.getTier()).toBe(DETAIL_TIER.medium);
  });
});
