import { describe, it, expect } from 'vitest';
import {
  ERA_COUNT,
  ERA_MAX,
  clamp,
  clampEra,
  resolveEra,
  lerp,
  lerpRGB,
  lerpColorGamma,
  smooth,
  eraOpacity,
  activeEras,
  totalOpacity,
  ERA_YEARS,
} from './eraSampler';
import { ERAS } from '../data/eras';
import {
  sampleSky,
  sampleGround,
  sampleBuilding,
  sampleStreetProp,
  sampleAmbient,
} from './sceneSampler';
import { BUILDING_LOTS } from '../data/buildings';

// ---------------------------------------------------------------------------
// resolveEra — the coordinate system at the heart of the transition engine.
// At an exact integer, the scene MUST deterministically match that era.
// ---------------------------------------------------------------------------
describe('resolveEra', () => {
  it('resolves integer eraFloats to that era with t=0', () => {
    for (let i = 0; i < ERA_COUNT; i++) {
      const r = resolveEra(i);
      expect(r.lower).toBe(i);
      expect(r.upper).toBe(i);
      expect(r.t).toBe(0);
    }
  });

  it('clamps out-of-range values', () => {
    expect(resolveEra(-5).lower).toBe(0);
    expect(resolveEra(100).lower).toBe(ERA_MAX);
    expect(resolveEra(100).upper).toBe(ERA_MAX);
  });

  it('brackets a midpoint correctly', () => {
    const r = resolveEra(2.5);
    expect(r.lower).toBe(2);
    expect(r.upper).toBe(3);
    expect(r.t).toBeCloseTo(0.5);
  });

  it('treats near-integer floats as exact integers (no float dust)', () => {
    // 1.999999 should still resolve to era 2, t=0, not era 1 with t≈1
    const r = resolveEra(1.9999999);
    expect(r.t).toBe(0);
    expect(r.lower).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Endpoint determinism — at an exact integer era, sampling must reproduce
// that era's data exactly (the AC: "verified by the sampler unit tests").
// ---------------------------------------------------------------------------
describe('endpoint determinism', () => {
  for (let i = 0; i < ERA_COUNT; i++) {
    it(`era ${i} (${ERA_YEARS[i]}) sky matches exactly`, () => {
      const s = sampleSky(i);
      const expected = ERAS[i].sky;
      expect(s.topColor).toEqual(expected.topColor);
      expect(s.horizonColor).toEqual(expected.horizonColor);
      expect(s.fogColor).toEqual(expected.fogColor);
      expect(s.fogNear).toBeCloseTo(expected.fogNear);
      expect(s.fogFar).toBeCloseTo(expected.fogFar);
      expect(s.sunIntensity).toBeCloseTo(expected.sunIntensity);
      expect(s.starIntensity).toBeCloseTo(expected.starIntensity);
      expect(s.cloudiness).toBeCloseTo(expected.cloudiness);
    });

    it(`era ${i} (${ERA_YEARS[i]}) ground matches exactly`, () => {
      const g = sampleGround(i);
      expect(g.roadColor).toEqual(ERAS[i].ground.roadColor);
      expect(g.sidewalkColor).toEqual(ERAS[i].ground.sidewalkColor);
      expect(g.wetness).toBeCloseTo(ERAS[i].ground.wetness);
    });

    it(`era ${i} (${ERA_YEARS[i]}) streetProp matches exactly`, () => {
      const sp = sampleStreetProp(i);
      expect(sp.lampColor).toEqual(ERAS[i].streetProp.lampColor);
      expect(sp.lampIntensity).toBeCloseTo(ERAS[i].streetProp.lampIntensity);
      expect(sp.lampStyle).toBe(ERAS[i].streetProp.lampStyle);
    });

    it(`era ${i} (${ERA_YEARS[i]}) ambient matches exactly`, () => {
      const a = sampleAmbient(i);
      expect(a.drone).toEqual(ERAS[i].ambient.drone);
      expect(a.rumble).toBeCloseTo(ERAS[i].ambient.rumble);
      expect(a.gain).toBeCloseTo(ERAS[i].ambient.gain);
    });
  }

  it('every building lot matches its era endpoint exactly', () => {
    for (const lot of BUILDING_LOTS) {
      expect(lot.eras.length).toBe(ERA_COUNT);
      for (let i = 0; i < ERA_COUNT; i++) {
        const b = sampleBuilding(i, lot);
        const expected = lot.eras[i];
        expect(b.height).toBeCloseTo(expected.height);
        expect(b.facadeColor).toEqual(expected.facadeColor);
        expect(b.windowGlow).toBeCloseTo(expected.windowGlow);
        expect(b.style).toBe(expected.style);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Crossfade / opacity math
// ---------------------------------------------------------------------------
describe('eraOpacity', () => {
  it('gives weight 1 to the current era at an exact integer', () => {
    for (let i = 0; i < ERA_COUNT; i++) {
      expect(eraOpacity(i, i)).toBe(1);
      // all other eras get 0
      for (let j = 0; j < ERA_COUNT; j++) {
        if (j !== i) expect(eraOpacity(i, j)).toBe(0);
      }
    }
  });

  it('only weights the two bracketing eras between integers', () => {
    // At eraFloat 1.5, only eras 1 and 2 should have non-zero weight
    const r = resolveEra(1.5);
    for (let j = 0; j < ERA_COUNT; j++) {
      const w = eraOpacity(1.5, j);
      if (j !== r.lower && j !== r.upper) {
        expect(w).toBe(0);
      } else {
        expect(w).toBeGreaterThan(0);
      }
    }
  });

  it('crossfade weights sum to ~1 everywhere', () => {
    for (let f = 0; f <= ERA_MAX; f += 0.01) {
      const total = totalOpacity(f);
      expect(total).toBeGreaterThan(0.999);
      expect(total).toBeLessThan(1.001);
    }
  });

  it('smoothstep easing makes the midpoint weight 0.5', () => {
    // smooth(0.5) = 0.5, so at t=0.5 both eras get exactly 0.5
    expect(eraOpacity(1.5, 1)).toBeCloseTo(0.5);
    expect(eraOpacity(1.5, 2)).toBeCloseTo(0.5);
  });

  it('weights are monotonic through a transition', () => {
    const lowerWeights: number[] = [];
    const upperWeights: number[] = [];
    for (let t = 0; t <= 1; t += 0.1) {
      lowerWeights.push(eraOpacity(2 + t, 2));
      upperWeights.push(eraOpacity(2 + t, 3));
    }
    // lower decreases, upper increases
    for (let i = 1; i < lowerWeights.length; i++) {
      expect(lowerWeights[i]).toBeLessThanOrEqual(lowerWeights[i - 1]);
      expect(upperWeights[i]).toBeGreaterThanOrEqual(upperWeights[i - 1]);
    }
  });
});

describe('activeEras', () => {
  it('returns a single era at an integer', () => {
    expect(activeEras(3)).toHaveLength(1);
    expect(activeEras(3)[0].index).toBe(3);
    expect(activeEras(3)[0].opacity).toBe(1);
  });

  it('returns exactly two bracketing eras between integers', () => {
    const a = activeEras(2.3);
    expect(a).toHaveLength(2);
    expect(a[0].index).toBe(2);
    expect(a[1].index).toBe(3);
    const sum = a.reduce((s, e) => s + e.opacity, 0);
    expect(sum).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// Lerp primitives
// ---------------------------------------------------------------------------
describe('lerp primitives', () => {
  it('lerp endpoints are exact', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('lerpRGB interpolates each channel', () => {
    expect(lerpRGB([0, 0, 0], [1, 1, 1], 0.5)).toEqual([0.5, 0.5, 0.5]);
  });

  it('lerpColorGamma endpoints are exact', () => {
    const a = lerpColorGamma([0.2, 0.4, 0.6], [0.8, 0.6, 0.4], 0);
    expect(a[0]).toBeCloseTo(0.2);
    const b = lerpColorGamma([0.2, 0.4, 0.6], [0.8, 0.6, 0.4], 1);
    expect(b[0]).toBeCloseTo(0.8);
  });

  it('smooth(0)=0, smooth(1)=1, smooth(0.5)=0.5', () => {
    expect(smooth(0)).toBe(0);
    expect(smooth(1)).toBe(1);
    expect(smooth(0.5)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Utility clamps
// ---------------------------------------------------------------------------
describe('clamp', () => {
  it('clamps below lo', () => expect(clamp(-1, 0, 5)).toBe(0));
  it('clamps above hi', () => expect(clamp(99, 0, 5)).toBe(5));
  it('passes through in-range', () => expect(clamp(3, 0, 5)).toBe(3));
  it('clampEra respects bounds', () => {
    expect(clampEra(-3)).toBe(0);
    expect(clampEra(99)).toBe(ERA_MAX);
  });
});

// ---------------------------------------------------------------------------
// Continuity — intermediate samples are bounded between endpoints
// ---------------------------------------------------------------------------
describe('continuity', () => {
  it('interpolated sky fog is between endpoints', () => {
    const f0 = ERAS[0].sky.fogFar;
    const f1 = ERAS[1].sky.fogFar;
    const mid = sampleSky(0.5).fogFar;
    expect(mid).toBeGreaterThanOrEqual(Math.min(f0, f1));
    expect(mid).toBeLessThanOrEqual(Math.max(f0, f1));
  });

  it('interpolated building height is between endpoints', () => {
    const lot = BUILDING_LOTS[0];
    const h0 = lot.eras[0].height;
    const h1 = lot.eras[1].height;
    const mid = sampleBuilding(0.5, lot).height;
    expect(mid).toBeGreaterThanOrEqual(Math.min(h0, h1));
    expect(mid).toBeLessThanOrEqual(Math.max(h0, h1));
  });
});
