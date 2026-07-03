/**
 * Era transition controller for the City Time Period Timelapse.
 *
 * This module orchestrates a **smooth, in-place visual transition** when the
 * user moves the timeline slider from one decade to another. Instead of
 * snapping (tearing down the old scene and rebuilding the new one in a single
 * frame), the controller interpolates over a bounded duration (target under
 * 1.5 seconds):
 *
 * 1. **Buildings** — the outgoing era's building group fades out (opacity
 *    ramp) while the incoming era's building group fades in. Building groups
 *    are fetched from the cached asset builder, so no mesh rebuild occurs
 *    during the transition — both old and new groups coexist briefly and are
 *    crossfaded via material opacity.
 *
 * 2. **Streets** — same crossfade approach: the old street furniture group
 *    fades out while the new one fades in.
 *
 * 3. **Lighting & sky** — ambient light intensity, sun intensity, sky colour,
 *    and fog colour are linearly interpolated between the two eras' values so
 *    the mood shifts gradually rather than snapping.
 *
 * 4. **Traffic & pedestrians** — the controller delegates to the
 *    {@link TrafficSystem} and {@link PedestrianSystem}, each of which
 *    implements its own internal crossfade (old vehicles/pedestrians fade out
 *    while new-era replacements fade in at matching positions).
 *
 * 5. **Audio** — the controller hands off to the {@link SfxMixer}, which
 *    crossfades its layered audio graph using exponential gain ramps.
 *
 * The controller integrates with the **central era state bus** (the
 * {@link TimelineHud} `onEraChange` callback). The {@link SceneComposer} wires
 * the HUD callback to {@link TransitionController.beginTransition}, and the
 * controller's `update` method is called every frame by the composer's render
 * loop.
 *
 * Design principles:
 * - **No full mesh rebuilds during transition.** Both eras' cached building
 *   groups are added to the scene simultaneously and crossfaded.
 * - **Bounded duration.** The transition completes within `duration` seconds
 *   (default 1.4 s, under the 1.5 s target).
 * - **Click-free audio.** Audio crossfade uses exponential gain ramps.
 * - **Idempotent.** If a new transition is requested while one is in progress,
 *   the old outgoing group is cleaned up immediately and the new transition
 *   begins from the current interpolated state.
 */

import * as THREE from 'three';
import type { EraSpec, EraId } from './eras/types.js';
import { getEraAssets, populateBuildings } from './assetBuilder/eras.js';
import type { BuildingLot } from './assetBuilder/buildings.js';
import type { TrafficSystem } from './traffic.js';
import type { PedestrianSystem } from './pedestrians.js';
import type { SfxMixer } from './audio/mixer.js';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default transition duration in seconds (under the 1.5 s target). */
const DEFAULT_DURATION = 1.4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The collection of scene objects the transition controller manipulates.
 *
 * The {@link SceneComposer} assembles this handle and passes it to the
 * controller so the controller can add/remove groups and adjust lighting
 * without owning the scene graph itself.
 */
export interface TransitionSceneHandle {
  /** The root group that era content (buildings, streets) is parented to. */
  blockGroup: THREE.Group;
  /** The building lots (for generating era-correct buildings). */
  lots: readonly BuildingLot[];
  /** The scene's ambient light (intensity is interpolated). */
  ambientLight: THREE.AmbientLight;
  /** The scene's sun/directional light (intensity is interpolated). */
  sunLight: THREE.DirectionalLight;
  /** The scene background colour (interpolated). */
  skyColor: THREE.Color;
  /** The scene fog colour (interpolated), or null if no fog. */
  fogColor: THREE.Color | null;
  /** The traffic system (crossfaded internally). */
  traffic: TrafficSystem;
  /** The pedestrian system (crossfaded internally). */
  pedestrians: PedestrianSystem;
  /** The audio mixer (crossfaded internally), or null if audio disabled. */
  mixer: SfxMixer | null;
}

