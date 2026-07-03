/**
 * Era-styled pedestrian system for the City Time Period Timelapse.
 *
 * Spawns and animates era-correct pedestrians along the city block's
 * sidewalks. Each pedestrian is an instance of the phase 1 procedural
 * pedestrian builder ({@link getPedestrian}), cloned so every figure can
 * move independently while sharing the cached geometry/materials.
 *
 * The system exposes {@link PedestrianSystem.setEra} so the main scene can
 * swap every pedestrian's outfit instantly when the timeline slider moves.
 * On an era change the population is rebuilt with the new era's silhouettes,
 * palette, density, and walking speed — but the spawn positions are reused so
 * the transition feels continuous rather than a hard cut.
 *
 * Walk animation:
 * Each pedestrian's legs and arms rotate around their hip/shoulder pivots
 * (named groups inserted by the builder) using a sine-driven swing. The swing
 * frequency scales with the era's `walkSpeed` so 1945 strollers amble while
 * 2025 pedestrians stride. Legs alternate; arms swing opposite to the legs.
 */

import * as THREE from 'three';
import type { EraSpec } from './eras/types.js';
import type { BlockLayout, SidewalkPath } from './cityBlock.js';
import { getPedestrian, getPedestrianLimbs, type PedestrianLimbs } from './assetBuilder/pedestrian.js';
import { createRng, eraSeed, disposeObject3D } from './assetBuilder/util.js';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Maximum number of pedestrians per sidewalk path. */
const MAX_PER_SIDEWALK = 14;

/** Amplitude of the leg swing in radians (~±25°). */
const LEG_SWING_AMP = 0.42;

/** Amplitude of the arm swing in radians (~±18°). */
const ARM_SWING_AMP = 0.30;

/** Multiplier converting era walkSpeed (m/s) into stride frequency (Hz). */
const STRIDE_FREQ_SCALE = 0.55;

/** Lateral scatter within the sidewalk band (fraction of width). */
const LATERAL_SCATTER = 0.6;

/** Small per-instance speed variance so pedestrians don't march in lockstep. */
const SPEED_VARIANCE = 0.15;

/** Despawn margin so pedestrians fully exit the frame before recycling (m). */
const DESPAWN_MARGIN = 1.5;

// ---------------------------------------------------------------------------
// Runtime pedestrian instance
// ---------------------------------------------------------------------------

/**
 * A single active pedestrian in the scene.
 *
 * The {@link mesh} is a **clone** of the cached builder output so it can be
 * positioned and animated independently. {@link limbs} are the resolved pivot
 * references inside that clone (may be `null` for variants without limbs).
 */
interface PedestrianInstance {
  /** The cloned pedestrian group, parented to the system root. */
  mesh: THREE.Group;
  /** Limb pivots for walk animation, or `null` if unavailable. */
  limbs: PedestrianLimbs | null;
  /** Which sidewalk path this pedestrian walks on. */
  path: SidewalkPath;
  /** Travel direction: +1 = +Z, -1 = -Z. */
  direction: 1 | -1;
  /** Current speed in m/s (era walkSpeed ± variance). */
  speed: number;
  /** Phase offset for the walk-cycle sine (radians). */
  phase: number;
  /** Variant index used to pick the silhouette from the era. */
  variantIndex: number;
}

// ---------------------------------------------------------------------------
// Public options interface
// ---------------------------------------------------------------------------

/** Options for constructing a {@link PedestrianSystem}. */
export interface PedestrianSystemOptions {
  /** The city block layout — sidewalks are read from here. */
  layout: BlockLayout;
}

// ---------------------------------------------------------------------------
// PedestrianSystem
// ---------------------------------------------------------------------------

