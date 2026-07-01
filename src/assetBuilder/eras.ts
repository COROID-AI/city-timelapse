import * as THREE from 'three';
import type { EraDescriptor, EraId } from '../eras/types';
import { ERAS } from '../eras/data';
import { makeFacadeTexture, makeSignTexture } from './textures';

/** Shared box geometry reused for all building masses (re-scaled per use). */
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export interface BuiltBuilding {
  group: THREE.Group;
  /** World-space center of the facade front face, for camera focus. */
  focusPoint: THREE.Vector3;
  /** Storefront name shown in the hover tooltip. */
  storefrontName: string;
  /** Size of the building footprint. */
  footprint: THREE.Vector2;
}

/**
 * Build a single building group for an era. The silhouette (flat / stepped /
 * setback / glass) and floor count come from the era descriptor so adjacent
 * eras look visibly different.
 */
export function makeBuilding(
  era: EraId,
  type: BuildingKey,
  storefrontName: string,
): BuiltBuilding {
  const desc = ERAS[era];
  const group = new THREE.Group();
  group.name = `building:${era}:${type}`;

  const facadeTex = makeFacadeTexture(era, type === 'lot' ? 'commercial' : type);
  const mat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    roughness: desc.silhouette === 'glass' ? 0.25 : 0.8,
    metalness: desc.silhouette === 'glass' ? 0.6 : 0.05,
  });

  const floors = Math.max(2, desc.typicalFloors + floorJitter(era, type));
  const floorH = 3.2;
  const w = footprintWidth(type);
  const d = 9;
  const totalH = floors * floorH;

  if (desc.silhouette === 'flat' || type === 'residential') {
    addMass(group, mat, w, totalH, d, 0, totalH / 2, 0);
  } else if (desc.silhouette === 'stepped') {
    addMass(group, mat, w, totalH * 0.6, d, 0, (totalH * 0.6) / 2, 0);
    addMass(group, mat, w * 0.7, totalH * 0.4, d * 0.8, 0, totalH * 0.6 + (totalH * 0.4) / 2, 0);
  } else if (desc.silhouette === 'setback') {
    addMass(group, mat, w, totalH * 0.5, d, 0, (totalH * 0.5) / 2, 0);
    addMass(group, mat, w * 0.8, totalH * 0.3, d, 0, totalH * 0.5 + (totalH * 0.3) / 2, 0);
    addMass(group, mat, w * 0.6, totalH * 0.2, d * 0.7, 0, totalH * 0.8 + (totalH * 0.2) / 2, 0);
  } else {
    // glass tower
    addMass(group, mat, w, totalH, d, 0, totalH / 2, 0);
  }

  // Storefront sign placed at street level on the front (+Z) face.
  const sign = makeSignSprite(era, storefrontName);
  sign.position.set(0, 4.2, d / 2 + 0.06);
  group.add(sign);

  // Billboard / advertising plane on the roof for the era.
  const billboard = makeBillboardSprite(era);
  billboard.position.set(0, totalH + 2.4, 0);
  billboard.scale.setScalar(w * 0.9);
  group.add(billboard);

  const focusPoint = new THREE.Vector3(0, totalH * 0.45, d / 2 + 8);

  return {
    group,
    focusPoint,
    storefrontName,
    footprint: new THREE.Vector2(w, d),
  };
}

function addMass(
  group: THREE.Group,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): void {
  const mesh = new THREE.Mesh(boxGeo, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function makeSignSprite(era: EraId, label: string): THREE.Sprite {
  const tex = makeSignTexture(era, label);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(8, 2, 1);
  sprite.name = 'storefront-sign';
  return sprite;
}

function makeBillboardSprite(era: EraId): THREE.Sprite {
  const desc = ERAS[era];
  const tex = makeSignTexture(era, desc.billboard);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(10, 2.5, 1);
  sprite.name = 'billboard';
  return sprite;
}

type BuildingKey = 'residential' | 'commercial' | 'office' | 'lot';

function footprintWidth(type: BuildingKey): number {
  switch (type) {
    case 'office':
      return 16;
    case 'commercial':
      return 12;
    case 'residential':
      return 10;
    default:
      return 11;
  }
}

function floorJitter(era: EraId, type: BuildingKey): number {
  let seed = ERAS[era].seed ^ (type.charCodeAt(0) * 40503);
  const rng = () => {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = Math.imul(seed ^ (seed >>> 16), 2246822507);
    t = Math.imul(t ^ (t >>> 13), 3266489909);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  if (type === 'office') return Math.floor(rng() * 6) - 1;
  if (type === 'commercial') return Math.floor(rng() * 4) - 1;
  return Math.floor(rng() * 2);
}

export function describeEra(era: EraId): EraDescriptor {
  return ERAS[era];
}
