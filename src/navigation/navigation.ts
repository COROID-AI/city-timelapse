/**
 * navigation.ts — Camera navigation for the city block: orbit, pan, zoom and
 * curated era viewpoint presets.
 *
 * Two layers are deliberately separated:
 *
 * 1. Pure, headless-testable logic — `EraViewpointPreset`, `FocusEase`,
 *    `NavigationLimits`, `EraNavigationProfile`, `NavigationCore` and
 *    `NavigationControlHook`. This logic only touches three.js math and camera
 *    objects, never the DOM, and is exercised directly by navigation.test.ts
 *    and navigation.composition.test.ts in Node.
 * 2. DOM-bound OrbitControls wiring — `NavigationAPI.attach(camera, domEl)`.
 *    Real orbit/pan/zoom interaction (damping, distance and polar limits, pan
 *    and zoom speeds) is wired to the browser DOM here. OrbitControls is
 *    imported lazily so Node test runners never load it; the wiring itself
 *    stays browser-only.
 *
 * Public contract exposed by `NavigationAPI`:
 *   - attach(camera, domEl?)    — bind a camera. When a DOM element is given,
 *     browser-only OrbitControls (damping, limits, pan, zoom) attach to it.
 *   - applyEra(eraId, progress) — adopt era-aware navigation limits/damping as
 *     the timeline transitions (progress 0..1), without moving the camera.
 *   - focusPreset(eraId)        — ease the camera to the era's curated view.
 *   - update(deltaSeconds)      — advance damping, preset flights and (in the
 *     browser) OrbitControls within the frame loop.
 *   - dispose()                 — release DOM listeners, OrbitControls, tweens.
 */

import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WORLD_BOUNDS } from '../core/blockLayout';
import { createDefaultCamera } from '../core/sceneRuntime';
import { ERA_IDS, easeInOutCubic, isEraId, type EraId } from '../eras/eraSystem';

/* ------------------------------------------------------------------ *
 * Vector + camera state helpers (pure).
 * ------------------------------------------------------------------ */

/** Freezable minimal 3D vector used for presets and camera math. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A camera's eye position plus its look-at point. */
export interface CameraState {
  readonly position: Vec3;
  readonly target: Vec3;
}

/** Clamp a value to [0, 1]. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ------------------------------------------------------------------ *
 * Navigation limits / damping configuration (pure).
 * ------------------------------------------------------------------ */

export interface NavigationLimits {
  /** Closest orbit distance (detail-zoom floor), meters. */
  readonly minDistance: number;
  /** Farthest useful orbit distance (scales with era skyline), meters. */
  readonly maxDistance: number;
  /** Orbit polar angle floor, radians from straight-down. */
  readonly minPolarAngle: number;
  /** Orbit polar angle ceiling, radians (kept wide enough for street views). */
  readonly maxPolarAngle: number;
  /** Orbit azimuth floor, radians; +/-Infinity unlocks the full circle. */
  readonly minAzimuthAngle: number;
  /** Orbit azimuth ceiling, radians. */
  readonly maxAzimuthAngle: number;
  /** Look-at point height bounds while panning, meters. */
  readonly minTargetY: number;
  readonly maxTargetY: number;
  /** Exponential input smoothing in [0, 1); higher = floatier. */
  readonly dampingFactor: number;
  readonly rotateSpeed: number;
  readonly panSpeed: number;
  readonly zoomSpeed: number;
}

export const DEFAULT_NAVIGATION_LIMITS: Readonly<NavigationLimits> = Object.freeze({
  minDistance: 4,
  maxDistance: 190,
  minPolarAngle: 0.05,
  maxPolarAngle: Math.PI * 0.98,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
  minTargetY: 1,
  maxTargetY: 90,
  dampingFactor: 0.08,
  rotateSpeed: 1,
  panSpeed: 1,
  zoomSpeed: 1,
});

/**
 * Merge partial limits over the defaults and validate every constraint.
 * Throws with a descriptive message when the resulting config is unusable.
 */
