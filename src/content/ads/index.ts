/**
 * src/content/ads/index.ts — era-aware advertisements scene module.
 *
 * Standard scene-module contract: { group, update, setEra, dispose,
 * registerAnchors }. Builds all five eras' ad populations once, keeps them in
 * per-era groups, registers anchor followers (window/shelf), and binds
 * texture swaps so the morph engine swaps mural→neon→billboard→screen maps
 * at the transition midpoint (already-cached canvases, no hitches).
 * Population crossfade rides the shared morph timeline (like EraVehicles).
 */

import * as THREE from 'three';

import type { MorphEngine } from '../../core/MorphEngine';
import { ANCHOR_SLOT_KEYS } from '../storefronts/registration';
import type { EraId } from '../../eras';
import { ERA_IDS } from '../../eras';
import type { AdPopulation } from './build';
import { buildAdPopulation } from './build';

export interface AdsModule {
  readonly group: THREE.Group;
  update(dt: number): void;
  setEra(era: EraId, t?: number): void;
  dispose(): void;
  registerAnchors(engine: MorphEngine): void;
  readonly populations: Map<EraId, AdPopulation>;
}

/** Create the ads module for the given starting era. */
export function createAds(era: EraId = '1945'): AdsModule {
  const group = new THREE.Group();
  group.name = 'EraAds';

  const populations = new Map<EraId, AdPopulation>();
  for (const id of ERA_IDS) {
    const pop = buildAdPopulation(id);
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
      setOpacity(toEra, Math.min(1, progress));
      setOpacity(fromEra, 1 - progress);
    });

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

  setOpacity(era, 1);

  return {
    group,
    update(_dt: number): void {
      // static ad boards — no per-frame work needed
    },
    setEra(id: EraId, t = 1): void {
      setOpacity(id, t);
    },
    dispose,
    registerAnchors,
    populations,
  };
}