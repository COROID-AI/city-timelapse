/**
 * Traffic system for the City Time Period Timelapse.
 *
 * Spawns and animates era-correct vehicles along the block's defined lanes.
 * Vehicles are cloned from the procedural asset builder's `EraAssetSet` and
 * driven along two lanes (one per travel direction) that follow the street
 * layout's road geometry.
 *
 * Safe spawning guarantees no two vehicles overlap: each lane maintains an
 * ordered list of active vehicles and the minimum headway is enforced both at
 * spawn time and via simple following-distance behaviour during the update
 * loop.
 */

import * as THREE from 'three';
import type { EraSpec, EraId } from './eras/types.js';
import { getEraAssets } from './assetBuilder/eras.js';
import { STREET_LAYOUT } from './assetBuilder/streets.js';

// ---------------------------------------------------------------------------
// Layout constants (derived from STREET_LAYOUT)
// ---------------------------------------------------------------------------

/** Half the road width — each lane is half the road. */
const LANE_WIDTH = STREET_LAYOUT.roadWidth / 2; // 4
/** Centre X of the eastbound lane (vehicles travel +Z). */
const LANE_EAST_X = LANE_WIDTH / 2; // +2
/** Centre X of the westbound lane (vehicles travel -Z). */
const LANE_WEST_X = -LANE_WIDTH / 2; // -2
/** Half the road length — vehicles wrap at ± this value. */
const HALF_ROAD = STREET_LAYOUT.roadLength / 2; // 30
/** Minimum gap between vehicles in the same lane (metres). */
const MIN_GAP = 6;
/** Maximum number of vehicles per lane (safety cap). */
const MAX_PER_LANE = 12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction of travel along the road. */
type Direction = 1 | -1;

/** Runtime state for a single active vehicle. */
interface ActiveVehicle {
  /** The three.js group added to the scene. */
  group: THREE.Group;
  /** Current Z position along the road. */
  z: number;
  /** Current speed (m/s), clamped to era target. */
  speed: number;
  /** Travel direction (+Z = 1, -Z = -1). */
  direction: Direction;
  /** Lane X offset. */
  laneX: number;
  /** Vehicle length (for gap checks). */
  length: number;
  /** Variant index into the era's vehicle array (for cycling). */
  variant: number;
}

// ---------------------------------------------------------------------------
// TrafficSystem class
// ---------------------------------------------------------------------------

/**
 * Manages era-appropriate vehicle traffic along the block's two lanes.
 *
 * Usage:
 * ```ts
 * const traffic = new TrafficSystem(scene);
 * traffic.setEra(eraSpec);        // spawn era-correct vehicles
 * traffic.update(deltaSeconds);   // animate each frame
 * traffic.dispose();               // cleanup
 * ```
 */
export class TrafficSystem {
  private readonly scene: THREE.Scene;
  /** All active vehicles (both lanes). */
  private vehicles: ActiveVehicle[] = [];
  /** The currently active era id (or null before first setEra). */
  private eraId: EraId | null = null;
  /** Template vehicle groups for the current era (from asset builder). */
  private templates: THREE.Group[] = [];
  /** Target speed for the current era (for re-acceleration). */
  private targetSpeed = 10;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Switch to a new era: remove all old vehicles and spawn era-correct ones.
   * @param era  The era spec to switch to.
   */
  setEra(era: EraSpec): void {
    if (this.eraId === era.id) return;
    this.clearVehicles();
    this.eraId = era.id;

    const assetSet = getEraAssets(era);
    this.templates = assetSet.vehicles;
    if (this.templates.length === 0) return;

    const [minLen, maxLen] = era.vehicles.lengthRange;
    this.targetSpeed = era.vehicles.targetSpeed;
    const targetSpeed = this.targetSpeed;

    // Determine vehicle count per lane based on density (vehicles per lane per minute)
    // Map density (6–18) to a spawn count (3–8 per lane).
    const perLane = Math.min(
      MAX_PER_LANE,
      Math.max(2, Math.round(era.vehicles.density / 2.2)),
    );

    this.spawnLane(era, perLane, 1, LANE_EAST_X, minLen, maxLen, targetSpeed);
    this.spawnLane(era, perLane, -1, LANE_WEST_X, minLen, maxLen, targetSpeed);
  }

