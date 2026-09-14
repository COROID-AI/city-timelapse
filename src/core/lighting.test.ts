import { describe, expect, it } from 'vitest';
import {
  applyAtmosphere,
  DEFAULT_ATMOSPHERE,
  DEFAULT_LIGHT_STATE,
  lightStateEquals,
  type AtmospherePreset,
} from './lighting';

function preset(overrides: Partial<AtmospherePreset> = {}): AtmospherePreset {
  return {
    sky: { top: { r: 0.1, g: 0.2, b: 0.3 }, horizon: { r: 0.8, g: 0.7, b: 0.6 } },
    fog: { color: { r: 0.5, g: 0.5, b: 0.55 }, density: 0.4 },
    sun: { direction: { x: 1, y: 1, z: 1 }, color: { r: 1, g: 0.95, b: 0.85 }, intensity: 1.5 },
    ambient: { color: { r: 0.7, g: 0.75, b: 0.8 }, intensity: 0.3 },
    ...overrides,
  };
}

describe('applyAtmosphere', () => {
  it('maps every preset field onto the visible light state', () => {
    const state = applyAtmosphere(preset());

    expect(state.sky.top).toEqual({ r: 0.1, g: 0.2, b: 0.3 });
    expect(state.sky.horizon).toEqual({ r: 0.8, g: 0.7, b: 0.6 });
    expect(state.fog.color).toEqual({ r: 0.5, g: 0.5, b: 0.55 });
    expect(state.fog.density).toBe(0.4);
    expect(state.sun.color).toEqual({ r: 1, g: 0.95, b: 0.85 });
    expect(state.sun.intensity).toBe(1.5);
    expect(state.ambient.color).toEqual({ r: 0.7, g: 0.75, b: 0.8 });
    expect(state.ambient.intensity).toBe(0.3);
    // Input direction was (1, 1, 1); output must be normalized to unit length.
    const length = Math.hypot(state.sun.direction.x, state.sun.direction.y, state.sun.direction.z);
    expect(length).toBeCloseTo(1, 10);
    expect(state.sun.direction.x).toBeGreaterThan(0);
  });

  it('is idempotent: applying the same preset twice yields an identical state', () => {
    const once = applyAtmosphere(preset());
    const twice = applyAtmosphere(preset(), once);
    expect(lightStateEquals(once, twice)).toBe(true);
    expect(twice).toEqual(once);
  });

  it('does not accumulate across repeated application', () => {
    const p = preset({ fog: { color: { r: 0.9, g: 0.8, b: 0.7 }, density: 0.2 } });
    let state = applyAtmosphere(p);
    for (let i = 0; i < 5; i += 1) {
      state = applyAtmosphere(p, state);
    }
    expect(state.fog.density).toBe(0.2);
    expect(lightStateEquals(state, applyAtmosphere(p))).toBe(true);
  });

  it('clamps fog density into [0, 1] and intensities to >= 0', () => {
    const state = applyAtmosphere(
      preset({
        fog: { color: { r: 1, g: 1, b: 1 }, density: 2 },
        sun: { direction: { x: 0, y: 1, z: 0 }, color: { r: 1, g: 1, b: 1 }, intensity: -3 },
        ambient: { color: { r: 0, g: 0, b: 0 }, intensity: -1 },
      }),
    );
    expect(state.fog.density).toBe(1);
    expect(state.sun.intensity).toBe(0);
    expect(state.ambient.intensity).toBe(0);
  });

  it('clamps colors into [0, 1]', () => {
    const state = applyAtmosphere(
      preset({
        sky: { top: { r: 2, g: -1, b: 0.5 }, horizon: { r: 0.5, g: 0.5, b: 0.5 } },
      }),
    );
    expect(state.sky.top.r).toBe(1);
    expect(state.sky.top.g).toBe(0);
    expect(state.sky.top.b).toBe(0.5);
  });

  it('keeps the previous state when the preset is null', () => {
    const current = applyAtmosphere(preset());
    expect(applyAtmosphere(null, current)).toBe(current);
    expect(applyAtmosphere(undefined, current)).toBe(current);
  });

  it('reproduces the default state from the default atmosphere preset', () => {
    const state = applyAtmosphere(DEFAULT_ATMOSPHERE);
    expect(lightStateEquals(state, DEFAULT_LIGHT_STATE)).toBe(true);
  });
});