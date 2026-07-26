import { BoxGeometry, Color, Mesh, MeshStandardMaterial } from 'three';
import {
  DEFAULT_ERA_CONFIG,
  ERA_ORDER,
  lerp,
  lerpHex,
  type EraKey,
} from './eraConfig.js';

/**
 * Debug placeholder domain.
 *
 * A single cube that scales and color-changes per era, proving the era →
 * TransitionManager → domain pipeline end-to-end. During a cross-fade it
 * interpolates scale and color between the source and destination era configs.
 *
 * This is also a reference implementation of the `registerDomain` contract for
 * downstream domain modules to follow.
 */
export function createDebugCube(): Mesh {
  const geometry = new BoxGeometry(4, 4, 4);
  const material = new MeshStandardMaterial({
    color: new Color(DEFAULT_ERA_CONFIG['1945'].buildings.palette.colors[0]),
    roughness: 0.5,
    metalness: 0.3,
  });
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(0, 3, 0);
  mesh.name = 'debug-cube';
  return mesh;
}

/**
 * Build the per-frame `applyEra` callback for the debug cube. The cube scales up
 * with era progress (taller toward the future) and takes on each era's primary
 * facade color, interpolating smoothly during a cross-fade.
 *
 * @returns the `applyEra` function to pass to `TransitionManager.registerDomain`.
 */
export function createDebugCubeApplyEra(mesh: Mesh): (toKey: EraKey, t: number, fromKey: EraKey) => void {
  return (toKey: EraKey, t: number, fromKey: EraKey) => {
    const from = DEFAULT_ERA_CONFIG[fromKey];
    const to = DEFAULT_ERA_CONFIG[toKey];

    // Scale grows with era index — a literal "timelapse grows the city" cue.
    const fromScale = 0.6 + eraProgress(fromKey) * 1.2;
    const toScale = 0.6 + eraProgress(toKey) * 1.2;
    const scale = lerp(fromScale, toScale, t);
    mesh.scale.setScalar(scale);

    // Keep the cube resting on the ground as it scales.
    mesh.position.y = 2 * scale;

    // Cross-fade the facade color between the two era palettes.
    const material = mesh.material as MeshStandardMaterial;
    const fromColor = from.buildings.palette.colors[0];
    const toColor = to.buildings.palette.colors[0];
    material.color.set(lerpHex(fromColor, toColor, t));

    // Subtly cross-fade PBR values too, reinforcing that any field is drivable.
    material.roughness = lerp(from.buildings.palette.roughness[0], to.buildings.palette.roughness[0], t);
    material.metalness = lerp(from.buildings.palette.metalness[1], to.buildings.palette.metalness[1], t);
  };
}

/** Normalized position of an era across the timeline, in [0, 1]. */
function eraProgress(key: EraKey): number {
  const idx = ERA_ORDER.indexOf(key);
  return idx / (ERA_ORDER.length - 1);
}
