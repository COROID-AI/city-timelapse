/**
 * src/content/storefronts/index.ts — era-aware storefronts scene module.
 *
 * Exposes the standard scene-module contract:
 *   { group, update(dt), setEra(era, t), dispose(), registerAnchors(engine) }
 *
 * All five eras' storefronts are built once and kept in per-era groups.
 * Transitions are driven by the shared MorphEngine timeline:
 *  - population crossfade rides engine.onTimeline (like EraVehicles),
 *  - anchor followers (doorway/window) are tagged per mesh,
 *  - texture swaps are bound so the engine swaps the already-cached
 *    CanvasTexture maps at the transition midpoint. No geometry is rebuilt
 *    mid-morph, so frame hitches are avoided.
 */

import * as THREE from 'three';

import type { MorphEngine } from '../../core/MorphEngine';
import { ANCHOR_SLOT_KEYS } from './registration';
import type { EraId } from '../../eras';
import { ERA_IDS } from '../../eras';
import type { StorefrontPopulation } from './build';
import { buildStorefrontPopulation } from './build';

export interface StorefrontModule {
  readonly group: THREE.Group;
  update(dt: number): void;
  setEra(era: EraId, t?: number): void;
  dispose(): void;
  /** Register all anchor followers + texture swaps on the morph engine. */
  registerAnchors(engine: MorphEngine): void;
  /** Declarative spec access (used by tests and future scene wiring). */
  readonly populations: Map<EraId, StorefrontPopulation>;
}

/** Create the storefronts module for the given starting era. */
export function createStorefronts(era: EraId = '1945'): StorefrontModule {
  const group = new THREE.Group();
  group.name = 'EraStorefronts';

  const populations = new Map<EraId, StorefrontPopulation>();
  for (const id of ERA_IDS) {
    const pop = buildStorefrontPopulation(id);
    group.add(pop.group);
    populations.set(id, pop);
  }

  let timelineOff: (() => void) | null = null;

  function setOpacity(visibleEra: EraId, t: number): void {
    for (const [id, pop] of populations) {
      const targetOpacity = id === visibleEra ? t : 0;
      pop.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const material = mesh?.material as THREE.MeshStandardMaterial | undefined;
        if (material) {
          material.opacity = targetOpacity;
          material.transparent = targetOpacity < 1;
        }
      });
    }
  }

  function registerAnchors(engine: MorphEngine): void {
    // Crossfade the whole population on the shared timeline.
    timelineOff = engine.onTimeline((state) => {
      const { progress, fromEra, toEra } = state;
      if (progress <= 0) {
        setOpacity(fromEra, 1);
        return;
      }
      if (progress >= 1) {
        setOpacity(toEra, 1);
        return;
      }
      const leaving = populations.get(fromEra);
      const arriving = populations.get(toEra);
      if (leaving && arriving) {
        setOpacity(toEra, Math.min(1, progress));
        setOpacity(fromEra, 1 - progress);
      }
    });

    // Tag anchor followers on each era's meshes.
    for (const id of ERA_IDS) {
      const pop = populations.get(id);
      if (!pop) {
        continue;
      }
      for (const f of pop.registration.followers) {
        if (!ANCHOR_SLOT_KEYS.includes(f.slot)) {
          continue;
        }
        const mesh = pop.group.getObjectByName(f.meshName);
        if (!mesh) {
          continue;
        }
        // The engine's anchor morph slots drive pose; content meshes are
        // tagged with the slot so future morph drivers can look them up.
        mesh.userData.anchorSlot = f.slot;
      }
    }

    // Bind texture swaps across adjacent eras on shared mesh names.
    for (let i = 0; i < ERA_IDS.length - 1; i += 1) {
      const fromId = ERA_IDS[i];
      const toId = ERA_IDS[i + 1];
      const from = populations.get(fromId);
      const to = populations.get(toId);
      if (!from || !to) {
        continue;
      }
      for (const [key, fromMat] of from.materials) {
        const toMat = to.materials.get(key);
        if (toMat && fromMat.map && toMat.map) {
          engine.bindTextureSwap(fromMat, () => fromMat.map, () => toMat.map);
        }
      }
    }
  }

  function dispose(): void {
    if (timelineOff) {
      timelineOff();
      timelineOff = null;
    }
    for (const pop of populations.values()) {
      pop.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        const material = mesh?.material as THREE.Material | undefined;
        if (material) {
          material.dispose();
        }
      });
      pop.group.clear();
    }
    populations.clear();
    group.clear();
  }

  // Initial pose: only the starting era visible.
  setOpacity(era, 1);

  return {
    group,
    update(_dt: number): void {
      // static facade — no per-frame work needed
    },
    setEra(id: EraId, t = 1): void {
      setOpacity(id, t);
    },
    dispose,
    registerAnchors,
    populations,
  };
}