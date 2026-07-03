/**
 * Pedestrian system for the City Time Period Timelapse.
 *
 * Spawns and animates era-styled pedestrians with era-appropriate outfits
 * walking along the sidewalks flanking the road. Pedestrians are cloned from
 * the procedural asset builder's `EraAssetSet` and given random walking
 * directions, speeds, and slight lateral offsets for naturalism.
 *
 * The system reads `era.pedestrians.density`, `.walkSpeed`, and `.hasPhones`
 * to determine count, movement speed, and prop behaviour.
 */

import * as THREE from 'three';
import type { EraSpec, EraId } from './eras/types.js';
import { getEraAssets } from './assetBuilder/eras.js';
import { STREET_LAYOUT } from './assetBuilder/streets.js';

// ---------------------------------------------------------------------------
// Layout constants (derived from STREET_LAYOUT)
// ---------------------------------------------------------------------------

/** Half the road width (road is centered at origin). */
const HALF_ROAD = STREET_LAYOUT.roadWidth / 2; // 4
/** Half the sidewalk width. */
const HALF_SIDEWALK = STREET_LAYOUT.sidewalkWidth / 2; // 1.75
/** Centre X of the east sidewalk. */
const SIDEWALK_EAST_X = HALF_ROAD + HALF_SIDEWALK; // 5.75
/** Centre X of the west sidewalk. */
const SIDEWALK_WEST_X = -(HALF_ROAD + HALF_SIDEWALK); // -5.75
/** Half the road length — pedestrians wrap at ± this value. */
const HALF_LENGTH = STREET_LAYOUT.roadLength / 2; // 30
/** Maximum pedestrians per sidewalk side. */
const MAX_PER_SIDE = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction of travel along the sidewalk. */
type Direction = 1 | -1;

/** Runtime state for a single active pedestrian. */
interface ActivePedestrian {
  /** The three.js group added to the scene. */
  group: THREE.Group;
  /** Current Z position along the sidewalk. */
  z: number;
  /** Walking speed (m/s). */
  speed: number;
  /** Travel direction (+Z = 1, -Z = -1). */
  direction: Direction;
  /** Sidewalk centre X. */
  sidewalkX: number;
  /** Lateral offset within the sidewalk (for naturalism). */
  lateralOffset: number;
  /** Walk-cycle phase (for leg animation, if meshes support it). */
  phase: number;
  /** Whether this pedestrian holds a phone prop. */
  hasPhone: boolean;
}

// ---------------------------------------------------------------------------
// PedestrianSystem class
// ---------------------------------------------------------------------------

/**
 * Manages era-appropriate pedestrians walking along the block's sidewalks.
 *
 * Usage:
 * ```ts
 * const peds = new PedestrianSystem(scene);
 * peds.setEra(eraSpec);        // spawn era-correct pedestrians
 * peds.update(deltaSeconds);    // animate each frame
 * peds.dispose();                // cleanup
 * ```
 */
export class PedestrianSystem {
  private readonly scene: THREE.Scene;
  /** All active pedestrians (both sidewalks). */
  private pedestrians: ActivePedestrian[] = [];
  /** The currently active era id (or null before first setEra). */
  private eraId: EraId | null = null;
  /** Template pedestrian groups for the current era. */
  private templates: THREE.Group[] = [];
  /** Whether the current era has phones. */
  private eraHasPhones = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Switch to a new era: remove all old pedestrians and spawn era-correct ones.
   * @param era  The era spec to switch to.
   */
  setEra(era: EraSpec): void {
    if (this.eraId === era.id) return;
    this.clearPedestrians();
    this.eraId = era.id;

    const assetSet = getEraAssets(era);
    this.templates = assetSet.pedestrians;
    this.eraHasPhones = era.pedestrians.hasPhones;
    if (this.templates.length === 0) return;

    // Determine count per side based on density (0–1)
    const perSide = Math.min(
      MAX_PER_SIDE,
      Math.max(2, Math.floor(era.pedestrians.density * 12)),
    );

    this.spawnSide(era, perSide, SIDEWALK_EAST_X);
    this.spawnSide(era, perSide, SIDEWALK_WEST_X);
  }

  /**
   * Per-frame update: advance all pedestrians along their sidewalks, animate
   * walk cycles, and wrap at boundaries.
   * @param deltaTime  Time since the last frame, in seconds.
   */
  update(deltaTime: number): void {
    for (const p of this.pedestrians) {
      // Advance position
      p.z += p.speed * p.direction * deltaTime;

      // Wrap around
      if (p.z > HALF_LENGTH) {
        p.z -= STREET_LAYOUT.roadLength;
      } else if (p.z < -HALF_LENGTH) {
        p.z += STREET_LAYOUT.roadLength;
      }

      // Update mesh position
      p.group.position.z = p.z;

      // Animate walk cycle — bob the group slightly
      p.phase += deltaTime * p.speed * 2;
      const bob = Math.abs(Math.sin(p.phase)) * 0.04;
      p.group.position.y = bob;

      // Slight sway
      p.group.rotation.z = Math.sin(p.phase * 0.5) * 0.03;
    }
  }

  /** Remove all pedestrians and dispose their scene objects. */
  dispose(): void {
    this.clearPedestrians();
    this.templates = [];
    this.eraId = null;
  }

  /** The number of currently active pedestrians. */
  get count(): number {
    return this.pedestrians.length;
  }

  // -------------------------------------------------------------------------
  // Private: spawning
  // -------------------------------------------------------------------------

  /**
   * Spawn `count` pedestrians on one sidewalk with safe spacing.
   */
  private spawnSide(era: EraSpec, count: number, sidewalkX: number): void {
    const spacing = STREET_LAYOUT.roadLength / count;
    const baseSpeed = era.pedestrians.walkSpeed;

    for (let i = 0; i < count; i++) {
      const variant = i % this.templates.length;
      const template = this.templates[variant]!;
      const clone = template.clone();

      // Random direction
      const direction: Direction = Math.random() < 0.5 ? 1 : -1;
      // Speed variation (±25%)
      const speed = baseSpeed * (0.75 + Math.random() * 0.5);
      // Lateral offset within sidewalk (-1.5 to +1.5 m from centre)
      const lateralOffset = (Math.random() - 0.5) * (STREET_LAYOUT.sidewalkWidth - 1);

      // Position along Z with jitter
      const baseZ = -HALF_LENGTH + i * spacing;
      const z = baseZ + (Math.random() - 0.5) * spacing * 0.5;

      clone.position.set(sidewalkX + lateralOffset, 0, z);
      // Face direction of travel
      clone.rotation.y = direction === 1 ? 0 : Math.PI;
      this.scene.add(clone);

      // Randomly assign phone prop if era has phones
      const hasPhone = this.eraHasPhones && Math.random() < 0.4;
      if (hasPhone) {
        // Tilt forward slightly as if looking at phone
        clone.rotation.x = 0.15;
      }

      this.pedestrians.push({
        group: clone,
        z,
        speed,
        direction,
        sidewalkX,
        lateralOffset,
        phase: Math.random() * Math.PI * 2,
        hasPhone,
      });
    }
  }

  /** Remove all pedestrians from the scene and clear the array. */
  private clearPedestrians(): void {
    for (const p of this.pedestrians) {
      this.scene.remove(p.group);
      this.disposeGroup(p.group);
    }
    this.pedestrians = [];
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
