import * as THREE from 'three';

/**
 * Frozen layout constants for the city block. These values are shared by every
 * era module so that building footprints, roads, sidewalks, and camera framing
 * line up across time periods. Do not change these without updating all
 * consumers.
 */

/** Overall footprint of the city block in world units (x = width, z = depth). */
export const BLOCK = Object.freeze({
  width: 120.0,
  depth: 120.0,
});

/** Roadway geometry surrounding the block. */
export const STREET = Object.freeze({
  width: 24.0,
  laneCount: 4,
});

/** Pedestrian sidewalk geometry lining the block. */
export const SIDEWALK = Object.freeze({
  width: 4.0,
  height: 0.18,
});

/** Curb geometry separating the sidewalk from the street. */
export const CURB = Object.freeze({
  height: 0.24,
  depth: 0.6,
});

/**
 * Five camera anchors — one per era — used for cinematic framing when the
 * timeline switches. Positions are world-space; `lookAt` is the focus point.
 * Values are frozen (deeply) so consumers cannot mutate the shared contract.
 */
export interface CameraAnchor {
  id: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

const makeAnchor = (id: string, x: number, y: number, z: number, lookX: number, lookY: number, lookZ: number): CameraAnchor =>
  Object.freeze({
    id,
    position: Object.freeze(new THREE.Vector3(x, y, z)),
    lookAt: Object.freeze(new THREE.Vector3(lookX, lookY, lookZ)),
  });

/** Camera anchors indexed for each era, in ERA_IDS order. */
export const CAMERA_ANCHORS: readonly CameraAnchor[] = Object.freeze([
  makeAnchor('1945', 0, 42, 96, 0, 0, 0),
  makeAnchor('1965', 0, 40, 92, 0, 0, 0),
  makeAnchor('1985', 0, 44, 98, 0, 0, 0),
  makeAnchor('2005', 0, 46, 100, 0, 0, 0),
  makeAnchor('2025', 0, 48, 104, 0, 0, 0),
]);