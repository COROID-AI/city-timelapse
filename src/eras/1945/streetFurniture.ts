import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { StreetFeature } from '../../types/streetFeature';
import { validateStreetFeature } from '../../types/streetFeature';
import { Rgb } from './palette';

/**
 * 1945 street furniture.
 *
 * Cast-iron lamp posts with a warm incandescent glow, fire alarm call boxes,
 * bicycle racks, a mailbox, and tram tracks on the cross street (the layout
 * includes a cross street). Each item is also exposed as a validated
 * StreetFeature for the shared contract.
 */

/** A single piece of 1945 street furniture. */
export interface EraStreetFurniture {
  /** Furniture kind. */
  kind: 'lamp_post' | 'fire_alarm' | 'bicycle_rack' | 'mailbox';
  /** Lot index the item is placed near (sidewalk edge). */
  lotIndex: number;
  /** Offset along the lot frontage in meters (-..+). */
  offsetX: number;
  /** Distance out from the facade (sidewalk). */
  offsetZ: number;
  /** Primary colour. */
  color: Rgb;
  /** Whether the item glows warm (lamp post). */
  lit: boolean;
}

/** Tram track definition (painted on the cross street). */
export interface TramTracks {
  /** Whether tram tracks are present. */
  present: boolean;
  /** Track gauge (centre-to-centre, meters). */
  gauge: number;
  /** Track colour (weathered steel). */
  color: Rgb;
}

const CAST_IRON = { r: 0.1, g: 0.1, b: 0.11 };
const GLOW = { r: 1.0, g: 0.72, b: 0.45 };
const STEEL = { r: 0.42, g: 0.42, b: 0.44 };
const GREEN = { r: 0.16, g: 0.3, b: 0.18 };
const RED_ALARM = { r: 0.6, g: 0.1, b: 0.08 };

/** The 1945 street furniture set. */
export const era1945StreetFurniture: readonly EraStreetFurniture[] =
  Object.freeze([
    { kind: 'lamp_post', lotIndex: 0, offsetX: -4.2, offsetZ: 1.6, color: CAST_IRON, lit: true },
    { kind: 'lamp_post', lotIndex: 1, offsetX: 4.2, offsetZ: 1.6, color: CAST_IRON, lit: true },
    { kind: 'lamp_post', lotIndex: 3, offsetX: -4.2, offsetZ: 1.6, color: CAST_IRON, lit: true },
    { kind: 'lamp_post', lotIndex: 5, offsetX: 4.2, offsetZ: 1.6, color: CAST_IRON, lit: true },
    { kind: 'lamp_post', lotIndex: 7, offsetX: -4.2, offsetZ: 1.6, color: CAST_IRON, lit: true },
    { kind: 'fire_alarm', lotIndex: 2, offsetX: -4.8, offsetZ: 1.6, color: RED_ALARM, lit: false },
    { kind: 'fire_alarm', lotIndex: 6, offsetX: 4.8, offsetZ: 1.6, color: RED_ALARM, lit: false },
    { kind: 'bicycle_rack', lotIndex: 4, offsetX: 0.0, offsetZ: 2.2, color: CAST_IRON, lit: false },
    { kind: 'mailbox', lotIndex: 8, offsetX: 3.6, offsetZ: 1.6, color: GREEN, lit: false },
  ]);

/** Tram tracks on the cross street (the layout includes a cross street). */
export const era1945TramTracks: TramTracks = Object.freeze({
  present: true,
  gauge: 1.4,
  color: STEEL,
});

