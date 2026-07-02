/**
 * Era-aware traffic system.
 *
 * Spawns era-correct vehicles (built by the procedural vehicles builder) and
 * drives them along the block's traffic lanes. Each lane carries one-way
 * traffic; vehicles are evenly spaced and re-spawn at the lane's start when
 * they exit the far end.
 *
 * On era change, {@link TrafficSystem.setEra} replaces every vehicle mesh
 * in place — preserving each vehicle's lane, progress, and speed — so
 * in-flight motion continues without interruption while silhouettes,
 * palettes, and headlights instantly reflect the new era.
 *
 * Vehicle count is capped by {@link TrafficSystemOptions.maxVehicles}
 * (default 24) to keep the scene smooth.
 */
import * as THREE from 'three';
import type { EraSpec } from './eraRegistry';
import type { BlockLayout, LaneDescriptor } from './cityBlock';
import { getEraAssetSet, type EraAssetSet } from './assetBuilder/eras';

// ---------------------------------------------------------------------------
// Tunables (render policy)
// ---------------------------------------------------------------------------

/** Hard cap on simultaneously rendered vehicles (render policy). */
const DEFAULT_MAX_VEHICLES = 24;

/** Base spacing between consecutive vehicles on the same lane (world units). */
const BASE_SPACING = 22;

/** Maximum delta-time per update step (prevents large jumps on tab refocus). */
const MAX_DT = 0.1;

/** Small Y offset to keep wheel bottoms above the road surface (no z-fight). */
const WHEEL_Y_OFFSET = 0.02;

/** Per-era base cruising speed in world units per second. */
const ERA_BASE_SPEED: Record<string, number> = {
  '1945': 7,
  '1965': 11,
  '1985': 10,
  '2005': 12,
  '2025': 13,
};

/** Per-era traffic density multiplier (scales vehicles per lane). */
const ERA_DENSITY: Record<string, number> = {
  '1945': 0.6,
  '1965': 0.8,
  '1985': 1.0,
  '2005': 1.1,
  '2025': 0.9,
};

// ---------------------------------------------------------------------------
// Lane geometry helpers (pure functions)
// ---------------------------------------------------------------------------

/** Euclidean length of a lane's midline (world units). */
function laneLength(lane: LaneDescriptor): number {
  const dx = lane.end[0] - lane.start[0];
  const dz = lane.end[1] - lane.start[1];
  return Math.hypot(dx, dz);
}

/**
 * World [x, z] position at parametric progress `t` ∈ [0, 1] along a lane.
 *
 * A lateral offset shifts the vehicle perpendicular to the travel direction,
 * to the right of travel (right-hand traffic convention).
 */
function lanePoint(
  lane: LaneDescriptor,
  t: number,
  lateralOffset: number,
): [number, number] {
  const x = THREE.MathUtils.lerp(lane.start[0], lane.end[0], t);
  const z = THREE.MathUtils.lerp(lane.start[1], lane.end[1], t);
  if (lane.axis === 'x') {
    // Perpendicular is Z; right of +x travel is −z, right of −x is +z.
    return [x, z + lateralOffset * -lane.direction];
  }
  // Perpendicular is X; right of +z travel is +x, right of −z is −x.
  return [x + lateralOffset * lane.direction, z];
}

