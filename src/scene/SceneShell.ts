/**
 * src/scene/SceneShell.ts — the empty scene shell.
 *
 * Owns the Three.js Scene Group that connects the morph engine to the world:
 *  - a base ground plane with a procedural CanvasTexture (every visual is
 *    procedural, no downloads),
 *  - the shared MorphEngine group (anchor morph slots + construction
 *    scaffolds),
 *  - a neutral facade stub whose shared topology is vertex-morphed by the
 *    engine between per-era anchor slots.
 *
 * Exposes the module contract used by every scene module:
 *   { group, update(dt), setEra(era, t), dispose() }
 * It never starts its own renderer or animation loop. Per the foundation
 * constraint, this shell contains *no era-specific content* — later tasks fill
 * the shared anchor slots and content arrays.
 */

import * as THREE from 'three';

import { createCanvasTexture } from '../assets';
import type { MorphEngine } from '../core/MorphEngine';
import { EraVehicles } from '../content/vehicles/EraVehicles';
import { EraPedestrians } from '../content/pedestrians/EraPedestrians';
import { ERA_ANCHOR_SLOTS, type EraId } from '../eras';
import { EraState } from '../state/EraState';

export class SceneShell {
  readonly group = new THREE.Group();
  private readonly facadeMaterial: THREE.MeshStandardMaterial;
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

    // Neutral facade stub: a single box whose vertex topology is morphed
    // between the per-era anchor slots by the shared morph engine.
    this.facadeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8f9aa8'),
      roughness: 0.8,
      metalness: 0.12,
    });
    const neutralWindow = ERA_ANCHOR_SLOTS['1945'].window;
    const facade = new THREE.BoxGeometry(
      neutralWindow.width,
      neutralWindow.height,
      neutralWindow.depth,
      4,
      4,
      2,
    ).toNonIndexed();
    const facadeMesh = new THREE.Mesh(facade, this.facadeMaterial);
    facadeMesh.position.set(neutralWindow.x, neutralWindow.y, neutralWindow.z);
    facadeMesh.name = 'facade-stub';
    this.group.add(facadeMesh);

    // Register all three shared anchor slots (doorway/window/shelf) as morph
    // targets, plus the per-era scaffolding. No era-specific content yet.
    morphEngine
      .createAnchorSlot('doorway', this.facadeMaterial)
      .mesh.position.copy(ERA_ANCHOR_SLOTS['1945'].doorway);
    morphEngine
      .createAnchorSlot('window', this.facadeMaterial)
      .mesh.position.copy(ERA_ANCHOR_SLOTS['1945'].window);
    morphEngine
      .createAnchorSlot('shelf', this.facadeMaterial)
      .mesh.position.copy(ERA_ANCHOR_SLOTS['1945'].shelf);

    this.group.add(morphEngine.group);

    this.unsubscribe = eraState.subscribe(() => {
      // Reserved for era-content tasks (content visibility ramping etc.).
    });
  }

  /** Advance per-frame logic. */
  update(_dt: number): void {
    this.vehicles.update(_dt);
    this.pedestrians.update(_dt);
  }

  setEra(era: EraId, _t: number): void {
    this.vehicles.setEra(era);
    this.pedestrians.setEra(era);
  }

  dispose(): void {
    this.unsubscribe();
    this.facadeMaterial.dispose();
    this.vehicles.dispose();
    this.pedestrians.dispose();
    this.group.clear();
  }
}