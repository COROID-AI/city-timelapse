/**
 * Ambient weather particles for the environment subsystem.
 *
 * Each era gets a drifting particle layer: 1945 coal-smoke haze, 1965 clear
 * air (sparse bright dust), 1985 wet-street mist, 2005 thin high haze, 2025
 * clean air (almost no particles). `applyParticleBlend` cross-fades the
 * particle material opacity between two era states so transitions never pop.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MathUtils,
  Points,
  PointsMaterial,
} from 'three';
import type { RgbColor } from '../engine/eras';

const clamp = MathUtils.clamp;

/** One era's particle layer parameters. */
export interface EraParticleState {
  readonly color: RgbColor;
  /** 0..1 density of the layer (drives opacity). */
  readonly density: number;
  /** Number of particles to spawn for the era. */
  readonly particleCount: number;
  /** Vertical spread of the layer, in world units. */
  readonly spreadY: number;
  /** Drift speed of the particles, in world units per second. */
  readonly driftSpeed: number;
}

/** A built particle layer: points object plus its geometry/material. */
export interface ParticleLayer {
  readonly points: Points;
  readonly geometry: BufferGeometry;
  readonly material: PointsMaterial;
  /** Base x/y/z positions used to recycle particles during update(). */
  readonly basePositions: Float32Array;
}

/**
 * Builds a particle layer with the given era parameters. Particles are
 * seeded with deterministic random positions within a box around the block.
 */
export function buildParticleLayer(
  state: EraParticleState,
  extent: { x: number; z: number },
): ParticleLayer {
  const count = Math.max(0, Math.floor(state.particleCount));
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const x = (Math.random() * 2 - 1) * extent.x;
    const y = Math.random() * state.spreadY;
    const z = (Math.random() * 2 - 1) * extent.z;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = y;
    basePositions[i * 3 + 2] = z;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color: new Color().setRGB(state.color.r, state.color.g, state.color.b),
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: state.density,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.name = 'environment-particles';
  points.frustumCulled = false;

  return { points, geometry, material, basePositions };
}

/**
 * Applies a particle state to a layer. Used for initial build and (through
 * `applyParticleBlend`) for era transitions.
 */
export function applyParticleState(layer: ParticleLayer, state: EraParticleState): void {
  layer.material.color.setRGB(state.color.r, state.color.g, state.color.b);
  layer.material.opacity = state.density;
  layer.points.visible = state.density > 0.001;
}

/**
 * Cross-fades a particle layer from one era state to another at progress
 * `t` (0 = from, 1 = to). Opacity and color lerp continuously; the layer
 * stays visible while either side has density.
 */
export function applyParticleBlend(
  layer: ParticleLayer,
  from: EraParticleState,
  to: EraParticleState,
  t: number,
): void {
  const k = clamp(t, 0, 1);
  layer.material.color
    .copy(new Color().setRGB(from.color.r, from.color.g, from.color.b))
    .lerp(new Color().setRGB(to.color.r, to.color.g, to.color.b), k);
  layer.material.opacity = MathUtils.lerp(from.density, to.density, k);
  layer.points.visible = layer.material.opacity > 0.001;
}

/**
 * Advances particle drift. Particles wrap around the block extents so the
 * layer reads as a continuous haze/mist.
 */
export function updateParticleLayer(layer: ParticleLayer, deltaSec: number, extent: { x: number; z: number }): void {
  const positions = layer.geometry.getAttribute('position') as BufferAttribute;
  const arr = positions.array as Float32Array;
  const base = layer.basePositions;
  const drift = layer.material.opacity > 0 ? 1 : 0;
  const speed = 0.25 * drift;
  const t = Math.min(deltaSec, 0.1);
  for (let i = 0; i < arr.length; i += 3) {
    let x = arr[i] + Math.sin(base[i] * 0.7 + performance.now() * 0.0004) * speed * t * 2 + 0.05 * speed * t;
    const y = arr[i + 1];
    let z = arr[i + 2] + 0.05 * speed * t;
    if (x > extent.x) x = -extent.x;
    if (x < -extent.x) x = extent.x;
    if (z > extent.z) z = -extent.z;
    if (z < -extent.z) z = extent.z;
    arr[i] = x;
    arr[i + 1] = y;
    arr[i + 2] = z;
  }
  positions.needsUpdate = true;
}

/** Releases the layer's GPU resources. */
export function disposeParticleLayer(layer: ParticleLayer): void {
  layer.geometry.dispose();
  layer.material.dispose();
}