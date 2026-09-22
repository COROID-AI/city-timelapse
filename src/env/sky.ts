/**
 * Procedural era sky — a shader-generated gradient dome with sun disc/halo and
 * hash-sparkle stars, plus the per-era sky/sun state tables and blend math.
 *
 * Everything visual here is generated on the GPU from uniforms: no HDRIs, no
 * downloaded textures, no cube-map probes. A `SkyState` is plain blendable data
 * so `src/env/atmosphere.ts` can crossfade sky, sun, light, fog, and weather
 * with one shared era blend value and no popping.
 *
 * Day and night tables exist for every era so the atmosphere module can offer
 * a 1985 smog-orange neon-night option (and quieter nights for the other years)
 * by crossfading `SKY_DAY_STATES[year] -> SKY_NIGHT_STATES[year]`.
 */

import * as THREE from 'three';
import type { EraYear } from '../era/timeline';

/** Complete, blendable description of the sky for one era at one time option. */
export interface SkyState {
  /** Color at the top of the dome (sooty gray in 1945, crisp blue in 2005). */
  zenith: THREE.Color;
  /** Horizon/haze band color — carries the soot, warm smog, and smog-orange tints. */
  horizon: THREE.Color;
  /** Below-horizon ground bounce color. */
  ground: THREE.Color;
  /** Sun (or moon) disc core color. */
  sunCore: THREE.Color;
  /** Sun halo/scatter color. */
  sunHalo: THREE.Color;
  /** Disc/halo brightness multiplier (~0.2 hazy night .. ~1.2 clear day). */
  sunIntensity: number;
  /** Sun/moon elevation in degrees above the horizon; also drives the key light. */
  sunElevationDeg: number;
  /** Sun azimuth in degrees (0 = +Z, 90 = +X). */
  sunAzimuthDeg: number;
  /** Procedural star sparkle strength (0 by day; smog suppresses it at night). */
  starOpacity: number;
}

/**
 * Daylight sky per era:
 * - 1945 sooty warm haze under a low, dimmed coal-smoke sun;
 * - 1965 warm sunlight over a mild smog band;
 * - 1985 smog-orange horizon under muted gray-blue;
 * - 2005 crisp deep blue with clean white sun;
 * - 2025 clear sky with green-tinged daylight.
 */
export const SKY_DAY_STATES: Readonly<Record<EraYear, SkyState>> = Object.freeze({
  1945: {
    zenith: new THREE.Color('#8d8676'),
    horizon: new THREE.Color('#c0a077'),
    ground: new THREE.Color('#6b6154'),
    sunCore: new THREE.Color('#ffdca6'),
    sunHalo: new THREE.Color('#caa472'),
    sunIntensity: 0.7,
    sunElevationDeg: 24,
    sunAzimuthDeg: 128,
    starOpacity: 0,
  },
  1965: {
    zenith: new THREE.Color('#79aed9'),
    horizon: new THREE.Color('#f0cda0'),
    ground: new THREE.Color('#8a8272'),
    sunCore: new THREE.Color('#ffe8bd'),
    sunHalo: new THREE.Color('#ffd79c'),
    sunIntensity: 1.0,
    sunElevationDeg: 42,
    sunAzimuthDeg: 118,
    starOpacity: 0,
  },
  1985: {
    zenith: new THREE.Color('#7e93a9'),
    horizon: new THREE.Color('#e08d55'),
    ground: new THREE.Color('#7a6a5c'),
    sunCore: new THREE.Color('#ffcf9a'),
    sunHalo: new THREE.Color('#dd9a63'),
    sunIntensity: 0.85,
    sunElevationDeg: 33,
    sunAzimuthDeg: 140,
    starOpacity: 0,
  },
  2005: {
    zenith: new THREE.Color('#3d7cc8'),
    horizon: new THREE.Color('#cfe3f2'),
    ground: new THREE.Color('#93a2ab'),
    sunCore: new THREE.Color('#ffffff'),
    sunHalo: new THREE.Color('#e9f3ff'),
    sunIntensity: 1.15,
    sunElevationDeg: 54,
    sunAzimuthDeg: 110,
    starOpacity: 0,
  },
  2025: {
    zenith: new THREE.Color('#4590d2'),
    horizon: new THREE.Color('#d6efe2'),
    ground: new THREE.Color('#8fa598'),
    sunCore: new THREE.Color('#f7fffb'),
    sunHalo: new THREE.Color('#e0fff2'),
    sunIntensity: 1.2,
    sunElevationDeg: 60,
    sunAzimuthDeg: 104,
    starOpacity: 0,
  },
}) as Readonly<Record<EraYear, SkyState>>;