/** Build a box mesh. */
function boxMesh(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: Rgb,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial());
  mesh.material.color.setRGB(color.r, color.g, color.b);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function buildFurnitureItem(
  scene: Scene,
  layout: CityBlockLayout,
  item: EraStreetFurniture,
): Mesh[] {
  const meshes: Mesh[] = [];
  const lot = layout.lots[item.lotIndex];
  if (!lot) return meshes;

  const facingSouth = lot.rotation === 180;
  const facadeZ = facingSouth ? lot.origin.z + lot.depth : lot.origin.z;
  const centerX = lot.origin.x + lot.width / 2;
  const x = centerX + item.offsetX;
  const z = facingSouth ? facadeZ - item.offsetZ : facadeZ + item.offsetZ;

  if (item.kind === 'lamp_post') {
    const post = boxMesh(scene, x, 2.6, z, 0.16, 5.0, 0.16, item.color);
    const arm = boxMesh(scene, x, 5.0, z, 0.9, 0.14, 0.14, item.color);
    const glowColor = item.lit ? GLOW : { r: 0.5, g: 0.45, b: 0.4 };
    const bulb = boxMesh(scene, x + 0.35, 4.8, z, 0.3, 0.3, 0.3, glowColor);
    meshes.push(post, arm, bulb);
    return meshes;
  }
  if (item.kind === 'fire_alarm') {
    const box = boxMesh(scene, x, 1.1, z, 0.5, 1.1, 0.4, item.color);
    const top = boxMesh(scene, x, 1.7, z, 0.3, 0.15, 0.3, { r: 0.9, g: 0.2, b: 0.15 });
    meshes.push(box, top);
    return meshes;
  }
  if (item.kind === 'bicycle_rack') {
    const rack = boxMesh(scene, x, 0.5, z, 1.8, 0.5, 0.5, item.color);
    meshes.push(rack);
    return meshes;
  }
  // Mailbox.
  const body = boxMesh(scene, x, 0.9, z, 0.6, 0.7, 0.5, item.color);
  const cap = boxMesh(scene, x, 1.3, z, 0.7, 0.2, 0.6, item.color);
  meshes.push(body, cap);
  return meshes;
}

/** Build the tram tracks on the cross street. */
function buildTramTracks(
  scene: Scene,
  layout: CityBlockLayout,
): Mesh[] {
  const meshes: Mesh[] = [];
  if (!era1945TramTracks.present) return meshes;
  const cs = layout.crossStreet;
  const z = cs.rect.origin.z + cs.rect.depth / 2;
  const x = cs.rect.origin.x + cs.rect.width / 2;
  const g = era1945TramTracks.gauge;
  for (const side of [-g / 2, g / 2]) {
    const rail = boxMesh(
      scene,
      x,
      0.05,
      z + side,
      cs.rect.width,
      0.08,
      0.18,
      era1945TramTracks.color,
    );
    meshes.push(rail);
  }
  return meshes;
}

/**
 * Build all 1945 street furniture plus tram tracks. Returns the meshes.
 */
export function buildEraStreetFurniture(
  scene: Scene,
  layout: CityBlockLayout,
): Mesh[] {
  const meshes: Mesh[] = [];
  for (const item of era1945StreetFurniture) {
    meshes.push(...buildFurnitureItem(scene, layout, item));
  }
  meshes.push(...buildTramTracks(scene, layout));
  return meshes;
}

/**
 * Expose the 1945 street furniture as validated StreetFeatures for the shared
 * foundation contract.
 */
export function era1945StreetFeatures(): StreetFeature[] {
  const featureFor = (item: EraStreetFurniture): StreetFeature => {
    const kind =
      item.kind === 'lamp_post'
        ? 'other'
        : item.kind === 'fire_alarm'
          ? 'other'
          : item.kind === 'bicycle_rack'
            ? 'other'
            : 'other';
    return {
      kind,
      rect: {
        origin: { x: 0, z: 0 },
        width: 0.5,
        depth: 0.5,
      },
      rotation: 0,
      eras: [1945],
      data: {
        itemKind: item.kind,
        lotIndex: item.lotIndex,
        lit: item.lit,
      },
    };
  };
  const features = era1945StreetFurniture.map(featureFor);
  for (const f of features) {
    const err = validateStreetFeature(f);
    if (err) throw new Error(`Invalid 1945 street feature: ${err}`);
  }
  return features;
}