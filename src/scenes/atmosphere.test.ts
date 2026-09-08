import { describe, expect, it } from 'vitest';
import { ERA_YEARS } from './eras.js';
import { Atmosphere, AtmosphereState, getInterpolatedEra } from './atmosphere.js';

/** The five canonical era years, in order. */
const YEARS = [...ERA_YEARS];

describe('Atmosphere per-era profiles', () => {
  it('mounts and derives a distinct state for every era year', () => {
    const states = YEARS.map((year) => {
      const atmosphere = new Atmosphere().instantiate(year);
      const state: AtmosphereState = atmosphere.current;
      atmosphere.dispose();
      return state;
    });

    // Distinct profile ids and sky tints across all five years.
    expect(new Set(states.map((s) => s.profileId)).size).toBe(5);
    expect(new Set(states.map((s) => skyKey(s.skyTint))).size).toBe(5);

    // Authentic directional drift: sun rises, fog clears, light cools.
    expect(states[0].fog).toBeGreaterThan(states[YEARS.length - 1].fog);
    expect(states[0].sunAngleDeg).toBeLessThan(
      states[YEARS.length - 1].sunAngleDeg,
    );
    expect(states[0].ambientLight).toBeLessThan(
      states[YEARS.length - 1].ambientLight,
    );
    // 1945 dim warm tungsten vs 2025 cool LED street light.
    expect(states[0].streetLightLevel).toBeLessThan(
      states[YEARS.length - 1].streetLightLevel,
    );
    expect(states[0].streetLight.b).toBeLessThan(
      states[YEARS.length - 1].streetLight.b,
    );
  });

  it('1945 is sooty postwar haze with dim warm tungsten', () => {
    const state = new Atmosphere().instantiate(1945).current;
    expect(state.profileId).toBe('golden-age-haze');
    expect(state.fog).toBeGreaterThan(0.5);
    expect(state.ambientLight).toBeLessThan(0.75);
    expect(state.streetLight.r).toBeGreaterThan(state.streetLight.b); // warm
  });

  it('1965 is bright optimistic daylight with saturated sky', () => {
    const state = new Atmosphere().instantiate(1965).current;
    expect(state.profileId).toBe('mid-century-pastel');
    expect(state.saturation).toBeGreaterThan(0.7);
    expect(state.ambientLight).toBeGreaterThan(0.7);
  });

  it('1985 is dusk neon glow with haze', () => {
    const state = new Atmosphere().instantiate(1985).current;
    expect(state.profileId).toBe('electric-dusk');
    expect(state.sunAngleDeg).toBeLessThan(60);
    expect(state.fog).toBeGreaterThan(0);
  });

  it('2005 is clear LEDs at night', () => {
    const state = new Atmosphere().instantiate(2005).current;
    expect(state.profileId).toBe('crisp-clean');
    expect(state.fog).toBeLessThan(0.3);
    expect(state.streetLight.b).toBeGreaterThan(200); // cool LED
  });

  it('2025 is clean air with dynamic smart street lights', () => {
    const state = new Atmosphere().instantiate(2025).current;
    expect(state.profileId).toBe('led-clean-high');
    expect(state.fog).toBeLessThan(0.2);
    expect(state.ambientLight).toBeGreaterThan(0.9);
  });
});

describe('Atmosphere interpolation during era transitions', () => {
  it('blends fog and light continuously between consecutive eras', () => {
    for (let i = 0; i < YEARS.length - 1; i++) {
      const from = YEARS[i];
      const to = YEARS[i + 1];
      const a = new Atmosphere().instantiate(from);
      const b = new Atmosphere().instantiate(from, 1); // fully at `to`
      const mid = new Atmosphere().instantiate(from, 0.5);

      const expectedFog =
        (a.current.fog + b.current.fog) / 2;
      expect(mid.current.fog).toBeCloseTo(expectedFog, 5);

      // Street light blends continuously: each channel of the midpoint stays
      // within the range spanned by the two era endpoints.
      for (const ch of ['r', 'g', 'b'] as const) {
        const lo = Math.min(a.current.streetLight[ch], b.current.streetLight[ch]);
        const hi = Math.max(a.current.streetLight[ch], b.current.streetLight[ch]);
        expect(mid.current.streetLight[ch]).toBeGreaterThanOrEqual(lo);
        expect(mid.current.streetLight[ch]).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('matches the shared interpolateEra-derived values at every step', () => {
    for (const year of YEARS) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const state = new Atmosphere().instantiate(year, t).current;
        const era = getInterpolatedEra(year, t);
        expect(state.fog).toBe(era.atmosphere.haze);
        expect(state.ambientLight).toBe(era.atmosphere.skyExposure);
        expect(state.saturation).toBe(era.atmosphere.saturation);
      }
    }
  });
});

function skyKey(rgb: { r: number; g: number; b: number }): string {
  return `${rgb.r},${rgb.g},${rgb.b}`;
}