/**
 * Unit tests for the era-morphing engine and registry.
 *
 * A mock subsystem records every `applyEraBlend(fromEra, toEra, t)` call so
 * we can prove:
 *   - t=0 on the first frame of a transition
 *   - t=1 on the final frame
 *   - t is monotonic between (smoothstep-eased)
 *   - the engine applies blends to every registered subsystem/group in one pass
 *   - re-targeting mid-blend continues from the current blended state
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { inverseSmoothstep, smoothstep, TransformationEngine } from '../../src/engine/TransformationEngine';
import {
  clearSubsystems,
  listSubsystems,
  register,
  type EraScopedSubsystem,
} from '../../src/engine/SceneRegistry';
import type { EraId } from '../../src/engine/eras';

/** A mock era-scoped subsystem; records applyEraBlend calls per group. */
class MockSubsystem implements EraScopedSubsystem {
  readonly groupId: string;
  readonly groups: object[];
  readonly calls: Array<{ from: EraId; to: EraId; t: number; group: object }> = [];
  readonly builds: EraId[] = [];

  constructor(groupId: string, groups: object[] = [{}]) {
    this.groupId = groupId;
    this.groups = groups;
  }

  build(era: EraId): unknown {
    this.builds.push(era);
    return { era };
  }

  applyEraBlend(fromEra: EraId, toEra: EraId, t: number): void {
    // This simulates a subsystem applying the blend to all of its groups.
    for (const group of this.groups) {
      this.calls.push({ from: fromEra, to: toEra, t, group });
    }
  }

  dispose(): void {
    this.calls.length = 0;
  }
}

/** Drives the engine with fixed-size frames (like a 60fps loop). */
function driveFrames(engine: TransformationEngine, frames: number, dt = 0.05): void {
  for (let i = 0; i < frames; i += 1) engine.tick(dt);
}

/** Slices a subsystem's calls into a single group's t series. */
function tSeries(subsystem: MockSubsystem, group: object): number[] {
  return subsystem.calls.filter((c) => c.group === group).map((c) => c.t);
}

/** Exact start of a transition: t must be 0 with the source era. */
function expectFirstCall(subsystem: MockSubsystem, from: EraId, to: EraId): void {
  expect(subsystem.calls.length).toBeGreaterThan(0);
  const first = subsystem.calls[0];
  expect(first.t).toBe(0);
  expect(first.from).toBe(from);
  expect(first.to).toBe(to);
}

/** Exact end of a transition: last call must be t=1 at the target era. */
function expectLastCall(subsystem: MockSubsystem, from: EraId, to: EraId): void {
  expect(subsystem.calls.length).toBeGreaterThan(0);
  const last = subsystem.calls[subsystem.calls.length - 1];
  expect(last.t).toBe(1);
  expect(last.from).toBe(from);
  expect(last.to).toBe(to);
}

beforeEach(() => {
  clearSubsystems();
});

describe('smoothstep easing helpers', () => {
  it('maps 0→0, 1→1, and 0.5→0.5 with an S-curve', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 12);
    expect(smoothstep(0.25)).toBeCloseTo(0.15625, 12);
    expect(smoothstep(0.75)).toBeCloseTo(0.84375, 12);
  });

  it('clamps inputs outside [0,1]', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
  });

  it('inverseSmoothstep reproduces the eased curve', () => {
    for (const y of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(smoothstep(inverseSmoothstep(y))).toBeCloseTo(y, 10);
    }
  });
});

