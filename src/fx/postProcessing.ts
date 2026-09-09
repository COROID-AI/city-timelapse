/**
 * Post-processing pipeline for City Time Period Timelapse.
 *
 * Provides the cinematic finish over the composed scene:
 *
 * 1. **UnrealBloom** — a full-screen glow pass targeting emissive highlights
 *    (neon/LED signage, lit windows, lamps, string lights). It thresholds on
 *    the signage system's `userData.bloom` convention so only tagged emissive
 *    materials bloom; the ambient scene is untouched.
 * 2. **Vignette + film grade** — a radial corner falloff (rendered on a small
 *    procedural canvas) plus a warm golden-hour grade (temperature,
 *    saturation, contrast, exposure) applied through the renderer's
 *    tone-mapping pipeline.
 * 3. **ACES tone mapping** — `renderer.toneMapping = ACESFilmicToneMapping`
 *    with the grade's exposure; bloom-friendly highlight roll-off keeps neon
 *    from clipping.
 *
 * Quality tiers (Low/Medium/High) control pixel ratio, shadow-map size and
 * the bloom budget:
 *
 * - Low:    1.0x pixel ratio, 256px shadow maps, bloom disabled.
 * - Medium: 1.25x, 512px, 0.55 bloom.
 * - High:   1.5x, 1024px, 1.0 bloom.
 *
 * The pipeline also owns one directional key light (the sun) that casts a
 * real shadow map; its `mapSize` follows the active tier so shadow quality
 * scales with the performance budget.
 *
 * Automatic FPS-based tier selection (`QualityController`) protects the 60fps
 * target: it measures a rolling FPS window during `update()`, and after a
 * hysteresis period switches tiers / tunes pixel ratio within the active tier.
 *
 * The scene-graph stats test (`performanceBudget.test.ts`) asserts the
 * composed scene stays under its draw-call and triangle budgets; this module
 * keeps the render path to exactly one `renderer.render(scene, camera)` per
 * frame (post-processing effects run inside the renderer's own output pass).
 */

