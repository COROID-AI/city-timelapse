/**
 * City scene — root scene graph manager.
 *
 * Assembles per-layer groups (buildings, storefronts, vehicles, pedestrians,
 * street environment) into a single THREE.Scene hierarchy. Exposes a factory
 * so the app can instantiate, update, and dispose the full scene graph.
 */

import * as THREE from 'three';
import type { EraContent } from '../content/eraConfig.js';
import { createBuildingsLayer } from './layers/buildings.js';
import { createStorefrontsLayer } from './layers/storefronts.js';
import { createVehiclesLayer } from './layers/vehicles.js';
import { createPedestriansLayer } from './layers/pedestrians.js';
import { createStreetEnvironment } from './layers/streetEnvironment.js';
import { createAtmosphereLayer } from './layers/atmosphereLayer.js';
import { createTransitionManager } from './transitionManager.js';
import { createCameraRig } from './cameraRig.js';

import type { AtmosphereLayerResult } from './layers/atmosphereLayer.js';

export interface SceneGraphResult {
  /** The root THREE.Scene containing all layers. */
  scene: THREE.Scene;
  /** Dispose every child group and free resources. */
  dispose(): void;
  /** Atmosphere layer for per-frame updates and era transitions. */
  atmosphere: AtmosphereLayerResult;
}

/**
 * Build the complete city scene graph for a given era's content config.
 *
 * Registers every named layer module as a named subgroup under `scene`,
 * and returns a helper to tear it all down.
 */
export function createCityScene(config: EraContent): SceneGraphResult {
  const scene = new THREE.Scene();
  scene.name = 'city-scene';

  // ── Atmosphere (sky, fog, hemisphere + directional sun) ───────────────
  const atmosphere = createAtmosphereLayer(scene);
  scene.add(atmosphere.group);

  // ── Layer groups (factory stubs wired in) ─────────────────────────────
  const buildings = createBuildingsLayer(config.buildings);
  scene.add(buildings.group);

  const storefronts = createStorefrontsLayer(config.storefronts);
  scene.add(storefronts.group);

  const vehicles = createVehiclesLayer(config.vehicles);
  scene.add(vehicles.group);

  const pedestrians = createPedestriansLayer(config.pedestrians);
  scene.add(pedestrians.group);

  const street = createStreetEnvironment(config.street);
  scene.add(street.group);

  // ── Camera rig & transition manager ──────────────────────────────────
  const cameraRig = createCameraRig();
  const transitionManager = createTransitionManager();

  return {
    get scene() {
      return scene;
    },
    get atmosphere() {
      return atmosphere;
    },
    dispose() {
      // Remove children in reverse order
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }
      cameraRig.dispose();
      transitionManager.dispose();
      atmosphere.dispose();
    },
  };
}
