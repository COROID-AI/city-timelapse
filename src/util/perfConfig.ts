// ─── Performance Optimization Configuration ────────────────────────────
// Shared configuration that controls rendering quality without modifying
// era module internals. All optimizations are applied via this config.

import type { EraId } from '../eras.js';

/** Maximum device pixel ratio clamp — prevents GPU overload on HiDPI screens */
export const MAX_PIXEL_RATIO = 1.5;

/** Target FPS for steady-state (non-transition) rendering */
export const TARGET_FPS_STEADY = 60;

/** Minimum acceptable FPS floor during transitions */
export const TARGET_FPS_TRANSITION = 30;

/** Adaptive pixel ratio clamping thresholds */
export const PIXEL_RATIO_ADAPTIVE = {
  /** If FPS drops below this, reduce pixel ratio to 0.75 */
  lowFpsThreshold: 40,
  /** If FPS drops below this, reduce pixel ratio to 0.5 */
  criticalFpsThreshold: 25,
};

/** Shadow map optimization settings */
export const SHADOW_CONFIG = {
  /** Default shadow map size per era */
  defaultSize: 1024,
  /** Reduced shadow map size when FPS is low */
  reducedSize: 512,
  /** Only cast shadows from the sun directional light */
  sunOnly: true,
  /** Shadow camera frustum half-width */
  cameraHalfWidth: 50,
  /** Shadow camera far plane */
  cameraFar: 180,
};

/** Geometry merging configuration */
export const GEOMETRY_MERGE_CONFIG = {
  /** Merge static building parts per building into single meshes */
  mergeStaticGeometry: true,
  /** Threshold for merge — only merge groups with fewer than N children */
  maxMergeChildren: 8,
};

/** Instancing configuration for repeated props */
export const INSTANCING_CONFIG = {
  /** Enable instanced rendering for street furniture */
  enableStreetFurnitureInstancing: true,
  /** Enable instanced rendering for vehicles */
  enableVehicleInstancing: false, // Vehicles need individual transforms
  /** Enable instanced rendering for pedestrians */
  enablePedestrianInstancing: false, // Pedestrians need individual animations
  /** Props that should be batched via instancing */
  instanceableProps: ['lampPost', 'bench', 'trashCan', 'mailbox'],
};

/** Frustum culling budget for particle effects */
export const FRUSTUM_PARTICLE_BUDGET = {
  /** Max visible particles when FPS >= target */
  maxParticlesOnScreen: 200,
  /** Max visible particles when FPS < target */
  maxParticlesReduced: 80,
};

/** Texture atlasing for sign materials across eras */
export const TEXTURE_ATLAS_CONFIG = {
  /** Enable shared texture atlas for all sign materials */
  enabled: true,
  /** Atlas dimensions */
  atlasSize: 2048,
  /** Max sign textures per atlas row */
  maxPerRow: 8,
};

/** Per-era shadow map sizes — override defaults for complex eras */
export const ERA_SHADOW_SIZES: Record<EraId, number> = {
  '1945': SHADOW_CONFIG.defaultSize,
  '1965': SHADOW_CONFIG.defaultSize,
  '1985': SHADOW_CONFIG.defaultSize,
  '2005': SHADOW_CONFIG.defaultSize * 2, // More glass reflections need sharper shadows
  '2025': SHADOW_CONFIG.defaultSize * 2,
};

/** Camera position used for reproducible profiling */
export const PROFILE_CAMERA_POSITION = { x: 35, y: 25, z: 35 };
export const PROFILE_CAMERA_FOV = 50;

/** Reproducible era sequence for profiling passes */
export const PROFILE_ERA_SEQUENCE: EraId[] = [
  '1945',
  '1965',
  '1985',
  '2005',
  '2025',
] as const;

/** Warm-up frames before measurement starts */
export const PROFILE_WARMUP_FRAMES = 30;

/** Measurement frames per era */
export const PROFILE_MEASURE_FRAMES = 120;
