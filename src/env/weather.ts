/**
 * Era weather and airborne particles — instanced, procedural, and cheap.
 *
 * Five particle kinds carry the era mood: soot and dust (coal-smoke 1945),
 * rain, snow, and leaves. Each kind is a single `THREE.InstancedMesh` built
 * through the shared procedural graphics library, so the whole weather system
 * is a handful of draw calls regardless of density.
 *
 * Design constraints honored here:
 * - **Instanced**: one mesh per kind, matrices streamed with dynamic usage;
 * - **Never obscures the timeline UI**: particles live in a low 40 m band under
 *   the top-of-screen timeline (plus the UI overlay renders above the canvas),
 *   and base opacities stay restrained;
 * - **Quality scaling**: instance counts scale with `AtmosphereQuality`
 *   (high 100% / medium 60% / low 35%) and zero-density kinds are skipped
 *   entirely — invisible kinds cost no CPU per frame;
 * - **Procedural**: particle sprites are tiny canvas gradients/shapes from the
 *   shared library (no downloaded textures, no HDRIs).
 */

import * as THREE from 'three';
import { ProceduralGfxLibrary } from '../gfx/materials';
import type { EraYear } from '../era/timeline';
import type { AtmosphereQuality } from './postfx';

/** The five era particle kinds. */
export type ParticleKind = 'soot' | 'dust' | 'rain' | 'snow' | 'leaves';

/** All particle kinds, in stable draw order. */
export const PARTICLE_KINDS: readonly ParticleKind[] = ['soot', 'dust', 'rain', 'snow', 'leaves'];

/** Blendable particle density per kind, each in 0..1. */
export interface WeatherState {
  soot: number;
  dust: number;
  rain: number;
  snow: number;
  leaves: number;
}

