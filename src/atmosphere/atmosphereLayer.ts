/**
 * atmosphereLayer.ts — per-era atmosphere and lighting layer (1945–2025).
 *
 * Owned by t07-atmosphere-lighting. Reads the era registry (`src/eras`) and
 * the headless runtime contract (`src/core/sceneRuntime`) READ-ONLY and never
 * mutates those modules — all period knowledge lives in the era definitions.
 *
 * What this layer owns:
 *  - A procedural light rig: ambient fill, hemisphere light (sky/ground
 *    bounce) and a directional sun whose elevation + warmth come from the era.
 *  - Scene-level sky tint (`scene.background`) and exponential fog, both
 *    driven by each era's palette/atmosphere data.
 *  - A code-only post-processing controller: bloom strength/threshold, tone
 *    mapping theme and vignette, all derived per era. The integration
 *    (t11-app-integration) wires the parameter snapshot into the real WebGL
 *    post pipeline; this module ships the effect GLSL so nothing depends on an
 *    external post-processing package.
 *
 * Public lifecycle:
 *  - `attach(group?)`        — register the light rig into the scene graph.
 *  - `applyEra(eraId, progress?)` — lerp sky, fog, lighting and post-process
 *    parameters toward an era; progress is the eased 0..1 blend (driven by
 *    EraSystem `era-transition` events or a slider).
 *  - `update(frameState)`    — per-frame application of the current blended
 *    parameters (SceneLayer hook; idempotent).
 *  - `dispose()`             — remove the rig and clear scene effects.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Object3D,
  Scene,
  Vector3,
} from 'three';

import { type FrameState, type SceneLayer } from '../core/sceneRuntime';
import {
  ERA_IDS,
  getEraDefinition,
  type EraAtmosphere,
  type EraDefinition,
  type EraId,
  type EraPalette,
} from '../eras/eraSystem';

/** SceneLayer id used by AtmosphereLayer and the SceneRuntime registration. */
export const ATMOSPHERE_LAYER_ID = 'atmosphere';

const DEFAULT_INITIAL_ERA: EraId = 1945;
/** Distance of the directional sun from the block centre. */
const SUN_DISTANCE = 260;

/* ------------------------------------------------------------------ *
 * Post-processing data contract
 * ------------------------------------------------------------------ */

/** Tone mapping character selected per era theme. */
export type ToneMappingTheme =
  | 'muted'
  | 'bright-clean'
  | 'neon-noir'
  | 'soft-haze'
  | 'crisp-led';

/** Vignette style selected per era theme. */
export type VignetteStyle = 'subtle' | 'soft' | 'cinematic';

/** Derived post-processing parameters for one era (or a blend of two). */
export interface PostProcessingParams {
  /** Bloom / glow strength 0..1 (high for neon 1985 and LED 2025). */
  readonly bloomStrength: number;
  /** Luminance threshold above which bright pixels bloom 0..1. */
  readonly bloomThreshold: number;
  readonly toneMapping: ToneMappingTheme;
  /** Post exposure, ~0.6..1.25. */
  readonly exposure: number;
  /** Colour saturation 0..1 (from the era atmosphere). */
  readonly saturation: number;
  /** Contrast, ~0.5..1.6 (from the era atmosphere). */
  readonly contrast: number;
  readonly vignette: VignetteStyle;
  /** Vignette darkness 0..1. */
  readonly vignetteStrength: number;
  /** Vignette tint (darkened era sky). */
  readonly vignetteColor: string;
}

/**
 * Full per-era atmosphere parameter vector. Every field is derived
 * deterministically from an `EraDefinition` (plus procedural per-era sun
 * azimuth); `applyEra` lerps between two of these vectors.
 */
export interface AtmosphereParams {
  /** Sky tint at the era's default time of day (palette.sky). */
  readonly skyColor: string;
  /** Horizon haze tint (palette.haze). */
  readonly hazeColor: string;
  readonly fogColor: string;
  readonly fogDensity: number;
  /** Sun elevation above the horizon in degrees (atmosphere data). */
  readonly sunElevationDeg: number;
  /** Procedural per-era sun azimuth in degrees. */
  readonly sunAzimuthDeg: number;
  readonly sunIntensity: number;
  /** Sun warmth tint (atmosphere.sunColor). */
  readonly sunColor: string;
  readonly ambientIntensity: number;
  readonly ambientColor: string;
  /** Hemisphere light top (sky) colour — matches the ambient sky tint. */
  readonly hemisphereSkyColor: string;
  /** Hemisphere light bottom (ground bounce) colour. */
  readonly hemisphereGroundColor: string;
  readonly hemisphereIntensity: number;
  readonly post: PostProcessingParams;
}