export function resolveLimits(overrides?: Partial<NavigationLimits>): NavigationLimits {
  const limits: NavigationLimits = { ...DEFAULT_NAVIGATION_LIMITS, ...overrides };
  const finiteKeys = [
    'minDistance',
    'maxDistance',
    'minPolarAngle',
    'maxPolarAngle',
    'minTargetY',
    'maxTargetY',
    'dampingFactor',
    'rotateSpeed',
    'panSpeed',
    'zoomSpeed',
  ] as const;
  for (const key of finiteKeys) {
    const value = limits[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`resolveLimits: ${key} must be a finite number, got ${String(value)}.`);
    }
  }
  if (Number.isNaN(limits.minAzimuthAngle) || Number.isNaN(limits.maxAzimuthAngle)) {
    throw new Error('resolveLimits: azimuth limits must be numbers or +/-Infinity.');
  }
  if (limits.minDistance < 0) {
    throw new Error('resolveLimits: minDistance must be >= 0.');
  }
  if (limits.minDistance >= limits.maxDistance) {
    throw new Error('resolveLimits: minDistance must be smaller than maxDistance.');
  }
  if (
    limits.minPolarAngle < 0 ||
    limits.maxPolarAngle > Math.PI ||
    limits.minPolarAngle >= limits.maxPolarAngle
  ) {
    throw new Error('resolveLimits: polar angles must satisfy 0 <= min < max <= PI.');
  }
  if (
    Number.isFinite(limits.minAzimuthAngle) &&
    Number.isFinite(limits.maxAzimuthAngle) &&
    limits.minAzimuthAngle >= limits.maxAzimuthAngle
  ) {
    throw new Error('resolveLimits: minAzimuthAngle must be smaller than maxAzimuthAngle.');
  }
  if (limits.minTargetY >= limits.maxTargetY) {
    throw new Error('resolveLimits: minTargetY must be smaller than maxTargetY.');
  }
  if (limits.dampingFactor < 0 || limits.dampingFactor >= 1) {
    throw new Error('resolveLimits: dampingFactor must be in [0, 1).');
  }
  if (limits.rotateSpeed < 0 || limits.panSpeed < 0 || limits.zoomSpeed < 0) {
    throw new Error('resolveLimits: speeds must be >= 0.');
  }
  return Object.freeze(limits);
}

/** Where the look-at point may roam: the modeled block plus a breathing margin. */
export const PAN_BOUNDS: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }> =
  Object.freeze({
    minX: WORLD_BOUNDS.minX - 18,
    maxX: WORLD_BOUNDS.maxX + 18,
    minZ: WORLD_BOUNDS.minZ - 16,
    maxZ: WORLD_BOUNDS.maxZ + 16,
  });

/* ------------------------------------------------------------------ *
 * Curated era viewpoint presets (pure data).
 * ------------------------------------------------------------------ */

export interface EraViewpointPreset {
  readonly eraId: EraId;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Camera eye position at the preset (world meters). */
  readonly position: Vec3;
  /** Look-at point (world meters). */
  readonly target: Vec3;
  /** Flight duration for focusPreset(), seconds. */
  readonly moveDurationSeconds: number;
}

const PRESET_DEFINITIONS: readonly EraViewpointPreset[] = [
  {
    eraId: 1945,
    id: 'street-1945',
    title: 'Street Level · 1945',
    description: 'Post-war storefronts at eye level: painted signs, ration-era windows and trolley tracks.',
    position: { x: -20, y: 1.8, z: 67 },
    target: { x: -16, y: 4.5, z: -16 },
    moveDurationSeconds: 2.0,
  },
  {
    eraId: 1965,
    id: 'mid-elevation-1965',
    title: 'Mid-Elevation · 1965',
    description: 'Chrome, tailfins and neon diners seen from mid-height above the avenue.',
    position: { x: 98, y: 32, z: -62 },
    target: { x: 0, y: 12, z: 0 },
    moveDurationSeconds: 2.0,
  },
  {
    eraId: 1985,
    id: 'skyline-1985',
    title: 'Elevated Neon Skyline · 1985',
    description: 'Neon-soaked night skyline: CRT billboards and glass towers seen from above.',
    position: { x: -112, y: 80, z: -94 },
    target: { x: 0, y: 28, z: 4 },
    moveDurationSeconds: 2.8,
  },
  {
    eraId: 2005,
    id: 'mid-2005',
    title: 'Mid-Elevation · 2005',
    description: 'Early-digital avenue: backlit signs and curtain-wall facades from mid height.',
    position: { x: 88, y: 28, z: 88 },
    target: { x: -8, y: 10, z: -8 },
    moveDurationSeconds: 2.0,
  },
  {
    eraId: 2025,
    id: 'led-street-2025',
    title: 'LED Street Level · 2025',
    description: 'LED canyon at street level: giant displays and e-scooter traffic in close-up.',
    position: { x: 76, y: 1.9, z: -16 },
    target: { x: -18, y: 6, z: 14 },
    moveDurationSeconds: 2.2,
  },
];

