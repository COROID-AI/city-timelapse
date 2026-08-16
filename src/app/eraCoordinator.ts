// ─── Era Coordinator ──────────────────────────────────────────────────────
// Centralizes era state, subscribes to timeline UI era-change events,
// and orchestrates per-domain updateEra/setEra calls across buildings,
// vehicles, pedestrians, streetscape, and audio.
//
// Decoupling contract:
//   - Timeline UI emits EraChangeEvent; coordinator listens.
//   - UI never imports scene or app modules.
//   - Coordinator owns scene mutation; UI owns DOM only.

import * as THREE from 'three';
import type { EraId } from '../eras.js';
import { ERA_REGISTRY } from '../eras.js';
import { buildEraBuildings } from '../buildings/registry.js';
import { TrafficManager } from '../vehicles/traffic.js';
import { PedestrianController } from '../pedestrians/controller.js';
import { buildStreetscape } from '../streets/layer.js';
import { TextureFactory } from '../util/textures.js';
import { BuildingTextureBuilder } from '../buildings/parts.js';
import { AudioController } from '../audio/index.js';
import { runTransition, abortTransition } from './transitions.js';

// ── Public API ────────────────────────────────────────────────────────────

/** Callback signature for era-change listeners */
export type EraChangeListener = (detail: EraChangeDetail) => void;

/** Detail payload carried by era-change events */
export interface EraChangeDetail {
  eraId: EraId;
  year: number;
  label: string;
  description: string;
}

/** Options for constructing an EraCoordinator */
export interface EraCoordinatorOptions {
  /** Three.js scene to mutate */
  scene: THREE.Scene;
  /** Shared texture factory for material generation */
  textures: TextureFactory;
  /** Per-building texture builder */
  buildingTextures: BuildingTextureBuilder;
}

// ── EraCoordinator class ──────────────────────────────────────────────────

/**
 * Manages the current era state and drives era transitions.
 *
 * Lifecycle:
 *   1. Create coordinator with scene + textures
 *   2. Call init() to build initial era scene
 *   3. Subscribe to timeline UI events via onEraChange()
 *   4. Call switchEra() to animate to a new era
 *   5. Call dispose() to clean up
 *
 * The coordinator ensures that every domain (buildings, vehicles, etc.)
 * is updated atomically and that transitions are smooth and interruptible.
 */
export class EraCoordinator {
  private _currentEra: EraId = '1945';
  private readonly _scene: THREE.Scene;
  private readonly _textures: TextureFactory;
  private readonly _bldgTextures: BuildingTextureBuilder;

  // Per-domain layers
  private _buildingsGroup: THREE.Group | null = null;
  private _streetscapeGroup: THREE.Group | null = null;
  private _trafficManager!: TrafficManager;
  private _pedestrianController!: PedestrianController;
  private _audioController!: AudioController;
  private _listeners: EraChangeListener[] = [];

  constructor(options: EraCoordinatorOptions) {
    this._scene = options.scene;
    this._textures = options.textures;
    this._bldgTextures = options.buildingTextures;
  }

  // ── Initialization ────────────────────────────────────────────────────

  /**
   * Build the initial era scene. Called once after construction.
   * Sets up all domain layers for the first era.
   */
  init(): void {
    this._trafficManager = new TrafficManager(this._scene);
    this._pedestrianController = new PedestrianController(this._scene);
    this._audioController = new AudioController({ autoInit: false });

    const buildings = buildEraBuildings(this._currentEra, this._textures, this._bldgTextures);
    if (buildings) {
      this._scene.add(buildings);
      buildings.name = 'buildings';
      this._tagChildren(buildings, 'building');
      this._buildingsGroup = buildings;
    }

    const streetscape = buildStreetscape(this._currentEra, this._textures);
    this._scene.add(streetscape);
    streetscape.name = 'streetscape';
    this._tagChildren(streetscape, 'street-furniture');
    this._streetscapeGroup = streetscape;

    this._trafficManager.init(this._currentEra);
    this._pedestrianController.updateEra(this._currentEra);
  }

  // ── Era switching ─────────────────────────────────────────────────────

