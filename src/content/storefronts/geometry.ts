/**
 * src/content/storefronts/geometry.ts — procedural storefront unit geometry.
 *
 * Builds one ground-floor shop unit from a StorefrontSpec as a small group of
 * primitive meshes: facade plane, display window, entrance door, sign band,
 * awning (with per-era shape) and banner. All textures are assigned later by
 * the materials builder; this file only creates meshes whose positions follow
 * the shared anchor slots so the morph engine can drive them during era
 * transitions.
 */

import * as THREE from 'three';

import type { StorefrontSpec } from '../../eras';
import {
  DOOR_HEIGHT,
  GROUND_FLOOR_HEIGHT,
  SIGN_BAND_HEIGHT,
  signBandY,
  windowCenterY,
  WINDOW_HEIGHT,
} from './layout';

export interface StorefrontPart {
  name: string;
  mesh: THREE.Mesh;
  /** Which shared anchor slot this part follows. */
  slot: 'doorway' | 'window' | undefined;
}

/** One unit: a named group plus all its anchor-following meshes. */
export interface StorefrontBuild {
  group: THREE.Group;
  parts: StorefrontPart[];
}

function box(
  name: string,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

/** Build the complete storefront unit geometry for one spec at slot x. */
export function buildStorefrontGeometry(
  spec: StorefrontSpec,
  slotX: number,
): StorefrontBuild {
  const group = new THREE.Group();
  group.name = spec.id;
  const parts: StorefrontPart[] = [];

  // facade backdrop (the brick / painted wall behind the windows)
  const facade = box(
    'facade',
    4.4,
    GROUND_FLOOR_HEIGHT,
    0.16,
    slotX,
    GROUND_FLOOR_HEIGHT / 2,
    0,
  );
  parts.push({ name: 'facade', mesh: facade, slot: undefined });
  group.add(facade);

  // sign band above the window
  const sign = box(
    'sign',
    4.2,
    SIGN_BAND_HEIGHT,
    0.18,
    slotX,
    signBandY(),
    0.02,
  );
  parts.push({ name: 'sign', mesh: sign, slot: undefined });
  group.add(sign);

  // display window (follows the shared window anchor)
  const windowX = slotX;
  const window = box(
    'window',
    3.4,
    WINDOW_HEIGHT,
    0.14,
    windowX,
    windowCenterY(),
    0.12,
  );
  parts.push({ name: 'window', mesh: window, slot: 'window' });
  group.add(window);

  // entrance door (follows the shared doorway anchor)
  const door = box(
    'door',
    1.2,
    DOOR_HEIGHT,
    0.2,
    slotX + 1.6,
    doorCenter(),
    0.16,
  );
  parts.push({ name: 'door', mesh: door, slot: 'doorway' });
  group.add(door);

  // awning — per-era shape
  const awning = buildAwning(spec, slotX);
  group.add(awning.mesh);
  parts.push({ name: 'awning', mesh: awning.mesh, slot: undefined });

  return { group, parts };
}

function doorCenter(): number {
  return DOOR_HEIGHT / 2;
}

function buildAwning(
  spec: StorefrontSpec,
  slotX: number,
): { mesh: THREE.Mesh } {
  const w = 4.4;
  const d = 1.1;
  const y = signBandY() - SIGN_BAND_HEIGHT / 2 - 0.08;
  const name = `awning-${spec.awning}`;
  switch (spec.awning) {
    case 'canvas-stripes':
      return { mesh: box(name, w, 0.24, d, slotX, y, 0) };
    case 'scalloped':
      return { mesh: box(name, w, 0.22, d, slotX, y, 0) };
    case 'metal-rib':
      return { mesh: box(name, w, 0.28, d, slotX, y, 0) };
    case 'glass-canopy':
      return { mesh: box(name, w, 0.14, d, slotX, y, 0) };
    case 'matte-canopy':
      return { mesh: box(name, w, 0.16, d, slotX, y, 0) };
  }
}