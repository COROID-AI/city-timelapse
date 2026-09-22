import { describe, expect, it } from 'vitest';
import {
  ERA_MAX_YEAR,
  ERA_MIN_YEAR,
  ERA_YEARS,
  EraTimelineCore,
  blendForPosition,
  blendForYear,
  easeInOutCubic,
  eraWeights,
  nearestEraYear,
  positionToYear,
  yearToPosition,
} from './timeline';
import type { EraBlend } from './timeline';

function expectBlend(actual: EraBlend, from: number, to: number, fraction: number): void {
  expect(actual.from).toBe(from);
  expect(actual.to).toBe(to);
  expect(actual.fraction).toBeCloseTo(fraction, 10);
}

describe('five-year era model', () => {
  it('exposes the ordered years 1945, 1965, 1985, 2005, 2025', () => {
    expect([...ERA_YEARS]).toEqual([1945, 1965, 1985, 2005, 2025]);
    expect(ERA_MIN_YEAR).toBe(1945);
    expect(ERA_MAX_YEAR).toBe(2025);
    expect(EraTimelineCore.YEARS).toBe(ERA_YEARS);
  });

  it('keeps years strictly increasing', () => {
    for (let i = 1; i < ERA_YEARS.length; i += 1) {
      expect(ERA_YEARS[i]).toBeGreaterThan(ERA_YEARS[i - 1]);
    }
  });

  it('snaps continuous years to the nearest era stop', () => {
    expect(nearestEraYear(1945)).toBe(1945);
    expect(nearestEraYear(1954)).toBe(1945);
    expect(nearestEraYear(1958)).toBe(1965);
    expect(nearestEraYear(1999)).toBe(2005);
    expect(nearestEraYear(-500)).toBe(1945);
    expect(nearestEraYear(9999)).toBe(2025);
    expect(nearestEraYear(Number.NaN)).toBe(1945);
  });
});

describe('position <-> year mapping', () => {
  it('places the five stops at equal positions', () => {
    expect(yearToPosition(1945)).toBe(0);
    expect(yearToPosition(1965)).toBeCloseTo(0.25, 10);
    expect(yearToPosition(1985)).toBeCloseTo(0.5, 10);
    expect(yearToPosition(2005)).toBeCloseTo(0.75, 10);
    expect(yearToPosition(2025)).toBe(1);

    expect(positionToYear(0)).toBe(1945);
    expect(positionToYear(0.25)).toBeCloseTo(1965, 10);
    expect(positionToYear(0.5)).toBeCloseTo(1985, 10);
    expect(positionToYear(0.75)).toBeCloseTo(2005, 10);
    expect(positionToYear(1)).toBeCloseTo(2025, 10);
  });

  it('round-trips intermediate years through positions', () => {
    expect(yearToPosition(1955)).toBeCloseTo(0.125, 10);
    expect(positionToYear(0.125)).toBeCloseTo(1955, 10);
    expect(positionToYear(yearToPosition(1990))).toBeCloseTo(1990, 10);
    expect(positionToYear(yearToPosition(2020))).toBeCloseTo(2020, 10);
  });

  it('clamps out-of-range and non-finite input at the ends', () => {
    expect(positionToYear(-0.4)).toBe(1945);
    expect(positionToYear(2)).toBeCloseTo(2025, 10);
    expect(positionToYear(Number.NaN)).toBe(1945);
    expect(positionToYear(Infinity)).toBeCloseTo(2025, 10);
    expect(yearToPosition(1800)).toBe(0);
    expect(yearToPosition(2400)).toBe(1);
    expect(yearToPosition(Number.NaN)).toBe(0);
    expect(yearToPosition(Infinity)).toBe(1);
    expect(yearToPosition(-Infinity)).toBe(0);
  });
});

