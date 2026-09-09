/**
 * Composition integration test for Atmosphere and Lighting system.
 *
 * Exercises the end-to-end composition contract consumed by compose-scene-app:
 * - Instantiates layout + AtmosphereSystem
 * - Attaches to a Scene with fog integration
 * - Drives update(channel) through a full chronological transition across all 5 eras (1945 -> 2025)
 * - Asserts continuous parameter changes (sky, sun key light, fog, lamps, particles, grade)
 * - Disposes cleanly and idempotently
 */

import { FogExp2, InstancedMesh, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { ERAS, type EraId } from '../../../../era/years';
import { createTimelineController } from '../../../../state/timelineStore';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import {
  GOLDEN_HOUR_GRADE,
} from '../atmosphereEraData';
import { createAtmosphereSystem, MAX_PARTICLES } from '../atmosphereSystem';

describe('AtmosphereSystem composition lifecycle', () => {
  const layout = createCityBlockLayout('composition-atmosphere-test');

  it('instantiates cleanly before attachment', () => {
    const atmosphere = createAtmosphereSystem(layout);

    expect(atmosphere.isAttached).toBe(false);
    expect(atmosphere.isDisposed).toBe(false);
    expect(atmosphere.rootGroup).toBeNull();
    expect(atmosphere.grade).toEqual(GOLDEN_HOUR_GRADE);
    expect(atmosphere.activeParticleCount).toBeGreaterThan(0);
  });

  it('attaches to a scene, creates root group, subsystems, particles, and fog', () => {
    const atmosphere = createAtmosphereSystem(layout);
    const scene = new Scene();

    atmosphere.attach({ scene });

    expect(atmosphere.isAttached).toBe(true);
    expect(atmosphere.rootGroup).not.toBeNull();
    expect(scene.children).toContain(atmosphere.rootGroup);

    // Fog attached to scene
    expect(scene.fog).toBeInstanceOf(FogExp2);
    const sceneFog = scene.fog as FogExp2;
    expect(sceneFog.density).toBeCloseTo(0.018, 3); // 1945 initial fog

    // Sky and lamp subsystems attached
    expect(atmosphere.skySystem.group).not.toBeNull();
    expect(atmosphere.lampSystem.group).not.toBeNull();

    // Ambient particles instanced mesh
    const particleMesh = atmosphere.rootGroup?.getObjectByName('atmosphere-particles');
    expect(particleMesh).toBeDefined();
    expect(particleMesh).toBeInstanceOf(InstancedMesh);
    expect(atmosphere.activeParticleCount).toBeLessThanOrEqual(MAX_PARTICLES);
  });

  it('drives update(channel) through a full 1945 -> 2025 transition asserting continuous changes', () => {
    const atmosphere = createAtmosphereSystem(layout);
    const scene = new Scene();
    atmosphere.attach({ scene });

    const timeline = createTimelineController({ transitionDuration: 1.0 });

    const recordedStates: {
      fromEra: EraId;
      toEra: EraId;
      t: number;
      sunIntensity: number;
      sunColor: number;
      fogDensity: number;
      ambientIntensity: number;
      hazeFactor: number;
      particleCount: number;
      lampColor: number;
      lampIntensity: number;
    }[] = [];

    // Step across all 4 transitions: 1945->1965, 1965->1985, 1985->2005, 2005->2025
    for (let i = 0; i < ERAS.length - 1; i += 1) {
      const fromEra = ERAS[i] as EraId;
      const toEra = ERAS[i + 1] as EraId;

      timeline.setYear(toEra, { immediate: true });

      // Sample 5 interpolation steps per era span
      for (let s = 0; s <= 4; s += 1) {
        const t = s / 4;
        const channel = { fromEra, toEra, t };
        atmosphere.update(channel, 0.016);

        recordedStates.push({
          fromEra,
          toEra,
          t,
          sunIntensity: atmosphere.currentSun.intensity,
          sunColor: atmosphere.currentSun.color,
          fogDensity: atmosphere.currentFogDensity,
          ambientIntensity: atmosphere.currentAmbientIntensity,
          hazeFactor: atmosphere.currentHazeFactor,
          particleCount: atmosphere.activeParticleCount,
          lampColor: atmosphere.lampSystem.currentLampColor,
          lampIntensity: atmosphere.lampSystem.currentLampIntensity,
        });
      }
    }

    // Verify all sampled points recorded continuous values without NaNs
    expect(recordedStates.length).toBe(20);
    for (const state of recordedStates) {
      expect(Number.isFinite(state.sunIntensity)).toBe(true);
      expect(Number.isFinite(state.fogDensity)).toBe(true);
      expect(Number.isFinite(state.ambientIntensity)).toBe(true);
      expect(Number.isFinite(state.hazeFactor)).toBe(true);
      expect(Number.isFinite(state.particleCount)).toBe(true);
      expect(Number.isFinite(state.lampColor)).toBe(true);
      expect(Number.isFinite(state.lampIntensity)).toBe(true);
    }

    // Verify overall era arc trends:
    // 1. Sun intensity increases from 1945 (0.85) to 2025 (1.4)
    const state1945 = recordedStates[0];
    const state2025 = recordedStates[recordedStates.length - 1];
    expect(state1945.sunIntensity).toBeLessThan(state2025.sunIntensity);

    // 2. Fog density decreases from 1945 heavy coal haze (0.018) to 2025 clear air (0.005)
    expect(state1945.fogDensity).toBeGreaterThan(state2025.fogDensity);

    // 3. Haze factor drops significantly by 2025
    expect(state1945.hazeFactor).toBeGreaterThan(0.7);
    expect(state2025.hazeFactor).toBeLessThan(0.2);

    // 4. Particle count decreases from heavy motes (110) to clear air (18)
    expect(state1945.particleCount).toBeGreaterThan(100);
    expect(state2025.particleCount).toBeLessThan(30);

    // 5. Scene fog stays synchronized with system fog
    const sceneFog = scene.fog as FogExp2;
    expect(sceneFog.density).toBeCloseTo(state2025.fogDensity, 4);

    // 6. Color grade remains identical and golden-hour friendly
    expect(atmosphere.grade).toEqual(GOLDEN_HOUR_GRADE);
    expect(atmosphere.grade.toneMapping).toBe('aces_filmic');
  });

  it('disposes cleanly, removes meshes from scene, clears fog, and is safe on repeat calls', () => {
    const atmosphere = createAtmosphereSystem(layout);
    const scene = new Scene();
    atmosphere.attach({ scene });

    expect(scene.children.length).toBeGreaterThan(0);
    expect(scene.fog).not.toBeNull();

    // First dispose
    atmosphere.dispose();
    expect(atmosphere.isDisposed).toBe(true);
    expect(atmosphere.isAttached).toBe(false);
    expect(atmosphere.rootGroup).toBeNull();
    expect(scene.children.length).toBe(0);
    expect(scene.fog).toBeNull();

    // Idempotent second dispose (must not throw)
    expect(() => atmosphere.dispose()).not.toThrow();
  });
});
