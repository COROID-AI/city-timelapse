/**
 * Era-aware traffic system for the City Time Period Timelapse.
 *
 * Spawns era-correct vehicles (produced by the procedural vehicle builder) and
 * drives them along the block-defined traffic lanes. Each lane is one-way; the
 * system handles lane direction, basic spacing between vehicles, and seamless
 * re-spawning when a vehicle exits the far end of its lane.
 *
 * Vehicles reflect the active era's {@link VehicleEraData}: body-style
 * silhouette, paint palette, and headlight colour all come from the era spec
 * via the cached builder, so switching eras is visually correct.
 *
 * Era transitions are smooth: when {@link TrafficSystem.setEra} is called, the
 * vehicles currently in flight fade out over a short crossfade window while
 * replacement vehicles of the new era fade in at the same positions. This
 * avoids a jarring "pop" where every car disappears and reappears instantly.
 *
 * The system owns a single `THREE.Group` root that is added to the scene once;
 * vehicles are added/removed as children of that root across the lifetime of
 * the block.
 */

import * as THREE from 'three';
import type { EraSpec, VehicleEraData } from './eras/types.js';
import type { TrafficLane } from './cityBlock.js';
import { getVehicle } from './assetBuilder/vehicles.js';
import {
  createRng,
  disposeObject3D,
} from './assetBuilder/util.js';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * Minimum gap (metres) that must exist between the rear of one vehicle and the
 * front of the next before a new vehicle may spawn in the same lane. Keeps
 * spawning safe and prevents vehicles overlapping.
 */
const MIN_SPAWN_GAP = 8;

/**
 * Duration of the era crossfade, in seconds. Old-era vehicles fade out and
 * new-era vehicles fade in over this window so the transition reads as a
 * dissolve rather than a hard cut.
 */
const ERA_CROSSFADE_SECONDS = 1.5;

/**
 * How many seconds of spacing to target between vehicles on a lane, derived
 * from the era's density. Higher density → shorter intervals → more cars.
 */
const DENSITY_INTERVAL_BASE = 6;

/**
 * Small jitter applied to spawn timing so vehicles don't appear at perfectly
 * regular intervals (which looks mechanical).
 */
const SPAWN_JITTER = 0.35;

/**
 * Per-vehicle speed variance factor. Each car drives within ±this fraction of
 * the era's target speed so traffic doesn't look like a convoy.
 */
const SPEED_VARIANCE = 0.18;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for constructing a {@link TrafficSystem}.
 */
export interface TrafficSystemOptions {
  /**
   * The traffic lanes, sourced from {@link BlockLayout.lanes}. The system
   * reads lane direction, centre X, spawn/end Z, and surface Y from each.
   */
  lanes: readonly TrafficLane[];
}

/**
 * Transition state for a vehicle during an era change.
 *
 * - `'none'`     — normal driving, fully opaque.
 * - `'fadingIn'`  — newly spawned replacement; opacity ramps 0 → 1.
 * - `'fadingOut'` — outgoing old-era vehicle; opacity ramps 1 → 0 then removed.
 */
type TransitionState = 'none' | 'fadingIn' | 'fadingOut';

/**
 * Runtime representation of a single vehicle in the scene.
 *
 * An {@link ActiveVehicle} wraps a cloned `THREE.Group` (so each car can be
 * positioned, faded, and disposed independently of the shared asset cache) and
 * tracks its progress along a lane.
 */
interface ActiveVehicle {
  /** The cloned vehicle mesh group. Owns its own materials (see cloneVehicle). */
  mesh: THREE.Group;
  /** The lane this vehicle is driving on. */
  lane: TrafficLane;
  /** Index into the era's body-styles array (determines silhouette/colour). */
  variantIndex: number;
  /** Current Z position along the lane axis. */
  z: number;
  /** Current speed in m/s (always positive; direction comes from the lane). */
  speed: number;
  /** Transition state used during era crossfades. */
  transition: TransitionState;
  /** Remaining seconds in the current transition (0 when `transition === 'none'`). */
  transitionTime: number;
  /** Total duration of the current transition (for normalising the progress). */
  transitionDuration: number;
  /**
   * Collected references to the cloned materials whose opacity we control.
   * Cached at creation so the update loop doesn't traverse every frame.
   */
  fadeMaterials: THREE.MeshStandardMaterial[];
}

// ---------------------------------------------------------------------------
// TrafficSystem
// ---------------------------------------------------------------------------