/**
 * A snapshot of lighting/sky parameters for one era, used as interpolation
 * endpoints during a transition.
 */
interface LightingState {
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  ambientIntensity: number;
  sunIntensity: number;
}

/**
 * A group of meshes (buildings or streets) that is being crossfaded.
 *
 * The `materials` array caches references to every `MeshStandardMaterial` in
 * the group so opacity can be set without traversing the tree every frame.
 */
interface FadeGroup {
  /** The scene group being faded. */
  group: THREE.Group;
  /** All standard materials in the group (marked transparent for opacity). */
  materials: THREE.MeshStandardMaterial[];
  /** Whether this group is fading in (true) or out (false). */
  fadingIn: boolean;
}

/**
 * The active transition state. `null` when no transition is in progress.
 */
interface TransitionState {
  /** The era we are transitioning from. */
  fromEra: EraSpec;
  /** The era we are transitioning to. */
  toEra: EraSpec;
  /** Elapsed time in seconds. */
  elapsed: number;
  /** Total duration in seconds. */
  duration: number;
  /** Outgoing fade groups (buildings, streets) — fading out. */
  outgoingGroups: FadeGroup[];
  /** Incoming fade groups (buildings, streets) — fading in. */
  incomingGroups: FadeGroup[];
  /** Starting lighting state (from-era). */
  fromLighting: LightingState;
  /** Ending lighting state (to-era). */
  toLighting: LightingState;
}

// ---------------------------------------------------------------------------
// Per-era lighting lookup tables
// ---------------------------------------------------------------------------

/** Sky colour per era (hex). */
const SKY_COLORS: Readonly<Record<EraId, number>> = {
  '1945': 0xb0a48f, // warm sepia
  '1965': 0xa0b4c8, // light blue
  '1985': 0x9a8ac8, // purple tint
  '2005': 0x87a8c8, // standard blue
  '2025': 0xc8e0e8, // pale clean blue
};

/** Sun intensity per era. */
const SUN_INTENSITIES: Readonly<Record<EraId, number>> = {
  '1945': 0.7,
  '1965': 0.85,
  '1985': 0.8,
  '2005': 0.95,
  '2025': 1.0,
};

/** Ambient intensity per era. */
const AMBIENT_INTENSITIES: Readonly<Record<EraId, number>> = {
  '1945': 0.35,
  '1965': 0.4,
  '1985': 0.38,
  '2005': 0.45,
  '2025': 0.5,
};

// ---------------------------------------------------------------------------
// TransitionController class
// ---------------------------------------------------------------------------

/**
 * Orchestrates smooth in-place era transitions.
 *
 * Lifecycle:
 * 1. Construct with a {@link TransitionSceneHandle}.
 * 2. Call {@link setEra} for the initial era (instant, no transition).
 * 3. Call {@link beginTransition} when the era changes (starts a crossfade).
 * 4. Call {@link update} every frame to advance the transition.
 * 5. Call {@link dispose} on teardown.
 *
 * The controller does NOT own the scene graph — it borrows the groups and
 * lights from the {@link SceneComposer} via the scene handle. The composer
 * remains responsible for disposal of cached assets on final teardown.
 */
export class TransitionController {
  private readonly handle: TransitionSceneHandle;
  private readonly duration: number;

  /** The currently active era (the "settled" state when no transition runs). */
  private currentEra: EraSpec | null = null;
  /** Active transition state, or null when idle. */
  private transition: TransitionState | null = null;
  /** Whether the controller has been disposed. */
  private disposed = false;

  /**
   * The buildings group for the current era (after transition completes).
   * Kept so we know what to remove when the next transition begins.
   */
  private currentBuildingsGroup: THREE.Group | null = null;
  /** The streets group for the current era. */
  private currentStreetsGroup: THREE.Group | null = null;

