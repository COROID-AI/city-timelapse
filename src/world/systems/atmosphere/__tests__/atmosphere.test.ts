/**
 * Unit test suite for Atmosphere and Lighting system.
 *
 * Asserts:
 * 1. Data completeness of `atmosphereEraData` across all 5 eras (1945, 1965, 1985, 2005, 2025).
 * 2. Continuous parameter lerp continuity between all adjacent eras (no NaNs, no jump discontinuities).
 * 3. Sky system geometry, per-vertex colors, sun key-light direction, and disposal.
 * 4. Lamp system anchor placement, 5 era pole styles, emissive bloom tuning, string lights, and disposal.
 * 5. Golden-hour grade consistency across all periods.
 */

import { Group, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { ERAS, type EraId } from '../../../../era/years';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import type { FurnitureAnchor } from '../../../layout/types';
import {
  atmosphereEraData,
  GOLDEN_HOUR_GRADE,
} from '../atmosphereEraData';
import { interpolateEraAtmosphere } from '../interpolation';
import { createLampSystem } from '../lamps';
import { createSkySystem } from '../sky';

describe('atmosphereEraData completeness', () => {
  it('covers all five canonical eras in chronological order', () => {
    for (const era of ERAS) {
      const data = atmosphereEraData[era as EraId];
      expect(data, `Missing data for era ${era}`).toBeDefined();
      expect(data.skyGradient).toBeDefined();
      expect(data.skyGradient.zenith).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(data.skyGradient.horizon).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(data.skyGradient.ground).toMatch(/^#[0-9a-fA-F]{6}$/);

      expect(data.sunColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(data.sunIntensity).toBeGreaterThan(0);
      expect(data.sunPosition.length).toBe(3);

      expect(data.ambientColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(data.ambientIntensity).toBeGreaterThan(0);

      expect(data.fogColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(data.fogDensity).toBeGreaterThan(0);

      expect(data.streetLampColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(data.streetLampIntensity).toBeGreaterThan(0);
      expect(data.streetLampStyle).toBeDefined();

      expect(data.hazeFactor).toBeGreaterThanOrEqual(0);
      expect(data.hazeFactor).toBeLessThanOrEqual(1.0);
      expect(data.colorGradeMood).toBeDefined();
    }
  });

  it('includes extended particle, shadow, string light, and bloom details for every era', () => {
    for (const era of ERAS) {
      const data = atmosphereEraData[era as EraId];
      // Particles
      expect(data.particles).toBeDefined();
      expect(['soot_smoke', 'smog_haze', 'clear_air']).toContain(data.particles.kind);
      expect(data.particles.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(data.particles.count).toBeGreaterThan(0);
      expect(data.particles.size).toBeGreaterThan(0);
      expect(data.particles.speed).toBeGreaterThan(0);

      // Shadow
      expect(data.shadow.softness).toBeGreaterThan(0);
      expect(data.shadow.density).toBeGreaterThan(0);

      // Bloom factor
      expect(data.emissiveBloomFactor).toBeGreaterThan(0);
      expect(data.emissiveBloomFactor).toBeLessThanOrEqual(1.0);

      // Grade
      expect(data.grade).toEqual(GOLDEN_HOUR_GRADE);
    }
  });

  it('provides era-authentic air quality tells per requirement', () => {
    // 1945 has high coal haze
    expect(atmosphereEraData['1945'].particles.kind).toBe('soot_smoke');
    expect(atmosphereEraData['1945'].hazeFactor).toBeGreaterThanOrEqual(0.7);

    // 1985 has photochemical smog
    expect(atmosphereEraData['1985'].particles.kind).toBe('smog_haze');
    expect(atmosphereEraData['1985'].particles.count).toBeGreaterThan(100);

    // 2025 has clean air
    expect(atmosphereEraData['2025'].particles.kind).toBe('clear_air');
    expect(atmosphereEraData['2025'].hazeFactor).toBeLessThanOrEqual(0.15);
    expect(atmosphereEraData['2025'].poll).toBeLessThan(15);
  });

  it('attaches festive string lights specifically to 2025', () => {
    expect(atmosphereEraData['1945'].stringLights).toBeNull();
    expect(atmosphereEraData['1965'].stringLights).toBeNull();
    expect(atmosphereEraData['1985'].stringLights).toBeNull();
    expect(atmosphereEraData['2005'].stringLights).toBeNull();

    expect(atmosphereEraData['2025'].stringLights).not.toBeNull();
    expect(atmosphereEraData['2025'].stringLights?.color).toBe('#dbeafe');
  });
});

describe('parameter lerp continuity between adjacent eras', () => {
  it('interpolates every atmospheric parameter smoothly with zero NaNs across all adjacent pairs', () => {
    const steps = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];

    for (let i = 0; i < ERAS.length - 1; i += 1) {
      const fromId = ERAS[i] as EraId;
      const toId = ERAS[i + 1] as EraId;
      const fromSpec = atmosphereEraData[fromId];
      const toSpec = atmosphereEraData[toId];

      for (const t of steps) {
        const interpolated = interpolateEraAtmosphere(fromSpec, toSpec, t);

        // Colors are valid 6-character hex strings
        expect(interpolated.skyGradient.zenith).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(interpolated.skyGradient.horizon).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(interpolated.skyGradient.ground).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(interpolated.sunColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(interpolated.ambientColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(interpolated.fogColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(interpolated.streetLampColor).toMatch(/^#[0-9a-fA-F]{6}$/);

        // Numeric parameters are finite and positive
        expect(Number.isFinite(interpolated.sunIntensity)).toBe(true);
        expect(interpolated.sunIntensity).toBeGreaterThan(0);

        expect(Number.isFinite(interpolated.ambientIntensity)).toBe(true);
        expect(interpolated.ambientIntensity).toBeGreaterThan(0);

        expect(Number.isFinite(interpolated.fogDensity)).toBe(true);
        expect(interpolated.fogDensity).toBeGreaterThan(0);

        expect(Number.isFinite(interpolated.streetLampIntensity)).toBe(true);
        expect(interpolated.streetLampIntensity).toBeGreaterThan(0);

        expect(Number.isFinite(interpolated.hazeFactor)).toBe(true);
        expect(interpolated.hazeFactor).toBeGreaterThanOrEqual(0);

        // Sun position coords are finite
        for (const coord of interpolated.sunPosition) {
          expect(Number.isFinite(coord)).toBe(true);
        }
      }
    }
  });

  it('preserves exact boundary values at t = 0 and t = 1', () => {
    const from = atmosphereEraData['1945'];
    const to = atmosphereEraData['1965'];

    const at0 = interpolateEraAtmosphere(from, to, 0);
    expect(at0.sunIntensity).toBeCloseTo(from.sunIntensity, 5);
    expect(at0.fogDensity).toBeCloseTo(from.fogDensity, 5);
    expect(at0.skyGradient.zenith.toLowerCase()).toBe(from.skyGradient.zenith.toLowerCase());

    const at1 = interpolateEraAtmosphere(from, to, 1);
    expect(at1.sunIntensity).toBeCloseTo(to.sunIntensity, 5);
    expect(at1.fogDensity).toBeCloseTo(to.fogDensity, 5);
    expect(at1.skyGradient.zenith.toLowerCase()).toBe(to.skyGradient.zenith.toLowerCase());
  });
});

describe('SkyEraSystem', () => {
  it('instantiates and attaches sky dome to scene', () => {
    const sky = createSkySystem();
    const scene = new Scene();

    expect(sky.group).toBeNull();
    sky.attach({ scene });

    expect(sky.group).not.toBeNull();
    expect(sky.group?.name).toBe('atmosphere-sky');
    expect(scene.children).toContain(sky.group);
    expect(sky.skyResources?.dome).toBeDefined();
    expect(sky.skyResources?.dome.name).toBe('sky-dome');
  });

  it('updates sun state and recomputes per-vertex colors during update ticks', () => {
    const sky = createSkySystem();
    const scene = new Scene();
    sky.attach({ scene });

    const sunInit = sky.sun;
    expect(sunInit.intensity).toBeGreaterThan(0);
    expect(sunInit.direction.length).toBe(3);

    // Update to 2025
    sky.update({ fromEra: '1945', toEra: '2025', t: 1 }, 0.016);
    const sun2025 = sky.sun;

    // Sun intensity in 2025 should be 1.4 (different from 1945 0.85)
    expect(sun2025.intensity).toBeCloseTo(1.4, 2);

    // Color buffer on dome should have been marked dirty
    const colorAttr = sky.skyResources?.dome.geometry.getAttribute('color');
    expect(colorAttr).toBeDefined();
  });

  it('supports show() toggle and disposes cleanly', () => {
    const sky = createSkySystem();
    const scene = new Scene();
    sky.attach({ scene });

    sky.show(false);
    expect(sky.group?.visible).toBe(false);

    sky.show(true);
    expect(sky.group?.visible).toBe(true);

    sky.dispose();
    expect(sky.group).toBeNull();
    expect(scene.children.length).toBe(0);
  });
});

describe('LampEraSystem', () => {
  const layout = createCityBlockLayout('atmosphere-test-seed');

  it('places lamps at all layout lamp furniture anchors', () => {
    const lampSys = createLampSystem(layout);
    const scene = new Scene();
    lampSys.attach({ scene });

    const expectedLampCount = layout.furniture.filter((f: FurnitureAnchor) => f.kind === 'lamp').length;
    expect(lampSys.lampCount).toBe(expectedLampCount);
    expect(lampSys.group?.name).toBe('atmosphere-lamps');
    expect(scene.children).toContain(lampSys.group);
  });

  it('creates 5 era pole styles per lamp post', () => {
    const lampSys = createLampSystem(layout);
    const scene = new Scene();
    lampSys.attach({ scene });

    const firstLampGroup = lampSys.group?.children.find((c) => c.name.startsWith('lamp-'));
    expect(firstLampGroup).toBeDefined();

    // Contains the 5 era styles as children
    const styleNames = firstLampGroup?.children.map((c) => c.name);
    expect(styleNames).toContain('style-1945-gas');
    expect(styleNames).toContain('style-1965-gooseneck');
    expect(styleNames).toContain('style-1985-cobra');
    expect(styleNames).toContain('style-2005-modern');
    expect(styleNames).toContain('style-2025-smart-spire');
  });

  it('cross-fades pole styles across era transitions', () => {
    const lampSys = createLampSystem(layout);
    const scene = new Scene();
    lampSys.attach({ scene });

    // In 1945, 1945 style is visible, other styles hidden
    lampSys.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0);
    const firstLamp = lampSys.group?.children.find((c) => c.name.startsWith('lamp-')) as Group;
    const style1945 = firstLamp.getObjectByName('style-1945-gas');
    const style2025 = firstLamp.getObjectByName('style-2025-smart-spire');

    expect(style1945?.visible).toBe(true);
    expect(style2025?.visible).toBe(false);

    // In 2025, 2025 style is visible, 1945 hidden
    lampSys.update({ fromEra: '2025', toEra: '2025', t: 0 }, 0);
    expect(style1945?.visible).toBe(false);
    expect(style2025?.visible).toBe(true);
  });

  it('drapes festive string lights in 2025 and hides them in earlier eras', () => {
    const lampSys = createLampSystem(layout);
    const scene = new Scene();
    lampSys.attach({ scene });

    expect(lampSys.stringLightSpans).toBeGreaterThan(0);

    // Hidden in 1945
    lampSys.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0);
    const stringGroup = lampSys.group?.children.find((c) => c.name.startsWith('stringlights-'));
    expect(stringGroup?.visible).toBe(false);

    // Visible in 2025
    lampSys.update({ fromEra: '2025', toEra: '2025', t: 0 }, 0);
    expect(stringGroup?.visible).toBe(true);
  });

  it('simulates gas flicker in 1945', () => {
    const lampSys = createLampSystem(layout);
    const scene = new Scene();
    lampSys.attach({ scene });

    lampSys.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0.016);
    const intensity1 = lampSys.currentLampIntensity;

    lampSys.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0.15);
    const intensity2 = lampSys.currentLampIntensity;

    expect(Number.isFinite(intensity1)).toBe(true);
    expect(Number.isFinite(intensity2)).toBe(true);
    expect(intensity1).toBeGreaterThan(0);
  });

  it('disposes lamp system cleanly', () => {
    const lampSys = createLampSystem(layout);
    const scene = new Scene();
    lampSys.attach({ scene });

    lampSys.dispose();
    expect(lampSys.group).toBeNull();
    expect(scene.children.length).toBe(0);
  });
});