/** Allocate a zeroed weather state (used as a lerp target). */
export function createWeatherState(partial: Partial<WeatherState> = {}): WeatherState {
  return {
    soot: partial.soot ?? 0,
    dust: partial.dust ?? 0,
    rain: partial.rain ?? 0,
    snow: partial.snow ?? 0,
    leaves: partial.leaves ?? 0,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Blend two weather states into `target` (allocates when no target given). */
export function lerpWeatherState(
  a: WeatherState,
  b: WeatherState,
  t: number,
  target: WeatherState = createWeatherState(),
): WeatherState {
  const k = clamp01(t);
  target.soot = a.soot + (b.soot - a.soot) * k;
  target.dust = a.dust + (b.dust - a.dust) * k;
  target.rain = a.rain + (b.rain - a.rain) * k;
  target.snow = a.snow + (b.snow - a.snow) * k;
  target.leaves = a.leaves + (b.leaves - a.leaves) * k;
  return target;
}

/**
 * Era particle mix:
 * - 1945 heavy soot + dust (coal smoke), barely any rain;
 * - 1965 mild smog dust with more drifting leaves;
 * - 1985 smoggy soot with the era's rainiest skies;
 * - 2005 no soot, crisp rain and first real snow;
 * - 2025 clean air: no soot, light dust, snow and leaves.
 */
export const ERA_WEATHER: Readonly<Record<EraYear, WeatherState>> = Object.freeze({
  1945: createWeatherState({ soot: 1.0, dust: 0.6, rain: 0.12, snow: 0.15, leaves: 0.2 }),
  1965: createWeatherState({ soot: 0.3, dust: 0.5, rain: 0.3, snow: 0.1, leaves: 0.45 }),
  1985: createWeatherState({ soot: 0.35, dust: 0.4, rain: 0.55, snow: 0.1, leaves: 0.25 }),
  2005: createWeatherState({ soot: 0.0, dust: 0.2, rain: 0.4, snow: 0.3, leaves: 0.35 }),
  2025: createWeatherState({ soot: 0.0, dust: 0.12, rain: 0.3, snow: 0.35, leaves: 0.45 }),
}) as Readonly<Record<EraYear, WeatherState>>;

/** Instance-count scale per quality tier (applied to the `high` baseline). */
export const PARTICLE_QUALITY_SCALE: Readonly<Record<AtmosphereQuality, number>> = Object.freeze({
  low: 0.35,
  medium: 0.6,
  high: 1,
});

/** Per-kind static configuration. */
interface ParticleKindSpec {
  color: string;
  opacity: number;
  count: number;
  scale: [number, number];
  fallSpeed: number;
  sway: number;
  swayFreq: number;
  tumble: boolean;
  billboard: boolean;
  texture: 'dot' | 'streak' | 'leaf';
}

const PARTICLE_SPECS: Readonly<Record<ParticleKind, ParticleKindSpec>> = {
  soot: { color: '#2b2621', opacity: 0.5, count: 320, scale: [0.13, 0.13], fallSpeed: -0.35, sway: 0.35, swayFreq: 0.4, tumble: false, billboard: true, texture: 'dot' },
  dust: { color: '#cdbb93', opacity: 0.3, count: 260, scale: [0.1, 0.1], fallSpeed: -0.18, sway: 0.55, swayFreq: 0.5, tumble: false, billboard: true, texture: 'dot' },
  rain: { color: '#a9c4de', opacity: 0.45, count: 900, scale: [0.035, 0.9], fallSpeed: -24, sway: 1.1, swayFreq: 1.2, tumble: false, billboard: true, texture: 'streak' },
  snow: { color: '#f4f8ff', opacity: 0.75, count: 520, scale: [0.13, 0.13], fallSpeed: -1.9, sway: 1.6, swayFreq: 0.9, tumble: false, billboard: true, texture: 'dot' },
  leaves: { color: '#b8763a', opacity: 0.8, count: 180, scale: [0.24, 0.15], fallSpeed: -1.3, sway: 2.2, swayFreq: 1.6, tumble: true, billboard: false, texture: 'leaf' },
};

/** The volume particles occupy, centered on the city block. */
export interface WeatherVolume {
  /** Half-extent of the particle box in X/Z (world units). */
  halfWidth: number;
  /** Particle band height in Y (world units); kept low so the timeline band stays clear. */
  height: number;
}

/** Construction options for the weather system. */
export interface WeatherSystemOptions {
  quality?: AtmosphereQuality;
  seed?: number;
  volume?: Partial<WeatherVolume>;
}

/** Live instanced weather system. */
export interface WeatherSystem {
  /** Root group; add it to the scene once. */
  readonly root: THREE.Group;
  /** Particle kinds present in this system. */
  readonly kinds: readonly ParticleKind[];
  /** One instanced mesh per kind (created via the shared gfx library). */
  readonly meshes: Readonly<Record<ParticleKind, THREE.InstancedMesh>>;
  /** Particle volume description. */
  readonly volume: Readonly<WeatherVolume>;
  /** Current quality tier (scales active instance counts). */
  readonly quality: AtmosphereQuality;
  /** Active rendered instance count for a kind (quality- and density-scaled). */
  countFor(kind: ParticleKind): number;
  /** Apply an era weather state (opacity/visibility) at a quality tier. */
  apply(state: WeatherState, quality?: AtmosphereQuality): void;
  /** Advance and stream particle matrices; optionally billboard to a camera. */
  update(deltaSeconds: number, camera?: THREE.Camera | null): void;
  /** Dispose geometry, materials, textures, and detach the root. */
  dispose(): void;
}

/** Gentle constant wind so streaks and leaves never fall perfectly straight. */
const WIND_X = 0.35;

// Scratch objects shared across the per-frame instance loop (no allocation).
const TEMP_POSITION = new THREE.Vector3();
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_SCALE = new THREE.Vector3();
const TEMP_MATRIX = new THREE.Matrix4();
const TEMP_EULER = new THREE.Euler();
const IDENTITY_QUATERNION = new THREE.Quaternion();

/**
 * Procedural particle sprite from the shared canvas utilities. Returns `null`
 * (flat colored quads) in headless environments without a 2D canvas context.
 */
function createParticleTexture(shape: 'dot' | 'streak' | 'leaf'): THREE.CanvasTexture | null {
  const size = 64;
  const { canvas, ctx } = ProceduralGfxLibrary.createSafeCanvas(size, size);
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  if (shape === 'dot') {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.65)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  } else if (shape === 'streak') {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(size * 0.38, 0, size * 0.24, size);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size * 0.34, size * 0.17, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.22, size * 0.72);
    ctx.lineTo(size * 0.78, size * 0.28);
    ctx.stroke();
  }

  const texture = ProceduralGfxLibrary.createCanvasTexture(canvas, 1, 1);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Build the instanced weather system. All matrices are seeded once with the
 * shared deterministic PRNG, then `update()` streams only the kinds that are
 * actually visible at the current era/quality.
 */
export function createWeatherSystem(options: WeatherSystemOptions = {}): WeatherSystem {
  const quality = options.quality ?? 'high';
  const volume: WeatherVolume = {
    halfWidth: options.volume?.halfWidth ?? 70,
    height: options.volume?.height ?? 40,
  };
  const rng = ProceduralGfxLibrary.createPRNG(options.seed ?? 1945);

  const root = new THREE.Group();
  root.name = 'atmosphereWeather';

  // One shared unit quad; per-kind scale comes from the instance matrix.
  const geometry = new THREE.PlaneGeometry(1, 1);
  const textures = new Map<'dot' | 'streak' | 'leaf', THREE.CanvasTexture | null>();
  const meshes = {} as Record<ParticleKind, THREE.InstancedMesh>;
  const positions = {} as Record<ParticleKind, Float32Array>;
  const phases = {} as Record<ParticleKind, Float32Array>;
  const speeds = {} as Record<ParticleKind, Float32Array>;
  const spins = {} as Record<ParticleKind, Float32Array>;
  const densities = createWeatherState();

  for (const kind of PARTICLE_KINDS) {
    const spec = PARTICLE_SPECS[kind];
    if (!textures.has(spec.texture)) textures.set(spec.texture, createParticleTexture(spec.texture));
    const map = textures.get(spec.texture) ?? null;

    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.color),
      map,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });

    const mesh = ProceduralGfxLibrary.createInstancedMesh({
      geometry,
      material,
      count: spec.count,
      name: `atmosphere-${kind}`,
      dynamic: true,
      castShadow: false,
      receiveShadow: false,
      colors: false,
    });
    mesh.frustumCulled = false;
    mesh.visible = false;

    const positionArray = new Float32Array(spec.count * 3);
    const phaseArray = new Float32Array(spec.count);
    const speedArray = new Float32Array(spec.count);
    const spinArray = new Float32Array(spec.count);

    for (let i = 0; i < spec.count; i += 1) {
      const i3 = i * 3;
      positionArray[i3] = rng.range(-volume.halfWidth, volume.halfWidth);
      positionArray[i3 + 1] = rng.range(0, volume.height);
      positionArray[i3 + 2] = rng.range(-volume.halfWidth, volume.halfWidth);
      phaseArray[i] = rng.range(0, Math.PI * 2);
      speedArray[i] = rng.range(0.7, 1.3);
      spinArray[i] = rng.range(-2.4, 2.4);

      TEMP_POSITION.set(positionArray[i3], positionArray[i3 + 1], positionArray[i3 + 2]);
      TEMP_SCALE.set(spec.scale[0], spec.scale[1], 1);
      TEMP_MATRIX.compose(TEMP_POSITION, IDENTITY_QUATERNION, TEMP_SCALE);
      mesh.setMatrixAt(i, TEMP_MATRIX);
    }
    mesh.instanceMatrix.needsUpdate = true;

    meshes[kind] = mesh;
    positions[kind] = positionArray;
    phases[kind] = phaseArray;
    speeds[kind] = speedArray;
    spins[kind] = spinArray;
    root.add(mesh);
  }

  let elapsed = 0;
  let currentQuality = quality;

  const apply = (state: WeatherState, nextQuality: AtmosphereQuality = currentQuality): void => {
    currentQuality = nextQuality;
    const scale = PARTICLE_QUALITY_SCALE[currentQuality];
    densities.soot = clamp01(state.soot);
    densities.dust = clamp01(state.dust);
    densities.rain = clamp01(state.rain);
    densities.snow = clamp01(state.snow);
    densities.leaves = clamp01(state.leaves);

    for (const kind of PARTICLE_KINDS) {
      const spec = PARTICLE_SPECS[kind];
      const mesh = meshes[kind];
      const density = densities[kind];
      mesh.count = Math.min(spec.count, Math.max(1, Math.round(spec.count * scale)));
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = spec.opacity * density;
      mesh.visible = density > 0.015;
    }
  };

  const update = (deltaSeconds: number, camera?: THREE.Camera | null): void => {
    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? Math.min(deltaSeconds, 0.1) : 0;
    if (dt === 0) return;
    elapsed += dt;

    const halfWidth = volume.halfWidth;
    const span = halfWidth * 2;

    for (const kind of PARTICLE_KINDS) {
      const mesh = meshes[kind];
      if (!mesh.visible) continue;
      const spec = PARTICLE_SPECS[kind];
      const positionArray = positions[kind];
      const phaseArray = phases[kind];
      const speedArray = speeds[kind];
      const spinArray = spins[kind];
      const activeCount = mesh.count;

      // Billboard kinds share one camera quaternion (zero per-instance math);
      // without a camera they keep identity orientation.
      if (spec.billboard && camera) TEMP_QUATERNION.copy(camera.quaternion);
      else if (spec.billboard) TEMP_QUATERNION.identity();
      const sharedQuat = spec.billboard ? TEMP_QUATERNION : null;
      TEMP_SCALE.set(spec.scale[0], spec.scale[1], 1);

      for (let i = 0; i < activeCount; i += 1) {
        const i3 = i * 3;
        const speed = speedArray[i];
        let x = positionArray[i3];
        let y = positionArray[i3 + 1];
        let z = positionArray[i3 + 2];

        y += spec.fallSpeed * speed * dt;
        if (y < 0) y += volume.height;
        else if (y > volume.height) y -= volume.height;

        const swayPhase = elapsed * spec.swayFreq + phaseArray[i];
        x += (Math.sin(swayPhase) * spec.sway + WIND_X) * speed * dt;
        z += Math.cos(swayPhase * 0.7) * spec.sway * 0.5 * speed * dt;
        if (x > halfWidth) x -= span;
        else if (x < -halfWidth) x += span;
        if (z > halfWidth) z -= span;
        else if (z < -halfWidth) z += span;

        positionArray[i3] = x;
        positionArray[i3 + 1] = y;
        positionArray[i3 + 2] = z;

        if (sharedQuat) {
          TEMP_QUATERNION.copy(sharedQuat);
        } else {
          TEMP_EULER.set(0, 0, spinArray[i] * elapsed);
          TEMP_QUATERNION.setFromEuler(TEMP_EULER);
        }
        TEMP_POSITION.set(x, y, z);
        TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
        mesh.setMatrixAt(i, TEMP_MATRIX);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    root,
    kinds: PARTICLE_KINDS,
    meshes,
    volume,
    get quality(): AtmosphereQuality {
      return currentQuality;
    },
    countFor(kind: ParticleKind): number {
      return meshes[kind].count;
    },
    apply,
    update,
    dispose(): void {
      root.removeFromParent();
      geometry.dispose();
      for (const kind of PARTICLE_KINDS) {
        const mesh = meshes[kind];
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
        mesh.removeFromParent();
      }
      for (const texture of textures.values()) texture?.dispose();
      textures.clear();
    },
  };
}