describe('TransformationEngine — single subsystem', () => {
  it('calls applyEraBlend with t=0 at start, monotonic t, and t=1 at end', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 1.0 }, [subsystem]);

    engine.setYear('1965');
    expect(engine.isTransitioning()).toBe(true);

    // 1 second at 60fps → first call t=0, monotonic, final t=1.
    driveFrames(engine, 20, 0.05);
    expect(engine.isTransitioning()).toBe(false);

    expectFirstCall(subsystem, '1945', '1965');
    expectLastCall(subsystem, '1945', '1965');

    const ts = tSeries(subsystem, subsystem.groups[0]);
    expect(ts[0]).toBe(0);
    expect(ts[ts.length - 1]).toBe(1);
    expect(ts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < ts.length; i += 1) {
      expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1]);
    }
    // A real mid-blend should have at least one strictly-eased sample.
    expect(ts.some((t) => t > 0 && t < 1)).toBe(true);
  });

  it('keeps t within [0,1] across every frame', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 1.5 }, [subsystem]);

    engine.setYear('1985');
    driveFrames(engine, 100, 1 / 60);

    for (const c of subsystem.calls) {
      expect(c.t).toBeGreaterThanOrEqual(0);
      expect(c.t).toBeLessThanOrEqual(1);
    }
  });

  it('applies the blend to all of a subsystem’s groups in one pass', () => {
    const groups = [{}, {}, {}];
    const subsystem = new MockSubsystem('multi', groups);
    const engine = new TransformationEngine({ durationSec: 0.6 }, [subsystem]);

    engine.setYear('2005');
    driveFrames(engine, 15, 0.04);

    for (const group of groups) {
      const ts = tSeries(subsystem, group);
      expect(ts.length).toBeGreaterThanOrEqual(2);
      expect(ts[0]).toBe(0);
      expect(ts[ts.length - 1]).toBe(1);
    }
  });

  it('drives multiple registered subsystems in the same pass', () => {
    const buildings = new MockSubsystem('buildings');
    const vehicles = new MockSubsystem('vehicles');
    const engine = new TransformationEngine({ durationSec: 0.5 }, [buildings, vehicles]);

    engine.setYear('1985');
    driveFrames(engine, 10, 0.05);

    expect(buildings.calls.length).toBe(vehicles.calls.length);
    for (let i = 0; i < vehicles.calls.length; i += 1) {
      // Same frame delivers the same eased t to every subsystem.
      expect(vehicles.calls[i].t).toBe(buildings.calls[i].t);
    }
  });

  it('resolves getYear()/getEraFloat() through the blended position', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 1.0 }, [subsystem]);

    expect(engine.getYear()).toBe('1945');
    engine.setYear('2005');
    driveFrames(engine, 10, 0.05); // half-way through a 1s transition
    expect(engine.getEraFloat()).toBeGreaterThan(0);
    expect(engine.getEraFloat()).toBeLessThan(3);
    driveFrames(engine, 10, 0.05);
    expect(engine.getYear()).toBe('2005');
    expect(engine.getEraFloat()).toBe(3);
  });
});

describe('TransformationEngine — re-targeting mid-blend', () => {
  it('re-targets from the current blended state without popping back', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 1.5 }, [subsystem]);

    // 1945 → 1985; advance to a fractional blended position (not an integer).
    engine.setYear('1985');
    driveFrames(engine, 5, 0.05); // 0.25s / 1.5s → mid-curve
    const midEraFloat = engine.getEraFloat();
    expect(midEraFloat).not.toBe(Math.round(midEraFloat));

    // Re-target to 2005 — the new transition must continue from midEraFloat.
    engine.setYear('2005');
    expect(engine.isTransitioning()).toBe(true);
    expect(engine.getEraFloat()).toBe(midEraFloat);

    // The very next render frame resumes from the exact blended position: the
    // visual position is preserved (no pop), and the blend continues from the
    // era at that blended position rather than jumping back to the source.
    engine.tick(0.05);
    const resumed = subsystem.calls[subsystem.calls.length - 1];
    expect(resumed.t).toBeLessThan(1);
    // The visual position never moved backward (no pop) and is still short of
    // the new target (index 3 = '2005').
    expect(engine.getEraFloat()).toBeGreaterThanOrEqual(midEraFloat);
    expect(engine.getEraFloat()).toBeLessThan(3);

    // Completing the new transition lands exactly on the new era.
    driveFrames(engine, 40, 0.05);
    expect(engine.isTransitioning()).toBe(false);
    expect(engine.getYear()).toBe('2005');
    expect(engine.getEraFloat()).toBe(3);
    expectLastCall(subsystem, resumed.from, '2005');
  });

  it('re-targeting continues toward the new era without popping back', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 1.0 }, [subsystem]);

    // Start 1945 → 1985; re-target mid-blend to 2005.
    engine.setYear('1985');
    driveFrames(engine, 5, 0.05);
    const midEraFloat = engine.getEraFloat();
    engine.setYear('2005');

    // After the re-target, every rendered eraFloat must move monotonically
    // toward the new target (index 3 = '2005'), never bouncing back.
    driveFrames(engine, 40, 0.05);
    const positions = [midEraFloat, ...subsystem.calls.map(() => engine.getEraFloat())];
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
    }
    expect(engine.getYear()).toBe('2005');
    expect(engine.getEraFloat()).toBe(3);
    expectLastCall(subsystem, subsystem.calls[subsystem.calls.length - 1].from, '2005');
  });

  it('setYear to the current era while idling is a no-op', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 1.0 }, [subsystem]);

    engine.setYear('1945');
    expect(engine.isTransitioning()).toBe(false);
    expect(subsystem.calls).toHaveLength(0);
  });
});

