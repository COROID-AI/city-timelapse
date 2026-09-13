/**
 * Era-agnostic atmosphere and lighting model.
 *
 * This module owns the shared 3D math types (`Vec3`, `Color3`) and the
 * atmosphere → light-state transform used by the SceneEngine. Everything
 * here is pure data + pure functions: no WebGL, no DOM, no scene objects,
 * so atmosphere presets can be authored, unit-tested and swapped in
 * parallel with the era domain (era → preset mapping lives in
 * era-furniture/scene-integration, not here).
 */

/** A 3-component unitless direction/position vector (world units). */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** An sRGB color with components in [0, 1]. */
export interface Color3 {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Sky gradient endpoints used for the skybox/background fill. */
export interface SkyLighting {
  /** Color straight up (zenith). */
  readonly top: Color3;
  /** Color at the horizon. */
  readonly horizon: Color3;
}

/** Atmospheric scattering/fog visible state. */
export interface FogLighting {
  readonly color: Color3;
  /** Exponential fog density in [0, 1]. */
  readonly density: number;
}

/** Directional sun light (parallel rays, "sun is infinitely far away"). */
export interface SunLighting {
  /** Unit-length direction the rays travel. */
  readonly direction: Vec3;
  readonly color: Color3;
  /** Light intensity multiplier (>= 0). */
  readonly intensity: number;
}

/** Global non-directional fill light. */
export interface AmbientLighting {
  readonly color: Color3;
  /** Intensity multiplier (>= 0). */
  readonly intensity: number;
}

/**
 * A complete, authored atmosphere description. Presets are the era-neutral
 * contract between the era domain and the engine: they fully describe every
 * visible lighting field, so `applyAtmosphere` can map them deterministically
 * (and idempotently) onto a {@link LightState} without any blending context.
 */
export interface AtmospherePreset {
  readonly sky: SkyLighting;
  readonly fog: FogLighting;
  readonly sun: SunLighting;
  readonly ambient: AmbientLighting;
}

/**
 * The engine's normalized visible lighting state — the result of running a
 * preset through {@link applyAtmosphere}. Renderers consume a `LightState`.
 */
export interface LightState {
  readonly sky: SkyLighting;
  readonly fog: FogLighting;
  readonly sun: SunLighting;
  readonly ambient: AmbientLighting;
}

/** Neutral baseline lighting: bright clear midday sky, no fog, balanced sun. */
export const DEFAULT_LIGHT_STATE: LightState = {
  sky: {
    top: { r: 0.24, g: 0.54, b: 0.95 },
    horizon: { r: 0.85, g: 0.9, b: 1 },
  },
  fog: {
    color: { r: 0.9, g: 0.9, b: 0.92 },
    density: 0,
  },
  sun: {
    // Unit vector straight down: noon sunlight, no FP drift through the
    // normalize transform in applyAtmosphere.
    direction: { x: 0, y: -1, z: 0 },
    color: { r: 1, g: 0.98, b: 0.92 },
    intensity: 1,
  },
  ambient: {
    color: { r: 0.75, g: 0.8, b: 0.88 },
    intensity: 0.35,
  },
};

/** The {@link AtmospherePreset} that reproduces {@link DEFAULT_LIGHT_STATE}. */
export const DEFAULT_ATMOSPHERE: AtmospherePreset = DEFAULT_LIGHT_STATE;

function clampByte(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampColor(color: Color3): Color3 {
  return {
    r: clampByte(color.r),
    g: clampByte(color.g),
    b: clampByte(color.b),
  };
}

function normalizeDirection(direction: Vec3): Vec3 {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length <= 1e-9) {
    return { x: 0, y: 1, z: 0 };
  }
  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
}

/**
 * Map an atmosphere preset onto a normalized, visible {@link LightState}.
 *
 * The transform is deterministic and total: every field of the preset is
 * carried over with safe clamping (colors → [0,1], fog density → [0,1],
 * intensities → >= 0, sun direction → unit length). Because the mapping
 * never accumulates, applying the same preset twice yields an identical
 * state (idempotent).
 *
 * `base` is only consulted when `preset` is null/undefined: the engine
 * passes its previous state so `setAtmosphere(null)` is a no-op instead of
 * a reset.
 */
export function applyAtmosphere(
  preset: AtmospherePreset | null | undefined,
  base: LightState = DEFAULT_LIGHT_STATE,
): LightState {
  if (preset == null) {
    return base;
  }
  return {
    sky: {
      top: clampColor(preset.sky.top),
      horizon: clampColor(preset.sky.horizon),
    },
    fog: {
      color: clampColor(preset.fog.color),
      density: clampByte(preset.fog.density),
    },
    sun: {
      direction: normalizeDirection(preset.sun.direction),
      color: clampColor(preset.sun.color),
      intensity: Math.max(0, preset.sun.intensity),
    },
    ambient: {
      color: clampColor(preset.ambient.color),
      intensity: Math.max(0, preset.ambient.intensity),
    },
  };
}

/** Structural equality for light states (used by idempotence assertions). */
export function lightStateEquals(a: LightState, b: LightState): boolean {
  return (
    a.sky.top.r === b.sky.top.r &&
    a.sky.top.g === b.sky.top.g &&
    a.sky.top.b === b.sky.top.b &&
    a.sky.horizon.r === b.sky.horizon.r &&
    a.sky.horizon.g === b.sky.horizon.g &&
    a.sky.horizon.b === b.sky.horizon.b &&
    a.fog.color.r === b.fog.color.r &&
    a.fog.color.g === b.fog.color.g &&
    a.fog.color.b === b.fog.color.b &&
    a.fog.density === b.fog.density &&
    a.sun.direction.x === b.sun.direction.x &&
    a.sun.direction.y === b.sun.direction.y &&
    a.sun.direction.z === b.sun.direction.z &&
    a.sun.color.r === b.sun.color.r &&
    a.sun.color.g === b.sun.color.g &&
    a.sun.color.b === b.sun.color.b &&
    a.sun.intensity === b.sun.intensity &&
    a.ambient.color.r === b.ambient.color.r &&
    a.ambient.color.g === b.ambient.color.g &&
    a.ambient.color.b === b.ambient.color.b &&
    a.ambient.intensity === b.ambient.intensity
  );
}