/** Minimal GLSL uniform snapshot sent to the post-processing pipeline. */
export interface PostProcessingUniforms {
  readonly uBloomStrength: number;
  readonly uBloomThreshold: number;
  readonly uExposure: number;
  readonly uSaturation: number;
  readonly uContrast: number;
  readonly uVignetteStrength: number;
  readonly uVignetteColor: [number, number, number];
}

/** Vertex + fragment shader pair for one post-processing pass. */
export interface PostProcessingShaderSet {
  readonly vertexShader: string;
  readonly fragmentShader: string;
}

/* ------------------------------------------------------------------ *
 * Small numeric / colour helpers (deterministic, headless-safe).
 * ------------------------------------------------------------------ */

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Returns `#rrggbb` lowercase form of any three.js colour representation. */
function normalizeHex(color: string): string {
  return `#${new Color(color).getHexString()}`;
}

/** Darkens a hex colour by a 0..1 factor (used for vignette tinting). */
export function darkenHex(color: string, factor: number): string {
  const c = new Color(color).multiplyScalar(clamp01(factor));
  return `#${c.getHexString()}`;
}

/** Interpolates two hex colours, returning `#rrggbb`. */
function lerpHex(from: string, to: string, t: number): string {
  const c = new Color(from).lerp(new Color(to), clamp01(t));
  return `#${c.getHexString()}`;
}

/** Unit direction of the sun from elevation/azimuth in degrees. */
export function sunDirection(elevationDeg: number, azimuthDeg: number): Vector3 {
  const elevation = (elevationDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  return new Vector3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.sin(azimuth),
  ).normalize();
}

/* ------------------------------------------------------------------ *
 * Per-era derivation
 * ------------------------------------------------------------------ */

interface PostTheme {
  readonly toneMapping: ToneMappingTheme;
  readonly vignette: VignetteStyle;
  readonly vignetteStrength: number;
}

/**
 * Chooses the tone mapping / vignette theme from the era's atmosphere data:
 * night is neon-noir with a cinematic vignette, haze is soft, LED-day is
 * crisp, post-war dusk is muted, everything else is bright-clean.
 */
function pickPostTheme(atmo: EraAtmosphere): PostTheme {
  if (atmo.timeOfDay === 'night') {
    return { toneMapping: 'neon-noir', vignette: 'cinematic', vignetteStrength: 0.55 };
  }
  if (atmo.weather === 'hazy') {
    return { toneMapping: 'soft-haze', vignette: 'soft', vignetteStrength: 0.26 };
  }
  if (atmo.lightTechnology === 'led') {
    return { toneMapping: 'crisp-led', vignette: 'subtle', vignetteStrength: 0.14 };
  }
  if (atmo.timeOfDay === 'dusk') {
    return { toneMapping: 'muted', vignette: 'soft', vignetteStrength: 0.34 };
  }
  return { toneMapping: 'bright-clean', vignette: 'subtle', vignetteStrength: 0.1 };
}

/** Derives the post-processing vector for one era's atmosphere/palette. */
export function derivePostProcessingParams(
  atmo: EraAtmosphere,
  palette: EraPalette,
): PostProcessingParams {
  const bloom = clamp01(atmo.bloom);
  const theme = pickPostTheme(atmo);
  return {
    bloomStrength: bloom,
    // Bright neon-era scenes bloom earlier; daylight scenes keep a high bar.
    bloomThreshold: clamp(0.9 - bloom * 0.65, 0.2, 0.9),
    toneMapping: theme.toneMapping,
    exposure: clamp(0.7 + atmo.ambientIntensity * 0.32 + atmo.sunIntensity * 0.12, 0.6, 1.25),
    saturation: clamp01(atmo.saturation),
    contrast: clamp(atmo.contrast, 0.5, 1.6),
    vignette: theme.vignette,
    vignetteStrength: clamp01(theme.vignetteStrength),
    vignetteColor: darkenHex(palette.sky, 0.55),
  };
}