function freezePreset(preset: EraViewpointPreset): Readonly<EraViewpointPreset> {
  return Object.freeze({
    ...preset,
    position: Object.freeze({ ...preset.position }),
    target: Object.freeze({ ...preset.target }),
  });
}

/** The five curated era viewpoints, one per era in slider order. */
export const ERA_VIEWPOINT_PRESETS: Readonly<readonly EraViewpointPreset[]> = Object.freeze(
  PRESET_DEFINITIONS.map(freezePreset),
);

const PRESET_BY_ERA = new Map<EraId, EraViewpointPreset>(
  ERA_VIEWPOINT_PRESETS.map((preset) => [preset.eraId, preset] as const),
);

/** Returns the curated viewpoint for an era; throws for unknown eras. */
export function getEraViewpointPreset(eraId: EraId): EraViewpointPreset {
  if (!isEraId(eraId)) {
    throw new Error(
      `getEraViewpointPreset: unknown era ${String(eraId)}; known eras: ${ERA_IDS.join(', ')}`,
    );
  }
  return PRESET_BY_ERA.get(eraId) as EraViewpointPreset;
}

/* ------------------------------------------------------------------ *
 * Era-aware navigation profiles (pure data).
 * ------------------------------------------------------------------ */

export interface NavigationScaleProfile {
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly dampingFactor: number;
}

export interface EraNavigationProfile extends NavigationScaleProfile {
  readonly eraId: EraId;
  readonly description: string;
  /** Preset id recommended first for this era. */
  readonly featuredPresetId: string;
}

const PROFILE_DEFINITIONS: readonly EraNavigationProfile[] = [
  {
    eraId: 1945,
    description: 'Post-war dusk streets — steady hands for dim incandescent light.',
    dampingFactor: 0.1,
    minDistance: 5,
    maxDistance: 170,
    featuredPresetId: 'street-1945',
  },
  {
    eraId: 1965,
    description: 'Bright mid-century boulevard with a taller skyline on the horizon.',
    dampingFactor: 0.07,
    minDistance: 5,
    maxDistance: 220,
    featuredPresetId: 'mid-elevation-1965',
  },
  {
    eraId: 1985,
    description: 'Neon night skyline — slow, stable pans across the glow.',
    dampingFactor: 0.12,
    minDistance: 6,
    maxDistance: 260,
    featuredPresetId: 'skyline-1985',
  },
  {
    eraId: 2005,
    description: 'Hazy early-digital avenues with towers beginning to climb.',
    dampingFactor: 0.08,
    minDistance: 5,
    maxDistance: 240,
    featuredPresetId: 'mid-2005',
  },
  {
    eraId: 2025,
    description: 'Bright LED canyons — close detail study at street level.',
    dampingFactor: 0.07,
    minDistance: 4,
    maxDistance: 200,
    featuredPresetId: 'led-street-2025',
  },
];

export const ERA_NAVIGATION_PROFILES: Readonly<readonly EraNavigationProfile[]> = Object.freeze(
  PROFILE_DEFINITIONS.map((profile) => Object.freeze({ ...profile })),
);

const PROFILE_BY_ERA = new Map<EraId, EraNavigationProfile>(
  ERA_NAVIGATION_PROFILES.map((profile) => [profile.eraId, profile] as const),
);

/** Returns the navigation profile for an era; throws for unknown eras. */
export function getEraNavigationProfile(eraId: EraId): EraNavigationProfile {
  if (!isEraId(eraId)) {
    throw new Error(
      `getEraNavigationProfile: unknown era ${String(eraId)}; known eras: ${ERA_IDS.join(', ')}`,
    );
  }
  return PROFILE_BY_ERA.get(eraId) as EraNavigationProfile;
}

