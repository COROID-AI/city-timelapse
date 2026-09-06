/**
 * Era color grading + film grain — city-timelapse post-processing.
 *
 * This module owns the per-era "look": warm sepia (1945), saturated pop
 * (1965), teal-magenta (1985), neutral (2005), crisp HDR (2025). It exposes a
 * single custom ShaderPass that applies color grade + animated film grain +
 * vignette in one full-screen pass, and lerps its uniforms across the same
 * ~0.8s eased window the scene morph uses so the grade follows the era
 * crossfade.
 *
 * Lifecycle: `bootstrap()` (enable the pass), `update(year, progress, delta)`
 * (start a grade transition and advance it each frame), `dispose()`.
 *
 * The `PostPipeline` in `pipeline.ts` owns the EffectComposer and inserts
 * this module's `pass`; this module is intentionally render-loop-agnostic so
 * it can be unit-tested / reused independently.
 */
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { EraKey } from '../data/eraDefinition';

// ===========================================================================
// Per-era grade targets
// ===========================================================================

/**
 * Per-era color grade descriptor. All fields are lerped smoothly between the
 * outgoing and incoming era during the morph window.
 */
export interface EraGrade {
  year: EraKey;
  /** Warm sepia strength: 0 (none) -> 1 (strong). */
  sepia: number;
  /** Color saturation: 1 = neutral, >1 = pop, <1 = muted. */
  saturation: number;
  /** Contrast multiplier around mid-grey. */
  contrast: number;
  /** Overall brightness multiplier (per-era exposure compensation). */
  brightness: number;
  /** Teal-magenta push (r,g,b) added after grading (1985 style). */
  tint: [number, number, number];
  /** Animated film grain strength: 0 (none) -> ~0.5 (heavy). */
  grain: number;
  /** Vignette falloff amount: 0 (none) -> 1 (heavy). */
  vignette: number;
  /** Bloom luminance threshold (era light sources glow above this). */
  bloomThreshold: number;
  /** Bloom strength. */
  bloomStrength: number;
  /** Bloom blur radius (px). */
  bloomRadius: number;
  /** Whether the era enables the optional SSAO-lite pass. */
  ssao: boolean;
  /** Human-readable look label (used by QA / debug). */
  label: string;
}

/** The five era grade targets, keyed by year. */
export const ERA_GRADES: Record<EraKey, EraGrade> = {
  1945: {
    year: 1945,
    sepia: 0.55,
    saturation: 0.82,
    contrast: 1.05,
    brightness: 1.0,
    tint: [0.02, 0.0, -0.01],
    grain: 0.42,
    vignette: 0.38,
    bloomThreshold: 0.72,
    bloomStrength: 0.55,
    bloomRadius: 0.55,
    ssao: false,
    label: 'warm sepia',
  },
  1965: {
    year: 1965,
    sepia: 0.2,
    saturation: 1.28,
    contrast: 1.1,
    brightness: 1.0,
    tint: [0.01, 0.0, 0.0],
    grain: 0.28,
    vignette: 0.28,
    bloomThreshold: 0.55,
    bloomStrength: 0.95,
    bloomRadius: 0.7,
    ssao: false,
    label: 'saturated pop',
  },
  1985: {
    year: 1985,
    sepia: 0.04,
    saturation: 1.12,
    contrast: 1.12,
    brightness: 0.98,
    tint: [0.02, 0.0, 0.03],
    grain: 0.22,
    vignette: 0.3,
    bloomThreshold: 0.45,
    bloomStrength: 1.2,
    bloomRadius: 0.85,
    ssao: false,
    label: 'teal-magenta',
  },
  2005: {
    year: 2005,
    sepia: 0.0,
    saturation: 1.0,
    contrast: 1.04,
    brightness: 1.0,
    tint: [0.0, 0.0, 0.0],
    grain: 0.08,
    vignette: 0.16,
    bloomThreshold: 0.6,
    bloomStrength: 0.8,
    bloomRadius: 0.6,
    ssao: false,
    label: 'neutral',
  },
  2025: {
    year: 2025,
    sepia: 0.0,
    saturation: 1.05,
    contrast: 1.14,
    brightness: 1.06,
    tint: [0.0, 0.0, 0.0],
    grain: 0.02,
    vignette: 0.12,
    bloomThreshold: 0.5,
    bloomStrength: 1.0,
    bloomRadius: 0.7,
    ssao: true,
    label: 'crisp HDR',
  },
};

/** Chronological era order. */
export const POSTFX_ERA_KEYS: readonly EraKey[] = [1945, 1965, 1985, 2005, 2025];

// ===========================================================================
// Custom grade + grain + vignette shader
// ===========================================================================

const GradeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GradeFragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uSepia;
  uniform float uSaturation;
  uniform float uContrast;
  uniform float uBrightness;
  uniform vec3 uTint;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 col = texel.rgb;

    // Color saturation.
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSaturation);

    // Contrast around mid grey.
    col = (col - 0.5) * uContrast + 0.5;

    // Brightness (per-era exposure compensation).
    col *= uBrightness;

    // Warm sepia blend.
    vec3 sepia = vec3(
      dot(col, vec3(0.393, 0.769, 0.189)),
      dot(col, vec3(0.349, 0.686, 0.168)),
      dot(col, vec3(0.272, 0.534, 0.131))
    );
    col = mix(col, sepia, uSepia);

    // Teal-magenta push.
    col += uTint;

    // Animated film grain (spatial + temporal noise).
    float g = (noise2(vUv * uResolution * 0.32 + vec2(uTime * 1.7, uTime * 1.3)) - 0.5);
    col += g * uGrain;

    // Vignette.
    vec2 d = vUv - 0.5;
    float dist = length(d);
    col *= 1.0 - uVignette * smoothstep(0.3, 0.85, dist);

    gl_FragColor = vec4(col, texel.a);
  }
`;

// ===========================================================================
// EraGrading
// ===========================================================================

/** The grade shader definition consumed by ShaderPass. */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSepia: { value: 0.55 },
    uSaturation: { value: 0.82 },
    uContrast: { value: 1.05 },
    uBrightness: { value: 1.0 },
    uTint: { value: new THREE.Vector3(0.02, 0.0, -0.01) },
    uGrain: { value: 0.42 },
    uVignette: { value: 0.38 },
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: GradeVertexShader,
  fragmentShader: GradeFragmentShader,
};

/** The handle returned by the EraGrading lifecycle. */
export interface EraGradingHandle {
  /** The ShaderPass the PostPipeline inserts into the composer. */
  readonly pass: ShaderPass;
  /** The currently displayed grade (updates immediately on switch). */
  readonly currentYear: EraKey;
  /** Enable the pass and initialise uniforms. */
  bootstrap(): void;
  /**
   * Start (and advance) a grade transition. `progress` is the eased morph
   * progress in [0,1]; `deltaSeconds` advances the animated grain time.
   */
  update(year: EraKey, progress: number, deltaSeconds: number): void;
  /** Resize the grain noise resolution (called from the pipeline). */
  setSize(width: number, height: number): void;
  /** Dispose the pass material. */
  dispose(): void;
}

/**
 * EraGrading — owns the grade/grain/vignette pass and lerps its uniforms
 * between the outgoing and incoming era grade across the morph window.
 */
export class EraGrading implements EraGradingHandle {
  readonly pass: ShaderPass;
  private era: EraKey = 1945;
  private from: EraGrade = ERA_GRADES[1945];
  private to: EraGrade = ERA_GRADES[1945];
  private time = 0;

  constructor() {
    this.pass = new ShaderPass(GradeShader);
    this.pass.enabled = false;
  }

  get currentYear(): EraKey {
    return this.era;
  }

  bootstrap(): void {
    this.pass.enabled = true;
    this.applyBlend(1);
  }

  update(year: EraKey, progress: number, deltaSeconds: number): void {
    this.time += deltaSeconds;
    if (year !== this.era) {
      this.from = this.to;
      this.to = ERA_GRADES[year];
      this.era = year;
    }
    this.applyBlend(progress);
  }

  setSize(width: number, height: number): void {
    const u = this.pass.uniforms;
    (u.uResolution.value as THREE.Vector2).set(width, height);
  }

  dispose(): void {
    this.pass.enabled = false;
    this.pass.dispose();
  }

  /** Lerp every grade uniform from `from` to `to` at eased `t`. */
  private applyBlend(t: number): void {
    const p = Math.max(0, Math.min(1, t));
    const u = this.pass.uniforms;
    const f = this.from;
    const to = this.to;
    const lerp = (a: number, b: number) => a + (b - a) * p;
    u.uSepia.value = lerp(f.sepia, to.sepia);
    u.uSaturation.value = lerp(f.saturation, to.saturation);
    u.uContrast.value = lerp(f.contrast, to.contrast);
    u.uBrightness.value = lerp(f.brightness, to.brightness);
    (u.uTint.value as THREE.Vector3).set(
      lerp(f.tint[0], to.tint[0]),
      lerp(f.tint[1], to.tint[1]),
      lerp(f.tint[2], to.tint[2]),
    );
    u.uGrain.value = lerp(f.grain, to.grain);
    u.uVignette.value = lerp(f.vignette, to.vignette);
    u.uTime.value = this.time;
  }
}