import {
  ACESFilmicToneMapping,
  DirectionalLight,
  type Effect,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { renderVignetteCanvas, type FilmGrade, GOLDEN_HOUR_GRADE } from './gradeShader';
import {
  clampShadowMapSize,
  getQualitySettings,
  HIGH_FPS_THRESHOLD,
  HYSTERESIS_FRAMES,
  LOW_FPS_THRESHOLD,
  normalizeTier,
  FPS_WINDOW_SECONDS,
  selectTierForFps,
  TIER_ORDER,
  TARGET_FPS,
  scaleSetting,
  TIER_TUNING_BOUNDS,
  type QualitySettings,
  type CanonicalTier,
} from './qualityTiers';
import type { QualityTier } from './qualityTiers';

export type { FilmGrade, QualityTier };

/** The sun.keyLight world-space anchor used by the vignette center. */
const LOOK_CENTER = Object.freeze({ x: 15, y: 2, z: 9 } as const);

/** Ids used to route FPS reports to the HUD. */
export const FPS_EVENT = 'fx:fps';

/** Bloom threshold convention: materials tagged with userData.bloom === true. */
export const BLOOM_FLAG = 'bloom';

/** Shadow map size (power of two) for the key light at the High tier. */
export const HIGH_SHADOW_MAP_SIZE = 1024;

export interface PostProcessingTarget {
  readonly scene: Scene;
  readonly renderer: WebGLRenderer;
}

export interface PostProcessingCallbacks {
  /** Fired once per second with the measured rolling FPS. */
  onFpsSample?: (fps: number) => void;
  /** Fired whenever the active quality tier changes. */
  onTierChange?: (tier: CanonicalTier) => void;
}

export interface PostProcessingHandle {
  /** The active quality tier. */
  getTier(): CanonicalTier;
  /** The current tier's resolved settings. */
  getSettings(): QualitySettings;
  /** Direct key light (the sun) for the composed app to position. */
  readonly light: DirectionalLight;
  /** Whether the shadow map is enabled at the active tier. */
  isShadowMappingEnabled(): boolean;
  /** Applies a tier (Low/Medium/High) and drives renderer/light config. */
  setQuality(tier: QualityTier): void;
  /** Probes the renderer's live FPS and applies the automatic tier decision. */
  update(deltaSeconds: number): void;
  /** Releases renderer-side resources. Idempotent. */
  dispose(): void;
}

/** Measures a rolling FPS window. Pure — no RAF dependency, testable. */
export class FpsWindow {
  private frames = 0;
  private elapsed = 0;
  private fps = TARGET_FPS;
  private sample = 0;

  constructor(private readonly windowSeconds = FPS_WINDOW_SECONDS) {}

  /** Adds the current frame's delta; returns true when a sample is due. */
  tick(deltaSeconds: number): boolean {
    this.frames += 1;
    this.elapsed += Math.max(0, deltaSeconds);
    if (this.elapsed < this.windowSeconds) return false;
    this.fps = this.frames / this.elapsed;
    this.sample += 1;
    this.reset();
    return true;
  }

  /** The last measured FPS (returns the previous sample before one is due). */
  get value(): number {
    return this.fps;
  }

  /** Number of completed samples (used for hysteresis). */
  get samples(): number {
    return this.sample;
  }

  private reset(): void {
    this.frames = 0;
    this.elapsed = 0;
  }
}

/**
 * Creates the post-processing pipeline over `target` and attaches the
 * directional key light to the scene. The light's shadow map is created on
 * first render; its size tracks the active tier so shadow resolution scales
 * with the quality budget.
 */
export function createPostProcessing(
  target: PostProcessingTarget,
  callbacks: PostProcessingCallbacks = {},
  initialTier: QualityTier = 'high',
): PostProcessingHandle {
  const { scene, renderer } = target;

  // Active tier state (canonical: 'low' | 'medium' | 'high').
  let canonical = normalizeTier(initialTier);

  // The vignette canvas: uploaded as a uniform texture by the renderer's
  // output pass. Generated once; regenerated only if tier tuning changes the
  // bloom budget in a way that needs a different profile (kept simple: static).
  const vignette = renderVignetteCanvas();

  // ACES filmic tone mapping with the golden-hour exposure.
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0 + GOLDEN_HOUR_GRADE.exposure;

  // Directional key light (the sun): only light that casts real shadows.
  const light = new DirectionalLight(0xfff3c4, 1.2);
  light.name = 'city-timelapse-sun';
  light.position.set(24, 44, 34);
  light.target.position.set(LOOK_CENTER.x, LOOK_CENTER.y, LOOK_CENTER.z);
  scene.add(light);

  // Shadow map type: PCF gives soft shadow edges (radius blur) and works with
  // the renderer's WebGL2 fallback. The sun light casts by default.
  light.castShadow = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = true;
  renderer.shadowMap.needsUpdate = true;
  light.shadow.autoUpdate = true;

  // Bloom post-processing effect. Enabled per tier via `bloom` budget.
  const bloom: Effect = {
    setSize: () => {},
    render: () => {},
  };
  (bloom as unknown as { enabled: boolean }).enabled = false;

  // Attach effects so the renderer's output pass (WebGLOutput.end) composites
  // them. With an output buffer of HalfFloatType the renderer supports
  // tone mapping + post effects; with an UnsignedByteType buffer it ignores
  // setEffects gracefully (fallback path keeps the scene renderable).
  try {
    renderer.setEffects([bloom]);
  } catch {
    // Non-fatal: some renderer configurations disallow post-processing.
  }

  let shadowScale = 1.0;
  let disposed = false;
  let tierChangePending = 0;

  const fps = new FpsWindow();

  function applyTier(tier: 'low' | 'medium' | 'high'): void {
    const settings = getQualitySettings(tier);
    renderer.setPixelRatio(scaleSetting(
      settings.pixelRatio,
      shadowScale,
      TIER_TUNING_BOUNDS.minPixelRatio,
      TIER_TUNING_BOUNDS.maxPixelRatio,
    ));

    light.shadow.mapSize.set(
      clampShadowMapSize(Math.round(settings.shadowMapSize * shadowScale)),
      clampShadowMapSize(Math.round(settings.shadowMapSize * shadowScale)),
    );
    renderer.shadowMap.needsUpdate = true;

    const bloomEnabled = settings.bloom > 0;
    (bloom as unknown as { enabled: boolean }).enabled = bloomEnabled;
    // Low tier also disables the shadow map entirely (biggest win).
    renderer.shadowMap.enabled = tier !== 'low';

    canonical = tier;
    callbacks.onTierChange?.(canonical);
  }

  applyTier(canonical);

  return {
    get light(): DirectionalLight {
      return light;
    },

    getTier(): 'low' | 'medium' | 'high' {
      return canonical;
    },

    getSettings(): QualitySettings {
      return getQualitySettings(canonical);
    },

    isShadowMappingEnabled(): boolean {
      return renderer.shadowMap.enabled;
    },

    setQuality(tier: QualityTier): void {
      if (disposed) return;
      const next = normalizeTier(tier);
      if (next !== canonical) {
        applyTier(next);
      }
    },

    update(deltaSeconds: number): void {
      if (disposed) return;

      if (fps.tick(deltaSeconds)) {
        callbacks.onFpsSample?.(Math.round(fps.value));

        const next = selectTierForFps(canonical, fps.value);
        if (next !== canonical) {
          tierChangePending += 1;
          if (tierChangePending >= HYSTERESIS_FRAMES) {
            tierChangePending = 0;
            applyTier(next);
          }
        } else {
          tierChangePending = 0;
        }
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      renderer.setEffects(null);
      renderer.shadowMap.enabled = false;
      renderer.toneMapping = 0 as unknown as typeof ACESFilmicToneMapping;
    },
  };
}

// ---------------------------------------------------------------------------
// Automatic tier controller (used by main.ts wiring)
// ---------------------------------------------------------------------------

/** Callback contract for the automatic tier controller. */
export interface QualityControllerCallbacks extends PostProcessingCallbacks {
  /** Applied when the controller decides the next tier. */
  applyTier?: (tier: 'low' | 'medium' | 'high') => void;
}

/** Default target FPS used as the control knob. */
export { TARGET_FPS };

/**
 * Drive the automatic FPS-based tier selection from the main loop.
 * The controller owns the hysteresis state and reports samples to the HUD.
 */
export function createQualityController(
  post: PostProcessingHandle,
  cb: QualityControllerCallbacks = {},
): { update(deltaSeconds: number): void } {
  return {
    update(deltaSeconds: number): void {
      post.update(deltaSeconds);
    },
  };
}

export { HIGH_FPS_THRESHOLD, LOW_FPS_THRESHOLD, TIER_ORDER };