function scaleProfileFromLimits(limits: NavigationLimits): NavigationScaleProfile {
  return {
    minDistance: limits.minDistance,
    maxDistance: limits.maxDistance,
    dampingFactor: limits.dampingFactor,
  };
}

/* ------------------------------------------------------------------ *
 * Focus-preset easing (pure).
 * ------------------------------------------------------------------ */

export interface FocusEaseState {
  readonly phase: 'idle' | 'focusing';
  /** Preset being flown to; null when idle. */
  readonly presetId: string | null;
  readonly eraId: EraId | null;
  /** Eased progress 0..1 (1 after a completed flight, 0 before start). */
  readonly progress: number;
  /** Seconds elapsed in the current flight. */
  readonly elapsed: number;
  /** Seconds of the current flight; null when idle. */
  readonly duration: number | null;
  readonly from: CameraState;
  readonly to: CameraState;
}

/**
 * Eased camera flight toward a viewpoint preset. Pure state machine — it never
 * touches a camera; `sample()` returns the interpolated view and `NavigationCore`
 * applies it. `progress` follows `easeInOutCubic` so flights ease-in, glide and
 * settle exactly on the preset target.
 */
export class FocusEase {
  private phase: 'idle' | 'focusing' = 'idle';
  private presetId: string | null = null;
  private eraId: EraId | null = null;
  private readonly fromPosition = new Vector3();
  private readonly fromTarget = new Vector3();
  private readonly toPosition = new Vector3();
  private readonly toTarget = new Vector3();
  private elapsed = 0;
  private duration = 1;
  private lastProgress = 0;

  get isActive(): boolean {
    return this.phase === 'focusing';
  }

  get progress(): number {
    return this.lastProgress;
  }

  get state(): FocusEaseState {
    return {
      phase: this.phase,
      presetId: this.presetId,
      eraId: this.eraId,
      progress: this.lastProgress,
      elapsed: this.elapsed,
      duration: this.phase === 'focusing' ? this.duration : null,
      from: { position: this.fromPosition.clone(), target: this.fromTarget.clone() },
      to: { position: this.toPosition.clone(), target: this.toTarget.clone() },
    };
  }

  /** Begin (or restart) a flight from `from` toward the preset's view. */
  start(preset: EraViewpointPreset, from: CameraState): void {
    this.presetId = preset.id;
    this.eraId = preset.eraId;
    this.duration = Math.max(0.001, preset.moveDurationSeconds);
    this.fromPosition.set(from.position.x, from.position.y, from.position.z);
    this.fromTarget.set(from.target.x, from.target.y, from.target.z);
    this.toPosition.set(preset.position.x, preset.position.y, preset.position.z);
    this.toTarget.set(preset.target.x, preset.target.y, preset.target.z);
    this.elapsed = 0;
    this.lastProgress = 0;
    this.phase = 'focusing';
  }

  /** Stop the flight. Returns to the idle state. */
  cancel(): void {
    this.phase = 'idle';
    this.presetId = null;
    this.eraId = null;
    this.elapsed = 0;
    this.lastProgress = 0;
  }

  /** Advance the flight clock. Returns true while still focusing. */
  update(deltaSeconds: number): boolean {
    if (this.phase !== 'focusing') return false;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return true;
    this.elapsed += deltaSeconds;
    const raw = Math.min(1, this.elapsed / this.duration);
    this.lastProgress = easeInOutCubic(raw);
    if (raw >= 1) {
      this.phase = 'idle';
      this.lastProgress = 1;
      return false;
    }
    return true;
  }

  /** Current eased camera state; idle returns the flight destination. */
  sample(): CameraState {
    const t = this.phase === 'focusing' ? this.lastProgress : 1;
    return {
      position: new Vector3().lerpVectors(this.fromPosition, this.toPosition, t),
      target: new Vector3().lerpVectors(this.fromTarget, this.toTarget, t),
    };
  }
}

/* ------------------------------------------------------------------ *
 * Pure procedural navigation controller (headless-testable).
 * ------------------------------------------------------------------ */