describe('pure blend math', () => {
  it('produces full-weight blends at every era stop', () => {
    expectBlend(blendForYear(1945), 1945, 1965, 0);
    expectBlend(blendForYear(1965), 1965, 1985, 0);
    expectBlend(blendForYear(1985), 1985, 2005, 0);
    expectBlend(blendForYear(2005), 2005, 2025, 0);
    expectBlend(blendForYear(2025), 2005, 2025, 1);
  });

  it('crossfades adjacent eras at midpoints and intermediate positions', () => {
    expectBlend(blendForYear(1955), 1945, 1965, 0.5);
    expectBlend(blendForYear(1975), 1965, 1985, 0.5);
    expectBlend(blendForYear(1990), 1985, 2005, 0.25);
    expectBlend(blendForYear(2015), 2005, 2025, 0.5);

    expectBlend(blendForPosition(0), 1945, 1965, 0);
    expectBlend(blendForPosition(0.125), 1945, 1965, 0.5);
    expectBlend(blendForPosition(0.25), 1965, 1985, 0);
    expectBlend(blendForPosition(0.5), 1985, 2005, 0);
    expectBlend(blendForPosition(0.75), 2005, 2025, 0);
    expectBlend(blendForPosition(1), 2005, 2025, 1);
  });

  it('always returns adjacent era pairs with a clamped 0..1 fraction', () => {
    for (let i = -20; i <= 120; i += 1) {
      const position = i / 100;
      const blend = blendForPosition(position);
      expect(blend.fraction).toBeGreaterThanOrEqual(0);
      expect(blend.fraction).toBeLessThanOrEqual(1);
      expect(ERA_YEARS.indexOf(blend.to)).toBe(ERA_YEARS.indexOf(blend.from) + 1);
      const year = positionToYear(position);
      expectBlend(blendForYear(year), blend.from, blend.to, blend.fraction);
    }
  });

  it('clamps blend fractions at both ends', () => {
    expectBlend(blendForYear(1900), 1945, 1965, 0);
    expectBlend(blendForYear(2100), 2005, 2025, 1);
    expectBlend(blendForYear(Number.NaN), 1945, 1965, 0);
    expectBlend(blendForPosition(-1.5), 1945, 1965, 0);
    expectBlend(blendForPosition(3.25), 2005, 2025, 1);
    expectBlend(blendForPosition(Number.NaN), 1945, 1965, 0);
  });

  it('increases the target-era weight monotonically across the timeline', () => {
    let previous2025Weight = -1;
    for (let position = 0; position <= 1.0001; position += 0.01) {
      const weights = eraWeights(blendForPosition(position));
      const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
      expect(total).toBeCloseTo(1, 10);
      const weight2025 = weights.get(2025) ?? 0;
      expect(weight2025).toBeGreaterThanOrEqual(previous2025Weight - 1e-12);
      previous2025Weight = weight2025;
    }
  });

  it('keeps era weights continuous across a segment boundary (no popping)', () => {
    const before = eraWeights(blendForYear(1964.999));
    const after = eraWeights(blendForYear(1965));
    for (const year of ERA_YEARS) {
      const delta = Math.abs((before.get(year) ?? 0) - (after.get(year) ?? 0));
      expect(delta).toBeLessThan(0.01);
    }
    expect(after.get(1965)).toBeCloseTo(1, 6);
    expect(after.get(1945)).toBeCloseTo(0, 6);
  });
});

describe('ease-in-out easing', () => {
  it('hits the endpoints and the midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('is monotonically non-decreasing across [0, 1]', () => {
    let previous = easeInOutCubic(0);
    for (let i = 1; i <= 200; i += 1) {
      const value = easeInOutCubic(i / 200);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });

  it('starts slowly and finishes slowly (ease-in-out, not linear)', () => {
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 10);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeCloseTo(0.9375, 10);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });

  it('is symmetric around the midpoint and clamps out-of-range input', () => {
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1, 10);
    }
    expect(easeInOutCubic(-2)).toBe(0);
    expect(easeInOutCubic(5)).toBe(1);
    expect(easeInOutCubic(Number.NaN)).toBe(0);
  });
});

