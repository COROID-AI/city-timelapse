// @vitest-environment node
//
// Headless composition: NavigationAPI drives the real SceneRuntime camera
// through the five curated era viewpoints without any DOM or OrbitControls.
// The walk proves the pure navigation logic (preset targets, easing progress,
// era limits) integrates with the headless runtime camera.

import { describe, expect, it } from 'vitest';

import { SceneRuntime } from '../core/sceneRuntime';
import { ERA_IDS } from '../eras/eraSystem';
import {
  DEFAULT_NAVIGATION_LIMITS,
  NavigationAPI,
  getEraNavigationProfile,
  getEraViewpointPreset,
  type Vec3,
} from './navigation';

function distanceBetween(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe('navigation × headless SceneRuntime composition', () => {
  it('walks all five eras, moving the camera to each curated viewpoint', () => {
    const runtime = new SceneRuntime();
    const nav = new NavigationAPI({ limits: DEFAULT_NAVIGATION_LIMITS });
    nav.attach(runtime.camera);

    const visited: string[] = [];
    let totalSteps = 0;

    for (const eraId of ERA_IDS) {
      nav.applyEra(eraId, 1);
      expect(nav.activeEraId).toBe(eraId);

      nav.focusPreset(eraId);
      const preset = getEraViewpointPreset(eraId);

      let guard = 0;
      while (nav.isEasing && guard < 600) {
        runtime.step(1 / 60);
        nav.update(1 / 60);
        guard += 1;
      }
      expect(nav.isEasing).toBe(false);
      totalSteps += guard;

      // The runtime camera settled exactly on the era preset's eye position.
      const cameraPosition = runtime.camera.position;
      expect(cameraPosition.x).toBeCloseTo(preset.position.x, 3);
      expect(cameraPosition.y).toBeCloseTo(preset.position.y, 3);
      expect(cameraPosition.z).toBeCloseTo(preset.position.z, 3);

      // The look-at point settled on the preset target.
      const state = nav.state;
      expect(state.target.x).toBeCloseTo(preset.target.x, 3);
      expect(state.target.y).toBeCloseTo(preset.target.y, 3);
      expect(state.target.z).toBeCloseTo(preset.target.z, 3);

      // The settled view respects the era-aware orbit envelope.
      const profile = getEraNavigationProfile(eraId);
      const distance = distanceBetween(cameraPosition, state.target);
      expect(distance).toBeGreaterThanOrEqual(profile.minDistance - 1e-3);
      expect(distance).toBeLessThanOrEqual(profile.maxDistance + 1e-3);

      visited.push(preset.id);
    }

    expect(visited).toEqual([
      'street-1945',
      'mid-elevation-1965',
      'skyline-1985',
      'mid-2005',
      'led-street-2025',
    ]);
    expect(totalSteps).toBeGreaterThan(0);

    nav.dispose();
    // The headless runtime remains usable after navigation teardown.
    expect(runtime.layerCount).toBe(0);
  });

  it('blends era navigation limits headlessly as progress advances', () => {
    const runtime = new SceneRuntime();
    const nav = new NavigationAPI({ camera: runtime.camera, initialEra: 1945 });
    const initial = nav.limits.maxDistance;

    nav.applyEra(1985, 0.5);
    const midway = nav.limits.maxDistance;
    expect(midway).toBeGreaterThan(initial);
    expect(midway).toBeLessThan(getEraNavigationProfile(1985).maxDistance);

    nav.applyEra(1985, 1);
    expect(nav.limits.maxDistance).toBeCloseTo(getEraNavigationProfile(1985).maxDistance, 6);
    nav.dispose();
  });

  it('hands control back immediately when the user inputs during a flight', () => {
    const runtime = new SceneRuntime();
    const nav = new NavigationAPI({ camera: runtime.camera });

    nav.focusPreset(1945);
    expect(nav.isEasing).toBe(true);

    nav.hook.rotate(0.2, 0); // simulated user drag interrupts the flight
    expect(nav.isEasing).toBe(false);

    nav.update(1 / 60);
    expect(runtime.camera.position).toBeDefined();
    nav.dispose();
  });
});