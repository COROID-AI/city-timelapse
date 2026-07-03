/**
 * Pedestrian system for the City Time Period Timelapse.
 *
 * Spawns and animates era-styled pedestrians with era-appropriate outfits
 * walking along the sidewalks flanking the road. Pedestrians are cloned from
 * the procedural asset builder's `EraAssetSet` and given random walking
 * directions, speeds, and slight lateral offsets for naturalism.
 *
 * Era transitions are smooth: when {@link PedestrianSystem.setEra} is called,
 * the pedestrians currently walking fade out over a crossfade window while
 * replacement pedestrians of the new era fade in at the same positions. This
 * avoids a jarring "pop" where every figure disappears and reappears instantly.
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
/** Duration of the era crossfade, in seconds (kept under the 1.5 s target). */
const ERA_CROSSFADE_SECONDS = 1.4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction of travel along the sidewalk. */
type Direction = 1 | -1;

/**
 * Transition state for a pedestrian during an era change.
 *
 * - `'none'` — normal walking, fully opaque.
 * - `'fadingIn'` — newly spawned replacement; opacity ramps 0 → 1.
 * - `'fadingOut'` — outgoing old-era pedestrian; opacity ramps 1 → 0 then removed.
 */
type TransitionState = 'none' | 'fadingIn' | 'fadingOut';

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
  /** Whether an era crossfade is currently in progress. */
  private crossfading = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Switch to a new era.
   *
   * On the very first call this populates the sidewalks with era-correct
   * pedestrians at full opacity. On subsequent calls the existing pedestrians
   * fade out while replacement pedestrians of the new era fade in at matching
   * positions, producing a smooth dissolve rather than a hard swap.
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
      this.templates = assetSet.pedestrians;
      this.eraHasPhones = era.pedestrians.hasPhones;
      if (this.templates.length === 0) return;

      const perSide = Math.min(
        MAX_PER_SIDE,
        Math.max(2, Math.floor(era.pedestrians.density * 12)),
      );

      this.spawnSide(era, perSide, SIDEWALK_EAST_X, 'none');
      this.spawnSide(era, perSide, SIDEWALK_WEST_X, 'none');
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
   * Per-frame update: advance all pedestrians along their sidewalks, animate
   * walk cycles, handle transition fades, and wrap at boundaries.
   * @param deltaTime  Time since the last frame, in seconds.
   */
  update(deltaTime: number): void {
    // Clamp delta to avoid huge jumps after a tab-switch / frame stall.
    const dt = Math.min(deltaTime, 0.1);

    // Process transitions and remove fully-faded-out pedestrians.
    for (let i = this.pedestrians.length - 1; i >= 0; i--) {
      const p = this.pedestrians[i]!;
      if (p.transition !== 'none') {
        p.transitionTime -= dt;
        const progress = 1 - Math.max(0, p.transitionTime) / p.transitionDuration;
        if (p.transition === 'fadingIn') {
          this.setMaterialsOpacity(p.fadeMaterials, progress);
          if (p.transitionTime <= 0) {
            p.transition = 'none';
            p.transitionTime = 0;
            this.setMaterialsOpacity(p.fadeMaterials, 1);
          }
        } else {
          // fadingOut
          this.setMaterialsOpacity(p.fadeMaterials, 1 - progress);
          if (p.transitionTime <= 0) {
            this.removePedestrian(p);
            continue;
          }
        }
      }
    }

    for (const p of this.pedestrians) {
      // Advance position
      p.z += p.speed * p.direction * dt;

      // Wrap around
      if (p.z > HALF_LENGTH) {
        p.z -= STREET_LAYOUT.roadLength;
      } else if (p.z < -HALF_LENGTH) {
        p.z += STREET_LAYOUT.roadLength;
      }

      // Update mesh position
      p.group.position.z = p.z;

      // Animate walk cycle — bob the group slightly
      p.phase += dt * p.speed * 2;
      const bob = Math.abs(Math.sin(p.phase)) * 0.04;
      p.group.position.y = bob;

      // Slight sway
      p.group.rotation.z = Math.sin(p.phase * 0.5) * 0.03;
    }

    // Once all fade-outs have completed, the crossfade is finished.
    if (this.crossfading && !this.pedestrians.some((p) => p.transition === 'fadingOut')) {
      this.crossfading = false;
    }
  }

  /** Remove all pedestrians and dispose their scene objects. */
  dispose(): void {
    this.clearPedestrians();
    this.templates = [];
    this.eraId = null;
    this.crossfading = false;
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
   *
   * Each pedestrian's materials are deep-cloned so opacity can be controlled
   * independently during era crossfades.
   */
  private spawnSide(
    era: EraSpec,
    count: number,
    sidewalkX: number,
    transition: TransitionState,
  ): void {
    const spacing = STREET_LAYOUT.roadLength / count;
    const baseSpeed = era.pedestrians.walkSpeed;

    for (let i = 0; i < count; i++) {
      const variant = i % this.templates.length;
      const template = this.templates[variant]!;
      const clone = this.clonePedestrian(template);

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

      // Collect fade materials and set initial opacity for the transition.
      const fadeMaterials = this.collectFadeMaterials(clone);
      if (transition === 'fadingIn') {
        this.setMaterialsOpacity(fadeMaterials, 0);
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
        transition,
        transitionTime: transition === 'none' ? 0 : ERA_CROSSFADE_SECONDS,
        transitionDuration: ERA_CROSSFADE_SECONDS,
        fadeMaterials,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Era crossfade
  // -------------------------------------------------------------------------

  /**
   * Begin a crossfade from the current era to a new one.
   *
   * Every active pedestrian is marked `fadingOut`, and a replacement pedestrian
   * of the new era is spawned at the same sidewalk position, marked `fadingIn`.
   * Over {@link ERA_CROSSFADE_SECONDS} the old population dissolves and the new
   * population takes over.
   */
  private transitionToEra(era: EraSpec): void {
    const assetSet = getEraAssets(era);
    const newTemplates = assetSet.pedestrians;
    this.eraHasPhones = era.pedestrians.hasPhones;

    // Snapshot the current population (the array will be mutated as we spawn).
    const current = [...this.pedestrians];

    // Temporarily swap templates so spawnSide uses the new era's pedestrians.
    this.templates = newTemplates;

    if (newTemplates.length === 0) {
      // No pedestrians for the new era — just fade out the old ones.
      for (const p of current) {
        p.transition = 'fadingOut';
        p.transitionTime = ERA_CROSSFADE_SECONDS;
        p.transitionDuration = ERA_CROSSFADE_SECONDS;
      }
      this.eraId = era.id;
      return;
    }

    const baseSpeed = era.pedestrians.walkSpeed;

    for (const p of current) {
      // Mark the old pedestrian for fade-out.
      p.transition = 'fadingOut';
      p.transitionTime = ERA_CROSSFADE_SECONDS;
      p.transitionDuration = ERA_CROSSFADE_SECONDS;

      // Spawn a replacement of the new era on the same sidewalk & Z.
      const variant = p.group.userData.variant ?? 0;
      const variantIdx = variant % newTemplates.length;
      const template = newTemplates[variantIdx]!;
      const clone = this.clonePedestrian(template);

      const speed = baseSpeed * (0.75 + Math.random() * 0.5);
      const lateralOffset = p.lateralOffset;

      clone.position.set(p.sidewalkX + lateralOffset, 0, p.z);
      clone.rotation.y = p.direction === 1 ? 0 : Math.PI;
      this.scene.add(clone);

      const hasPhone = this.eraHasPhones && Math.random() < 0.4;
      if (hasPhone) {
        clone.rotation.x = 0.15;
      }

      const fadeMaterials = this.collectFadeMaterials(clone);
      this.setMaterialsOpacity(fadeMaterials, 0);

      this.pedestrians.push({
        group: clone,
        z: p.z,
        speed,
        direction: p.direction,
        sidewalkX: p.sidewalkX,
        lateralOffset,
        phase: Math.random() * Math.PI * 2,
        hasPhone,
        transition: 'fadingIn',
        transitionTime: ERA_CROSSFADE_SECONDS,
        transitionDuration: ERA_CROSSFADE_SECONDS,
        fadeMaterials,
      });
    }

    this.eraId = era.id;
  }

  // -------------------------------------------------------------------------
  // Material cloning & opacity
  // -------------------------------------------------------------------------

  /**
   * Deep-clone a cached pedestrian template so each instance owns independent
   * materials (and thus independent opacity for crossfades).
   *
   * `THREE.Object3D.clone()` shares geometry and material references by
   * default. We clone materials explicitly here so fading one figure does not
   * affect the cached template or sibling figures.
   */
  private clonePedestrian(template: THREE.Group): THREE.Group {
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
   * Collect every `MeshStandardMaterial` in a pedestrian group that should be
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

  /** Remove a single pedestrian from the scene and dispose its resources. */
  private removePedestrian(p: ActivePedestrian): void {
    this.scene.remove(p.group);
    this.disposeGroup(p.group);
    const idx = this.pedestrians.indexOf(p);
    if (idx >= 0) this.pedestrians.splice(idx, 1);
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