/**
 * The era-aware traffic controller.
 *
 * Owns a root `THREE.Group` added to the scene, manages per-lane vehicle pools,
 * spawns / moves / respawns vehicles every frame, and crossfades the fleet when
 * the era changes.
 *
 * Usage:
 * ```ts
 * const traffic = new TrafficSystem({ lanes: block.getLayout().lanes });
 * scene.add(traffic.root);
 * traffic.setEra(getEra('1965'));
 * // each frame:
 * traffic.update(deltaSeconds);
 * ```
 */
export class TrafficSystem {
  /** Root group — add this to the scene once. */
  readonly root: THREE.Group;

  /** The lanes the system drives vehicles on. */
  private readonly lanes: readonly TrafficLane[];

  /** All currently active vehicles across all lanes. */
  private readonly vehicles: ActiveVehicle[] = [];

  /** Per-lane spawn timers: seconds remaining before the next spawn attempt. */
  private readonly spawnTimers: number[];

  /** Per-lane RNG for deterministic-but-varied spawn timing. */
  private readonly laneRngs: (() => number)[];

  /** The currently active era (set on first `setEra`). */
  private activeEra: EraSpec | null = null;

  /** Whether an era crossfade is currently in progress. */
  private crossfading = false;

  /**
   * Create the traffic system.
   *
   * @param opts  Lanes and optional configuration.
   */
  constructor(opts: TrafficSystemOptions) {
    this.root = new THREE.Group();
    this.root.name = 'traffic-system';

    this.lanes = opts.lanes;
    this.spawnTimers = this.lanes.map(() => 0);
    this.laneRngs = this.lanes.map((lane, i) =>
      createRng(0xBAD + i * 7919 + lane.direction * 31),
    );
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Switch the traffic fleet to a new era.
   *
   * On the very first call this populates the lanes with era-correct vehicles.
   * On subsequent calls the existing vehicles fade out while replacement
   * vehicles of the new era fade in at matching positions, producing a smooth
   * dissolve rather than a hard swap.
   *
   * @param era  The era spec to activate.
   */
  setEra(era: EraSpec): void {
    // No-op if the era is already active and no crossfade is pending.
    if (this.activeEra?.id === era.id && !this.crossfading) {
      return;
    }

    const isFirstEra = this.activeEra === null;

    if (isFirstEra) {
      // First population — spawn directly at full opacity.
      this.activeEra = era;
      this.populateLanes(era);
      return;
    }

    // Era change — crossfade.
    this.crossfading = true;
    this.transitionToEra(era);
  }

  /**
   * Advance the traffic simulation by `delta` seconds.
   *
   * Moves every vehicle along its lane, handles spawn timers, fades vehicles
   * during transitions, and respawns vehicles that exit the lane.
   *
   * @param delta  Elapsed seconds since the last update.
   */
  update(delta: number): void {
    // Clamp delta to avoid huge jumps after a tab-switch / frame stall.
    const dt = Math.min(delta, 0.1);

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i]!;
      this.stepVehicle(v, dt);
    }

    // Handle spawn timers for each lane.
    for (let li = 0; li < this.lanes.length; li++) {
      this.spawnTimers[li] -= dt;
      if (this.spawnTimers[li] <= 0 && this.activeEra) {
        this.trySpawn(this.lanes[li]!, li, this.activeEra);
      }
    }

