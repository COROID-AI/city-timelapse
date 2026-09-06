/**
 * Era atmosphere factory — city-timelapse.
 *
 * Defines per-era sky/fog colors, sun position, ambient/sun lighting, tone
 * mapping/exposure, and mood (clear 1945 sepia -> smoggy 60s/80s -> clean
 * blue 2005/2025) as a procedural gradient sky dome + light rig.
 *
 * Lifecycle: `atmosphereFactory({ scene, camera, renderer })` bootstraps the
 * light rig and procedural sky for all five eras and registers the
 * `EraDefinition.atmosphere` segment on `eraRegistry` (runtime fill only — no
 * shared foundation file is modified). `update(year)` starts a smooth
 * crossfade to the target era's sky/lighting, `tick(now)` advances that
 * crossfade each frame (call it from the animation loop), and `dispose()`
 * tears everything down.
 */
import * as THREE from 'three';
import { eraRegistry } from '../data/eraRegistry';
import type { EraKey } from '../data/eraDefinition';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-era atmosphere target descriptor. */
export interface EraAtmosphere {
  year: EraKey;
  /** Top of sky gradient (zenith). */
  skyTop: number;
  /** Horizon band of the sky gradient (also drives fog). */
  skyHorizon: number;
  /** Scene fog color (smog/haze). */
  fogColor: number;
  /** Fog density for the era (0 = clear, higher = smoggy). */
  fogDensity: number;
  /** Sun elevation in degrees above horizon. */
  sunElevation: number;
  /** Sun azimuth in degrees. */
  sunAzimuth: number;
  /** Ambient / hemisphere intensity. */
  ambientIntensity: number;
  /** Hemisphere sky color (upper light). */
  hemiSky: number;
  /** Hemisphere ground color (bounce). */
  hemiGround: number;
  /** Sun (directional) intensity. */
  sunIntensity: number;
  /** Sun light color (warmth). */
  sunColor: number;
  /** THREE tone mapping curve for the era. */
  toneMapping: THREE.ToneMapping;
  /** Renderer exposure. */
  exposure: number;
  /** Film grain amount applied to the sky (0 = clean modern). */
  grain: number;
  /** Sepia strength (0 = none, 1 = strong warm sepia). */
  sepia: number;
  /** Weather/mood descriptor used for the registered segment. */
  mood: string;
}

/** Required inputs for the atmosphere factory. */
export interface AtmosphereContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

