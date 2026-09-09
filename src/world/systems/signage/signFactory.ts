/**
 * Sign factory: builds era-authentic THREE sign meshes anchored to a layout
 * frontage plane.
 *
 * Every sign is a thin board (plane face + optional extrusion) that sits on
 * the *frontage plane* the shared layout exposes — the plane's `position`,
 * `facing` and `height` band fully define placement. The buildings system is
 * never imported or touched here: signage stays parallel-safe by anchoring
 * only to the layout's anchor planes.
 *
 * Materials:
 * - All sign faces use procedural canvas textures (`signTextures`).
 * - Illuminated boards (neon/backlit/digital/media) use an emissive material
 *   whose `userData.bloom` is `true` so the polish phase's bloom pass can
 *   target them consistently (the `userData.bloom` convention consumed by
 *   compose-scene-app).
 */

import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  type CanvasTexture,
} from 'three';
import type { FrontagePlane } from '../../layout/types';
import type { SignageItemSpec } from './signageEraData';
import { createSignTexture } from './signTextures';

/** Canonical user-data flag keyed on sign materials for the bloom pass. */
export const BLOOM_FLAG = 'bloom';

/** Resource bundle a sign owns (used for `disposeSignResources`). */
export interface SignResources {
  materials: Array<MeshBasicMaterial | MeshLambertMaterial>;
  textures: CanvasTexture[];
}

export interface CreateSignOptions {
  /** Frontage anchor plane (position/facing come from the layout). */
  readonly plane: FrontagePlane;
  /** Panel world dimensions: width along the street, height up the facade. */
  readonly size: { width: number; height: number };
  /** Vertical base of the panel measured up from the frontage ground. */
  readonly baseY: number;
  /** Board depth pushing outward from the plane (world units). */
  readonly depth: number;
  /** Era-appropriate sign definition. */
  readonly item: SignageItemSpec;
  /** Determinism seed (typically `<layoutSeed>:<era>:<signIndex>`). */
  readonly seed: string;
  /** Scene-graph group name prefix. */
  readonly namePrefix: string;
  /** Optional along-plane offset (world units, positive = to the viewer's right when facing the plane). */
  readonly offsetAlong?: number;
  /** Optional extra yaw (radians) added to the facing yaw (e.g. +/-PI/2 for blade signs). */
  readonly yawOffset?: number;
}

/**
 * Yaw (rotation around Y) that makes the +Z face of a plane point along
 * `facing` (an outward, street-ward normal). `atan2(x, z)` maps +Z -> 0,
 * +X -> +PI/2, -X -> -PI/2, -Z -> ±PI.
 */
export function yawForFacing(facing: { x: number; z: number }): number {
  return Math.atan2(facing.x, facing.z);
}

/** Build the canvas texture for a sign face (deterministic per seed). */
export function faceTextureFor(
  item: SignageItemSpec,
  sizeWidth: number,
  sizeHeight: number,
  seed: string,
): CanvasTexture {
  return createSignTexture({
    text: item.text,
    primary: item.primaryColor,
    accent: item.accentColor,
    base: item.baseColor,
    kind: item.textureKind,
    width: Math.max(80, Math.round(sizeWidth * 32)),
    height: Math.max(48, Math.round(sizeHeight * 32)),
    seed,
    burst: item.burst,
  });
}

/**
 * Create one sign mesh group anchored to `plane`.
 *
 * Orientation: the board's local +Z is the outward (street-ward) direction,
 * so after `rotation.y = yawForFacing(facing)` the front face points exactly
 * along the plane normal. Local +Y stays vertical regardless of facing.
 */
export function createSign(options: CreateSignOptions): { group: Group; resources: SignResources } {
  const { plane, size, baseY, depth, item, seed, namePrefix, offsetAlong = 0, yawOffset = 0 } = options;
  const group = new Group();
  group.name = `${namePrefix}-sign-${item.band}`;
  group.userData.signage = { category: item.category, band: item.band, tech: item.tech };

  const texture = faceTextureFor(item, size.width, size.height, seed);

  let faceMaterial: MeshBasicMaterial | MeshLambertMaterial;
  if (
    item.textureKind === 'painted' ||
    item.textureKind === 'poster' ||
    item.textureKind === 'graffiti' ||
    item.textureKind === 'awning'
  ) {
    // Unlit painted board — no bloom.
    faceMaterial = new MeshBasicMaterial({ map: texture, side: DoubleSide, color: 0xffffff });
  } else {
    // Illuminated: emissive map so the neon/backlit/LED/media face glows on
    // its own, tagged so the bloom pass can target it.
    faceMaterial = new MeshLambertMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 1,
      emissiveMap: texture,
      side: DoubleSide,
    });
    faceMaterial.userData[BLOOM_FLAG] = true;
  }

  const faceMesh = new Mesh(new PlaneGeometry(size.width, size.height), faceMaterial);
  faceMesh.name = `${group.name}-face`;
  faceMesh.userData.bloom = faceMaterial.userData[BLOOM_FLAG] === true;
  faceMesh.userData.frontagePlane = plane.position;
  group.add(faceMesh);

  const resources: SignResources = { materials: [faceMaterial], textures: [texture] };

  // Thin body so signs read as 3D boards from the side.
  if (depth > 0) {
    const bodyMaterial = new MeshBasicMaterial({ color: 0x1b2027 });
    const body = new Mesh(new BoxGeometry(size.width, size.height, depth), bodyMaterial);
    body.position.z = -depth / 2 - 0.01;
    body.name = `${group.name}-body`;
    group.add(body);
    resources.materials.push(bodyMaterial);
  }

  // Anchor placement: position at plane origin, yaw toward the street, rise
  // to the requested band. Local +Y is vertical because yaw only rotates XZ.
  group.rotation.y = yawForFacing(plane.facing) + yawOffset;
  group.position.set(
    plane.position.x + offsetAlong * Math.cos(yawForFacing(plane.facing)),
    baseY + size.height / 2,
    plane.position.z + offsetAlong * Math.sin(yawForFacing(plane.facing)),
  );

  return { group, resources };
}

/** Release every material / texture owned by a sign (idempotent). */
export function disposeSignResources(resources: SignResources): void {
  for (const texture of resources.textures) texture.dispose();
  for (const material of resources.materials) material.dispose();
}

/** Create a sign group (convenience alias of {@link createSign}). */
export function buildSignOnPlane(options: CreateSignOptions): Group {
  return createSign(options).group;
}