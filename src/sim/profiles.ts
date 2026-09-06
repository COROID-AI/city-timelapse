import type { EraId } from '../types';

/**
 * Era-parameterized simulation profiles and mesh-provider contracts.
 *
 * The simulation module is era-agnostic: it never branches on which era is
 * active. Instead, each era supplies a tuning profile (agent counts + speeds)
 * and references era-specific mesh providers. The integration owner injects
 * the actual mesh builders at boot via
 * `createSimulation({ layout }).setProviders(...)` and switches eras with
 * `setProfile(eraId)`.
 */

/**
 * Builds and releases one content mesh (a pedestrian outfit or a vehicle body)
 * for an agent. Generic so the simulation logic stays decoupled from Three.js
 * and from any particular era's art direction.
 */
export interface MeshProvider<T = unknown> {
  /** Create a mesh for one agent. `seed` varies per agent for visual variety. */
  build(seed: number): T;
  /** Release a mesh previously produced by {@link build}. */
  dispose(mesh: T): void;
}

/**
 * The injected mesh providers, keyed by a stable provider id. Each era profile
 * references the provider ids it wants, so switching profiles swaps the meshes
 * attached to agents without touching the simulation logic.
 */
export interface SimulationProviders {
  /** Pedestrian outfit meshes by provider id. */
  pedestrian: ReadonlyMap<string, MeshProvider>;
  /** Vehicle body meshes by provider id. */
  vehicle: ReadonlyMap<string, MeshProvider>;
}

/**
 * Per-era tuning table: how many agents, how fast they move, and which mesh
 * providers to use. This is the only place era-specific numbers live; the
 * movement code in pedestrians.ts / vehicles.ts is shared by every era.
 */
export interface EraProfile {
  /** The era this profile tunes. */
  era: EraId;
  /** Number of pedestrian agents to spawn. */
  pedestrianCount: number;
  /** Pedestrian walking speed range (world units / second). */
  pedestrianSpeedMin: number;
  pedestrianSpeedMax: number;
  /** Number of vehicle agents to spawn. */
  vehicleCount: number;
  /** Vehicle driving speed range (world units / second). */
  vehicleSpeedMin: number;
  vehicleSpeedMax: number;
  /** Provider id for this era's pedestrian outfits. */
  pedestrianProviderId: string;
  /** Provider id for this era's vehicle bodies. */
  vehicleProviderId: string;
}

const pedestrianProviderId = (era: EraId): string => `pedestrians-${era}`;
const vehicleProviderId = (era: EraId): string => `vehicles-${era}`;

/**
 * The five era profiles, in chronological order. Counts and speeds trend
 * upward over time (more pedestrians, more traffic, faster modern movement).
 * Each era references its own mesh providers so outfits and vehicles change
 * with the time period.
 */
export const ERA_PROFILES: readonly EraProfile[] = Object.freeze([
  {
    era: '1945',
    pedestrianCount: 10,
    pedestrianSpeedMin: 0.8,
    pedestrianSpeedMax: 1.2,
    vehicleCount: 4,
    vehicleSpeedMin: 3.0,
    vehicleSpeedMax: 5.0,
    pedestrianProviderId: pedestrianProviderId('1945'),
    vehicleProviderId: vehicleProviderId('1945'),
  },
  {
    era: '1965',
    pedestrianCount: 12,
    pedestrianSpeedMin: 0.9,
    pedestrianSpeedMax: 1.3,
    vehicleCount: 5,
    vehicleSpeedMin: 3.5,
    vehicleSpeedMax: 5.5,
    pedestrianProviderId: pedestrianProviderId('1965'),
    vehicleProviderId: vehicleProviderId('1965'),
  },
  {
    era: '1985',
    pedestrianCount: 14,
    pedestrianSpeedMin: 1.0,
    pedestrianSpeedMax: 1.4,
    vehicleCount: 6,
    vehicleSpeedMin: 4.0,
    vehicleSpeedMax: 6.0,
    pedestrianProviderId: pedestrianProviderId('1985'),
    vehicleProviderId: vehicleProviderId('1985'),
  },
  {
    era: '2005',
    pedestrianCount: 16,
    pedestrianSpeedMin: 1.1,
    pedestrianSpeedMax: 1.5,
    vehicleCount: 7,
    vehicleSpeedMin: 4.5,
    vehicleSpeedMax: 6.5,
    pedestrianProviderId: pedestrianProviderId('2005'),
    vehicleProviderId: vehicleProviderId('2005'),
  },
  {
    era: '2025',
    pedestrianCount: 18,
    pedestrianSpeedMin: 1.2,
    pedestrianSpeedMax: 1.6,
    vehicleCount: 8,
    vehicleSpeedMin: 5.0,
    vehicleSpeedMax: 7.0,
    pedestrianProviderId: pedestrianProviderId('2025'),
    vehicleProviderId: vehicleProviderId('2025'),
  },
]);

/** Look up an era profile by id. */
export function getProfile(era: EraId): EraProfile {
  const profile = ERA_PROFILES.find((p) => p.era === era);
  if (!profile) {
    throw new Error(`No simulation profile registered for era '${era}'.`);
  }
  return profile;
}

/** A deterministic pseudo-random number generator (LCG) for reproducible sims. */
export type RandomFn = () => number;

/** Create a seeded LCG returning values in [0, 1). */
export function createRng(seed: number): RandomFn {
  let state = seed & 0xffffffff;
  return () => {
    // JS bitwise ops produce signed 32-bit results; `>>> 0` converts to the
    // unsigned 0..2^32-1 range so the stream never goes negative.
    state = ((state * 1664525 + 1013904223) & 0xffffffff) >>> 0;
    return state / 0x100000000;
  };
}

/** Uniform random value in [min, max). */
export function randRange(rng: RandomFn, min: number, max: number): number {
  return min + rng() * (max - min);
}