/** Input surface a control source (real DOM wiring or a test hook) uses. */
export interface NavigationControlHook {
  /** Spin the camera around its look-at point (azimuth, polar), radians. */
  rotate(deltaTheta: number, deltaPhi: number): void;
  /** Slide the view along the camera's right/up axes (world meters). */
  pan(deltaX: number, deltaY: number): void;
  /** Dolly toward (multiplier < 1) or away from (multiplier > 1) the target. */
  zoom(multiplier: number): void;
}

export interface NavigationCoreOptions {
  camera?: PerspectiveCamera;
  limits?: NavigationLimits;
}

/**
 * Headless camera controller: orbit/pan/zoom with damping, limits and preset
 * flights. Works with a plain three.js perspective camera in Node and never
 * touches the DOM. The browser OrbitControls wiring and Node tests both drive
 * it through `NavigationControlHook` inputs.
 */
export class NavigationCore implements NavigationControlHook {
  camera: PerspectiveCamera;
  limits: NavigationLimits;
  readonly focus = new FocusEase();

  private readonly currentTarget = new Vector3(0, 0, 0);
  private pendingRotateTheta = 0;
  private pendingRotatePhi = 0;
  private pendingPanX = 0;
  private pendingPanY = 0;
  private pendingZoomLog = 0;
  private disposed = false;

  constructor(options: NavigationCoreOptions = {}) {
    this.camera = options.camera ?? createDefaultCamera();
    this.limits = options.limits ?? DEFAULT_NAVIGATION_LIMITS;
  }

  get state(): CameraState {
    return {
      position: this.camera.position.clone(),
      target: this.currentTarget.clone(),
    };
  }

  /** The controller's look-at point as a plain vector. */
  get targetView(): Vec3 {
    return { x: this.currentTarget.x, y: this.currentTarget.y, z: this.currentTarget.z };
  }

  /** Rebind the controller to another camera (used by NavigationAPI.attach). */
  bindCamera(camera: PerspectiveCamera): void {
    this.camera = camera;
  }

  /** Adopt an externally managed look-at point (used to sync OrbitControls). */
  syncTarget(target: Vec3): void {
    this.currentTarget.set(target.x, target.y, target.z);
  }

  rotate(deltaTheta: number, deltaPhi: number): void {
    this.assertActive();
    this.focus.cancel();
    this.pendingRotateTheta += deltaTheta * this.limits.rotateSpeed;
    this.pendingRotatePhi += deltaPhi * this.limits.rotateSpeed;
  }

  pan(deltaX: number, deltaY: number): void {
    this.assertActive();
    this.focus.cancel();
    this.pendingPanX += deltaX * this.limits.panSpeed;
    this.pendingPanY += deltaY * this.limits.panSpeed;
  }

  zoom(multiplier: number): void {
    this.assertActive();
    if (!Number.isFinite(multiplier) || multiplier <= 0) return;
    this.focus.cancel();
    this.pendingZoomLog += Math.log(multiplier) * this.limits.zoomSpeed;
  }

  /** Start an eased flight to a preset, retargeting smoothly mid-flight. */
  focusPreset(preset: EraViewpointPreset): void {
    this.assertActive();
    const from = this.focus.isActive ? this.focus.sample() : this.state;
    this.focus.start(preset, from);
  }

  cancelFocus(): void {
    this.focus.cancel();
  }

  /**
   * Advance one frame: a preset flight, or damped application of pending
   * orbit/pan/zoom input, followed by limit/polar/distance clamping.
   */
  update(deltaSeconds: number): void {
    if (this.disposed) return;
    if (this.focus.isActive) {
      this.focus.update(deltaSeconds);
      const view = this.focus.sample();
      this.camera.position.set(view.position.x, view.position.y, view.position.z);
      this.currentTarget.set(view.target.x, view.target.y, view.target.z);
      this.camera.lookAt(this.currentTarget);
      return;
    }
    const fraction = this.dampingFraction(deltaSeconds);
    if (fraction > 0) {
      this.applyPendingInput(fraction);
    }
    this.clampView();
    this.camera.lookAt(this.currentTarget);
  }

  dispose(): void {
    this.disposed = true;
    this.focus.cancel();
  }