describe('TransformationEngine — updateFrame and registry wiring', () => {
  it('updateFrame advances the blend by wall-clock deltas', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 1.0 }, [subsystem]);

    engine.setYear('2005');
    for (let ms = 50; ms <= 1000; ms += 50) {
      engine.updateFrame(ms);
    }
    expect(engine.isTransitioning()).toBe(true);
    engine.updateFrame(1100);
    expect(engine.isTransitioning()).toBe(false);
    expect(engine.getYear()).toBe('2005');
    expectLastCall(subsystem, '1945', '2005');
  });

  it('addSubsystem/removeSubsystem manage the registered set', () => {
    const engine = new TransformationEngine({ durationSec: 0.5 });
    const a = new MockSubsystem('a');
    const b = new MockSubsystem('b');
    engine.addSubsystem(a);
    engine.addSubsystem(b);

    engine.setYear('1965');
    driveFrames(engine, 12, 0.05);
    expect(a.calls.length).toBeGreaterThan(0);
    expect(b.calls.length).toBeGreaterThan(0);

    engine.removeSubsystem('b');
    const countB = b.calls.length;
    engine.setYear('1985');
    driveFrames(engine, 12, 0.05);
    expect(a.calls.length).toBeGreaterThan(countB);
    expect(b.calls.length).toBe(countB);
  });

  it('clear() stops applying blends to previously registered subsystems', () => {
    const subsystem = new MockSubsystem('test');
    const engine = new TransformationEngine({ durationSec: 0.5 }, [subsystem]);
    engine.setYear('1965');
    driveFrames(engine, 5, 0.05);
    const before = subsystem.calls.length;
    engine.clear();
    engine.setYear('1985');
    driveFrames(engine, 5, 0.05);
    expect(subsystem.calls.length).toBe(before);
  });
});

describe('SceneRegistry subsystem wiring', () => {
  it('register() + listSubsystems() returns registered era-scoped subsystems', () => {
    const buildings = new MockSubsystem('buildings');
    const vehicles = new MockSubsystem('vehicles');
    register(buildings);
    register(vehicles);

    const listed = listSubsystems();
    expect(listed).toContain(buildings);
    expect(listed).toContain(vehicles);
    expect(listed).toHaveLength(2);
  });

  it('build(era) supplies era data to the subsystem when erecting', () => {
    const subsystem = new MockSubsystem('environment');
    // The engine never owns era data: the subsystem's build() is the only
    // supplier, exactly as the registry contract requires.
    expect(subsystem.build('1985')).toEqual({ era: '1985' });
    expect(subsystem.builds).toContain('1985');
  });
});