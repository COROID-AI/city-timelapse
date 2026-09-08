/**
 * Neon night city world — the visual stage of the game.
 *
 * Composes the closed-loop track, wet reflective road, neon sign corridor,
 * streetlights, building silhouettes, and the night sky/fog into a single
 * `group` that the integration task attaches to the scene.
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `createNeonCity(scene)` -> builds and returns the world
 *   `world.update(dt, elapsed)` -> animates flicker + rain sheen (allocation-free)
 *   `world.dispose()` -> releases all GPU resources
 *
 * `createNeonCity` mutates only the passed-in `scene` (night sky + fog) and
 * returns a self-contained group; it has no other global side effects.
 */

import * as THREE from 'three';
import type { TrackCurve } from './track';
import { createTrack } from './track';
import type { RoadSurface } from './roadMaterial';
import { createRoad } from './roadMaterial';
import type { NeonCorridor } from './neonSigns';
import { createNeonSigns } from './neonSigns';
import type { NightLighting } from './lighting';
import { createNightLighting } from './lighting';
import { ROAD_HALF_WIDTH } from './track';

/** The assembled neon city world. */
export interface NeonCityWorld {
  /** Root group holding every world mesh; add this to the scene. */
  readonly group: THREE.Group;
  /** Advance the world by `dt` seconds at global time `elapsed`. */
  update(dt: number, elapsed: number): void;
  /** The deterministic closed-loop circuit (shared race/AI contract). */
  readonly track: TrackCurve;
  /** The wet reflective road surface. */
  readonly road: RoadSurface;
  /** The neon sign / streetlight / building corridor. */
  readonly corridor: NeonCorridor;
  /** The night sky / fog lighting rig. */
  readonly lighting: NightLighting;
  /** Start/finish line mesh marking checkpoint 0. */
  readonly startLine: THREE.Group;
  /** Release all GPU resources owned by the world. */
  dispose(): void;
}

/**
 * Build the neon night city world.
 *
 * @param scene The scene to apply night sky + fog to (also the attach target
 *              for `group`). Only the background/fog are mutated here.
 */
export function createNeonCity(scene: THREE.Scene): NeonCityWorld {
  const group = new THREE.Group();

  // Deterministic circuit shared with race/AI logic.
  const track = createTrack();

  // Wet reflective road.
  const road = createRoad(track.length);
  group.add(road.asphalt, road.reflector);

  // Neon corridor (signs, streetlamps, buildings).
  const corridor = createNeonSigns(track);
  group.add(corridor.group);

  // Night sky + fog + lighting rig (mutates `scene` background/fog).
  const lighting = createNightLighting(scene);
  const lightGroup = lighting.group;
  lightGroup.position.set(0, 0, 0);
  group.add(lightGroup);

  // Start/finish line: a subtle white strip across the road at checkpoint 0.
  const startLine = new THREE.Group();
  const lineGeo = new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2, 0.06, 0.5);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineMesh = new THREE.Mesh(lineGeo, lineMat);
  lineMesh.position
    .copy(track.startLine.position)
    .add(new THREE.Vector3(0, 0.05, 0));
  lineMesh.rotation.y = Math.atan2(track.startLine.tangent.x, track.startLine.tangent.z);
  startLine.add(lineMesh);
  group.add(startLine);

  return {
    group,
    track,
    road,
    corridor,
    lighting,
    startLine,
    update(dt, elapsed) {
      road.update(dt);
      corridor.update(dt, elapsed);
    },
    dispose() {
      road.dispose();
      corridor.dispose();
      lighting.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}