  /** Frame-rate-normalized fraction of the remaining input applied this frame. */
  private dampingFraction(deltaSeconds: number): number {
    const damping = this.limits.dampingFactor;
    if (damping <= 0) return 1;
    const seconds = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    return Math.min(1, damping * 60 * seconds);
  }

  private applyPendingInput(fraction: number): void {
    const deltaTheta = this.pendingRotateTheta * fraction;
    const deltaPhi = this.pendingRotatePhi * fraction;
    this.pendingRotateTheta -= deltaTheta;
    this.pendingRotatePhi -= deltaPhi;
    if (deltaTheta !== 0 || deltaPhi !== 0) this.orbitBy(deltaTheta, deltaPhi);

    const panX = this.pendingPanX * fraction;
    const panY = this.pendingPanY * fraction;
    this.pendingPanX -= panX;
    this.pendingPanY -= panY;
    if (panX !== 0 || panY !== 0) this.panBy(panX, panY);

    const zoomLog = this.pendingZoomLog * fraction;
    this.pendingZoomLog -= zoomLog;
    if (zoomLog !== 0) this.zoomBy(Math.exp(zoomLog));
  }

  private orbitBy(deltaTheta: number, deltaPhi: number): void {
    const offset = this.camera.position.clone().sub(this.currentTarget);
    const radius = offset.length();
    if (radius < 1e-6) return;
    const phi = Math.acos(clamp(offset.y / radius, -1, 1));
    const theta = Math.atan2(offset.x, offset.z);
    this.setOrbit(radius, phi - deltaPhi, theta - deltaTheta);
  }

  private setOrbit(radius: number, phi: number, theta: number): void {
    const { limits } = this;
    const clampedPhi = clamp(phi, limits.minPolarAngle, limits.maxPolarAngle);
    let clampedTheta = theta;
    if (Number.isFinite(limits.minAzimuthAngle) && Number.isFinite(limits.maxAzimuthAngle)) {
      clampedTheta = clamp(theta, limits.minAzimuthAngle, limits.maxAzimuthAngle);
    }
    const offset = new Vector3(
      radius * Math.sin(clampedPhi) * Math.sin(clampedTheta),
      radius * Math.cos(clampedPhi),
      radius * Math.sin(clampedPhi) * Math.cos(clampedTheta),
    );
    this.camera.position.copy(this.currentTarget).add(offset);
  }

  private panBy(worldX: number, worldY: number): void {
    const forward = this.currentTarget.clone().sub(this.camera.position);
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    const worldUp = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(forward, worldUp);
    if (right.lengthSq() < 1e-6) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }
    const up = new Vector3().crossVectors(right, forward).normalize();
    this.camera.position.addScaledVector(right, worldX).addScaledVector(up, worldY);
    this.currentTarget.addScaledVector(right, worldX).addScaledVector(up, worldY);
  }

  private zoomBy(multiplier: number): void {
    if (multiplier === 1) return;
    const offset = this.camera.position.clone().sub(this.currentTarget);
    const radius = offset.length();
    if (radius < 1e-6) return;
    offset.setLength(clamp(radius * multiplier, this.limits.minDistance, this.limits.maxDistance));
    this.camera.position.copy(this.currentTarget).add(offset);
  }

  /** Enforce all limits on the settled camera view. */
  private clampView(): void {
    const { limits } = this;
    const tx = clamp(this.currentTarget.x, PAN_BOUNDS.minX, PAN_BOUNDS.maxX);
    const ty = clamp(this.currentTarget.y, limits.minTargetY, limits.maxTargetY);
    const tz = clamp(this.currentTarget.z, PAN_BOUNDS.minZ, PAN_BOUNDS.maxZ);
    this.camera.position.x += tx - this.currentTarget.x;
    this.camera.position.y += ty - this.currentTarget.y;
    this.camera.position.z += tz - this.currentTarget.z;
    this.currentTarget.set(tx, ty, tz);

    const offset = this.camera.position.clone().sub(this.currentTarget);
    const rawRadius = offset.length();
    if (rawRadius < 1e-6) return;
    const radius = clamp(rawRadius, limits.minDistance, limits.maxDistance);
    const phi = clamp(
      Math.acos(clamp(offset.y / rawRadius, -1, 1)),
      limits.minPolarAngle,
      limits.maxPolarAngle,
    );
    let theta = Math.atan2(offset.x, offset.z);
    if (Number.isFinite(limits.minAzimuthAngle) && Number.isFinite(limits.maxAzimuthAngle)) {
      theta = clamp(theta, limits.minAzimuthAngle, limits.maxAzimuthAngle);
    }
    const clamped = new Vector3(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    );
    this.camera.position.copy(this.currentTarget).add(clamped);
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error('NavigationCore has been disposed and can no longer be used');
    }
  }
}