/**
 * Derives the complete atmosphere parameter vector for an era definition.
 * Sky/fog/haze tints, sun elevation + warmth, ambient/hemisphere light and
 * post-processing bloom/tone-map/vignette are all deterministic functions of
 * the era data (plus a procedural per-era sun azimuth).
 */
export function deriveAtmosphereParams(era: EraDefinition): AtmosphereParams {
  const atmo = era.atmosphere;
  const palette = era.palette;
  const sunAzimuthDeg = 90 + ERA_IDS.indexOf(era.id) * 45;
  return {
    skyColor: normalizeHex(palette.sky),
    hazeColor: normalizeHex(palette.haze),
    fogColor: normalizeHex(atmo.fogColor),
    fogDensity: clamp01(atmo.fogDensity),
    sunElevationDeg: atmo.sunElevationDeg,
    sunAzimuthDeg,
    sunIntensity: atmo.sunIntensity,
    sunColor: normalizeHex(atmo.sunColor),
    ambientIntensity: clamp01(atmo.ambientIntensity),
    ambientColor: normalizeHex(atmo.ambientColor),
    hemisphereSkyColor: normalizeHex(atmo.ambientColor),
    hemisphereGroundColor: normalizeHex(palette.ground),
    hemisphereIntensity: clamp(atmo.ambientIntensity * 0.9 + atmo.sunIntensity * 0.1, 0.1, 1),
    post: derivePostProcessingParams(atmo, palette),
  };
}

function clonePostParams(params: PostProcessingParams): PostProcessingParams {
  return { ...params };
}

function cloneAtmosphereParams(params: AtmosphereParams): AtmosphereParams {
  return { ...params, post: clonePostParams(params.post) };
}

/** Lerps two post-processing parameter vectors by t in [0,1]. */
export function lerpPostProcessingParams(
  from: PostProcessingParams,
  to: PostProcessingParams,
  t: number,
): PostProcessingParams {
  const p = clamp01(t);
  return {
    bloomStrength: from.bloomStrength + (to.bloomStrength - from.bloomStrength) * p,
    bloomThreshold: from.bloomThreshold + (to.bloomThreshold - from.bloomThreshold) * p,
    toneMapping: p < 0.5 ? from.toneMapping : to.toneMapping,
    exposure: from.exposure + (to.exposure - from.exposure) * p,
    saturation: from.saturation + (to.saturation - from.saturation) * p,
    contrast: from.contrast + (to.contrast - from.contrast) * p,
    vignette: p < 0.5 ? from.vignette : to.vignette,
    vignetteStrength: from.vignetteStrength + (to.vignetteStrength - from.vignetteStrength) * p,
    vignetteColor: lerpHex(from.vignetteColor, to.vignetteColor, p),
  };
}

/**
 * Lerps two per-era atmosphere parameter vectors by t in [0,1]. `applyEra`
 * uses this as the scene's blended state while an era transition runs.
 */
export function lerpAtmosphereParams(
  from: AtmosphereParams,
  to: AtmosphereParams,
  t: number,
): AtmosphereParams {
  const p = clamp01(t);
  return {
    skyColor: lerpHex(from.skyColor, to.skyColor, p),
    hazeColor: lerpHex(from.hazeColor, to.hazeColor, p),
    fogColor: lerpHex(from.fogColor, to.fogColor, p),
    fogDensity: from.fogDensity + (to.fogDensity - from.fogDensity) * p,
    sunElevationDeg: from.sunElevationDeg + (to.sunElevationDeg - from.sunElevationDeg) * p,
    sunAzimuthDeg: from.sunAzimuthDeg + (to.sunAzimuthDeg - from.sunAzimuthDeg) * p,
    sunIntensity: from.sunIntensity + (to.sunIntensity - from.sunIntensity) * p,
    sunColor: lerpHex(from.sunColor, to.sunColor, p),
    ambientIntensity: from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * p,
    ambientColor: lerpHex(from.ambientColor, to.ambientColor, p),
    hemisphereSkyColor: lerpHex(from.hemisphereSkyColor, to.hemisphereSkyColor, p),
    hemisphereGroundColor: lerpHex(from.hemisphereGroundColor, to.hemisphereGroundColor, p),
    hemisphereIntensity: from.hemisphereIntensity + (to.hemisphereIntensity - from.hemisphereIntensity) * p,
    post: lerpPostProcessingParams(from.post, to.post, p),
  };
}