describe('EraTimelineCore state', () => {
  it('starts at 1945 with a continuous position and settled blend', () => {
    const core = new EraTimelineCore();
    expect(core.position).toBe(0);
    expect(core.year).toBe(1945);
    expect(core.selectedYear).toBe(1945);
    expectBlend(core.blend, 1945, 1965, 0);
    expect(core.isTransitioning).toBe(false);
    expect(core.transitionProgress).toBe(1);
    expect(core.transitionDurationSeconds).toBeNull();
  });

  it('supports continuous blending at intermediate slider positions', () => {
    const core = new EraTimelineCore();
    core.setPosition(0.3);
    expect(core.position).toBeCloseTo(0.3, 10);
    expectBlend(core.blend, 1965, 1985, 0.2); // year 1969: 20% into the segment
    expect(core.selectedYear).toBe(1965); // nearest stop highlighted

    core.setPosition(2);
    expect(core.position).toBe(1);
    expectBlend(core.blend, 2005, 2025, 1);
    expect(core.selectedYear).toBe(2025);

    core.setPosition(-1);
    expect(core.position).toBe(0);
    expectBlend(core.blend, 1945, 1965, 0);
  });

  it('supports discrete snap-to-year selection', () => {
    const core = new EraTimelineCore();
    expect(core.selectYear(1985)).toBe(1985);
    expect(core.position).toBeCloseTo(0.5, 10);
    expect(core.selectedYear).toBe(1985);
    expectBlend(core.blend, 1985, 2005, 0);
    expect(core.isTransitioning).toBe(false);

    core.selectYear(1999);
    expect(core.selectedYear).toBe(2005);
    expect(core.position).toBeCloseTo(0.75, 10);

    // Discrete snap and continuous drag coexist on the same state.
    core.setPosition(0.3);
    expectBlend(core.blend, 1965, 1985, 0.2);
    core.selectYear(1945);
    expect(core.position).toBe(0);
  });

  it('notifies subscribers on state changes and transition completion', () => {
    const core = new EraTimelineCore();
    const seen: Array<{ position: number; selectedYear: number; transitioning: boolean }> = [];
    const unsubscribe = core.subscribe((snapshot) => {
      seen.push({
        position: snapshot.position,
        selectedYear: snapshot.selectedYear,
        transitioning: snapshot.transitioning,
      });
    });

    core.setPosition(0.4);
    expect(seen).toHaveLength(1);

    core.selectYear(1965);
    expect(seen).toHaveLength(2);
    expect(seen[1].selectedYear).toBe(1965);
    expect(seen[1].position).toBeCloseTo(0.25, 10);

    core.transitionTo(2025);
    expect(seen).toHaveLength(3);
    expect(seen[2].transitioning).toBe(true);

    // Per-frame advances do not spam listeners; completion fires once.
    core.advance(0.5);
    core.advance(0.5);
    expect(seen).toHaveLength(3);
    core.advance(0.5); // elapsed 1.5s -> default duration reached
    expect(seen).toHaveLength(4);
    expect(seen[3].transitioning).toBe(false);
    expect(seen[3].position).toBe(1);

    unsubscribe();
    core.setPosition(0.1);
    expect(seen).toHaveLength(4);
  });
});