/* ------------------------------------------------------------------ *
 * Public facade: NavigationAPI.
 * ------------------------------------------------------------------ */

export interface NavigationOptions {
  /** Camera bound immediately (optional; attach() can bind later). */
  camera?: PerspectiveCamera;
  /** Baseline limits/damping config (defaults to DEFAULT_NAVIGATION_LIMITS). */
  limits?: Partial<NavigationLimits>;
  /** Era assumed active before the first applyEra (defaults to 1945). */
  initialEra?: EraId | null;
  /** Input hook rotate/pan/zoom are forwarded to (defaults to the core). */
  controlHook?: NavigationControlHook;
}

/**
 * Navigation for the city block. Headless by default (`attach(camera)` binds a
 * camera only); passing a DOM element also wires browser-only OrbitControls
 * with damping, distance/polar limits, pan and zoom.
 */
export class NavigationAPI {
  /** Pure controller driving the bound camera (public for tests/programmatic use). */
  readonly core: NavigationCore;
  /** Input surface for rotate/pan/zoom (injectable). */
  readonly hook: NavigationControlHook;

  private controls: OrbitControls | null = null;
  private domCleanup: Array<() => void> = [];
  private blendFrom: NavigationScaleProfile | null = null;
  private lastEra: EraId | null = null;
  private lastProgress = -1;
  private activeEra: EraId | null;
  private disposed = false;

  constructor(options: NavigationOptions = {}) {
    const limits = resolveLimits(options.limits);
    this.core = new NavigationCore({ camera: options.camera, limits });
    this.hook = options.controlHook ?? this.core;
    this.activeEra = options.initialEra === undefined ? 1945 : options.initialEra;
    if (this.activeEra !== null) {
      const profile = getEraNavigationProfile(this.activeEra);
      this.core.limits = {
        ...limits,
        minDistance: profile.minDistance,
        maxDistance: profile.maxDistance,
        dampingFactor: profile.dampingFactor,
      };
      this.blendFrom = profile;
      this.lastEra = this.activeEra;
    }
  }

  get limits(): NavigationLimits {
    return this.core.limits;
  }

  get state(): CameraState {
    return this.core.state;
  }

  get isEasing(): boolean {
    return this.core.focus.isActive;
  }

  get activeEraId(): EraId | null {
    return this.activeEra;
  }

  get flight(): FocusEaseState {
    return this.core.focus.state;
  }

  /**
   * Bind a camera and, when `domEl` is given, wire browser-only OrbitControls
   * (damping, distance/polar limits, pan and zoom) to the DOM element. Without
   * a DOM element this is the headless mode exercised by the Node tests.
   */
  attach(camera: PerspectiveCamera, domEl?: HTMLElement | null): void {
    this.assertNotDisposed();
    this.core.bindCamera(camera);
    if (domEl) {
      void this.wireDomControls(domEl);
    }
  }

  /**
   * Adopt era-aware navigation limits/damping as the timeline transitions.
   * `progress` is the eased transition progress 0..1 (from the era system's
   * era-transition events); limits blend toward the destination era's profile.
   * The camera is never moved by era selection itself.
   */
  applyEra(eraId: EraId, progress: number): void {
    this.assertNotDisposed();
    if (!isEraId(eraId)) {
      throw new Error(`applyEra: unknown era ${String(eraId)}; known eras: ${ERA_IDS.join(', ')}`);
    }
    const t = clamp01(progress);
    const targetProfile = getEraNavigationProfile(eraId);
    const restarted = this.lastEra !== eraId || t < this.lastProgress;
    if (this.blendFrom === null || restarted) {
      this.blendFrom = scaleProfileFromLimits(this.core.limits);
    }
    this.lastEra = eraId;
    this.lastProgress = t;
    this.activeEra = eraId;

    this.core.limits = resolveLimits({
      ...this.core.limits,
      minDistance: lerp(this.blendFrom.minDistance, targetProfile.minDistance, t),
      maxDistance: lerp(this.blendFrom.maxDistance, targetProfile.maxDistance, t),
      dampingFactor: lerp(this.blendFrom.dampingFactor, targetProfile.dampingFactor, t),
    });
    if (t >= 1) {
      this.blendFrom = targetProfile;
    }

    if (this.controls) {
      this.controls.dampingFactor = this.core.limits.dampingFactor;
      this.controls.minDistance = this.core.limits.minDistance;
      this.controls.maxDistance = this.core.limits.maxDistance;
    }
  }

