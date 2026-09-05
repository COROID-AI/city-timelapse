/**
 * src/scene/SceneShell.ts — the city block scene shell.
 *
 * Owns the Three.js Scene Group that connects the morph engine to the world:
 *  - a base ground plane with a procedural CanvasTexture (every visual is
 *    procedural, no downloads),
 *  - the shared MorphEngine group (anchor morph slots + construction
 *    scaffolds),
 *  - the era-specific building block (src/content/buildings), which owns all
 *    building construction code and registers every mesh against the shared
 *    anchor groups for lossless vertex morphing,
 *  - the era-distinct street populations (src/content/vehicles and
 *    src/content/pedestrians), which drive their own groups through the shared
 *    morph timeline for transition-safe era swaps.
 *
 * Exposes the module contract used by every scene module:
 *   { group, update(dt), setEra(era, t), dispose() }
 * It never starts its own renderer or animation loop. All era-specific content
 * is declarative data consumed by the buildings/population modules; the shell
 * itself contains no per-era logic.
 */

import * as THREE from 'three';

import { createCanvasTexture } from '../assets';
import type { MorphEngine } from '../core/MorphEngine';
import { BuildingsSceneModule } from '../content/buildings/BuildingsSceneModule';
import { EraPedestrians } from '../content/pedestrians/EraPedestrians';
import { EraVehicles } from '../content/vehicles/EraVehicles';
import type { EraId } from '../eras';
import type { EraState } from '../state/EraState';

export class SceneShell {
  readonly group = new THREE.Group();
  private readonly buildings: BuildingsSceneModule;
  private readonly unsubscribe: () => void;
  private readonly vehicles: EraVehicles;
  private readonly pedestrians: EraPedestrians;

  constructor(eraState: EraState, morphEngine: MorphEngine) {
    this.group.name = 'SceneShell';

    // Era-specific population modules. They own their own groups and plug into
    // the shared morph timeline for transition-safe era swaps (vehicles drive
    // off / new era drives in; pedestrians crossfade on the sidewalk loop).
    this.vehicles = new EraVehicles(eraState.era, morphEngine);
    this.pedestrians = new EraPedestrians(eraState.era, morphEngine);
    this.group.add(this.vehicles.group);
    this.group.add(this.pedestrians.group);

    // Ground: procedural canvas texture (asphalt/per-sidewalk), era-neutral.
    const groundTexture = createCanvasTexture({ kind: 'shape', size: 512 }).texture;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({
        map: groundTexture,
        color: 0x33383f,
        roughness: 0.95,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = false;
    this.group.add(ground);

    // Era-specific building block (all construction code + morph anchors).
    this.buildings = new BuildingsSceneModule(morphEngine);
    this.group.add(this.buildings.group);

    this.group.add(morphEngine.group);

    // Keep every module in sync with era changes: population swaps ride the
    // shared morph timeline and buildings rebuild their era construction
    // details on the same shared anchor groups.
    this.unsubscribe = eraState.subscribe((era) => {
      this.vehicles.setEra(era);
      this.pedestrians.setEra(era);
      this.buildings.setEra(era);
    });
  }

  /** Advance per-frame logic. */
  update(dt: number): void {
    this.vehicles.update(dt);
    this.pedestrians.update(dt);
    this.buildings.update(dt);
  }

  setEra(era: EraId, t: number): void {
    this.vehicles.setEra(era);
    this.pedestrians.setEra(era);
    this.buildings.setEra(era, t);
  }

  dispose(): void {
    this.unsubscribe();
    this.vehicles.dispose();
    this.pedestrians.dispose();
    this.buildings.dispose();
    this.group.clear();
  }
}