/**
 * Owns and drives all pedestrians on the block.
 *
 * Lifecycle:
 * 1. `new PedestrianSystem({ layout })` — creates the root group (empty).
 * 2. `setEra(spec)` — spawns the era-appropriate population.
 * 3. `update(dt)` — advances walking positions and limb animation each frame.
 * 4. `setEra(nextSpec)` — swaps outfits: removes old meshes, spawns new ones.
 * 5. `dispose()` — tears everything down and frees GPU resources.
 *
 * The root {@link THREE.Group} should be added to the scene once; it is
 * reused across era changes (children are swapped, not the group itself).
 */
export class PedestrianSystem {
  /** Root group — add this to the scene. */
  readonly root: THREE.Group;

  /** The block layout (sidewalk paths are read from here). */
  private readonly layout: BlockLayout;

  /** The currently active era, or `null` before the first `setEra`. */
  private activeEra: EraSpec | null = null;

  /** Active pedestrian instances. */
  private readonly pedestrians: PedestrianInstance[] = [];

  /** Per-era RNG for deterministic spawn distribution. */
  private rng: () => number = Math.random;

  /**
   * Create the pedestrian system.
   *
   * The root group is created immediately but remains empty until
   * {@link setEra} is called.
   */
  constructor(options: PedestrianSystemOptions) {
    this.root = new THREE.Group();
    this.root.name = 'pedestrian-system';
    this.layout = options.layout;
  }

  // ---------------------------------------------------------------------
  // Era management
  // ---------------------------------------------------------------------

  /**
   * The currently active era spec, or `null` before the first {@link setEra}.
   */
  getEra(): EraSpec | null {
    return this.activeEra;
  }

  /**
   * Switch the pedestrian population to a new era.
   *
   * All existing pedestrian meshes are removed and disposed, then a fresh
   * population is spawned using the new era's silhouettes, palette, density,
   * and walking speed. Spawn positions along the sidewalks are reused so the
   * visual transition feels continuous.
   *
   * Calling with the same era id is a no-op.
   *
   * @param era  The era spec to activate.
   */
  setEra(era: EraSpec): void {
    // No-op if the era hasn't changed.
    if (this.activeEra?.id === era.id) return;

    // Tear down the old population.
    this.clearPedestrians();

    this.activeEra = era;
    this.rng = createRng(eraSeed(era, 'pedestrian-system'));

    // Spawn the new era-appropriate population.
    this.spawnPopulation(era);
  }

  // ---------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------