/**
 * Night sky per era (the "neon night option"):
 * - 1945 sooty night — city smoke dims stars to a faint smudge;
 * - 1965 mild smog night with a warm/dusky band;
 * - 1985 smog-orange horizon glow from signage and streetlights;
 * - 2005 clean cool night with visible stars;
 * - 2025 clear teal night, stars slightly veiled by high atmosphere.
 */
export const SKY_NIGHT_STATES: Readonly<Record<EraYear, SkyState>> = Object.freeze({
  1945: {
    zenith: new THREE.Color('#131217'),
    horizon: new THREE.Color('#4a3624'),
    ground: new THREE.Color('#171410'),
    sunCore: new THREE.Color('#d5dae6'),
    sunHalo: new THREE.Color('#7d7a76'),
    sunIntensity: 0.22,
    sunElevationDeg: 46,
    sunAzimuthDeg: 96,
    starOpacity: 0.12,
  },
  1965: {
    zenith: new THREE.Color('#0b1428'),
    horizon: new THREE.Color('#493d4f'),
    ground: new THREE.Color('#15151c'),
    sunCore: new THREE.Color('#ccd8ee'),
    sunHalo: new THREE.Color('#6f7fa0'),
    sunIntensity: 0.3,
    sunElevationDeg: 50,
    sunAzimuthDeg: 88,
    starOpacity: 0.35,
  },
  1985: {
    zenith: new THREE.Color('#090f1f'),
    horizon: new THREE.Color('#e06f33'),
    ground: new THREE.Color('#16121a'),
    sunCore: new THREE.Color('#c3cee2'),
    sunHalo: new THREE.Color('#b4764f'),
    sunIntensity: 0.28,
    sunElevationDeg: 48,
    sunAzimuthDeg: 84,
    starOpacity: 0.05,
  },
  2005: {
    zenith: new THREE.Color('#061228'),
    horizon: new THREE.Color('#2a4468'),
    ground: new THREE.Color('#11161d'),
    sunCore: new THREE.Color('#dfe8f7'),
    sunHalo: new THREE.Color('#7f95b8'),
    sunIntensity: 0.4,
    sunElevationDeg: 52,
    sunAzimuthDeg: 80,
    starOpacity: 0.6,
  },
  2025: {
    zenith: new THREE.Color('#06182c'),
    horizon: new THREE.Color('#235067'),
    ground: new THREE.Color('#101a1c'),
    sunCore: new THREE.Color('#e6f2f5'),
    sunHalo: new THREE.Color('#86a8bd'),
    sunIntensity: 0.42,
    sunElevationDeg: 54,
    sunAzimuthDeg: 78,
    starOpacity: 0.5,
  },
}) as Readonly<Record<EraYear, SkyState>>;

/** Allocate an empty working sky state (used as a lerp target). */
export function createSkyState(): SkyState {
  return {
    zenith: new THREE.Color(0, 0, 0),
    horizon: new THREE.Color(0, 0, 0),
    ground: new THREE.Color(0, 0, 0),
    sunCore: new THREE.Color(0, 0, 0),
    sunHalo: new THREE.Color(0, 0, 0),
    sunIntensity: 0,
    sunElevationDeg: 0,
    sunAzimuthDeg: 0,
    starOpacity: 0,
  };
}