/* ------------------------------------------------------------------ *
 * Post-processing shaders (code-only WebGL effects, no packages).
 * ------------------------------------------------------------------ */

const POST_VERTEX_SHADER = `\
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/**
 * Bright-pass extraction shader for the bloom pre-pass: pixels above the era
 * luminance threshold are scaled by bloom strength and exposed.
 */
export function buildBrightPassShader(params: PostProcessingParams): string {
  return `\
// Bright-pass extraction (bloom) — theme: ${params.toneMapping}
precision highp float;
uniform sampler2D uScene;
uniform float uBloomStrength;
uniform float uBloomThreshold;
uniform float uExposure;
varying vec2 vUv;

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec3 color = texture2D(uScene, vUv).rgb * uExposure;
  float l = luminance(color);
  float amount = smoothstep(uBloomThreshold, uBloomThreshold + 0.2, l);
  gl_FragColor = vec4(color * amount * uBloomStrength, 1.0);
}
`;
}

/**
 * Composite shader: additive bloom, filmic tone mapping, saturation/contrast
 * grade and a themed vignette.
 */
export function buildCompositeShader(params: PostProcessingParams): string {
  return `\
// Composite — tone mapping: ${params.toneMapping}, vignette: ${params.vignette}
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignetteStrength;
uniform vec3 uVignetteColor;
varying vec2 vUv;

vec3 filmic(vec3 x) {
  vec3 a = max(vec3(0.0), x - vec3(0.004));
  return (a * (6.2 * a + 0.5)) / (a * (6.2 * a + 1.7) + 0.06);
}

vec3 gradeSaturation(vec3 color, float sat) {
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), color, sat);
}

