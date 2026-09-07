import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { Rgb } from './palette';

/**
 * 1945 vehicles.
 *
 * Black 1940s sedans with running boards, a period bus, and delivery trucks
 * with wooden beds. Traffic is slow and sparse. Vehicles follow the perimeter
 * street ring plus the cross street as a simple waypoint loop, built from box
 * primitives for the Three.js WebGL pipeline.
 */

/** A single 1945 vehicle definition. */
export interface EraVehicle {
  /** Vehicle kind. */
  kind: 'sedan' | 'bus' | 'truck';
  /** Primary body colour. */
  color: Rgb;
  /** World units per second (slow for 1945). */
  speed: number;
  /** Offset along the loop in [0, 1) to spread vehicles out. */
  loopOffset: number;
  /** Whether this vehicle runs the cross street segment. */
  onCrossStreet: boolean;
}

/** The moving vehicle handle. */
export interface EraVehicleRig {
  /** The vehicle mesh. */
  readonly mesh: Mesh;
  /** All meshes that make up the vehicle (for disposal). */
  readonly meshes: readonly Mesh[];
  /** Advance the vehicle along its route by dt seconds. */
  update(dt: number): void;
}

const BLACK = { r: 0.06, g: 0.06, b: 0.07 };
const DARK_GREY = { r: 0.16, g: 0.16, b: 0.17 };
const CREAM = { r: 0.82, g: 0.74, b: 0.6 };
const WOOD = { r: 0.45, g: 0.34, b: 0.22 };
const GREEN = { r: 0.16, g: 0.3, b: 0.18 };

/** The 1945 vehicle fleet (slow, sparse). */
export const era1945Vehicles: readonly EraVehicle[] = Object.freeze([
  { kind: 'sedan', color: BLACK, speed: 6.5, loopOffset: 0.0, onCrossStreet: false },
  { kind: 'sedan', color: DARK_GREY, speed: 5.5, loopOffset: 0.35, onCrossStreet: false },
  { kind: 'bus', color: CREAM, speed: 5.0, loopOffset: 0.7, onCrossStreet: false },
  { kind: 'truck', color: WOOD, speed: 4.5, loopOffset: 0.5, onCrossStreet: true },
]);

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

interface LoopPoint {
  x: number;
  z: number;
}

/** Build the perimeter street-ring loop (outer edges of the streets). */
function perimeterLoop(layout: CityBlockLayout): LoopPoint[] {
  const pad = 3;
  const minX = layout.bounds.minX + pad;
  const maxX = layout.bounds.maxX - pad;
  const minZ = layout.bounds.minZ + pad;
  const maxZ = layout.bounds.maxZ - pad;
  return [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];
}

/** Build the cross-street loop (east-west across the block). */
function crossStreetLoop(layout: CityBlockLayout): LoopPoint[] {
  const cs = layout.crossStreet;
  const z = cs.rect.origin.z + cs.rect.depth / 2;
  const minX = cs.rect.origin.x + 2;
  const maxX = cs.rect.origin.x + cs.rect.width - 2;
  return [
    { x: minX, z },
    { x: maxX, z },
  ];
}

/** Build the boxy body of a 1940s vehicle. Returns all meshes. */
function buildBody(
  scene: Scene,
  vehicle: EraVehicle,
): Mesh[] {
  if (vehicle.kind === 'bus') {
    const body = boxMesh(scene, 0, 1.7, 0, 2.6, 3.0, 9.5, vehicle.color);
    const roof = boxMesh(scene, 0, 3.3, 0, 2.2, 0.15, 8.8, DARK_GREY);
    const band = boxMesh(scene, 0, 1.0, 0, 2.6, 0.7, 9.0, GREEN);
    return [body, roof, band];
  }
  if (vehicle.kind === 'truck') {
    // Cab.
    const cab = boxMesh(scene, 0, 1.2, -1.6, 2.2, 1.6, 1.8, vehicle.color);
    // Wooden bed.
    const bed = boxMesh(scene, 0, 1.7, 2.2, 2.4, 1.1, 4.4, WOOD);
    const bedWall = boxMesh(scene, 0, 2.3, 2.2, 2.4, 0.3, 4.4, WOOD);
    return [cab, bed, bedWall];
  }
  // Sedan: body + running boards.
  const body = boxMesh(scene, 0, 0.9, 0, 1.9, 1.0, 4.4, vehicle.color);
  const cabin = boxMesh(scene, 0, 1.5, -0.2, 1.7, 0.7, 2.2, vehicle.color);
  const runningBoardL = boxMesh(scene, -1.1, 0.3, 0, 0.18, 0.2, 4.2, BLACK);
  const runningBoardR = boxMesh(scene, 1.1, 0.3, 0, 0.18, 0.2, 4.2, BLACK);
  return [body, cabin, runningBoardL, runningBoardR];
}

/**
 * Create a moving 1945 vehicle. The returned rig exposes the mesh and an
 * update step. `crossStreet` option routes the truck along the cross street.
 */
export function createEraVehicle(
  scene: Scene,
  layout: CityBlockLayout,
  vehicle: EraVehicle,
): EraVehicleRig {
  const meshes = buildBody(scene, vehicle);
  const mesh = meshes[0];
  const loop = vehicle.onCrossStreet
    ? crossStreetLoop(layout)
    : perimeterLoop(layout);

  // Total loop length.
  let total = 0;
  const segLen: number[] = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segLen.push(len);
    total += len;
  }

  // Start at a point offset around the loop.
  let dist = (vehicle.loopOffset * total) % total;
  let segment = 0;
  while (dist > segLen[segment]) {
    dist -= segLen[segment];
    segment = (segment + 1) % loop.length;
  }
  let t = dist / segLen[segment];

  function update(dt: number): void {
    let remaining = vehicle.speed * dt;
    while (remaining > 0) {
      const len = segLen[segment];
      const frac = remaining / len;
      if (t + frac >= 1) {
        remaining = (t + frac - 1) * len;
        t = 0;
        segment = (segment + 1) % loop.length;
      } else {
        t += frac;
        remaining = 0;
      }
    }
    const a = loop[segment];
    const b = loop[(segment + 1) % loop.length];
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    mesh.position.set(x, 0.4, z);
    const angle = Math.atan2(b.x - a.x, b.z - a.z);
    mesh.rotation.y = angle;
  }

  return { mesh, meshes, update };
}

/** Create the full 1945 fleet. */
export function createEraVehicleFleet(
  scene: Scene,
  layout: CityBlockLayout,
): EraVehicleRig[] {
  return era1945Vehicles.map((v) => createEraVehicle(scene, layout, v));
}