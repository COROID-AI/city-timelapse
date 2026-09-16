// @vitest-environment node
//
// Navigation unit tests: curated era viewpoint presets, limits/damping config,
// focus-preset easing and the pure NavigationCore procedure driven through an
// injected control hook. Runs in Node — no DOM, no OrbitControls.

import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import { ERA_IDS, type EraId } from '../eras/eraSystem';
import {
  DEFAULT_NAVIGATION_LIMITS,
  ERA_NAVIGATION_PROFILES,
  ERA_VIEWPOINT_PRESETS,
  FocusEase,
  NavigationAPI,
  NavigationCore,
  PAN_BOUNDS,
  clamp01,
  getEraNavigationProfile,
  getEraViewpointPreset,
  resolveLimits,
  type CameraState,
  type NavigationControlHook,
  type NavigationLimits,
  type Vec3,
} from './navigation';

// --- geometry helpers -------------------------------------------------------

function distanceOf(position: Vec3, target: Vec3): number {
  return Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
}

function polarAngleOf(position: Vec3, target: Vec3): number {
  const dy = position.y - target.y;
  const radius = distanceOf(position, target);
  return Math.acos(clamp01(dy / radius));
}

function azimuthOf(position: Vec3, target: Vec3): number {
  return Math.atan2(position.x - target.x, position.z - target.z);
}

// --- era viewpoint presets --------------------------------------------------