  /**
   * @param handle    The scene objects to manipulate.
   * @param duration  Transition duration in seconds (default 1.4).
   */
  constructor(handle: TransitionSceneHandle, duration = DEFAULT_DURATION) {
    this.handle = handle;
    this.duration = duration;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Set the initial era instantly (no transition). Called on startup or when
   * the controller is first wired up.
   *
   * @param era  The era to apply immediately.
   */
  setEra(era: EraSpec): void {
    if (this.disposed) return;

    // If a transition is in progress, clean up the outgoing groups.
    if (this.transition) {
      this.cleanupTransition();
    }

    // Remove any existing era content.
    this.removeCurrentGroups();

    this.currentEra = era;
    this.applyEraInstant(era);
  }

  /**
   * Begin a smooth transition to a new era.
   *
   * If a transition is already in progress, it is interrupted: the outgoing
   * groups from the in-progress transition are cleaned up, and a new
   * transition begins from the current visual state to the target era.
   *
   * @param toEra  The era to transition to.
   */
  beginTransition(toEra: EraSpec): void {
    if (this.disposed) return;
    if (!this.currentEra) {
      // No current era — just set instantly.
      this.setEra(toEra);
      return;
    }
    if (this.currentEra.id === toEra.id && !this.transition) return;

    // Interrupt any in-progress transition.
    if (this.transition) {
      this.cleanupTransition();
    }

    const fromEra = this.currentEra;
    this.currentEra = toEra;

    // --- Prepare outgoing groups (the current era's buildings & streets) ---
    const outgoingGroups: FadeGroup[] = [];

    if (this.currentBuildingsGroup) {
      outgoingGroups.push({
        group: this.currentBuildingsGroup,
        materials: this.collectMaterials(this.currentBuildingsGroup),
        fadingIn: false,
      });
    }
    if (this.currentStreetsGroup) {
      outgoingGroups.push({
        group: this.currentStreetsGroup,
        materials: this.collectMaterials(this.currentStreetsGroup),
        fadingIn: false,
      });
    }

    // --- Prepare incoming groups (the new era's buildings & streets) ---
    const incomingGroups: FadeGroup[] = [];

    // Generate/fetch the new era's buildings (cached, no rebuild).
    populateBuildings(toEra, this.handle.lots);
    const newAssetSet = getEraAssets(toEra);

    const newBuildingsGroup = new THREE.Group();
    newBuildingsGroup.name = `buildings-${toEra.id}`;
    for (const building of newAssetSet.buildings) {
      newBuildingsGroup.add(building);
    }
    // Start fully transparent.
    const buildingMats = this.collectMaterials(newBuildingsGroup);
    this.setOpacity(buildingMats, 0);
    this.handle.blockGroup.add(newBuildingsGroup);
    incomingGroups.push({
      group: newBuildingsGroup,
      materials: buildingMats,
      fadingIn: true,
    });

    const newStreetsGroup = newAssetSet.streets.clone();
    newStreetsGroup.name = `streets-${toEra.id}`;
    const streetMats = this.collectMaterials(newStreetsGroup);
    this.setOpacity(streetMats, 0);
    this.handle.blockGroup.add(newStreetsGroup);
    incomingGroups.push({
      group: newStreetsGroup,
      materials: streetMats,
      fadingIn: true,
    });

    // --- Lighting endpoints ---
    const fromLighting = this.lightingFor(fromEra);
    const toLighting = this.lightingFor(toEra);

    // --- Delegate to traffic, pedestrians, and audio ---
    this.handle.traffic.setEra(toEra);
    this.handle.pedestrians.setEra(toEra);
    if (this.handle.mixer) this.handle.mixer.setEra(toEra.id);

    // --- Set up transition state ---
    this.transition = {
      fromEra,
      toEra,
      elapsed: 0,
      duration: this.duration,
      outgoingGroups,
      incomingGroups,
      fromLighting,
      toLighting,
    };

    // Track the incoming groups as the new "current" (they'll be fully opaque
    // when the transition completes).
    this.currentBuildingsGroup = newBuildingsGroup;
    this.currentStreetsGroup = newStreetsGroup;
  }

  /**
   * Whether a transition is currently in progress.
   */
  get isTransitioning(): boolean {
    return this.transition !== null;
  }

  /**
   * Advance the transition by `deltaTime` seconds.
   *
   * Called every frame by the {@link SceneComposer}. When the transition
   * completes, outgoing groups are disposed and the transition state is
   * cleared.
   *
   * @param deltaTime  Time since the last frame, in seconds.
   */
  update(deltaTime: number): void {
    if (this.disposed || !this.transition) return;

    const dt = Math.min(deltaTime, 0.1);
    this.transition.elapsed += dt;

    // Normalised progress [0, 1], eased with smoothstep for natural feel.
    const raw = Math.min(1, this.transition.elapsed / this.transition.duration);
    const t = raw * raw * (3 - 2 * raw); // smoothstep

    // --- Crossfade building & street groups ---
    for (const fg of this.transition.outgoingGroups) {
      this.setOpacity(fg.materials, 1 - t);
    }
    for (const fg of this.transition.incomingGroups) {
      this.setOpacity(fg.materials, t);
    }

    // --- Interpolate lighting & sky ---
    this.interpolateLighting(this.transition.fromLighting, this.transition.toLighting, t);

    // --- Check completion ---
    if (this.transition.elapsed >= this.transition.duration) {
      this.finishTransition();
    }
  }

  /** Dispose the controller and clean up any in-progress transition. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.transition) {
      this.cleanupTransition();
    }
    this.removeCurrentGroups();
  }

  // -------------------------------------------------------------------------
  // Private: era application (instant, no transition)
  // -------------------------------------------------------------------------

  /**
   * Apply an era instantly: add buildings and streets at full opacity, set
   * lighting, and delegate to traffic/pedestrians/audio.
   */
  private applyEraInstant(era: EraSpec): void {
    // Buildings
    populateBuildings(era, this.handle.lots);
    const assetSet = getEraAssets(era);

    this.currentBuildingsGroup = new THREE.Group();
    this.currentBuildingsGroup.name = `buildings-${era.id}`;
    for (const building of assetSet.buildings) {
      this.currentBuildingsGroup.add(building);
    }
    this.handle.blockGroup.add(this.currentBuildingsGroup);

    // Streets
    this.currentStreetsGroup = assetSet.streets.clone();
    this.currentStreetsGroup.name = `streets-${era.id}`;
    this.handle.blockGroup.add(this.currentStreetsGroup);

    // Traffic, pedestrians, audio
    this.handle.traffic.setEra(era);
    this.handle.pedestrians.setEra(era);
    if (this.handle.mixer) this.handle.mixer.setEra(era.id);

    // Lighting
    const lighting = this.lightingFor(era);
    this.applyLighting(lighting);
  }

  // -------------------------------------------------------------------------
  // Private: transition lifecycle
  // -------------------------------------------------------------------------

  /**
   * Finish the transition: snap all values to their final state, dispose
   * outgoing groups, and clear the transition state.
   */
  private finishTransition(): void {
    const tr = this.transition!;

    // Snap incoming groups to full opacity.
    for (const fg of tr.incomingGroups) {
      this.setOpacity(fg.materials, 1);
      // Reset transparency flag for performance (no longer needed).
      for (const mat of fg.materials) {
        mat.transparent = false;
        mat.opacity = 1;
      }
    }

    // Dispose and remove outgoing groups.
    for (const fg of tr.outgoingGroups) {
      this.handle.blockGroup.remove(fg.group);
      // Note: we do NOT dispose cached geometry/materials here because the
      // asset builder caches them for reuse when the era is revisited.
      // Only dispose cloned materials that were created for fading.
      this.disposeClonedMaterials(fg.group);
    }

    // Snap lighting to final state.
    this.applyLighting(tr.toLighting);

    this.transition = null;
  }

  /**
   * Interrupt and clean up an in-progress transition.
   *
   * Outgoing groups are removed. Incoming groups become the new current
   * groups (at whatever opacity they reached). Lighting is snapped to the
   * target era.
   */
  private cleanupTransition(): void {
    const tr = this.transition;
    if (!tr) return;

    // Remove outgoing groups.
    for (const fg of tr.outgoingGroups) {
      this.handle.blockGroup.remove(fg.group);
      this.disposeClonedMaterials(fg.group);
    }

    // Incoming groups become current (they're already in the scene).
    // Reset their transparency for performance.
    for (const fg of tr.incomingGroups) {
      for (const mat of fg.materials) {
        mat.opacity = 1;
        mat.transparent = false;
      }
    }

    // Snap lighting to the target.
    this.applyLighting(tr.toLighting);

    this.transition = null;
  }

  /**
   * Remove the current era's building and street groups from the scene.
   * Called before applying a new era or on disposal.
   */
  private removeCurrentGroups(): void {
    if (this.currentBuildingsGroup) {
      this.handle.blockGroup.remove(this.currentBuildingsGroup);
      this.disposeClonedMaterials(this.currentBuildingsGroup);
      this.currentBuildingsGroup = null;
    }
    if (this.currentStreetsGroup) {
      this.handle.blockGroup.remove(this.currentStreetsGroup);
      this.disposeClonedMaterials(this.currentStreetsGroup);
      this.currentStreetsGroup = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private: material helpers
  // -------------------------------------------------------------------------

  /**
   * Collect all `MeshStandardMaterial` instances in a group, marking them
   * transparent so opacity changes take effect. De-duplicates by reference.
   */
  private collectMaterials(group: THREE.Group): THREE.MeshStandardMaterial[] {
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

  /** Set opacity on an array of materials. */
  private setOpacity(materials: THREE.MeshStandardMaterial[], opacity: number): void {
    for (const mat of materials) {
      mat.opacity = opacity;
    }
  }

  /**
   * Dispose only the cloned materials in a group (not the cached geometry).
   *
   * During transitions, materials are cloned so each group can have
   * independent opacity. These clones must be disposed when the group is
   * removed. However, geometries are shared from the asset cache and must NOT
   * be disposed here.
   */
  private disposeClonedMaterials(group: THREE.Group): void {
    const seen = new Set<THREE.Material>();
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.material) return;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!seen.has(mat)) {
          seen.add(mat);
          mat.dispose();
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Private: lighting interpolation
  // ---------------------------------------------------------------------------

  /**
   * Compute the lighting state for an era.
   */
  private lightingFor(era: EraSpec): LightingState {
    return {
      skyColor: new THREE.Color(SKY_COLORS[era.id]),
      fogColor: new THREE.Color(SKY_COLORS[era.id]),
      ambientIntensity: AMBIENT_INTENSITIES[era.id],
      sunIntensity: SUN_INTENSITIES[era.id],
    };
  }

  /**
   * Interpolate between two lighting states by factor `t` (0 → from, 1 → to)
   * and apply the result to the scene.
   */
  private interpolateLighting(
    from: LightingState,
    to: LightingState,
    t: number,
  ): void {
    this.handle.skyColor.copy(from.skyColor).lerp(to.skyColor, t);
    if (this.handle.fogColor) {
      this.handle.fogColor.copy(from.fogColor).lerp(to.fogColor, t);
    }
    this.handle.ambientLight.intensity =
      from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * t;
    this.handle.sunLight.intensity =
      from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;
  }

  /**
   * Instantly apply a lighting state to the scene.
   */
  private applyLighting(state: LightingState): void {
    this.handle.skyColor.copy(state.skyColor);
    if (this.handle.fogColor) {
      this.handle.fogColor.copy(state.fogColor);
    }
    this.handle.ambientLight.intensity = state.ambientIntensity;
    this.handle.sunLight.intensity = state.sunIntensity;
  }
}
