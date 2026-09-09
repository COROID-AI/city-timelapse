/**
 * Ground-mesh builder for the city-block layout.
 *
 * `buildGroundMeshes(layout)` turns the pure `BlockLayout` into a
 * THREE.Group of flat meshes on the ground plane (Y = 0):
 *
 * - a soil ground base under the whole scene,
 * - road carriageways with procedurally painted lane-marking textures,
 * - zebra crosswalk overlays,
 * - paved sidewalks,
 * - raised curbs along the street edges.
 *
 * The group owns every material/texture it creates; `disposeGroundMeshes`
 * releases them. The result is deterministic per layout and era-neutral —
 * era systems (buildings, vehicles, pedestrians) attach above this frame.
 */

import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Material,
} from 'three';
import type { BlockLayout, GridRect, Street } from './types';
import { createCrosswalkTexture, createStreetTexture } from './groundTextures';

/* Layer heights keep flat meshes free of z-fighting. */
const GROUND_Y = 0;
const ROAD_Y = 0.012;
const CROSSWALK_Y = 0.024;
const SIDEWALK_Y = 0.036;
const CURB_HEIGHT = 0.1;
const CURB_WIDTH = 0.16;

/** Ground base covering the block island and the surrounding pavement. */
const GROUND_RECT = { minX: -16, maxX: 40, minZ: -16, maxZ: 28 };

const GROUND_COLOR = 0x6f6250;
const SIDEWALK_COLOR = 0xcfc6b6;
const CURB_COLOR = 0x948c7e;

/** Materials/textures owned by a built ground group. */
export interface GroundResources {
  materials: Material[];
}

function addRectMesh(
  group: Group,
  rect: GridRect,
  y: number,
  material: Material,
  name: string,
): Mesh {
  const geometry = new PlaneGeometry(rect.maxX - rect.minX, rect.maxZ - rect.minZ);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

/** Rails: one raised curb box along each long edge of the carriageway. */
function addStreetCurbs(
  group: Group,
  street: Street,
  material: Material,
): void {
  const c = street.carriageway;
  if (street.axis === 'x') {
    const far = { minX: c.minX, maxX: c.maxX, minZ: c.minZ - CURB_WIDTH / 2, maxZ: c.minZ + CURB_WIDTH / 2 };
    const near = { minX: c.minX, maxX: c.maxX, minZ: c.maxZ - CURB_WIDTH / 2, maxZ: c.maxZ + CURB_WIDTH / 2 };
    addCurbBox(group, far, material, `curb-${street.id}-far`);
    addCurbBox(group, near, material, `curb-${street.id}-block`);
  } else {
    const far = { minX: c.minX - CURB_WIDTH / 2, maxX: c.minX + CURB_WIDTH / 2, minZ: c.minZ, maxZ: c.maxZ };
    const near = { minX: c.maxX - CURB_WIDTH / 2, maxX: c.maxX + CURB_WIDTH / 2, minZ: c.minZ, maxZ: c.maxZ };
    addCurbBox(group, far, material, `curb-${street.id}-far`);
    addCurbBox(group, near, material, `curb-${street.id}-block`);
  }
}

function addCurbBox(
  group: Group,
  rect: GridRect,
  material: Material,
  name: string,
): Mesh {
  const geometry = new BoxGeometry(
    rect.maxX - rect.minX,
    CURB_HEIGHT,
    rect.maxZ - rect.minZ,
  );
  const mesh = new Mesh(geometry, material);
  mesh.position.set(
    (rect.minX + rect.maxX) / 2,
    CURB_HEIGHT / 2,
    (rect.minZ + rect.maxZ) / 2,
  );
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

/**
 * Build the whole ground/road/sidewalk/curb/crosswalk frame for `layout`.
 * The returned group's `userData.groundResources.materials` holds every
 * material/texture created here for `disposeGroundMeshes`.
 */
export function buildGroundMeshes(layout: BlockLayout): Group {
  const group = new Group();
  group.name = 'city-block-ground';
  const materials: Material[] = [];

  const groundMaterial = new MeshBasicMaterial({ color: GROUND_COLOR });
  materials.push(groundMaterial);
  addRectMesh(group, GROUND_RECT, GROUND_Y, groundMaterial, 'ground');

  for (const street of layout.streets) {
    const roadMaterial = new MeshBasicMaterial({
      map: createStreetTexture(street, layout.seed),
      color: 0xffffff,
    });
    materials.push(roadMaterial);
    addRectMesh(group, street.carriageway, ROAD_Y, roadMaterial, `road-${street.id}`);
  }

  for (const street of layout.streets) {
    for (const crossing of street.crosswalks) {
      const material = new MeshBasicMaterial({
        map: createCrosswalkTexture(crossing, layout.seed),
        transparent: true,
        depthWrite: false,
        color: 0xffffff,
      });
      materials.push(material);
      addRectMesh(group, crossing.bounds, CROSSWALK_Y, material, `crosswalk-${crossing.id}`);
    }
  }

  const sidewalkMaterial = new MeshBasicMaterial({ color: SIDEWALK_COLOR });
  materials.push(sidewalkMaterial);
  for (const sidewalk of layout.sidewalks) {
    addRectMesh(group, sidewalk.bounds, SIDEWALK_Y, sidewalkMaterial, `sidewalk-${sidewalk.id}`);
  }

  const curbMaterial = new MeshBasicMaterial({ color: CURB_COLOR });
  materials.push(curbMaterial);
  for (const street of layout.streets) {
    addStreetCurbs(group, street, curbMaterial);
  }

  group.userData.groundResources = { materials } satisfies GroundResources;
  return group;
}

/** Release every material/texture created by `buildGroundMeshes`. */
export function disposeGroundMeshes(group: Group): void {
  const resources = group.userData.groundResources as GroundResources | undefined;
  if (resources) {
    for (const material of resources.materials) {
      // Release any procedural texture bound to the material first.
      const map = (material as { map?: { dispose?: () => void } }).map;
      map?.dispose?.();
      material.dispose();
    }
  }
  if (group.parent) {
    group.parent.remove(group);
  }
}