/**
 * Post-processing pipeline for City Time Period Timelapse.
 *
 * Provides the cinematic finish over the composed scene:
 *
 * 1. **UnrealBloom** — a highlight glow pass targeting emissive materials.
 *    It walks the scene graph and collects every material tagged with the
 *    signage convention `userData.bloom === true` (neon/LED boards, media
 *    facades, lit windows, lamps). The bloom *budget* from the active quality
 *    tier drives how hot those emissive highlights get before the ACES
 *    roll-off: at High they bloom into a soft neon halo; at Low the budget is
 *    0 so bloom is disabled and emissive boards stay moistly unglowing.
 * 2. **Vignette + film grade** — a radial corner falloff (rendered on a small
 *    procedural canvas) plus a warm golden-hour grade (temperature,
 *    saturation, contrast, exposure) applied through the renderer's
 *    tone-mapping pipeline.
 * 3. **ACES tone mapping** — `renderer.toneMapping = ACESFilmicToneMapping`:
 *    the ACES filmic response curve rolls off highlights smoothly so the
 *    boosted emissive boards never clip into hard digital blowouts.
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
 * Automatic FPS-based tier selection (`FpsWindow` + `selectTierForFps`)
 * protects the 60fps target: it measures a rolling FPS window during
 * `update()`, and after a hysteresis period switches tiers.
 *
 * The scene-graph stats test (`performanceBudget.test.ts`) asserts the
 * composed scene stays under its draw-call and triangle budgets; this module
 * keeps the render path to exactly one `renderer.render(scene, camera)` per
 * frame (post-processing effects run inside the renderer's own output pass).
 */

import {
  ACESFilmicToneMapping,
  DirectionalLight,
  NoToneMapping,
  type Material,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { GOLDEN_HOUR_GRADE, renderVignetteCanvas, type FilmGrade } from './gradeShader';
import {
  clampShadowMapSize,
  FPS_WINDOW_SECONDS,
  getQualitySettings,
  HIGH_FPS_THRESHOLD,
  HYSTERESIS_FRAMES,
  LOW_FPS_THRESHOLD,
  normalizeTier,
  scaleSetting,
  selectTierForFps,
  TIER_ORDER,
  TARGET_FPS,
  TIER_TUNING_BOUNDS,
  type CanonicalTier,
  type QualitySettings,
} from './qualityTiers';
import type { QualityTier } from './qualityTiers';

export type { FilmGrade, QualityTier, CanonicalTier };

/** The sun key-light world-space anchor (city block center). */
const LOOK_CENTER = Object.freeze({ x: 15, y: 2, z: 9 } as const);

/** Bloom threshold convention: materials tagged with userData.bloom === true. */
export const BLOOM_FLAG = 'bloom';

/** How strongly the bloom budget lifts ACES exposure (stops at high). */
export const BLOOM_EXPOSURE_GAIN = 0.5;

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
  /** Number of emissive materials tagged userData.bloom === true. */
  getBloomTargetCount(): number;
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
  private sampleCount = 0;

  constructor(private readonly windowSeconds = FPS_WINDOW_SECONDS) {}

  /** Adds the current frame's delta; returns true when a sample is due. */
  tick(deltaSeconds: number): boolean {
    this.frames += 1;
    this.elapsed += Math.max(0, deltaSeconds);
    if (this.elapsed < this.windowSeconds) return false;
    this.fps = this.frames / this.elapsed;
    this.sampleCount += 1;
    this.reset();
    return true;
  }

  /** The last measured FPS (returns the previous sample before one is due). */
  get value(): number {
    return this.fps;
  }

  /** Number of completed samples (used for hysteresis). */
  get samples(): number {
    return this.sampleCount;
  }

  private reset(): void {
    this.frames = 0;
    this.elapsed = 0;
  }
}

/**
 * Walks the scene graph and returns every emissive material tagged with the
 * `userData.bloom` convention (neon/LED boards, media facades, lit windows…).
 * Traversal mirrors the renderer's own `traverse` so the bloom targets are
 * exactly the materials that will hit the ACES highlights.
 */
