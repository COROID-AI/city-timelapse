import { describe, expect, it } from 'vitest';
import type { CameraView } from '../../core/cameraRig';
import { SceneEngine } from '../../core/engine';
import type { LightState } from '../../core/lighting';
import { applyAtmosphere, lightStateEquals } from '../../core/lighting';
import type { RendererFactoryOptions, SceneRenderer } from '../../core/renderer';
import { ERA_YEARS, type EraId } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';
import { buildAtmospherePreset, hexToColor3, ERA_ATMOSPHERE_PRESETS } from './atmosphere';

/** Headless renderer stub: records every LightState the engine pushes. */
class AtmosphereStubRenderer implements SceneRenderer<string> {
  readonly scene = 'atmosphere-stub';
  lightStates: LightState[] = [];

  resize(): void {}
  applyLighting(state: LightState): void {
    this.lightStates.push(state);
  }
  updateCamera(_view: CameraView): void {}
  render(): void {}
  dispose(): void {}
}

describe('Era atmosphere presets (src/world/furniture/atmosphere.ts)', () => {
  it('derives sky, fog, sun and ambient fields from each era palette', () => {
    for (const era of ERA_YEARS) {
      const data = buildAtmospherePreset(era);
      const palette = ERA_PALETTES[era];
      const sky = hexToColor3(palette.sky);
      // Zenith is a deepened sky; horizon stays near the palette sky cast.
      expect(data.preset.sky.top.r).toBeCloseTo(sky.r * 0.84, 6);
      expect(data.preset.sky.top.g).toBeCloseTo(sky.g * 0.84, 6);
      expect(data.preset.sky.top.b).toBeCloseTo(sky.b * 0.84, 6);
      expect(data.preset.fog.color).toEqual(hexToColor3(palette.fog));
      expect(data.preset.sun.color).toEqual(hexToColor3(palette.sun.color));
      expect(data.preset.sun.intensity).toBe(palette.sun.intensity);
    }
  });

  it('gives every era a distinct mood: presets pair apart after normalization', () => {
    const states = ERA_YEARS.map((era) => applyAtmosphere(buildAtmospherePreset(era).preset));
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        expect(lightStateEquals(states[i]!, states[j]!)).toBe(false);
      }
    }
  });

  it('ranks fog density with the smoggiest era (1985) on top', () => {
    const densities: Partial<Record<EraId, number>> = {};
    for (const era of ERA_YEARS) {
      densities[era] = buildAtmospherePreset(era).preset.fog.density;
    }
    expect(densities[1985]!).toBeGreaterThan(densities[1945]!);
    expect(densities[1945]!).toBeGreaterThan(densities[1965]!);
    expect(densities[1965]!).toBeGreaterThan(densities[2005]!);
    expect(densities[2005]!).toBeGreaterThan(densities[2025]!);
    expect(densities[2025]!).toBeGreaterThan(0);
  });

  it('exposes era atmosphere metadata (air quality, mood, precipitation)', () => {
    const data = buildAtmospherePreset(1985);
    expect(data.airQuality).toBe('smog-heavy');
    expect(data.daylightMood).toBe('harsh-smog');
    expect(data.haze).toBeGreaterThan(0.5);
    const clear = buildAtmospherePreset(2025);
    expect(clear.haze).toBeLessThan(0.1);
    expect(clear.daylightMood).toBe('bright-green');
  });

  it('survives the engine transform: normalized, deterministic and idempotent', () => {
    for (const era of ERA_YEARS) {
      const preset = buildAtmospherePreset(era).preset;
      const once = applyAtmosphere(preset);
      const twice = applyAtmosphere(preset, once);
      expect(lightStateEquals(once, twice)).toBe(true);
      // Sun direction is unit length after normalization.
      const dir = once.sun.direction;
      expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1, 9);
      // Fog and color components are clamped into valid ranges.
      expect(once.fog.density).toBeGreaterThanOrEqual(0);
      expect(once.fog.density).toBeLessThanOrEqual(1);
    }
  });

  it('registers a complete preset for every era in the shared registry', () => {
    expect(Object.keys(ERA_ATMOSPHERE_PRESETS).sort()).toEqual([...ERA_YEARS].map((e) => String(e)).sort());
    for (const era of ERA_YEARS) {
      expect(lightStateEquals(applyAtmosphere(ERA_ATMOSPHERE_PRESETS[era]!.preset), applyAtmosphere(buildAtmospherePreset(era).preset))).toBe(true);
    }
  });

  it('applies each preset only through the SceneEngine public atmosphere hooks', () => {
    for (const era of ERA_YEARS) {
      const data = buildAtmospherePreset(era);
      const renderer = new AtmosphereStubRenderer();
      const container = document.createElement('div');
      const engine = new SceneEngine<string>({
        container,
        factory: (options: RendererFactoryOptions) => {
          void options;
          return renderer;
        },
        atmosphere: data.preset,
      });

      // Constructor hook: the preset reaches the renderer's lighting sink.
      expect(renderer.lightStates).toHaveLength(1);
      expect(lightStateEquals(renderer.lightStates[0]!, applyAtmosphere(data.preset))).toBe(true);

      // Public setAtmosphere hook: explicit push, idempotent.
      engine.setAtmosphere(data.preset);
      expect(renderer.lightStates).toHaveLength(2);
      expect(lightStateEquals(renderer.lightStates.at(-1)!, applyAtmosphere(data.preset))).toBe(true);

      engine.dispose();
    }
  });
});