void main() {
  vec2 uv = vUv;
  vec3 color = texture2D(uScene, uv).rgb * uExposure;
  color += texture2D(uBloom, uv).rgb;
  color = filmic(color);
  color = gradeSaturation(color, uSaturation);
  color = (color - 0.5) * uContrast + 0.5;
  float d = distance(uv, vec2(0.5));
  float vignette = 1.0 - smoothstep(0.25, 0.85, d) * uVignetteStrength;
  color = mix(uVignetteColor, color, vignette);
  gl_FragColor = vec4(color, 1.0);
}
`;
}

/**
 * Procedural post-processing controller. Holds the current per-era parameter
 * snapshot, produces the GLSL uniform values for the render pipeline and
 * builds the code-only bright-pass / composite shader pair.
 */
export class PostProcessingController {
  private params: PostProcessingParams;

  constructor(params: PostProcessingParams) {
    this.params = clonePostParams(params);
  }

  /** Read-only copy of the current post-processing parameters. */
  get snapshot(): PostProcessingParams {
    return clonePostParams(this.params);
  }

  /** Replace the parameters (used when an era change lands). */
  configure(params: PostProcessingParams): void {
    this.params = clonePostParams(params);
  }

  /** GLSL uniform values matching the current parameters. */
  toUniforms(): PostProcessingUniforms {
    const vignette = new Color(this.params.vignetteColor);
    return {
      uBloomStrength: this.params.bloomStrength,
      uBloomThreshold: this.params.bloomThreshold,
      uExposure: this.params.exposure,
      uSaturation: this.params.saturation,
      uContrast: this.params.contrast,
      uVignetteStrength: this.params.vignetteStrength,
      uVignetteColor: [vignette.r, vignette.g, vignette.b],
    };
  }

  /** Bloom bright-pass shader set. */
  get brightPass(): PostProcessingShaderSet {
    return { vertexShader: POST_VERTEX_SHADER, fragmentShader: buildBrightPassShader(this.params) };
  }

  /** Filmic tone mapping + vignette composite shader set. */
  get composite(): PostProcessingShaderSet {
    return { vertexShader: POST_VERTEX_SHADER, fragmentShader: buildCompositeShader(this.params) };
  }
}

/* ------------------------------------------------------------------ *
 * AtmosphereLayer
 * ------------------------------------------------------------------ */

/** Constructor options for `AtmosphereLayer`. */
export interface AtmosphereLayerOptions {
  /**
   * Scene receiving sky/background and fog. When using `SceneRuntime` pass
   * the runtime scene (e.g. `{ scene: runtime.scene }`); when omitted the
   * layer falls back to its own scene or adopts the scene its rig is added to.
   */
  readonly scene?: Scene;
  /** Era applied at construction (and on `attach`). Default 1945. */
  readonly initialEra?: EraId;
}

/** Read-only snapshot of the layer's transition state. */
export interface AtmosphereLayerState {
  /** Era the layer is settled on (blend source while transitioning). */
  readonly eraId: EraId;
  /** Destination era during a tween; null when settled. */
  readonly target: EraId | null;
  /** Eased blend progress 0..1; 1 when settled. */
  readonly progress: number;
  readonly transitioning: boolean;
  /** Current blended atmosphere parameters (what is applied to the scene). */
  readonly params: AtmosphereParams;
}

/** The procedural light rig owned by the layer. */
export interface LightingControllers {
  readonly ambient: AmbientLight;
  readonly hemisphere: HemisphereLight;
  readonly sun: DirectionalLight;
}

/** Walks up the object graph to the owning Scene, or null. */
function resolveSceneRoot(node: Object3D): Scene | null {
  let current: Object3D | null = node;
  while (current !== null) {
    if (current instanceof Scene) return current;
    current = current.parent;
  }
  return null;
}

/**
 * Era-driven atmosphere and lighting layer.
 *
 * Attach the layer to a group (or to the runtime scene directly) to register
 * the procedural light rig into the scene graph; `applyEra(id, progress)`
 * lerps sky tint, fog, sun elevation/warmth, ambient/hemisphere light and the
 * post-processing vector; `update()` refreshes it every frame; `dispose()`
 * removes the rig and clears scene background/fog.
 */
export class AtmosphereLayer implements SceneLayer {
  readonly id = ATMOSPHERE_LAYER_ID;

  private _scene: Scene;
  private readonly sceneExplicit: boolean;
  private readonly rig = new Group();
  private readonly ambient: AmbientLight;
  private readonly hemisphere: HemisphereLight;
  private readonly sun: DirectionalLight;
  private readonly postController: PostProcessingController;
  private currentParams: AtmosphereParams;
  private settledEra: EraId;
  private targetEra: EraId | null = null;
  private progress = 1;
  private fromParams: AtmosphereParams | null = null;
  private fog: FogExp2 | null = null;
  private disposed = false;

  constructor(options: AtmosphereLayerOptions = {}) {
    this._scene = options.scene ?? new Scene();
    this.sceneExplicit = options.scene !== undefined;
    this.settledEra = options.initialEra ?? DEFAULT_INITIAL_ERA;
    this.currentParams = deriveAtmosphereParams(getEraDefinition(this.settledEra));

    this.ambient = new AmbientLight(
      this.currentParams.ambientColor,
      this.currentParams.ambientIntensity,
    );
    this.hemisphere = new HemisphereLight(
      this.currentParams.hemisphereSkyColor,
      this.currentParams.hemisphereGroundColor,
      this.currentParams.hemisphereIntensity,
    );
    this.sun = new DirectionalLight(this.currentParams.sunColor, this.currentParams.sunIntensity);
    this.applySunOrientation(this.currentParams);

    this.rig.name = 'atmosphere:light-rig';
    // The directional light's target must be in the graph for matrix updates.
    this.rig.add(this.ambient, this.hemisphere, this.sun, this.sun.target);

    this.postController = new PostProcessingController(this.currentParams.post);
  }

  /** The scene this layer drives (background + fog). */
  get scene(): Scene {
    return this._scene;
  }

  /** The procedural light rig controllers. */
  get controllers(): LightingControllers {
    return { ambient: this.ambient, hemisphere: this.hemisphere, sun: this.sun };
  }

  /** Current post-processing parameter snapshot. */
  get postProcessing(): PostProcessingParams {
    return this.postController.snapshot;
  }

  /** Read-only snapshot of the layer's transition state. */
  getState(): AtmosphereLayerState {
    return {
      eraId: this.settledEra,
      target: this.targetEra,
      progress: this.progress,
      transitioning: this.targetEra !== null && this.progress < 1,
      params: cloneAtmosphereParams(this.currentParams),
    };
  }

  /**
   * Register the light rig into the scene graph. With no argument the rig is
   * added to the layer's scene; passing a group (or scene) targets that host.
   * Idempotent — re-attaching just re-parents the rig.
   */
  attach(group?: Object3D): this {
    this.assertAlive();
    this.adoptSceneIfNeeded();
    const host = group ?? this._scene;
    if (this.rig.parent !== host) {
      if (this.rig.parent) this.rig.parent.remove(this.rig);
      host.add(this.rig);
    }
    this.applyCurrentToScene();
    return this;
  }

  /** SceneLayer hook: the rig used by `SceneRuntime.attachLayer`. */
  createRoot(): Object3D {
    // Applying here means `SceneRuntime.attachLayer` surfaces sky/fog/lighting
    // on the very tick it registers the layer (the explicit attach() path and
    // each update() re-apply the same state, so this is idempotent).
    this.applyCurrentToScene();
    return this.rig;
  }

  /**
   * Apply atmosphere parameters toward `eraId`.
   *
   * `progress` is the eased 0..1 blend from the previously applied state
   * (typically fed from `EraSystem` `era-transition` events). `progress >= 1`
   * settles on the era. Calling with the already-settled era is a no-op.
   */
  applyEra(eraId: EraId, progress = 1): this {
    this.assertAlive();
    const definition = getEraDefinition(eraId);
    const target = deriveAtmosphereParams(definition);
    const p = clamp01(progress);

    if (this.targetEra === null && p >= 1 && eraId === this.settledEra) {
      return this; // already fully on this era
    }
    if (p >= 1) {
      this.settledEra = eraId;
      this.targetEra = null;
      this.fromParams = null;
      this.progress = 1;
      this.currentParams = target;
      this.applyCurrentToScene();
      return this;
    }

    // Start (or restart) the blend from the currently applied state so a
    // retarget mid-tween continues from where the scene actually is.
    if (this.targetEra !== eraId || this.fromParams === null) {
      this.fromParams = cloneAtmosphereParams(this.currentParams);
    }
    this.targetEra = eraId;
    this.progress = p;
    this.currentParams = lerpAtmosphereParams(this.fromParams, target, p);
    this.applyCurrentToScene();
    return this;
  }

  /**
   * Per-frame application of the current blended parameters. Called by the
   * runtime loop or manually; idempotent and safe after disposal (no-op).
   */
  update(_state: FrameState): void {
    if (this.disposed) return;
    this.adoptSceneIfNeeded();
    this.applyCurrentToScene();
  }

  /**
   * Remove the light rig from its host and clear scene effects (background,
   * fog, post-processing). After disposal `applyEra`/`attach` throw and
   * `update` becomes a no-op.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rig.parent) this.rig.parent.remove(this.rig);
    this.rig.clear();
    if (this._scene.fog === this.fog) this._scene.fog = null;
    this.fog = null;
    this._scene.background = null;
    this.targetEra = null;
    this.fromParams = null;
    this.progress = 0;
  }

  /* ---------------- internals ---------------- */

  private applySunOrientation(params: AtmosphereParams): void {
    this.sun.position
      .copy(sunDirection(params.sunElevationDeg, params.sunAzimuthDeg))
      .multiplyScalar(SUN_DISTANCE);
  }

  private applyCurrentToScene(): void {
    const params = this.currentParams;

    this._scene.background = new Color(params.skyColor);
    if (this.fog === null) {
      this.fog = new FogExp2(params.fogColor, params.fogDensity);
      this._scene.fog = this.fog;
    } else {
      if (this._scene.fog !== this.fog) this._scene.fog = this.fog;
      this.fog.color.set(params.fogColor);
      this.fog.density = params.fogDensity;
    }

    this.ambient.color.set(params.ambientColor);
    this.ambient.intensity = params.ambientIntensity;
    this.hemisphere.color.set(params.hemisphereSkyColor);
    this.hemisphere.groundColor.set(params.hemisphereGroundColor);
    this.hemisphere.intensity = params.hemisphereIntensity;
    this.sun.color.set(params.sunColor);
    this.sun.intensity = params.sunIntensity;
    this.applySunOrientation(params);

    this.postController.configure(params.post);
  }

  /**
   * When the layer was constructed without an explicit scene, adopt the Scene
   * its rig currently lives in (covers `SceneRuntime.attachLayer` flows where
   * the integration does not pass a scene option).
   */
  private adoptSceneIfNeeded(): void {
    if (this.sceneExplicit) return;
    const host = this.rig.parent;
    if (host === null) return;
    const root = resolveSceneRoot(host);
    if (root !== null && root !== this._scene) this._scene = root;
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new Error(`AtmosphereLayer (${this.id}) has been disposed and can no longer be used`);
    }
  }
}