/** The handle returned by `atmosphereFactory`. */
export interface AtmosphereHandle {
  /** Root group holding the light rig (added to the scene once). */
  readonly group: THREE.Group;
  /** Currently displayed era. */
  readonly currentYear: EraKey;
  /** Start a smooth crossfade to `year` (lifecycle `update`). */
  update(year: EraKey): void;
  /** Advance the active crossfade by the given elapsed time (seconds). */
  tick(deltaSeconds: number): void;
  /** Remove the rig from the scene and clear the registered segment. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Per-era atmosphere targets
// ---------------------------------------------------------------------------

const ERA_ATMOSPHERES: Record<EraKey, EraAtmosphere> = {
  1945: {
    year: 1945,
    skyTop: 0xa8a094,
    skyHorizon: 0xd6cdb8,
    fogColor: 0xc9c2b0,
    fogDensity: 0.0016,
    sunElevation: 26,
    sunAzimuth: 128,
    ambientIntensity: 0.55,
    hemiSky: 0xf5e6d0,
    hemiGround: 0x8a7f6d,
    sunIntensity: 1.9,
    sunColor: 0xffdfa8,
    toneMapping: THREE.ReinhardToneMapping,
    exposure: 1.05,
    grain: 0.35,
    sepia: 0.55,
    mood: 'clear warm sepia morning',
  },
  1965: {
    year: 1965,
    skyTop: 0x8fa6bd,
    skyHorizon: 0xb9b7ac,
    fogColor: 0xa7a69c,
    fogDensity: 0.0045,
    sunElevation: 55,
    sunAzimuth: 145,
    ambientIntensity: 0.5,
    hemiSky: 0xcfe0ee,
    hemiGround: 0x8d8b84,
    sunIntensity: 1.4,
    sunColor: 0xfff0d0,
    toneMapping: THREE.ReinhardToneMapping,
    exposure: 0.95,
    grain: 0.22,
    sepia: 0.25,
    mood: 'smoggy mid-century grey-blue',
  },
  1985: {
    year: 1985,
    skyTop: 0x6f8ca6,
    skyHorizon: 0xa09882,
    fogColor: 0x948b74,
    fogDensity: 0.0055,
    sunElevation: 48,
    sunAzimuth: 160,
    ambientIntensity: 0.48,
    hemiSky: 0xe6cfae,
    hemiGround: 0x6f6f6e,
    sunIntensity: 1.3,
    sunColor: 0xffe0b0,
    toneMapping: THREE.ReinhardToneMapping,
    exposure: 0.9,
    grain: 0.2,
    sepia: 0.18,
    mood: 'dense urban smog with sodium haze',
  },
  2005: {
    year: 2005,
    skyTop: 0x3f7fbf,
    skyHorizon: 0x9fc3e0,
    fogColor: 0xb8d6ea,
    fogDensity: 0.0012,
    sunElevation: 62,
    sunAzimuth: 175,
    ambientIntensity: 0.45,
    hemiSky: 0xcfe8f8,
    hemiGround: 0x5f5f5e,
    sunIntensity: 1.7,
    sunColor: 0xffffff,
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 0.82,
    grain: 0.08,
    sepia: 0,
    mood: 'clear bright modern blue',
  },
  2025: {
    year: 2025,
    skyTop: 0x2f6cb0,
    skyHorizon: 0xa8cbe8,
    fogColor: 0xc4def0,
    fogDensity: 0.0009,
    sunElevation: 68,
    sunAzimuth: 190,
    ambientIntensity: 0.42,
    hemiSky: 0xcfe8fa,
    hemiGround: 0x4f4f4e,
    sunIntensity: 1.8,
    sunColor: 0xf3f9ff,
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 0.78,
    grain: 0.02,
    sepia: 0,
    mood: 'crisp clean contemporary blue',
  },
};

const ERA_KEYS: readonly EraKey[] = [1945, 1965, 1985, 2005, 2025];

const DEG2RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Procedural gradient sky
// ---------------------------------------------------------------------------

/**
 * Draw a procedural gradient sky with a sun glow onto a fresh canvas.
 * (No downloaded HDRIs — pure canvas generation.)
 */
function paintSky(target: EraAtmosphere): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  // Vertical gradient from zenith to horizon.
  const top = new THREE.Color(target.skyTop);
  const horizon = new THREE.Color(target.skyHorizon);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(1, `#${horizon.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Film grain / smog noise overlay (scaled by era grain + sepia tint).
  if (target.grain > 0 || target.sepia > 0) {
    const noise = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < noise.data.length; i += 4) {
      const g = (Math.random() * 2 - 1) * 28 * target.grain;
      const y = Math.floor(i / 4 / canvas.width);
      const u = y / canvas.height;
      // Bloom noise more toward horizon (smog) and add a warm sepia cast.
      const sep = target.sepia;
      noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = 0;
      noise.data[i] += g;
      noise.data[i + 1] += g * 0.9 + sep * 12 * u;
      noise.data[i + 2] += g * 0.6 + sep * 4 * u;
      noise.data[i + 3] = Math.min(255, (target.grain * 0.55 + u * 0.35 + sep * 0.25) * 90);
    }
    ctx.putImageData(noise, 0, 0);
  }

  // Sun glow positioned from elevation/azimuth.
  const sunX = canvas.width * (0.5 + Math.cos((target.sunAzimuth * DEG2RAD) * 0.9) * 0.22);
  const sunY = canvas.height * (0.72 - (target.sunElevation / 90) * 0.9);
  const sunColor = new THREE.Color(target.sunColor);
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 90);
  sunGlow.addColorStop(0, `rgba(255,255,255,0.65)`);
  sunGlow.addColorStop(0.25, `rgba(${(sunColor.r * 255) | 0},${(sunColor.g * 255) | 0},${(sunColor.b * 255) | 0},0.35)`);
  sunGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Bootstrap the per-era atmosphere (light rig + procedural sky) for all five
 * eras and return a lifecycle handle.
 *
 * - Registers the `EraDefinition.atmosphere` segment on `eraRegistry` for
 *   each year (runtime fill — shared foundation files are untouched).
 * - Adds the light rig group to `scene` and owns the sky background window.
 * - `update(year)` starts a crossfade; call `tick(delta)` each frame to ease
 *   sky colors, fog, sun, ambient and exposure so era switches never flash.
 */
export function atmosphereFactory(ctx: AtmosphereContext): AtmosphereHandle {
  const { scene, renderer } = ctx;
  const root = new THREE.Group();
  let currentYear: EraKey = 1945;

  // Light rig.
  const ambient = new THREE.AmbientLight(0xffffff, 1);
  root.add(ambient);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7a7a7a, 1);
  hemi.position.set(0, 20, 0);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 0);
  root.add(sun);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.visible = true;
    }
  });

  // Procedural sky dome (BackSide sphere carrying the painted gradient).
  const skyCanvas = paintSky(ERA_ATMOSPHERES[1945]);
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    fog: false,
    toneMapped: true,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 12), skyMaterial);
  skyDome.renderOrder = -1;
  scene.add(skyDome);

  // Fog (linear). Near/far are derived from each era's density; when an era
  // is clear, far is pushed out so fog is effectively absent (no flash).
  const fog = new THREE.Fog(0xc9c2b0, 1, 2000);
  scene.fog = fog;

  // Runtime current values (what is actually applied to the scene objects),
  // used as the "from" source when a new transition starts.
  const current: EraAtmosphere & { fogEnabled: boolean } = {
    ...ERA_ATMOSPHERES[1945],
    fogEnabled: ERA_ATMOSPHERES[1945].fogDensity > 0,
  };
  let to: EraAtmosphere = ERA_ATMOSPHERES[1945];
  let from: EraAtmosphere = ERA_ATMOSPHERES[1945];
  let transitionStart = -1;
  const TRANSITION_DURATION = 900; // ms

  /** Register the atmosphere segment for every era (runtime fill). */
  for (const year of ERA_KEYS) {
    const at = ERA_ATMOSPHERES[year];
    (eraRegistry[year] as unknown as Record<string, unknown>).atmosphere = {
      skyTop: `#${new THREE.Color(at.skyTop).getHexString()}`,
      skyHorizon: `#${new THREE.Color(at.skyHorizon).getHexString()}`,
      fogColor: `#${new THREE.Color(at.fogColor).getHexString()}`,
      fogDensity: at.fogDensity,
      sunElevation: at.sunElevation,
      sunAzimuth: at.sunAzimuth,
      ambientIntensity: at.ambientIntensity,
      hemiSky: `#${new THREE.Color(at.hemiSky).getHexString()}`,
      hemiGround: `#${new THREE.Color(at.hemiGround).getHexString()}`,
      sunIntensity: at.sunIntensity,
      sunColor: `#${new THREE.Color(at.sunColor).getHexString()}`,
      toneMapping: at.toneMapping,
      exposure: at.exposure,
      grain: at.grain,
      sepia: at.sepia,
      mood: at.mood,
    };
  }

  /** Interpolate between two atmosphere descriptors at t∈[0,1]. */
  function blend(a: EraAtmosphere, b: EraAtmosphere, t: number): EraAtmosphere {
    // For toneMapping/exposure we snap to the destination (avoid interpolating
    // between curves); everything color/numeric lerps smoothly.
    const lerp = (x: number, y: number) => x + (y - x) * t;
    const lerpColor = (x: number, y: number): number => {
      const c = new THREE.Color(x).lerp(new THREE.Color(y), t);
      return c.getHex();
    };
    return {
      year: b.year,
      skyTop: lerpColor(a.skyTop, b.skyTop),
      skyHorizon: lerpColor(a.skyHorizon, b.skyHorizon),
      fogColor: lerpColor(a.fogColor, b.fogColor),
      fogDensity: lerp(a.fogDensity, b.fogDensity),
      sunElevation: lerp(a.sunElevation, b.sunElevation),
      sunAzimuth: lerp(a.sunAzimuth, b.sunAzimuth),
      ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity),
      hemiSky: lerpColor(a.hemiSky, b.hemiSky),
      hemiGround: lerpColor(a.hemiGround, b.hemiGround),
      sunIntensity: lerp(a.sunIntensity, b.sunIntensity),
      sunColor: lerpColor(a.sunColor, b.sunColor),
      toneMapping: b.toneMapping,
      exposure: lerp(a.exposure, b.exposure),
      grain: lerp(a.grain, b.grain),
      sepia: lerp(a.sepia, b.sepia),
      mood: b.mood,
    };
  }

  /** Apply a descriptor snapshot to the actual scene objects. */
  function apply(at: EraAtmosphere): void {
    // Sky gradient + sun glow redrawn on the shared canvas each transition step.
    const canvas = paintSky(at);
    (skyTexture.image as HTMLCanvasElement) = canvas;
    skyTexture.needsUpdate = true;

    // Fog: reuse a linear Fog; near/far derived from density.
    const expNear = 12 + 8 * (at.fogDensity * 400);
    const expFar = 90 + 40 * (1 - at.fogDensity * 400);
    const fogCol = new THREE.Color(at.fogColor);
    fog.color.copy(fogCol);
    fog.near = expNear;
    fog.far = expFar;

    // Lights.
    const el = at.sunElevation * DEG2RAD;
    const az = at.sunAzimuth * DEG2RAD;
    const r = 30;
    sun.position.set(
      r * Math.cos(el) * Math.cos(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.sin(az),
    );
    sun.intensity = at.sunIntensity;
    sun.color.setHex(at.sunColor);

    hemi.intensity = at.ambientIntensity;
    hemi.color.setHex(at.hemiSky);
    hemi.groundColor.setHex(at.hemiGround);

    ambient.intensity = at.ambientIntensity * 0.8;
    const warmOverlay = new THREE.Color('#ffffff').lerp(new THREE.Color('#ffd9a0'), at.sepia);
    ambient.color.copy(warmOverlay);

    // Renderer tone mapping + exposure.
    renderer.toneMapping = at.toneMapping;
    renderer.toneMappingExposure = at.exposure;
  }

  // Apply the initial era fully (no transition flash).
  apply(ERA_ATMOSPHERES[1945]);

  /** Local tweaks that never cause a white/black flash. */
  const handle: AtmosphereHandle = {
    group: root,
    get currentYear() {
      return currentYear;
    },
    update(year: EraKey): void {
      if (year === currentYear) {
        return;
      }
      const target = ERA_ATMOSPHERES[year];
      from = { ...current };
      to = target;
      transitionStart = nowMs();
      currentYear = year;
    },
    tick(deltaSeconds: number): void {
      if (transitionStart < 0) {
        return;
      }
      const elapsed = nowMs() - transitionStart;
      const tRaw = Math.min(1, elapsed / TRANSITION_DURATION);
      const t = easeInOut(tRaw);
      if (t >= 1) {
        apply(to);
        Object.assign(current, to);
        transitionStart = -1;
        return;
      }
      const blended = blend(from, to, t);
      apply(blended);
      Object.assign(current, blended);
      void deltaSeconds;
    },
    dispose(): void {
      scene.remove(root);
      scene.remove(sun.target);
      scene.remove(skyDome);
      skyDome.geometry.dispose();
      skyMaterial.dispose();
      skyTexture.dispose();
      scene.fog = null;
      for (const year of ERA_KEYS) {
        delete (eraRegistry[year] as unknown as Record<string, unknown>).atmosphere;
      }
    },
  };

  return handle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowMs(): number {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}