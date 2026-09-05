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
 *    anchor groups for lossless vertex morphing.
 *
 * Exposes the module contract used by every scene module:
 *   { group, update(dt), setEra(era, t), dispose() }
 * It never starts its own renderer or animation loop. All era-specific
 * building content is declarative data consumed by the buildings module; the
 * shell itself contains no per-era logic.
 */

import * as THREE from 'three';

import { createCanvasTexture } from '../assets';
import type { MorphEngine } from '../core/MorphEngine';
import { BuildingsSceneModule } from '../content/buildings/BuildingsSceneModule';
import { ERA_IDS } from '../eras';
import { EraState } from '../state/EraState';

export class SceneShell {
  readonly group = new THREE.Group();
  private readonly buildings: BuildingsSceneModule;
  private readonly unsubscribe: () => void;

  constructor(eraState: EraState, morphEngine: MorphEngine | null = null) {
    this.group.name = 'SceneShell';

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

    if (morphEngine) {
      this.group.add(morphEngine.group);
    }

    // Keep the buildings module in sync with every era change.
    this.unsubscribe = eraState.subscribe((era) => {
      this.buildings.setEra(era);
    });
  }

  /** Advance per-frame logic. */
  update(dt: number): void {
    this.buildings.update(dt);
  }

  setEra(era: (typeof ERA_IDS)[number], t: number): void {
    this.buildings.setEra(era, t);
  }

  dispose(): void {
    this.unsubscribe();
    this.buildings.dispose();
    this.group.clear();
  }
}