describe('era viewpoint presets', () => {
  it('curates exactly one viewpoint per era in slider order', () => {
    expect(ERA_VIEWPOINT_PRESETS).toHaveLength(5);
    expect(ERA_VIEWPOINT_PRESETS.map((preset) => preset.eraId)).toEqual(ERA_IDS);
    const ids = ERA_VIEWPOINT_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of ERA_VIEWPOINT_PRESETS) {
      expect(preset.moveDurationSeconds).toBeGreaterThan(0);
      expect(preset.title.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps street-era presets at eye level and the 1985 skyline elevated', () => {
    const street1945 = ERA_VIEWPOINT_PRESETS.find((preset) => preset.eraId === 1945)!;
    const skyline1985 = ERA_VIEWPOINT_PRESETS.find((preset) => preset.eraId === 1985)!;
    const led2025 = ERA_VIEWPOINT_PRESETS.find((preset) => preset.eraId === 2025)!;
    const mid1965 = ERA_VIEWPOINT_PRESETS.find((preset) => preset.eraId === 1965)!;
    const mid2005 = ERA_VIEWPOINT_PRESETS.find((preset) => preset.eraId === 2005)!;

    expect(street1945.position.y).toBeLessThan(4);
    expect(led2025.position.y).toBeLessThan(4);
    expect(skyline1985.position.y).toBeGreaterThan(60);
    expect(mid1965.position.y).toBeGreaterThan(20);
    expect(mid1965.position.y).toBeLessThan(45);
    expect(mid2005.position.y).toBeGreaterThan(20);
    expect(mid2005.position.y).toBeLessThan(45);
  });

  it('keeps every curated view inside the default orbit envelope', () => {
    for (const preset of ERA_VIEWPOINT_PRESETS) {
      const distance = distanceOf(preset.position, preset.target);
      expect(distance).toBeGreaterThanOrEqual(DEFAULT_NAVIGATION_LIMITS.minDistance);
      expect(distance).toBeLessThanOrEqual(DEFAULT_NAVIGATION_LIMITS.maxDistance);
      const polar = polarAngleOf(preset.position, preset.target);
      expect(polar).toBeGreaterThanOrEqual(DEFAULT_NAVIGATION_LIMITS.minPolarAngle);
      expect(polar).toBeLessThanOrEqual(DEFAULT_NAVIGATION_LIMITS.maxPolarAngle);
      expect(preset.target.y).toBeGreaterThanOrEqual(DEFAULT_NAVIGATION_LIMITS.minTargetY);
      expect(preset.target.y).toBeLessThanOrEqual(DEFAULT_NAVIGATION_LIMITS.maxTargetY);
    }
  });

  it('getEraViewpointPreset resolves presets and rejects unknown eras', () => {
    expect(getEraViewpointPreset(1945).id).toBe('street-1945');
    expect(getEraViewpointPreset(1985).id).toBe('skyline-1985');
    expect(getEraViewpointPreset(2025).id).toBe('led-street-2025');
    expect(() => getEraViewpointPreset(2055 as EraId)).toThrow(/unknown era/);
    expect(() => getEraViewpointPreset(1900 as EraId)).toThrow(/unknown era/);
  });
});

// --- limits / damping configuration -----------------------------------------

describe('limits and damping configuration', () => {
  it('defaults are sane for a city block', () => {
    const limits = DEFAULT_NAVIGATION_LIMITS;
    expect(limits.minDistance).toBeLessThan(limits.maxDistance);
    expect(limits.minPolarAngle).toBeGreaterThan(0);
    expect(limits.maxPolarAngle).toBeLessThanOrEqual(Math.PI);
    expect(limits.minTargetY).toBeLessThan(limits.maxTargetY);
    expect(limits.dampingFactor).toBeGreaterThanOrEqual(0);
    expect(limits.dampingFactor).toBeLessThan(1);
    // Azimuth is unlocked by default so users can circle the whole block.
    expect(limits.minAzimuthAngle).toBe(-Infinity);
    expect(limits.maxAzimuthAngle).toBe(Infinity);
  });

  it('resolveLimits merges overrides onto the defaults', () => {
    const limits = resolveLimits({ maxDistance: 500, dampingFactor: 0.2 });
    expect(limits.maxDistance).toBe(500);
    expect(limits.dampingFactor).toBe(0.2);
    expect(limits.minDistance).toBe(DEFAULT_NAVIGATION_LIMITS.minDistance);
  });

  it('rejects invalid limits', () => {
    expect(() => resolveLimits({ minDistance: 10, maxDistance: 5 })).toThrow(/minDistance/);
    expect(() => resolveLimits({ minPolarAngle: 1.2, maxPolarAngle: 0.6 })).toThrow(/polar/);
    expect(() => resolveLimits({ dampingFactor: 1.2 })).toThrow(/dampingFactor/);
    expect(() => resolveLimits({ minTargetY: 80, maxTargetY: 10 })).toThrow(/minTargetY/);
  });
});

// --- era navigation profiles -------------------------------------------------

describe('era navigation profiles', () => {
  it('defines a profile for every era and matches featured presets', () => {
    expect(ERA_NAVIGATION_PROFILES).toHaveLength(5);
    expect(ERA_NAVIGATION_PROFILES.map((profile) => profile.eraId)).toEqual(ERA_IDS);
    for (const profile of ERA_NAVIGATION_PROFILES) {
      const preset = getEraViewpointPreset(profile.eraId);
      expect(preset.id).toBe(profile.featuredPresetId);
      expect(profile.minDistance).toBeGreaterThan(0);
      expect(profile.maxDistance).toBeGreaterThan(profile.minDistance);
      expect(profile.dampingFactor).toBeGreaterThanOrEqual(0);
      expect(profile.dampingFactor).toBeLessThan(1);
    }
  });

  it('allows the tallest skyline viewing for the neon 1985 era', () => {
    const skyline = getEraNavigationProfile(1985);
    const street = getEraNavigationProfile(1945);
    expect(skyline.maxDistance).toBeGreaterThan(street.maxDistance);
    expect(skyline.dampingFactor).toBeGreaterThan(street.dampingFactor);
  });

  it('rejects unknown eras', () => {
    expect(() => getEraNavigationProfile(2055 as EraId)).toThrow(/unknown era/);
  });
});

// --- focus-preset easing -----------------------------------------------------

describe('FocusEase (preset flight easing)', () => {
  const from: CameraState = {
    position: { x: 0, y: 10, z: 80 },
    target: { x: 0, y: 0, z: 0 },
  };

  it('is idle until started', () => {
    const ease = new FocusEase();
    expect(ease.isActive).toBe(false);
    expect(ease.state.phase).toBe('idle');
    expect(ease.progress).toBe(0);
  });

  it('eases from the current view to the preset view', () => {
    const ease = new FocusEase();
    ease.start(getEraViewpointPreset(1985), from);
    expect(ease.isActive).toBe(true);

    const atStart = ease.sample();
    expect(atStart.position.x).toBeCloseTo(from.position.x, 6);
    expect(atStart.position.y).toBeCloseTo(from.position.y, 6);
    expect(atStart.position.z).toBeCloseTo(from.position.z, 6);

    let guard = 0;
    while (ease.isActive && guard < 1000) {
      ease.update(1 / 60);
      guard += 1;
    }
    expect(ease.isActive).toBe(false);
    expect(ease.progress).toBe(1);

    const settled = ease.sample();
    expect(settled.position.x).toBeCloseTo(getEraViewpointPreset(1985).position.x, 4);
    expect(settled.position.y).toBeCloseTo(getEraViewpointPreset(1985).position.y, 4);
    expect(settled.position.z).toBeCloseTo(getEraViewpointPreset(1985).position.z, 4);
    expect(settled.target.x).toBeCloseTo(getEraViewpointPreset(1985).target.x, 4);
    expect(settled.target.y).toBeCloseTo(getEraViewpointPreset(1985).target.y, 4);
    expect(settled.target.z).toBeCloseTo(getEraViewpointPreset(1985).target.z, 4);
  });

  it('reports eased progress on an ease-in-out curve', () => {
    const edge = getEraViewpointPreset(1945);
    const ease = new FocusEase();
    ease.start(edge, from);
    expect(ease.progress).toBe(0);

    ease.update(edge.moveDurationSeconds / 2);
    expect(ease.progress).toBeCloseTo(0.5, 5); // easeInOutCubic(0.5) === 0.5

    const quarter = new FocusEase();
    quarter.start(edge, from);
    quarter.update(edge.moveDurationSeconds / 4);
    expect(quarter.progress).toBeLessThan(0.25); // ease-in holds the start of the flight
  });

  it('can retarget mid-flight from the sampled view', () => {
    const ease = new FocusEase();
    ease.start(getEraViewpointPreset(1985), from);
    ease.update(getEraViewpointPreset(1985).moveDurationSeconds / 3);
    const mid = ease.sample();

    ease.start(getEraViewpointPreset(1945), mid);
    expect(ease.isActive).toBe(true);
    const retargetedStart = ease.sample();
    expect(retargetedStart.position.x).toBeCloseTo(mid.position.x, 6);
    expect(retargetedStart.position.y).toBeCloseTo(mid.position.y, 6);
    expect(retargetedStart.position.z).toBeCloseTo(mid.position.z, 6);
  });

  it('cancel stops an active flight', () => {
    const ease = new FocusEase();
    ease.start(getEraViewpointPreset(1985), from);
    ease.update(0.1);
    ease.cancel();
    expect(ease.isActive).toBe(false);
    expect(ease.progress).toBe(0);
    expect(ease.update(1 / 60)).toBe(false);
  });
});

// --- NavigationCore: limits, pan/zoom and damping ----------------------------

describe('NavigationCore controls (injected control hook)', () => {
  /** Camera at (0, 0, 80) looking at the origin with instant (damping 0) input. */
  function coreWith(limits: Partial<NavigationLimits>): NavigationCore {
    const camera = new PerspectiveCamera(50, 1, 0.1, 3000);
    camera.position.set(0, 0, 80);
    camera.lookAt(0, 0, 0);
    return new NavigationCore({
      camera,
      limits: resolveLimits({ dampingFactor: 0, ...limits }),
    });
  }

  it('clamps polar angle within limits while orbiting', () => {
    const core = coreWith({ minPolarAngle: 0.2, maxPolarAngle: 1.1 });
    core.rotate(0, -0.6); // pitch below the horizon beyond the ceiling
    core.update(1 / 60);
    const polar = polarAngleOf(core.state.position, core.state.target);
    expect(polar).toBeCloseTo(1.1, 6);
  });

  it('clamps azimuth angle within limits while orbiting', () => {
    const core = coreWith({ minAzimuthAngle: -0.5, maxAzimuthAngle: 0.5 });
    core.rotate(0.6, 0);
    core.update(1 / 60);
    const azimuth = azimuthOf(core.state.position, core.state.target);
    expect(azimuth).toBeCloseTo(-0.5, 6);
  });

  it('clamps orbit distance to min/max while zooming', () => {
    const core = coreWith({ minDistance: 10, maxDistance: 60 });
    core.zoom(10); // dolly out far beyond the ceiling
    core.update(1 / 60);
    expect(distanceOf(core.state.position, core.state.target)).toBeCloseTo(60, 6);

    core.zoom(0.001); // dolly in far beyond the floor
    core.update(1 / 60);
    expect(distanceOf(core.state.position, core.state.target)).toBeCloseTo(10, 6);
  });

  it('pans camera and target together and respects pan bounds', () => {
    const core = coreWith({ minTargetY: 1, maxTargetY: 90 });
    core.update(1 / 60); // settle the target into the target-y bounds first
    const before = core.state;

    core.pan(12, 0); // right axis at the default orientation is +x
    core.update(1 / 60);
    const after = core.state;
    expect(after.target.x).toBeCloseTo(before.target.x + 12, 6);
    expect(after.position.x - after.target.x).toBeCloseTo(before.position.x - before.target.x, 6);

    core.pan(1000, 0); // runaway pan clamps at the pan bounds
    core.update(1 / 60);
    expect(core.state.target.x).toBeLessThanOrEqual(PAN_BOUNDS.maxX + 1e-6);

    core.pan(0, -1000); // downward pan clamps at the eye-height floor
    core.update(1 / 60);
    expect(core.state.target.y).toBeGreaterThanOrEqual(1 - 1e-6);
  });

  it('applies exponential damping to rotate input', () => {
    const core = coreWith({ dampingFactor: 0.08 });
    core.rotate(1, 0); // one radian of azimuth input, speed 1
    const theta0 = azimuthOf(core.state.position, core.state.target);

    core.update(1 / 60);
    const step1 = azimuthOf(core.state.position, core.state.target);
    expect(Math.abs(step1 - theta0)).toBeCloseTo(0.08, 6); // 8% of the pending input

    core.update(1 / 60);
    const step2 = azimuthOf(core.state.position, core.state.target);
    expect(Math.abs(step2 - step1)).toBeLessThan(Math.abs(step1 - theta0)); // remaining shrinks

    let guard = 0;
    while (guard < 600) {
      core.update(1 / 60);
      guard += 1;
    }
    const finalTheta = azimuthOf(core.state.position, core.state.target);
    expect(Math.abs(finalTheta - theta0) - 1).toBeLessThan(1e-3); // converges to the input
  });

  it('drives the pure controller through an injected control hook', () => {
    const core = coreWith({});
    const calls: Array<{ method: string; args: readonly number[] }> = [];
    const hook: NavigationControlHook = {
      rotate: (dx, dy) => {
        calls.push({ method: 'rotate', args: [dx, dy] });
        core.rotate(dx, dy);
      },
      pan: (dx, dy) => {
        calls.push({ method: 'pan', args: [dx, dy] });
        core.pan(dx, dy);
      },
      zoom: (multiplier) => {
        calls.push({ method: 'zoom', args: [multiplier] });
        core.zoom(multiplier);
      },
    };

    hook.rotate(0.25, 0.1);
    hook.zoom(0.5);
    core.update(1 / 60);

    expect(calls).toEqual([
      { method: 'rotate', args: [0.25, 0.1] },
      { method: 'zoom', args: [0.5] },
    ]);
    // The zoom moved the camera closer to the look-at point.
    expect(distanceOf(core.state.position, core.state.target)).toBeLessThan(80);
  });

  it('rejects input after dispose', () => {
    const core = coreWith({});
    core.dispose();
    expect(() => core.rotate(0.1, 0)).toThrow(/disposed/);
    core.update(1 / 60); // inert, no throw
  });
});

// --- NavigationAPI facade ----------------------------------------------------

describe('NavigationAPI facade', () => {
  it('attach binds a camera headlessly without DOM wiring', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 3000);
    camera.position.set(10, 20, 30);
    const api = new NavigationAPI();
    api.attach(camera);
    expect(api.state.position.x).toBe(10);
    expect(api.state.position.y).toBe(20);
    expect(api.state.position.z).toBe(30);
    api.dispose();
  });

  it('routes hook input to its camera headlessly', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 3000);
    camera.position.set(0, 0, 80);
    const api = new NavigationAPI({ camera });
    api.hook.rotate(0.5, 0);
    api.update(1 / 60);
    expect(azimuthOf(api.state.position, api.state.target)).not.toBeCloseTo(0, 6);
    api.dispose();
    expect(api.isEasing).toBe(false);
  });

  it('applyEra adopts era-aware limits and blends progress headlessly', () => {
    const api = new NavigationAPI({ camera: new PerspectiveCamera(), initialEra: 1945 });
    const base1945 = api.limits.maxDistance;

    api.applyEra(1985, 0); // beginning of the transition: still the old profile
    expect(api.limits.maxDistance).toBeCloseTo(base1945, 6);

    api.applyEra(1985, 0.5); // halfway: limits blend toward 1985
    const midway = api.limits.maxDistance;
    expect(midway).toBeGreaterThan(base1945);
    expect(midway).toBeLessThan(getEraNavigationProfile(1985).maxDistance);

    api.applyEra(1985, 1); // settled: full 1985 profile
    expect(api.limits.maxDistance).toBeCloseTo(getEraNavigationProfile(1985).maxDistance, 6);
    expect(api.activeEraId).toBe(1985);
    api.dispose();
  });

  it('rejects use after dispose', () => {
    const api = new NavigationAPI({ camera: new PerspectiveCamera() });
    api.dispose();
    expect(() => api.applyEra(1985, 1)).toThrow(/disposed/);
    expect(() => api.focusPreset(1985)).toThrow(/disposed/);
    expect(() => api.attach(new PerspectiveCamera())).toThrow(/disposed/);
    api.update(1 / 60); // inert, no throw
  });
});