describe('EraTimelineCore transition driver', () => {
  it('animates 1945 -> 2025 over a 1..2 second ease-in-out with continuous frames', () => {
    const core = new EraTimelineCore();
    const duration = 1.5;
    core.transitionTo(2025);
    expect(core.isTransitioning).toBe(true);
    expect(core.selectedYear).toBe(2025);
    expect(core.transitionDurationSeconds).toBeCloseTo(duration, 10);
    expect(core.transitionDurationSeconds).toBeGreaterThanOrEqual(1);
    expect(core.transitionDurationSeconds).toBeLessThanOrEqual(2);

    const positions: number[] = [core.position];
    const progresses: number[] = [];
    const dt = 0.05;
    let elapsed = 0;
    let guard = 0;
    while (core.isTransitioning && guard < 500) {
      elapsed += dt;
      const frame = core.advance(dt);
      positions.push(frame.position);
      progresses.push(frame.progress);
      // Frame must sit exactly on the eased curve for the elapsed time.
      const expected = easeInOutCubic(Math.min(1, elapsed / duration));
      expect(frame.position).toBeCloseTo(expected, 10);
      expect(frame.progress).toBeCloseTo(expected, 10);
      expect(frame.transitioning).toBe(elapsed < duration);
      guard += 1;
    }

    expect(guard).toBeGreaterThanOrEqual(20); // morphs over time, never snaps
    expect(elapsed).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThanOrEqual(2 + dt);

    // Continuous: monotonic movement with no per-frame jump.
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1] - 1e-12);
      expect(positions[i] - positions[i - 1]).toBeLessThan(0.1);
    }

    // Eased, not linear: a sixth of the time covers under 2% of the travel.
    expect(positions[5]).toBeLessThan(0.1);
    expect(positions[5]).toBeCloseTo(easeInOutCubic(0.25 / duration), 10);

    // Settled end state at 2025 with full weight on the final era.
    const final = core.frame();
    expect(final.transitioning).toBe(false);
    expect(final.progress).toBe(1);
    expect(final.position).toBe(1);
    expectBlend(final.blend, 2005, 2025, 1);
    expect(core.selectedYear).toBe(2025);

    // Idle ticks keep the settled frame and do not restart anything.
    const idle = core.advance(0.05);
    expect(idle.position).toBe(1);
    expect(idle.transitioning).toBe(false);
    expect(core.isTransitioning).toBe(false);
  });

  it('clamps requested durations into the 1..2 second window', () => {
    const core = new EraTimelineCore();
    core.transitionTo(1985, 0.05);
    expect(core.transitionDurationSeconds).toBe(1);

    const other = new EraTimelineCore();
    other.transitionTo(2025, 30);
    expect(other.transitionDurationSeconds).toBe(2);
  });

  it('completes immediately when the target equals the current position', () => {
    const core = new EraTimelineCore();
    core.selectYear(1945);
    core.transitionTo(1945);
    expect(core.isTransitioning).toBe(false);
    expect(core.position).toBe(0);
    expectBlend(core.blend, 1945, 1965, 0);
  });

  it('retargets mid-flight from the current animated position', () => {
    const core = new EraTimelineCore();
    core.transitionTo(2025);
    core.advance(0.75); // halfway through the default 1.5s transition
    expect(core.position).toBeCloseTo(0.5, 6);

    core.transitionTo(1945, 1);
    expect(core.isTransitioning).toBe(true);
    expect(core.selectedYear).toBe(1945);

    let guard = 0;
    while (core.isTransitioning && guard < 200) {
      core.advance(0.05);
      guard += 1;
    }
    expect(core.position).toBe(0);
    expect(core.selectedYear).toBe(1945);
    expectBlend(core.blend, 1945, 1965, 0);
  });

  it('animates between arbitrary stops, e.g. 2025 -> 1965', () => {
    const core = new EraTimelineCore();
    core.selectYear(2025);
    core.transitionTo(1965, 1);
    const positions: number[] = [];
    let guard = 0;
    while (core.isTransitioning && guard < 200) {
      positions.push(core.advance(0.05).position);
      guard += 1;
    }
    expect(positions.length).toBeGreaterThanOrEqual(15);
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeLessThanOrEqual(positions[i - 1] + 1e-12);
    }
    expect(core.position).toBeCloseTo(0.25, 10);
    expectBlend(core.blend, 1965, 1985, 0);
    expect(core.selectedYear).toBe(1965);
  });

  it('cancels a running transition when the slider is dragged', () => {
    const core = new EraTimelineCore();
    core.transitionTo(2025);
    core.advance(0.3);
    expect(core.isTransitioning).toBe(true);
    core.setPosition(0.6);
    expect(core.isTransitioning).toBe(false);
    expect(core.position).toBeCloseTo(0.6, 10);
    expectBlend(core.blend, 1985, 2005, 0.4);
  });
});

describe('module purity constraints', () => {
  it('keeps timeline math free of renderer imports', () => {
    // Read the module source via Vite raw imports (no Node typings needed).
    const sources = import.meta.glob('./timeline.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const source = sources['./timeline.ts'];
    expect(typeof source).toBe('string');
    expect(source).not.toMatch(/from ['"]three['"]/);
    expect(source).not.toMatch(/import\s*\(\s*['"]three['"]/);
    expect(source).not.toMatch(/\bTHREE\b/);
  });
});