/** Copy `source` into `target` and return `target`. */
export function copySkyState(source: SkyState, target: SkyState): SkyState {
  target.zenith.copy(source.zenith);
  target.horizon.copy(source.horizon);
  target.ground.copy(source.ground);
  target.sunCore.copy(source.sunCore);
  target.sunHalo.copy(source.sunHalo);
  target.sunIntensity = source.sunIntensity;
  target.sunElevationDeg = source.sunElevationDeg;
  target.sunAzimuthDeg = source.sunAzimuthDeg;
  target.starOpacity = source.starOpacity;
  return target;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Blend two sky states into `target` (allocates a state when no target is
 * given). Angles blend linearly — with a continuous era fraction this produces
 * a smooth sun arc with no discrete jumps.
 */
export function lerpSkyState(a: SkyState, b: SkyState, t: number, target: SkyState = createSkyState()): SkyState {
  const k = clamp01(t);
  target.zenith.lerpColors(a.zenith, b.zenith, k);
  target.horizon.lerpColors(a.horizon, b.horizon, k);
  target.ground.lerpColors(a.ground, b.ground, k);
  target.sunCore.lerpColors(a.sunCore, b.sunCore, k);
  target.sunHalo.lerpColors(a.sunHalo, b.sunHalo, k);
  target.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k;
  target.sunElevationDeg = a.sunElevationDeg + (b.sunElevationDeg - a.sunElevationDeg) * k;
  target.sunAzimuthDeg = a.sunAzimuthDeg + (b.sunAzimuthDeg - a.sunAzimuthDeg) * k;
  target.starOpacity = a.starOpacity + (b.starOpacity - a.starOpacity) * k;
  return target;
}

/**
 * Unit vector from the city toward the sun/moon for a sky state. The same
 * direction drives the sky disc, the halo, and the scene's key light, so
 * shadows always match the visible sun.
 */
export function sunDirection(state: SkyState, target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
  const elevation = THREE.MathUtils.degToRad(state.sunElevationDeg);
  const azimuth = THREE.MathUtils.degToRad(state.sunAzimuthDeg);
  const cosElevation = Math.cos(elevation);
  return target
    .set(cosElevation * Math.cos(azimuth), Math.sin(elevation), cosElevation * Math.sin(azimuth))
    .normalize();
}

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vSkyDirection;

void main() {
  vSkyDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunCore;
uniform vec3 uSunHalo;
uniform vec3 uSunDirection;
uniform float uSunIntensity;
uniform float uStarOpacity;

varying vec3 vSkyDirection;

float skyHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 dir = normalize(vSkyDirection);
  float height = clamp(dir.y, -1.0, 1.0);

  vec3 color;
  if (height >= 0.0) {
    float t = pow(clamp(height, 0.0, 1.0), 0.55);
    color = mix(uHorizon, uZenith, t);
  } else {
    color = mix(uHorizon, uGround, pow(clamp(-height, 0.0, 1.0), 0.5));
  }

  // Haze/smog layer hugging the horizon: carries the sooty, warm, and
  // smog-orange bands without any texture lookup.
  float haze = pow(1.0 - clamp(abs(height) * 2.4, 0.0, 1.0), 2.0);
  color = mix(color, uHorizon, haze * 0.45);

  // Sun disc plus wide halo scatter.
  float sunDot = clamp(dot(dir, normalize(uSunDirection)), 0.0, 1.0);
  float disc = smoothstep(0.99935, 0.99965, sunDot);
  float halo = pow(sunDot, 120.0) * 0.65 + pow(sunDot, 9.0) * 0.16;
  color += (uSunCore * disc * 2.5 + uSunHalo * halo) * uSunIntensity;

  // Procedural stars: one hash per sky cell, suppressed by smog at night.
  if (uStarOpacity > 0.001) {
    vec3 cell = floor(dir * 180.0);
    float star = step(0.9975, skyHash(cell));
    float twinkle = 0.55 + 0.45 * skyHash(cell + 11.0);
    float above = smoothstep(0.02, 0.3, height);
    color += vec3(0.8, 0.86, 1.0) * star * twinkle * uStarOpacity * above;
  }

  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** A live sky dome in the scene graph. */
export interface SkyDome {
  /** Dome mesh; add it to the scene once (rendered first, never writes depth). */
  readonly mesh: THREE.Mesh;
  /** Gradient/sun/star shader material. */
  readonly material: THREE.ShaderMaterial;
  /** Dome radius in world units. */
  readonly radius: number;
  /** Push a sky state into the shader uniforms (cheap; call every blend frame). */
  apply(state: SkyState): void;
  /** Free GPU resources and detach the dome from its parent. */
  dispose(): void;
}

/**
 * Build the procedural sky dome. The dome renders before all opaque geometry
 * with depth writes/tests disabled, acting as the scene background while the
 * city always draws over it. The fragment shader blends linearly into the
 * renderer's tone mapping and color-space output so the sky matches lit
 * materials exactly (including through the bloom composer path).
 */
export function createSkyDome(radius: number = 460): SkyDome {
  const uniforms = {
    uZenith: { value: new THREE.Color(0, 0, 0) },
    uHorizon: { value: new THREE.Color(0, 0, 0) },
    uGround: { value: new THREE.Color(0, 0, 0) },
    uSunCore: { value: new THREE.Color(0, 0, 0) },
    uSunHalo: { value: new THREE.Color(0, 0, 0) },
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uSunIntensity: { value: 1 },
    uStarOpacity: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    name: 'atmosphereSkyMaterial',
    uniforms,
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });

  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'atmosphereSkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  return {
    mesh,
    material,
    radius,
    apply(state: SkyState): void {
      (uniforms.uZenith.value as THREE.Color).copy(state.zenith);
      (uniforms.uHorizon.value as THREE.Color).copy(state.horizon);
      (uniforms.uGround.value as THREE.Color).copy(state.ground);
      (uniforms.uSunCore.value as THREE.Color).copy(state.sunCore);
      (uniforms.uSunHalo.value as THREE.Color).copy(state.sunHalo);
      uniforms.uSunIntensity.value = Math.max(0, state.sunIntensity);
      uniforms.uStarOpacity.value = clamp01(state.starOpacity);
      sunDirection(state, uniforms.uSunDirection.value);
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}
