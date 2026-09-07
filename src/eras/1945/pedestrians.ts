import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { Rgb } from './palette';

/**
 * 1945 pedestrians.
 *
 * Men in fedoras/overcoats/suits, women in 1940s dresses and victory rolls,
 * soldiers in uniform, and children with hoop toys. The pedestrian count is
 * low. Each pedestrian is built from box primitives for the Three.js WebGL
 * pipeline.
 */

/** Pedestrian outfit archetype. */
export type PedestrianArchetype =
  | 'man_fedora'
  | 'man_suit'
  | 'woman_dress'
  | 'soldier'
  | 'child_hoop';

/** A single 1945 pedestrian. */
export interface EraPedestrian {
  /** Outfit archetype. */
  archetype: PedestrianArchetype;
  /** Lot index the pedestrian walks near. */
  lotIndex: number;
  /** Offset along the sidewalk. */
  offsetX: number;
  /** Distance out from the facade (on the sidewalk). */
  offsetZ: number;
  /** Clothing colour. */
  color: Rgb;
}

/** A moving pedestrian handle. */
export interface EraPedestrianRig {
  /** The pedestrian mesh. */
  readonly mesh: Mesh;
  /** All meshes that make up the pedestrian (for disposal). */
  readonly meshes: readonly Mesh[];
  /** Advance the pedestrian along the sidewalk by dt seconds. */
  update(dt: number): void;
}

const OVERCOAT = { r: 0.2, g: 0.18, b: 0.16 };
const SUIT = { r: 0.16, g: 0.16, b: 0.18 };
const FEDORA = { r: 0.25, g: 0.2, b: 0.15 };
const DRESS = { r: 0.5, g: 0.22, b: 0.3 };
const UNIFORM = { r: 0.32, g: 0.36, b: 0.24 };
const CHILD = { r: 0.45, g: 0.35, b: 0.3 };
const HOOP = { r: 0.8, g: 0.6, b: 0.3 };
const SKIN = { r: 0.62, g: 0.5, b: 0.42 };

/** The 1945 pedestrian set (low count). */
export const era1945Pedestrians: readonly EraPedestrian[] = Object.freeze([
  { archetype: 'man_fedora', lotIndex: 0, offsetX: -2.5, offsetZ: 3.0, color: OVERCOAT },
  { archetype: 'woman_dress', lotIndex: 2, offsetX: 2.5, offsetZ: 3.0, color: DRESS },
  { archetype: 'soldier', lotIndex: 3, offsetX: -1.5, offsetZ: 3.2, color: UNIFORM },
  { archetype: 'man_suit', lotIndex: 5, offsetX: 1.5, offsetZ: 3.0, color: SUIT },
  { archetype: 'child_hoop', lotIndex: 7, offsetX: -2.0, offsetZ: 3.4, color: CHILD },
  { archetype: 'man_fedora', lotIndex: 8, offsetX: 2.0, offsetZ: 3.2, color: FEDORA },
]);

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

/** Build a pedestrian body from an archetype. Returns all meshes. */
function buildPedestrian(
  scene: Scene,
  p: EraPedestrian,
): Mesh[] {
  const meshes: Mesh[] = [];
  // Body.
  const body = boxMesh(scene, 0, 0.8, 0, 0.5, 1.2, 0.3, p.color);
  // Head.
  const head = boxMesh(scene, 0, 1.55, 0, 0.3, 0.3, 0.3, SKIN);
  meshes.push(body, head);

  if (p.archetype === 'man_fedora') {
    const hat = boxMesh(scene, 0, 1.72, 0, 0.42, 0.16, 0.42, FEDORA);
    const brim = boxMesh(scene, 0, 1.66, 0, 0.5, 0.08, 0.5, FEDORA);
    meshes.push(hat, brim);
  } else if (p.archetype === 'woman_dress') {
    // Victory rolls (two hair buns) + dress skirt.
    const rollL = boxMesh(scene, -0.14, 1.72, 0, 0.14, 0.16, 0.14, { r: 0.3, g: 0.2, b: 0.18 });
    const rollR = boxMesh(scene, 0.14, 1.72, 0, 0.14, 0.16, 0.14, { r: 0.3, g: 0.2, b: 0.18 });
    const skirt = boxMesh(scene, 0, 0.4, 0, 0.6, 0.5, 0.34, p.color);
    meshes.push(rollL, rollR, skirt);
  } else if (p.archetype === 'soldier') {
    const cap = boxMesh(scene, 0, 1.7, 0, 0.36, 0.14, 0.36, UNIFORM);
    meshes.push(cap);
  } else if (p.archetype === 'child_hoop') {
    // Hoop toy beside the child.
    const hoop = boxMesh(scene, 0.5, 0.45, 0, 0.2, 0.9, 0.08, HOOP);
    meshes.push(hoop);
  }
  return meshes;
}

/**
 * Create a moving 1945 pedestrian on the sidewalk of its lot. The pedestrian
 * walks back and forth along the frontage.
 */
export function createEraPedestrian(
  scene: Scene,
  layout: CityBlockLayout,
  p: EraPedestrian,
): EraPedestrianRig {
  const meshes = buildPedestrian(scene, p);
  const mesh = meshes[0];
  const lot = layout.lots[p.lotIndex];
  const centerX = lot ? lot.origin.x + lot.width / 2 : 0;
  const baseX = centerX + p.offsetX;
  const facingSouth = lot ? lot.rotation === 180 : false;
  const facadeZ = lot ? (facingSouth ? lot.origin.z + lot.depth : lot.origin.z) : 0;
  const z = facingSouth ? facadeZ - p.offsetZ : facadeZ + p.offsetZ;

  const amplitude = 3.5;
  const speed = 0.6; // slow walk
  let phase = p.offsetX;

  function update(dt: number): void {
    phase += speed * dt;
    const x = baseX + Math.sin(phase) * amplitude;
    mesh.position.set(x, 0, z);
  }

  return { mesh, meshes, update };
}

/** Create the full 1945 pedestrian set. */
export function createEraPedestrianSet(
  scene: Scene,
  layout: CityBlockLayout,
): EraPedestrianRig[] {
  return era1945Pedestrians.map((p) => createEraPedestrian(scene, layout, p));
}