  /**
   * Switch to a new era with staged transition.
   * If another transition is running, it is aborted and replaced.
   * Never hard-cuts — outgoing elements fade/sink, incoming rise/fade.
   */
  async switchEra(newEra: EraId): Promise<void> {
    if (newEra === this._currentEra) return;

    // Step 1: Fade out old scene elements (staggered layers)
    await runTransition(
      { scene: this._scene },
      'outgoing',
    ).catch((err) => {
      // Abort is expected when rapidly switching eras
      if ((err as Error).message !== 'transition_aborted') {
        console.error('Outgoing transition failed:', err);
      }
    });

    // Step 2: Replace all domain content (synchronous)
    this._replaceSceneContent(newEra);

    // Step 3: Fade in new scene elements (staggered layers)
    await runTransition(
      { scene: this._scene },
      'incoming',
    ).catch((err) => {
      if ((err as Error).message !== 'transition_aborted') {
        console.error('Incoming transition failed:', err);
      }
    });

    // Notify listeners
    this._notifyListeners(newEra);
  }

  /**
   * Synchronous era switch — updates all domains immediately.
   * Used for debug hotkeys where animation is skipped.
   */
  forceSwitchEra(newEra: EraId): void {
    if (newEra === this._currentEra) return;

    abortTransition();
    this._replaceSceneContent(newEra);
    this._notifyListeners(newEra);
  }

  // ── Properties ────────────────────────────────────────────────────────

  /** Currently active era identifier */
  get currentEra(): EraId {
    return this._currentEra;
  }

  // ── Event subscription ────────────────────────────────────────────────

  /** Register a listener for era-change events */
  onEraChange(listener: EraChangeListener): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  /** Handle an era-change event from the timeline UI */
  handleEraChange(detail: EraChangeDetail): void {
    this.switchEra(detail.eraId);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  /** Dispose all managed resources */
  dispose(): void {
    this._listeners = [];
    abortTransition();
    this._cleanupScene();
    this._trafficManager.dispose();
    this._pedestrianController.dispose();
    this._audioController.dispose();
  }

  // ── Scene diagnostics ─────────────────────────────────────────────────

  /** Dump scene child counts per layer for debugging */
  dumpSceneStats(): string {
    const lines: string[] = [];
    lines.push(`=== Scene Stats (era: ${this._currentEra}) ===`);
    lines.push(`Total scene children: ${this._scene.children.length}`);

    const counts = new Map<string, number>();
    this._scene.traverse((child) => {
      const tag = (child as any).__eraLayer ?? 'untagged';
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });

    lines.push('Per-layer counts:');
    for (const [layer, count] of counts) {
      lines.push(`  ${layer}: ${count}`);
    }

    lines.push(`Buildings group children: ${this._buildingsGroup ? this._buildingsGroup.children.length : 0}`);
    lines.push(`Streetscape group children: ${this._streetscapeGroup ? this._streetscapeGroup.children.length : 0}`);

    return lines.join('\n');
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private _replaceSceneContent(newEra: EraId): void {
    // Clean up old scene elements
    this._cleanupScene();

    this._currentEra = newEra;

    // Rebuild visuals
    const buildings = buildEraBuildings(newEra, this._textures, this._bldgTextures);
    if (buildings) {
      this._scene.add(buildings);
      buildings.name = 'buildings';
      this._tagChildren(buildings, 'building');
      this._buildingsGroup = buildings;
    }

    const streetscape = buildStreetscape(newEra, this._textures);
    this._scene.add(streetscape);
    streetscape.name = 'streetscape';
    this._tagChildren(streetscape, 'street-furniture');
    this._streetscapeGroup = streetscape;

    this._trafficManager.updateEra(newEra);
    this._pedestrianController.updateEra(newEra);
    this._audioController.setEra(newEra);
  }

  private _cleanupScene(): void {
    // Remove buildings
    if (this._buildingsGroup && this._buildingsGroup.parent) {
      this._removeWithDispose(this._buildingsGroup);
      this._buildingsGroup = null;
    }

    // Remove streetscape
    if (this._streetscapeGroup && this._streetscapeGroup.parent) {
      this._removeWithDispose(this._streetscapeGroup);
      this._streetscapeGroup = null;
    }

    // Remove any orphan tagged objects left behind
    const toRemove: THREE.Object3D[] = [];
    this._scene.traverse((child) => {
      if ((child as any).__eraLayer) {
        toRemove.push(child);
      }
    });
    for (const obj of toRemove) {
      if (obj.parent) obj.parent.remove(obj);
    }
  }

  private _removeWithDispose(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    }
    // Dispose the group itself
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  private _tagChildren(group: THREE.Group, tag: string): void {
    group.traverse((child) => {
      (child as any).__eraLayer = tag;
    });
  }

  private _notifyListeners(eraId: EraId): void {
    const spec = ERA_REGISTRY.find((e) => e.id === eraId);
    if (spec) {
      for (const listener of this._listeners) {
        listener({ eraId, year: spec.year, label: spec.label, description: spec.description });
      }
    }
  }
}