    // Once all fade-outs have completed, the crossfade is finished.
    if (this.crossfading && !this.vehicles.some((v) => v.transition === 'fadingOut')) {
      this.crossfading = false;
    }
  }

  /**
   * The era the traffic system is currently rendering, or `null` before the
   * first `setEra` call.
   */
  getEra(): EraSpec | null {
    return this.activeEra;
  }

  /**
   * The current number of active vehicles across all lanes.
   */
  get vehicleCount(): number {
    return this.vehicles.length;
  }

  /**
   * Dispose all vehicles and reset to an empty state.
   * The root group remains in the scene; only its children are removed.
   */
  dispose(): void {
    for (const v of this.vehicles) {
      this.root.remove(v.mesh);
      disposeObject3D(v.mesh);
    }
    this.vehicles.length = 0;
    this.spawnTimers.fill(0);
    this.activeEra = null;
    this.crossfading = false;
  }

  // -------------------------------------------------------------------------
  // Population & spawning
  // -------------------------------------------------------------------------

  /**
   * Populate every lane with era-correct vehicles at startup.
   *
   * Vehicles are seeded along the lane at intervals derived from the era's
   * density, each offset slightly so the lane doesn't start empty.
   */
  private populateLanes(era: EraSpec): void {
    for (let li = 0; li < this.lanes.length; li++) {
      const lane = this.lanes[li]!;
      const rng = this.laneRngs[li]!;
      const interval = this.spawnInterval(era.vehicles);
      const laneLength = Math.abs(lane.endZ - lane.spawnZ);

      // Place vehicles from the spawn end, spaced by `interval` metres.
      let offset = interval * (0.5 + rng() * 0.5);
      while (offset < laneLength) {
        const z = lane.spawnZ + lane.direction * offset;
        this.spawnVehicle(era, lane, z, 'none');
        offset += interval * (0.8 + rng() * 0.4);
      }

      // Set the next spawn timer.
      this.spawnTimers[li] = interval * (0.5 + rng() * SPAWN_JITTER);
    }
  }

  /**
   * Attempt to spawn a new vehicle at the back of a lane.
   *
   * "Safe spawning": the vehicle is only created if there is no other vehicle
   * within {@link MIN_SPAWN_GAP} of the spawn point, preventing overlaps.
   */
  private trySpawn(lane: TrafficLane, laneIndex: number, era: EraSpec): void {
    const rng = this.laneRngs[laneIndex]!;

    // Check the lane for nearby vehicles near the spawn point.
    if (!this.isSpawnClear(lane)) {
      // Retry soon.
      this.spawnTimers[laneIndex] = 1.0 + rng() * 0.5;
      return;
    }

    this.spawnVehicle(era, lane, lane.spawnZ, 'none');

    // Reset timer based on era density.
    const interval = this.spawnInterval(era.vehicles);
    this.spawnTimers[laneIndex] = interval * (1 - SPAWN_JITTER + rng() * SPAWN_JITTER * 2);
  }

  /**
   * Check whether the spawn point of a lane is clear of other vehicles.
   */
  private isSpawnClear(lane: TrafficLane): boolean {
    for (const v of this.vehicles) {
      if (v.lane.id !== lane.id) continue;
      const dist = Math.abs(v.z - lane.spawnZ);
      if (dist < MIN_SPAWN_GAP) return false;
    }
    return true;
  }

  /**
   * Spawn a single vehicle on a lane at the given Z, with an optional
   * transition state (used during era crossfades).
   */
  private spawnVehicle(
    era: EraSpec,
    lane: TrafficLane,
    z: number,
    transition: TransitionState,
  ): ActiveVehicle | null {
    const v = era.vehicles;
    if (v.bodyStyles.length === 0) return null;

    // Pick a body-style variant, weighting commercial vehicles occasionally.
    const rng = Math.random();
    let variantIndex: number;
    if (rng < v.commercialFraction && v.bodyStyles.includes('pickup')) {
      variantIndex = v.bodyStyles.indexOf('pickup');
    } else {
      variantIndex = Math.floor(Math.random() * v.bodyStyles.length);
    }

    // Fetch the cached template and clone it so we get independent materials.
    const template = getVehicle(era, variantIndex);
    const mesh = this.cloneVehicle(template);

    // Apply fade materials and set initial opacity for the transition.
    const fadeMaterials = this.collectFadeMaterials(mesh);
    if (transition === 'fadingIn') {
      this.setMaterialsOpacity(fadeMaterials, 0);
    }

    // Determine speed with per-vehicle variance.
    const baseSpeed = v.targetSpeed;
    const speed = baseSpeed * (1 - SPEED_VARIANCE + Math.random() * SPEED_VARIANCE * 2);

    const vehicle: ActiveVehicle = {
      mesh,
      lane,
      variantIndex,
      z,
      speed,
      transition,
      transitionTime: transition === 'none' ? 0 : ERA_CROSSFADE_SECONDS,
      transitionDuration: ERA_CROSSFADE_SECONDS,
      fadeMaterials,
    };

    this.positionVehicle(vehicle);
    this.root.add(mesh);
    this.vehicles.push(vehicle);
    return vehicle;
  }

  /**
   * Compute the mean seconds between spawns for a lane, based on the era's
   * density value. Higher density → shorter intervals.
   */
  private spawnInterval(data: VehicleEraData): number {
    // density ranges ~6–18 in the registry; map to 6s down to ~2.5s.
    const clamped = Math.max(1, data.density);
    return Math.max(2.0, DENSITY_INTERVAL_BASE - clamped * 0.25);
  }

  // -------------------------------------------------------------------------
  // Per-vehicle stepping
  // -------------------------------------------------------------------------

  /**
   * Advance a single vehicle: move it, update transitions, respawn on exit.
   */
  private stepVehicle(v: ActiveVehicle, dt: number): void {
    // Move along the lane direction.
    v.z += v.lane.direction * v.speed * dt;

    // Update transition fade.
    if (v.transition !== 'none') {
      v.transitionTime -= dt;
      const progress = 1 - Math.max(0, v.transitionTime) / v.transitionDuration;
      if (v.transition === 'fadingIn') {
        this.setMaterialsOpacity(v.fadeMaterials, progress);
        if (v.transitionTime <= 0) {
          v.transition = 'none';
          v.transitionTime = 0;
          this.setMaterialsOpacity(v.fadeMaterials, 1);
        }
      } else {
        // fadingOut
        this.setMaterialsOpacity(v.fadeMaterials, 1 - progress);
        if (v.transitionTime <= 0) {
          this.removeVehicle(v);
          return;
        }
      }
    }

    // Check if the vehicle has exited the lane end.
    const exited =
      v.lane.direction > 0 ? v.z >= v.lane.endZ : v.z <= v.lane.endZ;

    if (exited) {
      // Re-spawn: wrap to the spawn end (only for non-fading-out vehicles).
      if (v.transition === 'fadingOut') {
        this.removeVehicle(v);
        return;
      }
      v.z = v.lane.spawnZ;
    }

    this.positionVehicle(v);
  }

  /**
   * Update the mesh transform to match the vehicle's lane position.
   *
   * The vehicle template faces +Z. For northbound lanes (direction +1) the
   * front (+Z) should point in the travel direction (+Z), so no rotation is
   * needed. For southbound lanes (direction -1) the vehicle must face -Z,
   * achieved by rotating 180° about the Y axis.
   */
  private positionVehicle(v: ActiveVehicle): void {
    v.mesh.position.set(v.lane.centerX, v.lane.surfaceY, v.z);
    v.mesh.rotation.y = v.lane.direction > 0 ? 0 : Math.PI;
  }

  /**
   * Remove a vehicle from the scene and dispose its cloned resources.
   */
  private removeVehicle(v: ActiveVehicle): void {
    this.root.remove(v.mesh);
    disposeObject3D(v.mesh);
    const idx = this.vehicles.indexOf(v);
    if (idx >= 0) this.vehicles.splice(idx, 1);
  }

  // -------------------------------------------------------------------------
  // Era crossfade
  // -------------------------------------------------------------------------

  /**
   * Begin a crossfade from the current era to a new one.
   *
   * Every active vehicle is marked `fadingOut`, and a replacement vehicle of
   * the new era is spawned at the same lane position, marked `fadingIn`. Over
   * {@link ERA_CROSSFADE_SECONDS} the old fleet dissolves and the new fleet
   * takes over.
   *
   * @param era  The new era to transition to.
   */
  private transitionToEra(era: EraSpec): void {
    // Snapshot the current fleet (the array will be mutated as we spawn).
    const current = [...this.vehicles];

    for (const v of current) {
      // Mark the old vehicle for fade-out.
      v.transition = 'fadingOut';
      v.transitionTime = ERA_CROSSFADE_SECONDS;
      v.transitionDuration = ERA_CROSSFADE_SECONDS;

      // Spawn a replacement of the new era on the same lane & Z.
      this.spawnVehicle(era, v.lane, v.z, 'fadingIn');
    }

    this.activeEra = era;
  }

  // -------------------------------------------------------------------------
  // Material cloning & opacity
  // -------------------------------------------------------------------------

  /**
   * Deep-clone a cached vehicle template so each instance owns independent
   * materials (and thus independent opacity for crossfades).
   *
   * `THREE.Object3D.clone()` shares geometry and material references by
   * default. We clone materials explicitly here so fading one car does not
   * affect the cached template or sibling cars.
   */
  private cloneVehicle(template: THREE.Group): THREE.Group {
    const clone = template.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.material) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone());
      } else {
        mesh.material = mesh.material.clone();
      }
    });
    return clone;
  }

  /**
   * Collect every `MeshStandardMaterial` in a vehicle group that should be
   * affected by opacity fades.
   *
   * We fade the body paint, glass, bumpers, and details — essentially all
   * standard materials — but skip taillight/headlight emissive materials are
   * also faded for consistency. Materials are marked transparent so opacity
   * changes take effect.
   */
  private collectFadeMaterials(group: THREE.Group): THREE.MeshStandardMaterial[] {
    const materials: THREE.MeshStandardMaterial[] = [];
    const seen = new Set<THREE.Material>();

    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.material) return;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial && !seen.has(mat)) {
          seen.add(mat);
          mat.transparent = true;
          materials.push(mat);
        }
      }
    });

    return materials;
  }

  /**
   * Set the opacity on a collection of materials.
   *
   * @param materials  The materials to update.
   * @param opacity    Target opacity (0–1).
   */
  private setMaterialsOpacity(
    materials: THREE.MeshStandardMaterial[],
    opacity: number,
  ): void {
    for (const mat of materials) {
      mat.opacity = opacity;
    }
  }
}
