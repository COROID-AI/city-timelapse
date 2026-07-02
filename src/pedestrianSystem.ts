/**
 * Era-styled pedestrian system.
 *
 * Spawns procedurally-built, era-correct pedestrians along the city block's
 * sidewalk lanes (defined by {@link BlockLayout.sidewalkLanes}). Each
 * pedestrian walks back-and-forth along its assigned sidewalk strip, with
 * animated leg/arm swing driven by named pivot groups (`armL`, `armR`,
 * `legL`, `legR`) baked into the pedestrian builder.
 *
 * {@link PedestrianSystem.setEra} swaps every pedestrian's outfit mesh
 * in place — preserving each pedestrian's position, direction, and walk
 * phase so motion is never interrupted during an era transition.
 */
import * as THREE from 'three';
import type { EraSpec } from './eraRegistry';
import { getEraSpec, ALL_ERA_SPECS } from './eraRegistry';
import type { BlockLayout, LaneDescriptor } from './cityBlock';
import { getEraAssetSet } from './assetBuilder/eras';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Maximum number of simultaneous pedestrians (capped for performance). */
const MAX_PEDESTRIANS = 48;

/** Base walking speed in world units per second (scaled per era). */
const BASE_WALK_SPEED = 1.6;

/** Walking stride frequency in Hz (how fast legs swing). */
const STRIDE_FREQUENCY = 1.8;

/** Maximum leg/arm swing angle in radians. */
const SWING_ANGLE = 0.55;

/** Sidewalk surface Y position (top of curb). */
const SIDEWALK_Y = 0.18;

// ---------------------------------------------------------------------------
// Per-era walk-speed multiplier
// ---------------------------------------------------------------------------

/**
 * Era-appropriate pacing: 1945 is a leisurely stroll, 2025 is a brisk
 * modern pace. This multiplier is combined with {@link BASE_WALK_SPEED}.
 */
const ERA_WALK_SPEEDS: Record<string, number> = {
  '1945': 0.80,
  '1965': 0.90,
  '1985': 1.00,
  '2005': 1.10,
  '2025': 1.20,
};

// ---------------------------------------------------------------------------
// Runtime pedestrian instance
// ---------------------------------------------------------------------------

/**
 * One walking pedestrian on a sidewalk.
 *
 * The `group` holds the current era's mesh and is re-parented across era
 * swaps so world position / rotation are preserved.
 */
interface PedestrianInstance {
  /** Root THREE group — add to the system group. */
  readonly group: THREE.Group;
  /** The sidewalk lane this pedestrian walks along. */
  readonly lane: LaneDescriptor;
  /** Current distance travelled along the lane (0 → laneLength). */
  distance: number;
  /** Direction of travel: +1 (start→end) or -1 (end→start). */
  direction: 1 | -1;
  /** Per-pedestrian phase offset so the crowd doesn't march in lockstep. */
  readonly phaseOffset: number;
  /** Stable variant seed for deterministic outfit selection. */
  readonly variantSeed: number;
  /** Lateral offset within the sidewalk width (so peds don't overlap). */
  readonly lateralOffset: number;
  /** Cached pivot references for animation (null until mesh is built). */
  armL: THREE.Group | null;
  armR: THREE.Group | null;
  legL: THREE.Group | null;
  legR: THREE.Group | null;
}

// ---------------------------------------------------------------------------
// PedestrianSystem
// ---------------------------------------------------------------------------

/** Options for constructing a {@link PedestrianSystem}. */
export interface PedestrianSystemOptions {
  /** Initial era spec. Defaults to the first era (1945). */
  initialSpec?: EraSpec;
  /** Maximum pedestrians (defaults to {@link MAX_PEDESTRIANS}). */
  maxPedestrians?: number;
}

/**
 * Manages a crowd of era-styled, walking pedestrians on the city block's
 * sidewalks.
 *
 * Construct once with a {@link BlockLayout}, add {@link PedestrianSystem.group}
 * to the scene, then call {@link PedestrianSystem.update} each frame to
 * animate walking. Call {@link PedestrianSystem.setEra} to swap outfits
 * without disrupting pedestrian motion.
 */
export class PedestrianSystem {
  /** Root THREE group — add this to your scene. */
  readonly group: THREE.Group;

  /** The block layout providing sidewalk lane geometry. */
  readonly layout: BlockLayout;

  /** The currently active era spec. */
  currentSpec: EraSpec;

  /** All living pedestrian instances. */
  private readonly pedestrians: PedestrianInstance[] = [];

  /** Maximum number of pedestrians. */
  private readonly maxPedestrians: number;

