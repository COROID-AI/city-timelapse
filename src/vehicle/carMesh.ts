/**
 * Low-poly neon sports car mesh factory.
 *
 * Builds a small roadside-free car out of three.js primitives with:
 *   - a streamlined low-poly body in a selectable livery;
 *   - four wheels with dark tires + neon rims;
 *   - glowing headlights (front white/cyan) and taillights (rear red);
 *   - two named exhaust anchor transforms the FX task hangs blue-purple
 *     nitrous flames from while `boosting`.
 *
 * The returned group exposes a `livery` live-reference and every named anchor
 * as a stable child that FX / integration can find by `.getObjectByName`:
 *   - `exhaustLeft` / `exhaustRight`  -> flame anchor points at the rear;
 *   - `headlightL` / `headlightR` / `taillightL` / `taillightR` -> lights.
 *
 * Facets use two-sided basic material so the neon look reads from any camera
 * angle and needs no light rig. Emission color comes straight from the mesh
 * material color on unlit neon surfaces.
 *
 * Mesh scale is tuned for a racing car ~4.4 x 1.9 x 1.1 m around the origin.
 */

import * as THREE from 'three';

/** Body + light colors for a selectable livery. */
export interface Livery {
  /** Primary body color. */
  readonly body: number;
  /** Accent stripes / cockpit color. */
  readonly accent: number;
  /** Headlight emissive color. */
  readonly headlight: number;
  /** Taillight emissive color. */
  readonly taillight: number;
}

/** Available liveries the AI opponents can reuse. */
export const LIVERIES: Readonly<Record<string, Readonly<Livery>>> = {
  hero: {
    body: 0x1b2b6b,
    accent: 0x00e5ff,
    headlight: 0xd8fbff,
    taillight: 0xff1a66,
  },
  violet: {
    body: 0x481a6b,
    accent: 0xb16bff,
    headlight: 0xf0e6ff,
    taillight: 0xff3860,
  },
  ember: {
    body: 0x6b1e1a,
    accent: 0xffb16b,
    headlight: 0xfff2d8,
    taillight: 0xff2d1a,
  },
  frost: {
    body: 0x0f4a52,
    accent: 0x6bf5ff,
    headlight: 0xe0ffff,
    taillight: 0xff3a6e,
  },
} as const;

/** Default livery for the player car. */
export const DEFAULT_LIVERY = 'hero';

/** Config for `createCarMesh`. */
export interface CarMeshOptions {
  /** Livery key from `LIVERIES`. Defaults to the player's `hero`. */
  readonly livery?: string;
}

/**
 * Build and return the car group. The returned group is attached to nothing;
 * whoever owns the car is responsible for adding it to the scene.
 */
export function createCarMesh(
  options: CarMeshOptions = {},
): THREE.Group {
  const livery = normalizeLivery(options.livery);
  const root = new THREE.Group();
  root.name = 'player-car';
  root.userData.livery = livery.key;

  const car = buildBody(livery);
  root.add(car);

  addWheels(root);
  addHeadlights(root, livery);
  addTaillights(root, livery);
  addExhaustAnchors(root);

  return root;
}

/** Look up a livery by key, falling back to the player default. */
export function normalizeLivery(
  key: string | undefined,
): { key: string; colors: Livery } {
  const chosen =
    key !== undefined && LIVERIES[key as keyof typeof LIVERIES]
      ? key
      : DEFAULT_LIVERY;
  const colors = LIVERIES[chosen as keyof typeof LIVERIES] as Livery;
  return { key: chosen, colors };
}

/** Faceted body shell + cockpit canopy + neon stripes. */
function buildBody(livery: { colors: Livery }): THREE.Group {
  const body = new THREE.Group();
  body.name = 'car-body';

  // Lower monocoque: a subtly wedge-shaped box.
  const hullGeo = new THREE.BoxGeometry(1.9, 0.55, 4.2);
  const hullMat = new THREE.MeshStandardMaterial({
    color: livery.colors.body,
    metalness: 0.85,
    roughness: 0.25,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 0.45;
  body.add(hull);

  // Upper cabin / cockpit canopy.
  const cabinGeo = new THREE.BoxGeometry(1.5, 0.4, 2.0);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: livery.colors.accent,
    metalness: 0.35,
    roughness: 0.6,
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 0.85, -0.25);
  body.add(cabin);

  // Neon accent stripe along the flank.
  const stripeGeo = new THREE.BoxGeometry(0.04, 0.06, 3.4);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: livery.colors.accent,
  });
  const stripeL = new THREE.Mesh(stripeGeo, stripeMat);
  stripeL.position.set(-0.97, 0.72, 0);
  const stripeR = new THREE.Mesh(stripeGeo, stripeMat);
  stripeR.position.set(0.97, 0.72, 0);
  body.add(stripeL, stripeR);

  return body;
}

/** Four wheels: dark tire ring + emissive neon rim center. */
function addWheels(root: THREE.Group): void {
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12);
  tireGeo.rotateZ(Math.PI / 2); // axle along X
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.95,
    metalness: 0.1,
  });
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

  const offsets: ReadonlyArray<[number, number, number]> = [
    [-0.85, 0.42, 1.35],
    [0.85, 0.42, 1.35],
    [-0.85, 0.42, -1.35],
    [0.85, 0.42, -1.35],
  ];
  offsets.forEach(([x, y, z], i) => {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(x, y, z);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(x, y, z);
    tire.name = `wheel-${i}`;
    rim.name = `wheel-rim-${i}`;
    root.add(tire, rim);
  });
}

/** Two glowing headlights at the front (positive Z is forward). */
function addHeadlights(root: THREE.Group, livery: { colors: Livery }): void {
  const geo = new THREE.BoxGeometry(0.32, 0.14, 0.06);
  const mat = new THREE.MeshBasicMaterial({
    color: livery.colors.headlight,
    toneMapped: false,
  });
  const l = new THREE.Mesh(geo, mat);
  l.name = 'headlightL';
  l.position.set(-0.62, 0.55, 2.1);
  const r = new THREE.Mesh(geo, mat);
  r.name = 'headlightR';
  r.position.set(0.62, 0.55, 2.1);
  root.add(l, r);
}

/** Two glowing taillights at the rear (negative Z). */
function addTaillights(root: THREE.Group, livery: { colors: Livery }): void {
  const geo = new THREE.BoxGeometry(0.34, 0.12, 0.06);
  const mat = new THREE.MeshBasicMaterial({
    color: livery.colors.taillight,
    toneMapped: false,
  });
  const l = new THREE.Mesh(geo, mat);
  l.name = 'taillightL';
  l.position.set(-0.6, 0.55, -2.1);
  const r = new THREE.Mesh(geo, mat);
  r.name = 'taillightR';
  r.position.set(0.6, 0.55, -2.1);
  root.add(l, r);
}

/** Two empty anchor transforms the FX task hangs nitrous flames from. */
function addExhaustAnchors(root: THREE.Group): void {
  const build = (name: string, x: number): THREE.Object3D => {
    const anchor = new THREE.Object3D();
    anchor.name = name;
    anchor.position.set(x, 0.45, -2.06);
    root.add(anchor);
    return anchor;
  };
  build('exhaustLeft', -0.45);
  build('exhaustRight', 0.45);
}