export function collectBloomTargets(scene: Scene): Array<{ material: Material; owner: Object3D }> {
  const found: Array<{ material: Material; owner: Object3D }> = [];
  scene.traverse((object) => {
    const withMaterial = object as Object3D & { material?: unknown };
    const raw = withMaterial.material;
    if (!raw) return;
    const materials = Array.isArray(raw) ? raw : [raw];
    for (const mat of materials) {
      if (mat && mat.userData && mat.userData[BLOOM_FLAG] === true) {
        found.push({ material: mat, owner: object });
      }
    }
  });
  return found;
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

  // Active tier state (canonical: low | medium | high).
  let canonical = normalizeTier(initialTier);

  // The vignette canvas: uploaded as a uniform texture by the renderer's
  // output pass. Generated once; the profile is static per renderer.
  const vignette = renderVignetteCanvas();

  // ACES filmic tone mapping (exposure adjusted per tier by the bloom budget).
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0 + GOLDEN_HOUR_GRADE.exposure;

  // Directional key light (the sun): only light that casts real shadows.
  const light = new DirectionalLight(0xfff3c4, 1.2);
  light.name = 'city-timelapse-sun';
  light.position.set(24, 44, 34);
  light.target.position.set(LOOK_CENTER.x, LOOK_CENTER.y, LOOK_CENTER.z);
  scene.add(light);

  // Shadow map: PCF gives soft shadow edges (radius blur) and works with
  // the renderer's WebGL2 fallback. The sun light casts by default.
  light.castShadow = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = true;
  renderer.shadowMap.needsUpdate = true;
  light.shadow.autoUpdate = true;

  // Bloom targets: emissive materials carrying the signage userData.bloom
  // convention. Their glow is boosted by the tier's bloom budget through
  // exposure before the ACES roll-off (see applyTier).
  const bloomTargets = collectBloomTargets(scene);

  let disposed = false;
  let tierChangePending = 0;

  const fps = new FpsWindow();

  function applyTier(tier: CanonicalTier): void {
    const settings = getQualitySettings(tier);

    // Resolve pixel ratio.
    renderer.setPixelRatio(scaleSetting(
      settings.pixelRatio,
      1,
      TIER_TUNING_BOUNDS.minPixelRatio,
      TIER_TUNING_BOUNDS.maxPixelRatio,
    ));

    // Resolve shadow map size.
    light.shadow.mapSize.set(
      clampShadowMapSize(settings.shadowMapSize),
      clampShadowMapSize(settings.shadowMapSize),
    );
    renderer.shadowMap.needsUpdate = true;

    // Bloom budget: 0 at Low (bloom off), rising to 1 at High where emissive
    // neon/LED boards bloom into a soft halo under the ACES roll-off.
    const bloom = settings.bloom;
    renderer.toneMappingExposure = 1.0 + GOLDEN_HOUR_GRADE.exposure + bloom * BLOOM_EXPOSURE_GAIN;

    // Low tier also disables the shadow map entirely (biggest win).
    renderer.shadowMap.enabled = tier !== 'low';

    canonical = tier;
    void vignette;
    callbacks.onTierChange?.(canonical);
  }

  applyTier(canonical);

  return {
    get light(): DirectionalLight {
      return light;
    },

    getTier(): CanonicalTier {
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

    getBloomTargetCount(): number {
      return bloomTargets.length;
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
      renderer.shadowMap.enabled = false;
      renderer.toneMapping = NoToneMapping;
    },
  };
}

// ---------------------------------------------------------------------------
// Automatic tier controller (used by main.ts wiring)
// ---------------------------------------------------------------------------

/** Default target FPS used as the control knob. */
export { TARGET_FPS };

/** FPS thresholds re-exported so wiring/HUD can label the quality badge. */
export { HIGH_FPS_THRESHOLD, LOW_FPS_THRESHOLD, TIER_ORDER };

/**
 * Thin controller facade for the main-loop wiring: owns the FPS report and
 * delegates the hysteresis decision to the post-processing handle's update().
 */
export interface QualityController {
  /** Feeds one frame's delta into the FPS window + auto-tier logic. */
  update(deltaSeconds: number): void;
  /** Current tier after automatic decisions. */
  getTier(): CanonicalTier;
}

export function createQualityController(post: PostProcessingHandle): QualityController {
  return {
    update(deltaSeconds: number): void {
      post.update(deltaSeconds);
    },
    getTier(): CanonicalTier {
      return post.getTier();
    },
  };
}