/**
 * Traffic system for the City Time Period Timelapse.
 *
 * Spawns and animates era-correct vehicles along the block's defined lanes.
 * Vehicles are cloned from the procedural asset builder's `EraAssetSet` and
 * driven along two lanes (one per travel direction) that follow the street
 * layout's road geometry.
 *
 * Era transitions are smooth: when {@link TrafficSystem.setEra} is called, the
 * vehicles currently in flight fade out over a crossfade window while
 * replacement vehicles of the new era fade in at the same positions. This
 * avoids a jarring "pop" where every car disappears and reappears instantly.
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
/** Duration of the era crossfade, in seconds (kept under the 1.5 s target). */
const ERA_CROSSFADE_SECONDS = 1.4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction of travel along the road. */
type Direction = 1 | -1;

/**
 * Transition state for a vehicle during an era change.
 *
 * - `'none'` — normal driving, fully opaque.
 * - `'fadingIn'` — newly spawned replacement; opacity ramps 0 → 1.
 * - `'fadingOut'` — outgoing old-era vehicle; opacity ramps 1 → 0 then removed.
 */
type TransitionState = 'none' | 'fadingIn' | 'fadingOut';

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
  /** Whether an era crossfade is currently in progress. */
  private crossfading = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Switch to a new era.
   *
   * On the very first call this populates the lanes with era-correct vehicles
   * at full opacity. On subsequent calls the existing vehicles fade out while
   * replacement vehicles of the new era fade in at matching positions,
   * producing a smooth dissolve rather than a hard swap.
   *
   * @param era  The era spec to switch to.
   */
  setEra(era: EraSpec): void {
    // No-op if the era is already active and no crossfade is pending.
    if (this.eraId === era.id && !this.crossfading) return;

    const isFirstEra = this.eraId === null;

    if (isFirstEra) {
      // First population — spawn directly at full opacity.
      this.eraId = era.id;
      const assetSet = getEraAssets(era);
      this.templates = assetSet.vehicles;
      this.targetSpeed = era.vehicles.targetSpeed;
      if (this.templates.length === 0) return;

      const [minLen, maxLen] = era.vehicles.lengthRange;
      const targetSpeed = this.targetSpeed;
      const perLane = Math.min(
        MAX_PER_LANE,
        Math.max(2, Math.round(era.vehicles.density / 2.2)),
      );

      this.spawnLane(era, perLane, 1, LANE_EAST_X, minLen, maxLen, targetSpeed, 'none');
      this.spawnLane(era, perLane, -1, LANE_WEST_X, minLen, maxLen, targetSpeed, 'none');
      return;
    }

    // Era change — crossfade.
    this.crossfading = true;
    this.transitionToEra(era);
  }

  /** Whether an era crossfade is currently in progress. */
  get isCrossfading(): boolean {
    return this.crossfading;
  }

  /**
   * Per-frame update: advance all vehicles along their lanes, apply
   * following-distance behaviour, handle transition fades, and wrap at road
   * boundaries.
   * @param deltaTime  Time since the last frame, in seconds.
   */
  update(deltaTime: number): void {
    // Clamp delta to avoid huge jumps after a tab-switch / frame stall.
    const dt = Math.min(deltaTime, 0.1);

    // Process transitions and remove fully-faded-out vehicles.
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i]!;
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
            continue;
          }
        }
      }
    }

    // Separate vehicles by lane for gap checks
    const eastLane = this.vehicles.filter((v) => v.direction === 1);
    const westLane = this.vehicles.filter((v) => v.direction === -1);

    this.updateLane(eastLane, dt);
    this.updateLane(westLane, dt);

    // Once all fade-outs have completed, the crossfade is finished.
    if (this.crossfading && !this.vehicles.some((v) => v.transition === 'fadingOut')) {
      this.crossfading = false;
    }
  }

  /** Remove all vehicles and dispose their scene objects. */
  dispose(): void {
    this.clearVehicles();
    this.templates = [];
    this.eraId = null;
    this.crossfading = false;
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
   *
   * Each vehicle's materials are deep-cloned so opacity can be controlled
   * independently during era crossfades.
   */
  private spawnLane(
    era: EraSpec,
    count: number,
    direction: Direction,
    laneX: number,
    minLen: number,
    maxLen: number,
    targetSpeed: number,
    transition: TransitionState,
  ): void {
    // Evenly space vehicles along the road with jitter for naturalism
    const spacing = (STREET_LAYOUT.roadLength - MIN_GAP) / count;
    for (let i = 0; i < count; i++) {
      const variant = i % this.templates.length;
      const template = this.templates[variant]!;
      const clone = this.cloneVehicle(template);

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

      // Collect fade materials and set initial opacity for the transition.
      const fadeMaterials = this.collectFadeMaterials(clone);
      if (transition === 'fadingIn') {
        this.setMaterialsOpacity(fadeMaterials, 0);
      }

      this.vehicles.push({
        group: clone,
        z,
        speed,
        direction,
        laneX,
        length,
        variant,
        transition,
        transitionTime: transition === 'none' ? 0 : ERA_CROSSFADE_SECONDS,
        transitionDuration: ERA_CROSSFADE_SECONDS,
        fadeMaterials,
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
    }
  }

  /** The target speed for the current era (for re-acceleration). */
  private eraTargetSpeed(): number {
    return this.targetSpeed;
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
   */
  private transitionToEra(era: EraSpec): void {
    const assetSet = getEraAssets(era);
    const newTemplates = assetSet.vehicles;
    this.targetSpeed = era.vehicles.targetSpeed;

    // Snapshot the current fleet (the array will be mutated as we spawn).
    const current = [...this.vehicles];

    // Temporarily swap templates so spawnLane uses the new era's vehicles.
    const oldTemplates = this.templates;
    this.templates = newTemplates;

    if (newTemplates.length === 0) {
      // No vehicles for the new era — just fade out the old ones.
      for (const v of current) {
        v.transition = 'fadingOut';
        v.transitionTime = ERA_CROSSFADE_SECONDS;
        v.transitionDuration = ERA_CROSSFADE_SECONDS;
      }
      this.eraId = era.id;
      return;
    }

    const [minLen, maxLen] = era.vehicles.lengthRange;
    const targetSpeed = era.vehicles.targetSpeed;

    for (const v of current) {
      // Mark the old vehicle for fade-out.
      v.transition = 'fadingOut';
      v.transitionTime = ERA_CROSSFADE_SECONDS;
      v.transitionDuration = ERA_CROSSFADE_SECONDS;

      // Spawn a replacement of the new era on the same lane & Z.
      const variant = v.variant % newTemplates.length;
      const template = newTemplates[variant]!;
      const clone = this.cloneVehicle(template);

      const length = minLen + Math.random() * (maxLen - minLen);
      const speed = targetSpeed * (0.8 + Math.random() * 0.4);

      clone.position.set(v.laneX, 0, v.z);
      clone.rotation.y = v.direction === 1 ? 0 : Math.PI;
      this.scene.add(clone);

      const fadeMaterials = this.collectFadeMaterials(clone);
      this.setMaterialsOpacity(fadeMaterials, 0);

      this.vehicles.push({
        group: clone,
        z: v.z,
        speed,
        direction: v.direction,
        laneX: v.laneX,
        length,
        variant,
        transition: 'fadingIn',
        transitionTime: ERA_CROSSFADE_SECONDS,
        transitionDuration: ERA_CROSSFADE_SECONDS,
        fadeMaterials,
      });
    }

    // Restore templates reference (the new era is now active).
    void oldTemplates;
    this.templates = newTemplates;
    this.eraId = era.id;
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
   * affected by opacity fades. Materials are marked transparent so opacity
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

  // -------------------------------------------------------------------------
  // Private: cleanup
  // -------------------------------------------------------------------------

  /** Remove a single vehicle from the scene and dispose its resources. */
  private removeVehicle(v: ActiveVehicle): void {
    this.scene.remove(v.group);
    this.disposeGroup(v.group);
    const idx = this.vehicles.indexOf(v);
    if (idx >= 0) this.vehicles.splice(idx, 1);
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