  /**
   * @param layout  The city block layout (sidewalk lanes).
   * @param opts    Construction options.
   */
  constructor(layout: BlockLayout, opts: PedestrianSystemOptions = {}) {
    this.group = new THREE.Group();
    this.group.name = 'pedestrianSystem';
    this.layout = layout;
    this.currentSpec = opts.initialSpec ?? getEraSpec('1945');
    this.maxPedestrians = opts.maxPedestrians ?? MAX_PEDESTRIANS;

    this.spawnPedestrians();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Swap all pedestrians to a new era's outfits *in place*.
   *
   * Each pedestrian's mesh is rebuilt using the cached era asset set and
   * re-parented into the same group slot, preserving world position,
   * facing direction, walk phase, and lane assignment. Motion is never
   * interrupted.
   *
   * @param spec the era spec to switch to.
   */
  setEra(spec: EraSpec): void {
    if (spec.eraId === this.currentSpec.eraId) return;
    this.currentSpec = spec;

    const assets = getEraAssetSet(spec);

    for (const ped of this.pedestrians) {
      // Remove old mesh children (keep the root group — position is preserved).
      this.clearPedestrianMesh(ped);

      // Build new era-correct mesh.
      const mesh = assets.buildPedestrian(ped.variantSeed);
      mesh.name = `pedestrian-${ped.variantSeed}`;
      ped.group.add(mesh);

      // Re-bind animation pivots from the new mesh.
      this.bindPivots(ped, mesh);

      // Re-apply facing direction so the new mesh faces the right way.
      this.applyFacing(ped);
    }
  }

  /**
   * Advance all pedestrian walking animation and movement by `deltaSeconds`.
   *
   * @param deltaSeconds  Elapsed time since the last update (seconds).
   */
  update(deltaSeconds: number): void {
    const walkSpeedMul = ERA_WALK_SPEEDS[this.currentSpec.eraId] ?? 1.0;
    const speed = BASE_WALK_SPEED * walkSpeedMul;

    for (const ped of this.pedestrians) {
      this.updatePedestrian(ped, deltaSeconds, speed);
    }
  }

  /** Number of active pedestrians. */
  get count(): number {
    return this.pedestrians.length;
  }

  /** Free all GPU resources held by this system. */
  dispose(): void {
    for (const ped of this.pedestrians) {
      this.clearPedestrianMesh(ped);
      this.group.remove(ped.group);
    }
    this.pedestrians.length = 0;
  }

  // -----------------------------------------------------------------------
  // Spawning
  // -----------------------------------------------------------------------

  /**
   * Populate pedestrians across all sidewalk lanes, distributing the cap
   * evenly across the four sidewalk strips.
   */
  private spawnPedestrians(): void {
    const lanes = this.layout.sidewalkLanes;
    if (lanes.length === 0) return;

    const perLane = Math.ceil(this.maxPedestrians / lanes.length);

    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li]!;
      const laneLen = this.laneLength(lane);

      for (let i = 0; i < perLane; i++) {
        const variantSeed = 1 + li * 100 + i * 7;
        const distance = (i / perLane) * laneLen + (variantSeed % 3) * 0.5;
        const direction: 1 | -1 = i % 2 === 0 ? lane.direction : (-lane.direction as 1 | -1);
        const lateralOffset = ((variantSeed % 5) - 2) * 0.4;

        const ped = this.createPedestrian(lane, distance, direction, variantSeed, lateralOffset);
        this.pedestrians.push(ped);
        if (this.pedestrians.length >= this.maxPedestrians) return;
      }
    }
  }

  /**
   * Create a single pedestrian instance at the given lane position.
   */
  private createPedestrian(
    lane: LaneDescriptor,
    distance: number,
    direction: 1 | -1,
    variantSeed: number,
    lateralOffset: number,
  ): PedestrianInstance {
    const assets = getEraAssetSet(this.currentSpec);
    const mesh = assets.buildPedestrian(variantSeed);
    mesh.name = `pedestrian-${variantSeed}`;

    const group = new THREE.Group();
    group.name = `ped-${variantSeed}`;
    group.add(mesh);

    const ped: PedestrianInstance = {
      group,
      lane,
      distance,
      direction,
      phaseOffset: (variantSeed % 100) / 100 * Math.PI * 2,
      variantSeed,
      lateralOffset,
      armL: null,
      armR: null,
      legL: null,
      legR: null,
    };

    this.bindPivots(ped, mesh);
    this.applyFacing(ped);
    this.placePedestrian(ped);

    this.group.add(group);
    return ped;
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  /**
   * Move one pedestrian along its lane and animate its limbs.
   */
  private updatePedestrian(ped: PedestrianInstance, dt: number, speed: number): void {
    const lane = ped.lane;
    const laneLen = this.laneLength(lane);

    // Advance distance.
    ped.distance += speed * ped.direction * dt;

    // Bounce at lane ends (turn around).
    if (ped.distance >= laneLen) {
      ped.distance = laneLen;
      ped.direction = -1 as 1 | -1;
    } else if (ped.distance <= 0) {
      ped.distance = 0;
      ped.direction = 1 as 1 | -1;
    }

    // Update position.
    this.placePedestrian(ped);

    // Animate limbs.
    const t = (performance.now() / 1000) * STRIDE_FREQUENCY + ped.phaseOffset;
    const swing = Math.sin(t) * SWING_ANGLE;

    if (ped.legL) ped.legL.rotation.x = swing;
    if (ped.legR) ped.legR.rotation.x = -swing;
    if (ped.armL) ped.armL.rotation.x = -swing;
    if (ped.armR) ped.armR.rotation.x = swing;
  }

  // -----------------------------------------------------------------------
  // Geometry helpers
  // -----------------------------------------------------------------------

  /** Compute the world-space length of a lane. */
  private laneLength(lane: LaneDescriptor): number {
    const dx = lane.end[0] - lane.start[0];
    const dz = lane.end[1] - lane.start[1];
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Place a pedestrian at its current `distance` along the lane, with
   * lateral offset within the sidewalk width.
   */
  private placePedestrian(ped: PedestrianInstance): void {
    const lane = ped.lane;
    const laneLen = this.laneLength(lane);
    const t = laneLen > 0 ? ped.distance / laneLen : 0;

    const x = lane.start[0] + (lane.end[0] - lane.start[0]) * t;
    const z = lane.start[1] + (lane.end[1] - lane.start[1]) * t;

    // Lateral offset perpendicular to travel direction.
    const dx = lane.end[0] - lane.start[0];
    const dz = lane.end[1] - lane.start[1];
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    // Perpendicular (rotate 90°): (-dz, dx) / len
    const perpX = -dz / len;
    const perpZ = dx / len;

    ped.group.position.set(
      x + perpX * ped.lateralOffset,
      SIDEWALK_Y,
      z + perpZ * ped.lateralOffset,
    );
  }

  /**
   * Set the pedestrian group's Y rotation to face its travel direction.
   */
  private applyFacing(ped: PedestrianInstance): void {
    const lane = ped.lane;
    const dx = (lane.end[0] - lane.start[0]) * ped.direction;
    const dz = (lane.end[1] - lane.start[1]) * ped.direction;
    ped.group.rotation.y = Math.atan2(dx, dz);
  }

  /**
   * Find and cache the named limb pivot groups inside a pedestrian mesh.
   */
  private bindPivots(ped: PedestrianInstance, mesh: THREE.Object3D): void {
    ped.armL = this.findChildByName(mesh, 'armL');
    ped.armR = this.findChildByName(mesh, 'armR');
    ped.legL = this.findChildByName(mesh, 'legL');
    ped.legR = this.findChildByName(mesh, 'legR');
  }

  /**
   * Recursively search an object's children for a named group.
   */
  private findChildByName(root: THREE.Object3D, name: string): THREE.Group | null {
    if (root.name === name && root instanceof THREE.Group) return root;
    for (const child of root.children) {
      const found = this.findChildByName(child, name);
      if (found) return found;
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Remove and dispose the current mesh children from a pedestrian's group,
   * resetting pivot references.
   */
  private clearPedestrianMesh(ped: PedestrianInstance): void {
    for (let i = ped.group.children.length - 1; i >= 0; i--) {
      const child = ped.group.children[i]!;
      ped.group.remove(child);
      this.disposeObject(child);
    }
    ped.armL = null;
    ped.armR = null;
    ped.legL = null;
    ped.legR = null;
  }

  /**
   * Dispose geometries and materials in a mesh hierarchy.
   * Cached prototype materials/textures are shared and must not be disposed,
   * but cloned pedestrian meshes own their geometry clones, so disposing
   * geometry is safe. Materials may be shared from the cache — we skip
   * disposal of any material whose `userData.sharedCache` flag is set.
   */
  private disposeObject(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && 'dispose' in m && typeof m.dispose === 'function') {
          const mat = m as THREE.MeshStandardMaterial;
          if (mat.userData?.sharedCache) continue;
          (m as THREE.Material).dispose();
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a {@link PedestrianSystem} for a given block layout and era.
 * @param layout  The city block layout.
 * @param eraId   The era to initialise with (defaults to '1945').
 */
export function createPedestrianSystem(layout: BlockLayout, eraId: string = '1945'): PedestrianSystem {
  return new PedestrianSystem(layout, { initialSpec: getEraSpec(eraId) });
}

/**
 * Pre-create pedestrian systems for all eras (useful for scene bootstrap).
 * @param layout  The city block layout.
 */
export function createAllEraPedestrianSystems(layout: BlockLayout): Record<string, PedestrianSystem> {
  const systems: Record<string, PedestrianSystem> = {};
  for (const spec of ALL_ERA_SPECS) {
    systems[spec.eraId] = new PedestrianSystem(layout, { initialSpec: spec });
  }
  return systems;
}