  /** Ease the camera to the era's curated viewpoint preset. */
  focusPreset(eraId: EraId): void {
    this.assertNotDisposed();
    const preset = getEraViewpointPreset(eraId);
    if (this.controls) {
      // Adopt the live OrbitControls view so the flight starts from reality.
      const target = this.controls.target;
      this.core.syncTarget({ x: target.x, y: target.y, z: target.z });
    }
    this.core.focusPreset(preset);
  }

  /** Advance one frame: flights, damping and (in the browser) OrbitControls. */
  update(deltaSeconds: number): void {
    if (this.disposed) return;
    if (this.controls) {
      if (this.isEasing) {
        this.core.update(deltaSeconds);
        const target = this.core.targetView;
        this.controls.target.set(target.x, target.y, target.z);
        this.controls.update(deltaSeconds);
      } else {
        this.controls.update(deltaSeconds);
      }
      return;
    }
    this.core.update(deltaSeconds);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.core.dispose();
    for (const cleanup of this.domCleanup) cleanup();
    this.domCleanup = [];
    if (this.controls) {
      try {
        this.controls.dispose();
      } catch {
        /* finalizer errors must never break teardown */
      }
      this.controls = null;
    }
  }

  /** Lazily load and wire OrbitControls so Node never evaluates it. */
  private async wireDomControls(domEl: HTMLElement): Promise<void> {
    try {
      const { OrbitControls: OrbitControlsCtor } = await import(
        'three/examples/jsm/controls/OrbitControls.js'
      );
      if (this.disposed) return;
      if (this.controls) {
        try {
          this.controls.dispose();
        } catch {
          /* replace stale controls */
        }
      }
      const controls = new OrbitControlsCtor(this.core.camera, domEl);
      controls.enableDamping = true;
      controls.dampingFactor = this.core.limits.dampingFactor;
      controls.minDistance = this.core.limits.minDistance;
      controls.maxDistance = this.core.limits.maxDistance;
      controls.minPolarAngle = this.core.limits.minPolarAngle;
      controls.maxPolarAngle = this.core.limits.maxPolarAngle;
      if (Number.isFinite(this.core.limits.minAzimuthAngle)) {
        controls.minAzimuthAngle = this.core.limits.minAzimuthAngle;
      }
      if (Number.isFinite(this.core.limits.maxAzimuthAngle)) {
        controls.maxAzimuthAngle = this.core.limits.maxAzimuthAngle;
      }
      controls.rotateSpeed = this.core.limits.rotateSpeed;
      controls.panSpeed = this.core.limits.panSpeed;
      controls.zoomSpeed = this.core.limits.zoomSpeed;
      controls.screenSpacePanning = false;

      // Any user interaction interrupts an in-flight preset easing.
      const interrupt = (): void => this.core.cancelFocus();
      domEl.addEventListener('pointerdown', interrupt);
      domEl.addEventListener('touchstart', interrupt, { passive: true });
      domEl.addEventListener('wheel', interrupt, { passive: true });
      this.domCleanup.push(
        () => domEl.removeEventListener('pointerdown', interrupt),
        () => domEl.removeEventListener('touchstart', interrupt),
        () => domEl.removeEventListener('wheel', interrupt),
      );
      this.controls = controls;
    } catch (error) {
      // Browser-only wiring: if OrbitControls cannot load in this environment,
      // the pure NavigationCore keeps navigation functional headlessly.
      console.warn('[navigation] OrbitControls unavailable; using headless core navigation.', error);
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('NavigationAPI has been disposed and can no longer be used');
    }
  }
}