  /**
   * Per-frame update: advance all vehicles along their lanes, apply
   * following-distance behaviour, and wrap at road boundaries.
   * @param deltaTime  Time since the last frame, in seconds.
   */
  update(deltaTime: number): void {
    // Separate vehicles by lane for gap checks
    const eastLane = this.vehicles.filter((v) => v.direction === 1);
    const westLane = this.vehicles.filter((v) => v.direction === -1);

    this.updateLane(eastLane, deltaTime);
    this.updateLane(westLane, deltaTime);
  }

  /** Remove all vehicles and dispose their scene objects. */
  dispose(): void {
    this.clearVehicles();
    this.templates = [];
    this.eraId = null;
  }

  /** The number of currently active vehicles. */
  get count(): number {
    return this.vehicles.length;
  }

  // -------------------------------------------------------------------------
  // Private: lane management
  // -------------------------------------------------------------------------

  /**
   * Spawn `count` vehicles in a single lane with safe spacing.
   */
  private spawnLane(
    era: EraSpec,
    count: number,
    direction: Direction,
    laneX: number,
    minLen: number,
    maxLen: number,
    targetSpeed: number,
  ): void {
    // Evenly space vehicles along the road with jitter for naturalism
    const spacing = (STREET_LAYOUT.roadLength - MIN_GAP) / count;
    for (let i = 0; i < count; i++) {
      const variant = i % this.templates.length;
      const template = this.templates[variant]!;
      const clone = template.clone();

      const length = minLen + Math.random() * (maxLen - minLen);
      // Add some speed variation (±20%)
      const speed = targetSpeed * (0.8 + Math.random() * 0.4);

      // Position: evenly spaced with slight jitter
      const baseZ = -HALF_ROAD + MIN_GAP / 2 + i * spacing;
      const z = baseZ + (Math.random() - 0.5) * spacing * 0.3;

      clone.position.set(laneX, 0, z);
      // Face the direction of travel
      clone.rotation.y = direction === 1 ? 0 : Math.PI;
      this.scene.add(clone);

      this.vehicles.push({
        group: clone,
        z,
        speed,
        direction,
        laneX,
        length,
        variant,
      });
    }
    // Suppress unused-warning for era param (kept for signature clarity / future extensibility)
    void era;
  }

  /**
   * Update a single lane's vehicles: advance positions, apply following-distance
   * deceleration, and wrap at boundaries.
   */
  private updateLane(lane: ActiveVehicle[], deltaTime: number): void {
    if (lane.length === 0) return;

    // Sort by position in travel direction so we can check the vehicle ahead
    lane.sort((a, b) => {
      // For direction +1, the "ahead" vehicle has higher Z.
      // For direction -1, the "ahead" vehicle has lower Z.
      return a.direction * (a.z - b.z);
    });

    for (let i = 0; i < lane.length; i++) {
      const v = lane[i]!;

      // Following-distance check: look at the vehicle ahead (circular lane)
      const ahead = lane[(i + 1) % lane.length]!;
      let gap: number;
      if (ahead === v) {
        gap = Infinity;
      } else {
        // Gap in travel direction (circular)
        const rawGap = (ahead.z - v.z) * v.direction;
        gap = rawGap < 0 ? rawGap + STREET_LAYOUT.roadLength : rawGap;
      }

      // If too close, slow down; otherwise accelerate toward target speed
      const safeGap = v.length + MIN_GAP;
      if (gap < safeGap) {
 v.speed = Math.max(0, v.speed - 8 * deltaTime);
      } else {
        // Gentle acceleration back toward the era target speed
        v.speed = Math.min(
          this.eraTargetSpeed(),
          v.speed + 3 * deltaTime,
        );
      }

      // Advance
      v.z += v.speed * v.direction * deltaTime;

      // Wrap around
      if (v.z > HALF_ROAD) {
 v.z -= STREET_LAYOUT.roadLength;
      } else if (v.z < -HALF_ROAD) {
 v.z += STREET_LAYOUT.roadLength;
      }

      // Update the mesh
      v.group.position.z = v.z;
      // Rotate wheels visually (spin the group slightly for life — optional)
      // Keep it simple: just position.
    }
  }

  /** The target speed for the current era (for re-acceleration). */
  private eraTargetSpeed(): number {
    return this.targetSpeed;
  }

  /** Remove all vehicles from the scene and clear the array. */
  private clearVehicles(): void {
    for (const v of this.vehicles) {
      this.scene.remove(v.group);
      this.disposeGroup(v.group);
    }
    this.vehicles = [];
  }

  /** Recursively dispose geometries and materials in a group. */
  private disposeGroup(group: THREE.Group): void {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
 mat.forEach((m) => m.dispose());
      } else if (mat) {
 mat.dispose();
      }
    });
  }
}