/** Y rotation so the vehicle faces its direction of travel along the lane. */
function laneFacingRotation(lane: LaneDescriptor): number {
  if (lane.axis === 'x') {
    return lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  return lane.direction > 0 ? 0 : Math.PI;
}

// ---------------------------------------------------------------------------
// Vehicle runtime model
// ---------------------------------------------------------------------------

/** A single moving vehicle instance. */
interface TrafficVehicle {
  /** Container group added to the scene; position/rotation updated each frame. */
  readonly group: THREE.Group;
  /** Index into {@link BlockLayout.trafficLanes}. */
  readonly laneIndex: number;
  /** Parametric position along the lane [0, 1). */
  progress: number;
  /** Per-vehicle speed jitter multiplier [0.85, 1.15]. */
  readonly speedFactor: number;
  /** Lateral offset from the lane centerline (world units, right of travel). */
  readonly lateralOffset: number;
  /** Stable seed for deterministic vehicle appearance within an era. */
  variantSeed: number;
}

// ---------------------------------------------------------------------------
// TrafficSystemOptions
// ---------------------------------------------------------------------------

/** Construction options for {@link TrafficSystem}. */
export interface TrafficSystemOptions {
  /** Initial era spec. */
  initialSpec: EraSpec;
  /** Block layout providing traffic lane descriptors. */
  layout: BlockLayout;
  /** Maximum simultaneous vehicles (default 24). */
  maxVehicles?: number;
}

// ---------------------------------------------------------------------------
// TrafficSystem
// ---------------------------------------------------------------------------

/**
 * A composable, era-switchable traffic system.
 *
 * Construct once, add {@link TrafficSystem.group} to a scene, then call
 * {@link TrafficSystem.update} each frame and {@link TrafficSystem.setEra}
 * when the timeline changes. Vehicle meshes swap in place on era change —
 * lane assignments, progress, and speed are all preserved.
 */
export class TrafficSystem {
  /** Root THREE group — add this to your scene. */
  readonly group: THREE.Group;

  /** The currently active era spec. */
  currentSpec: EraSpec;

  private assets: EraAssetSet;
  private readonly layout: BlockLayout;
  private readonly vehicles: TrafficVehicle[] = [];
  private readonly maxVehicles: number;

  /**
   * @param opts construction options.
   */
  constructor(opts: TrafficSystemOptions) {
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    this.currentSpec = opts.initialSpec;
    this.layout = opts.layout;
    this.maxVehicles = opts.maxVehicles ?? DEFAULT_MAX_VEHICLES;
    this.assets = getEraAssetSet(this.currentSpec);
    this.spawnInitial();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Advance all vehicles by `dt` seconds.
   *
   * Vehicles move along their assigned lanes at the era's base cruising speed
   * (scaled by per-vehicle jitter). When a vehicle reaches the end of its
   * lane it wraps to the start (re-spawn), maintaining spacing.
   *
   * @param dt  Delta time in seconds (clamped internally to 0.1 s max).
   */
  update(dt: number): void {
    const step = Math.min(Math.max(dt, 0), MAX_DT);
    if (step === 0) return;

    for (const v of this.vehicles) {
      const lane = this.layout.trafficLanes[v.laneIndex]!;
      const len = laneLength(lane);
      const speed = this.currentBaseSpeed() * v.speedFactor;
      v.progress += (speed * step) / len;

      // Re-spawn: wrap to start when exiting the far end.
      if (v.progress >= 1) {
        v.progress %= 1;
        // Re-randomize variant on re-spawn for visual variety. The vehicle
        // cache makes this a cheap clone lookup.
        v.variantSeed = Math.floor(Math.random() * 1000);
        this.clearGroup(v.group);
        v.group.add(this.assets.buildVehicle(v.variantSeed));
      }

      this.applyVehicleTransform(v);
    }
  }

  /**
   * Swap every vehicle's mesh to the new era *in place*.
   *
   * Each vehicle's lane, progress, speed factor, and lateral offset are
   * preserved — only the visual mesh (silhouette, palette, headlights) is
   * replaced — so in-flight motion continues without interruption.
   *
   * @param spec  The era spec to switch to.
   */
  setEra(spec: EraSpec): void {
    if (spec.eraId === this.currentSpec.eraId) return;
    this.currentSpec = spec;
    this.assets = getEraAssetSet(spec);

    for (const v of this.vehicles) {
      // Remove the old era's mesh. Vehicle clones share cached geometries and
      // materials with the prototype, so we only detach — disposal is managed
      // by the vehicle cache via clearVehicleCache().
      this.clearGroup(v.group);

      // Build the new era-correct vehicle (cached prototype → clone).
      const mesh = this.assets.buildVehicle(v.variantSeed);
      v.group.add(mesh);

      // Re-apply position/rotation for the new mesh.
      this.applyVehicleTransform(v);
    }
  }

  /** Current number of active vehicles. */
  get vehicleCount(): number {
    return this.vehicles.length;
  }

  /** Free all resources held by this traffic system. */
  dispose(): void {
    for (const v of this.vehicles) {
      this.clearGroup(v.group);
    }
    this.vehicles.length = 0;
    this.clearGroup(this.group);
  }

  // -----------------------------------------------------------------------
  // Internal: spawning
  // -----------------------------------------------------------------------

  /** Spawn the initial set of vehicles across all lanes. */
  private spawnInitial(): void {
    const lanes = this.layout.trafficLanes;
    const density = ERA_DENSITY[this.currentSpec.eraId] ?? 1;
    let count = 0;

    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li]!;
      const len = laneLength(lane);
      const spacing = BASE_SPACING / density;
      const perLane = Math.max(1, Math.floor(len / spacing));

      for (let i = 0; i < perLane && count < this.maxVehicles; i++, count++) {
        // Evenly distribute with a small random jitter so vehicles don't
        // appear in a perfectly rigid grid.
        const progress = i / perLane + (Math.random() - 0.5) * 0.03;
        this.spawnVehicle(li, progress);
      }
    }
  }

  /**
   * Create a single vehicle on the given lane at the given progress.
   * @returns the created vehicle.
   */
  private spawnVehicle(laneIndex: number, progress: number): TrafficVehicle {
    const lane = this.layout.trafficLanes[laneIndex]!;
    const variantSeed = Math.floor(Math.random() * 1000);
    const mesh = this.assets.buildVehicle(variantSeed);

    const group = new THREE.Group();
    group.add(mesh);

    // Per-vehicle speed jitter (±15 %) so vehicles don't move in lockstep.
    const speedFactor = 0.85 + Math.random() * 0.3;
    // Lateral jitter within the lane for visual variety (±40 % of lane width).
    const lateralOffset = (Math.random() - 0.5) * lane.width * 0.4;

    const vehicle: TrafficVehicle = {
      group,
      laneIndex,
      progress: ((progress % 1) + 1) % 1,
      speedFactor,
      lateralOffset,
      variantSeed,
    };

    this.group.add(group);
    this.vehicles.push(vehicle);
    this.applyVehicleTransform(vehicle);
    return vehicle;
  }

  // -----------------------------------------------------------------------
  // Internal: transforms
  // -----------------------------------------------------------------------

  /** Base cruising speed for the current era (world units / second). */
  private currentBaseSpeed(): number {
    return ERA_BASE_SPEED[this.currentSpec.eraId] ?? 10;
  }

  /** Set a vehicle's group position and rotation from its lane/progress. */
  private applyVehicleTransform(v: TrafficVehicle): void {
    const lane = this.layout.trafficLanes[v.laneIndex]!;
    const [x, z] = lanePoint(lane, v.progress, v.lateralOffset);
    v.group.position.set(x, WHEEL_Y_OFFSET, z);
    v.group.rotation.y = laneFacingRotation(lane);
  }

  // -----------------------------------------------------------------------
  // Internal: cleanup
  // -----------------------------------------------------------------------

  /** Remove all children from a group without disposing shared resources. */
  private clearGroup(g: THREE.Group): void {
    for (let i = g.children.length - 1; i >= 0; i--) {
      g.remove(g.children[i]!);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a {@link TrafficSystem} for the given era and block layout.
 * @param spec    Initial era spec.
 * @param layout  Block layout (provides traffic lanes).
 */
export function createTrafficSystem(
  spec: EraSpec,
  layout: BlockLayout,
): TrafficSystem {
  return new TrafficSystem({ initialSpec: spec, layout });
}