  /**
   * Advance the pedestrian simulation by `dt` seconds.
   *
   * Moves each pedestrian along their sidewalk, wraps them when they reach
   * the end, and animates the leg/arm swing based on their speed.
   *
   * @param dt  Delta time in seconds (clamped to avoid huge steps).
   */
  update(dt: number): void {
    if (!this.activeEra || this.pedestrians.length === 0) return;

    // Clamp dt to avoid tunneling through the block on frame hitches.
    const step = Math.min(dt, 0.1);

    for (const ped of this.pedestrians) {
      // --- Translate along the sidewalk (Z axis) ---
      const dz = ped.speed * ped.direction * step;
      ped.mesh.position.z += dz;

      // --- Recycle when past the end of the path ---
      const path = ped.path;
      if (ped.direction === 1 && ped.mesh.position.z > path.endZ + DESPAWN_MARGIN) {
        // Walking +Z: wrap to the spawn end.
        ped.mesh.position.z = path.spawnZ - DESPAWN_MARGIN;
      } else if (ped.direction === -1 && ped.mesh.position.z < path.endZ - DESPAWN_MARGIN) {
        // Walking -Z: wrap to the spawn end.
        ped.mesh.position.z = path.spawnZ + DESPAWN_MARGIN;
      }

      // --- Animate limbs (walk cycle) ---
      if (ped.limbs) {
        const freq = ped.speed * STRIDE_FREQ_SCALE;
        const phase = ped.phase + performance.now() * 0.001 * freq * Math.PI * 2;
        const legSwing = Math.sin(phase) * LEG_SWING_AMP;
        const armSwing = Math.sin(phase) * ARM_SWING_AMP;

        // Legs alternate; arms swing opposite to the ipsilateral leg.
        ped.limbs.legL.rotation.x = legSwing;
        ped.limbs.legR.rotation.x = -legSwing;
        ped.limbs.armL.rotation.x = -armSwing;
        ped.limbs.armR.rotation.x = armSwing;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------

  /**
   * Fully dispose the system: removes all pedestrians from the root and
   * disposes their (cloned) GPU resources.
   */
  dispose(): void {
    this.clearPedestrians();
    this.activeEra = null;
  }

  // ---------------------------------------------------------------------
  // Internal: population management
  // ---------------------------------------------------------------------

  /**
   * Remove and dispose all active pedestrians without touching the root group.
   */
  private clearPedestrians(): void {
    for (const ped of this.pedestrians) {
      this.root.remove(ped.mesh);
      disposeObject3D(ped.mesh);
    }
    this.pedestrians.length = 0;
  }

  /**
   * Spawn the era-appropriate population across all sidewalk paths.
   *
   * The number of pedestrians per sidewalk is derived from the era's
   * `density` (0–1) scaled against {@link MAX_PER_SIDEWALK}. Each pedestrian
   * gets a deterministic variant (silhouette index), a randomised lateral
   * offset within the walkable band, and a speed based on the era's
   * `walkSpeed` with small per-instance variance.
   */
  private spawnPopulation(era: EraSpec): void {
    const ped = era.pedestrians;
    const count = Math.round(MAX_PER_SIDEWALK * ped.density);
    if (count <= 0) return;

    const sidewalks = this.layout.sidewalks;
    const baseSpeed = ped.walkSpeed;

    for (const path of sidewalks) {
      const direction = path.side === 'east' ? 1 : -1;
      // Evenly distribute spawn Z across the path length so pedestrians don't
      // clump at one end at spawn time.
      const span = Math.abs(path.endZ - path.spawnZ);
      const step = span / Math.max(count, 1);

      for (let i = 0; i < count; i++) {
        const variantIndex = i % ped.silhouettes.length;

        // Lateral offset within the walkable band.
        const lateral = (this.rng() - 0.5) * path.width * LATERAL_SCATTER;

        // Randomised initial Z so the population isn't a perfect grid.
        const zJitter = (this.rng() - 0.5) * step * 0.5;
        const z = path.spawnZ + i * step * direction + zJitter;

        // Speed with per-instance variance.
        const speed = baseSpeed * (1 + (this.rng() - 0.5) * SPEED_VARIANCE * 2);

        // Walk-cycle phase offset so pedestrians are out of sync.
        const phase = this.rng() * Math.PI * 2;

        this.spawnPedestrian(era, variantIndex, path, direction, lateral, z, speed, phase);
      }
    }
  }

  /**
   * Create a single pedestrian instance and add it to the scene.
   */
  private spawnPedestrian(
    era: EraSpec,
    variantIndex: number,
    path: SidewalkPath,
    direction: 1 | -1,
    lateralOffset: number,
    z: number,
    speed: number,
    phase: number,
  ): void {
    // Clone the cached builder output so this instance can move independently.
    const template = getPedestrian(era, variantIndex);
    const mesh = template.clone(true);
    mesh.name = `pedestrian:${era.id}:${variantIndex}:${this.pedestrians.length}`;

    // Position on the sidewalk surface.
    mesh.position.set(
      path.centerX + lateralOffset,
      path.surfaceY,
      z,
    );

    // Face the walking direction. The builder models face +Z by default,
    // so rotate 180° for southbound (-Z) pedestrians.
    mesh.rotation.y = direction === 1 ? 0 : Math.PI;

    // Resolve limb pivots inside the clone for walk animation.
    const limbs = getPedestrianLimbs(mesh);

    this.root.add(mesh);

    this.pedestrians.push({
      mesh,
      limbs,
      path,
      direction,
      speed,
      phase,
      variantIndex,
    });
  }
}
