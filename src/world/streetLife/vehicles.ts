/**
 * Era Vehicle Fleets and Traffic Simulation
 *
 * Implements procedural period-accurate vehicle models for all five eras:
 * - 1945: Rounded pre-war sedans with curved fenders and vintage delivery trucks.
 * - 1965: Long finned cruisers with two-tone paint and chrome bumpers, plus muscle coupes.
 * - 1985: Boxy geometric sedans with rectangular headlights and station wagons with woodgrain trim.
 * - 2005: Rounded aerodynamic crossovers / SUVs and compact hatchbacks.
 * - 2025: Minimalist EVs with closed front grilles and LED light bars, plus electric scooters and cyclists.
 *
 * All vehicles track layout lane flow paths with frame-rate-independent animation,
 * safe headway anti-collision spacing, wheel rotation, and smooth intersection turns.
 */

import * as THREE from 'three';
import type { EraId, EraTheme } from '../../era/types';
import type { BlockLayout, TrafficPath, VehicleLane } from '../layout';
import { sampleTrafficPath } from '../layout';
import type { Rng } from '../../lib/rng';

export type VehicleArchetype =
  | '1945_rounded_sedan'
  | '1945_vintage_truck'
  | '1965_finned_cruiser'
  | '1965_muscle_coupe'
  | '1985_boxy_sedan'
  | '1985_station_wagon'
  | '2005_crossover'
  | '2005_hatchback'
  | '2025_ev_sedan'
  | '2025_electric_scooter'
  | '2025_bike_cyclist';

export interface VehicleInstance {
  id: string;
  era: EraId;
  archetype: VehicleArchetype;
  tags: string[];
  mesh: THREE.Group;
  lane: VehicleLane;
  path: TrafficPath;
  distance: number;
  baseSpeed: number;
  currentSpeed: number;
  length: number;
  width: number;
  height: number;
  primaryColor: string;
  secondaryColor?: string;
  wheels: THREE.Mesh[];
  steerables?: THREE.Object3D[];
  rider?: THREE.Group;
  isMicromobility: boolean;
}

export interface VehicleBuilderResult {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  steerables?: THREE.Object3D[];
  rider?: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  length: number;
  width: number;
  height: number;
}

export interface FleetOptions {
  count?: number;
  includeMicromobility?: boolean;
}

// ============================================================================
// Material & Helper Utilities
// ============================================================================

function createStandardMat(
  materials: THREE.Material[],
  color: THREE.ColorRepresentation,
  roughness = 0.4,
  metalness = 0.2,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    transparent: true,
    opacity: 1.0,
  });
  materials.push(mat);
  return mat;
}

function createEmissiveMat(
  materials: THREE.Material[],
  color: THREE.ColorRepresentation,
  emissive: THREE.ColorRepresentation,
  intensity = 1.0,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  });
  materials.push(mat);
  return mat;
}

function trackGeom<T extends THREE.BufferGeometry>(geometries: THREE.BufferGeometry[], geom: T): T {
  geometries.push(geom);
  return geom;
}

function addMesh(
  parent: THREE.Object3D,
  geom: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  geometries?: THREE.BufferGeometry[],
): THREE.Mesh {
  if (geometries) {
    trackGeom(geometries, geom);
  }
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  parent.add(mesh);
  return mesh;
}

function buildWheel(
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  radius = 0.35,
  width = 0.22,
  rimColor = 0xdddddd,
  whitewall = false,
): THREE.Group {
  const wheelGroup = new THREE.Group();

  // Tire
  const tireGeom = trackGeom(geometries, new THREE.CylinderGeometry(radius, radius, width, 16));
  const tireMat = createStandardMat(materials, 0x1c1c1c, 0.9, 0.1);
  const tire = new THREE.Mesh(tireGeom, tireMat);
  tire.rotation.z = Math.PI / 2;
  wheelGroup.add(tire);

  // Hub / Rim
  const rimGeom = trackGeom(geometries, new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width * 1.02, 12));
  const rimMat = createStandardMat(materials, rimColor, 0.2, 0.8);
  const rim = new THREE.Mesh(rimGeom, rimMat);
  rim.rotation.z = Math.PI / 2;
  wheelGroup.add(rim);

  // Whitewall accent (1945/1965)
  if (whitewall) {
    const wwGeom = trackGeom(geometries, new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, width * 1.01, 14));
    const wwMat = createStandardMat(materials, 0xffffff, 0.5, 0.1);
    const ww = new THREE.Mesh(wwGeom, wwMat);
    ww.rotation.z = Math.PI / 2;
    wheelGroup.add(ww);
  }

  return wheelGroup;
}

// ============================================================================
// Period Procedural Vehicle Builders
// ============================================================================

/**
 * 1945 Rounded Pre-War Sedan:
 * Bulbous curved fenders, rounded hood, split windshield, running boards, chrome grille.
 */
export function build1945Sedan(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.35, 0.3);
  const chromeMat = createStandardMat(materials, 0xcccccc, 0.15, 0.9);
  const glassMat = createStandardMat(materials, 0x223344, 0.1, 0.9);
  const darkTrimMat = createStandardMat(materials, 0x1f1f1f, 0.8, 0.1);
  const lightMat = createEmissiveMat(materials, 0xfff4d0, 0xffe699, 1.2);
  const tailMat = createEmissiveMat(materials, 0xcc1111, 0xbb0000, 1.0);

  // 1. Chassis / Lower Body
  addMesh(group, new THREE.BoxGeometry(1.8, 0.45, 4.6), bodyMat, [0, 0.45, 0], [0, 0, 0], geometries);

  // 2. Rounded Hood & Front Nose
  addMesh(group, new THREE.BoxGeometry(1.6, 0.45, 1.6), bodyMat, [0, 0.72, 1.2], [0, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.75, 0.8, 1.5, 12), bodyMat, [0, 0.75, 1.2], [Math.PI / 2, 0, 0], geometries);

  // 3. Cabin & Rounded Roof
  addMesh(group, new THREE.BoxGeometry(1.65, 0.65, 2.0), glassMat, [0, 1.05, -0.4], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.7, 0.12, 2.1), bodyMat, [0, 1.4, -0.4], [0, 0, 0], geometries);
  // Curved roof top
  addMesh(group, new THREE.CylinderGeometry(0.8, 0.85, 2.0, 12), bodyMat, [0, 1.42, -0.4], [Math.PI / 2, 0, 0], geometries);

  // 4. Running Boards
  addMesh(group, new THREE.BoxGeometry(0.18, 0.08, 2.4), darkTrimMat, [0.95, 0.32, 0], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.18, 0.08, 2.4), darkTrimMat, [-0.95, 0.32, 0], [0, 0, 0], geometries);

  // 5. Bulbous Front & Rear Fenders
  addMesh(group, new THREE.BoxGeometry(0.35, 0.42, 1.4), bodyMat, [0.88, 0.55, 1.4], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.42, 1.4), bodyMat, [-0.88, 0.55, 1.4], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.42, 1.4), bodyMat, [0.88, 0.55, -1.3], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.42, 1.4), bodyMat, [-0.88, 0.55, -1.3], [0, 0, 0], geometries);

  // 6. Chrome Grille & Bumpers
  addMesh(group, new THREE.BoxGeometry(0.6, 0.5, 0.1), chromeMat, [0, 0.65, 2.05], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.9, 0.12, 0.15), chromeMat, [0, 0.38, 2.35], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.9, 0.12, 0.15), chromeMat, [0, 0.38, -2.35], [0, 0, 0], geometries);

  // 7. Pod Headlights & Taillights
  addMesh(group, new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12), lightMat, [0.65, 0.8, 1.95], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12), lightMat, [-0.65, 0.8, 1.95], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.15, 0.12, 0.08), tailMat, [0.75, 0.65, -2.32], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.15, 0.12, 0.08), tailMat, [-0.75, 0.65, -2.32], [0, 0, 0], geometries);

  // 8. Wheels (Whitewall)
  const wheelPositions: Array<[number, number, number]> = [
    [0.88, 0.35, 1.4],
    [-0.88, 0.35, 1.4],
    [0.88, 0.35, -1.3],
    [-0.88, 0.35, -1.3],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.35, 0.22, 0xcccccc, true);
    w.position.set(...pos);
    group.add(w);
    // Track first child mesh for animation
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 4.8,
    width: 1.9,
    height: 1.65,
  };
}

/**
 * 1945 Vintage Delivery / Flatbed Truck:
 * Tall rounded cab, wooden/metal cargo bed, running boards, vintage styling.
 */
export function build1945Truck(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const cabMat = createStandardMat(materials, primaryColor, 0.45, 0.2);
  const bedMat = createStandardMat(materials, 0x6a4a35, 0.8, 0.1); // Wood bed
  const frameMat = createStandardMat(materials, 0x222222, 0.6, 0.4);
  const chromeMat = createStandardMat(materials, 0xbbbbbb, 0.2, 0.8);
  const glassMat = createStandardMat(materials, 0x223344, 0.1, 0.9);
  const lightMat = createEmissiveMat(materials, 0xfff4d0, 0xffe699, 1.2);
  const tailMat = createEmissiveMat(materials, 0xcc1111, 0xbb0000, 1.0);

  // Chassis frame
  addMesh(group, new THREE.BoxGeometry(1.6, 0.3, 5.2), frameMat, [0, 0.45, 0], [0, 0, 0], geometries);

  // Cab lower & hood
  addMesh(group, new THREE.BoxGeometry(1.85, 0.65, 1.6), cabMat, [0, 0.75, 0.8], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.4, 0.55, 1.3), cabMat, [0, 0.75, 1.95], [0, 0, 0], geometries);

  // Cab upper & windshield
  addMesh(group, new THREE.BoxGeometry(1.75, 0.7, 1.4), glassMat, [0, 1.35, 0.7], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.8, 0.12, 1.5), cabMat, [0, 1.72, 0.7], [0, 0, 0], geometries);

  // Rear Cargo Bed
  addMesh(group, new THREE.BoxGeometry(2.0, 0.8, 2.7), bedMat, [0, 0.9, -1.2], [0, 0, 0], geometries);
  // Cargo contents / wooden crates
  addMesh(group, new THREE.BoxGeometry(1.6, 0.6, 2.2), createStandardMat(materials, 0x8a6240, 0.85, 0.1), [0, 1.4, -1.2], [0, 0, 0], geometries);

  // Grille & Bumper
  addMesh(group, new THREE.BoxGeometry(0.7, 0.6, 0.1), chromeMat, [0, 0.75, 2.6], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.95, 0.16, 0.15), chromeMat, [0, 0.42, 2.7], [0, 0, 0], geometries);

  // Headlights
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.18, 0.22, 12), lightMat, [0.72, 0.85, 2.45], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.18, 0.22, 12), lightMat, [-0.72, 0.85, 2.45], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.15, 0.15, 0.08), tailMat, [0.85, 0.5, -2.6], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.15, 0.15, 0.08), tailMat, [-0.85, 0.5, -2.6], [0, 0, 0], geometries);

  // Wheels
  const wheelPositions: Array<[number, number, number]> = [
    [0.92, 0.4, 1.7],
    [-0.92, 0.4, 1.7],
    [0.92, 0.4, -1.3],
    [-0.92, 0.4, -1.3],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.4, 0.28, 0x888888, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 5.4,
    width: 2.0,
    height: 1.95,
  };
}

/**
 * 1965 Finned Cruiser:
 * Long, wide, low stance, dramatic rear tailfins, two-tone paint, full chrome trim.
 */
export function build1965Cruiser(
  primaryColor: string,
  secondaryColor = '#ffffff',
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.25, 0.4);
  const roofMat = createStandardMat(materials, secondaryColor, 0.25, 0.4); // Two-tone roof
  const chromeMat = createStandardMat(materials, 0xe0e0e0, 0.1, 0.95);
  const glassMat = createStandardMat(materials, 0x1f3040, 0.1, 0.9);
  const lightMat = createEmissiveMat(materials, 0xfffbe8, 0xffe8a0, 1.3);
  const tailMat = createEmissiveMat(materials, 0xee2222, 0xdd1111, 1.2);

  // 1. Main Long Lower Body
  addMesh(group, new THREE.BoxGeometry(2.0, 0.48, 5.4), bodyMat, [0, 0.45, 0], [0, 0, 0], geometries);

  // 2. Long Front Hood
  addMesh(group, new THREE.BoxGeometry(1.9, 0.18, 1.9), bodyMat, [0, 0.72, 1.6], [0, 0, 0], geometries);

  // 3. Low Greenhouse & Thin Pillars
  addMesh(group, new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat, [0, 0.98, -0.2], [0, 0, 0], geometries);
  // Two-tone Roof
  addMesh(group, new THREE.BoxGeometry(1.75, 0.08, 2.3), roofMat, [0, 1.28, -0.2], [0, 0, 0], geometries);

  // 4. Signature Rear Tailfins
  // Left Tailfin
  const finGeomL = trackGeom(geometries, new THREE.BoxGeometry(0.12, 0.42, 1.8));
  const finL = new THREE.Mesh(finGeomL, bodyMat);
  finL.position.set(0.95, 0.85, -1.8);
  finL.rotation.x = -0.15; // Slant upward towards rear
  group.add(finL);

  // Right Tailfin
  const finGeomR = trackGeom(geometries, new THREE.BoxGeometry(0.12, 0.42, 1.8));
  const finR = new THREE.Mesh(finGeomR, bodyMat);
  finR.position.set(-0.95, 0.85, -1.8);
  finR.rotation.x = -0.15;
  group.add(finR);

  // 5. Chrome Side Spear Trim
  addMesh(group, new THREE.BoxGeometry(0.04, 0.06, 5.2), chromeMat, [1.02, 0.52, 0], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.04, 0.06, 5.2), chromeMat, [-1.02, 0.52, 0], [0, 0, 0], geometries);

  // 6. Massive Front & Rear Chrome Bumpers & Wide Grille
  addMesh(group, new THREE.BoxGeometry(2.05, 0.22, 0.2), chromeMat, [0, 0.42, 2.75], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.8, 0.32, 0.08), chromeMat, [0, 0.62, 2.7], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(2.05, 0.22, 0.2), chromeMat, [0, 0.42, -2.75], [0, 0, 0], geometries);

  // 7. Quad Headlights & Bullet Fin Taillights
  addMesh(group, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), lightMat, [0.72, 0.65, 2.75], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), lightMat, [0.48, 0.65, 2.75], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), lightMat, [-0.72, 0.65, 2.75], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), lightMat, [-0.48, 0.65, 2.75], [Math.PI / 2, 0, 0], geometries);

  // Bullet Taillights in Fins
  addMesh(group, new THREE.ConeGeometry(0.08, 0.2, 10), tailMat, [0.95, 0.95, -2.75], [-Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.ConeGeometry(0.08, 0.2, 10), tailMat, [-0.95, 0.95, -2.75], [-Math.PI / 2, 0, 0], geometries);

  // 8. Wheels (Chrome hubcaps)
  const wheelPositions: Array<[number, number, number]> = [
    [0.96, 0.34, 1.6],
    [-0.96, 0.34, 1.6],
    [0.96, 0.34, -1.6],
    [-0.96, 0.34, -1.6],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.34, 0.22, 0xffffff, true);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 5.6,
    width: 2.05,
    height: 1.45,
  };
}

/**
 * 1965 Muscle Coupe:
 * Fastback profile, aggressive stance, hood scoop, chrome side stripes.
 */
export function build1965Coupe(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.25, 0.4);
  const stripeMat = createStandardMat(materials, 0xffffff, 0.3, 0.2);
  const chromeMat = createStandardMat(materials, 0xe0e0e0, 0.1, 0.9);
  const glassMat = createStandardMat(materials, 0x1f2832, 0.1, 0.9);
  const lightMat = createEmissiveMat(materials, 0xfffbe8, 0xffe8a0, 1.3);
  const tailMat = createEmissiveMat(materials, 0xee2222, 0xdd1111, 1.2);

  // Body lower
  addMesh(group, new THREE.BoxGeometry(1.9, 0.45, 4.8), bodyMat, [0, 0.42, 0], [0, 0, 0], geometries);

  // Long hood + Scoop
  addMesh(group, new THREE.BoxGeometry(1.8, 0.18, 1.8), bodyMat, [0, 0.68, 1.3], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.6, 0.1, 0.8), bodyMat, [0, 0.8, 1.4], [0, 0, 0], geometries);

  // Racing Stripe
  addMesh(group, new THREE.BoxGeometry(0.35, 0.02, 4.8), stripeMat, [0, 0.72, 0], [0, 0, 0], geometries);

  // Sloped Fastback Greenhouse
  addMesh(group, new THREE.BoxGeometry(1.6, 0.55, 2.0), glassMat, [0, 0.95, -0.2], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.65, 0.06, 1.8), bodyMat, [0, 1.24, -0.2], [0, 0, 0], geometries);

  // Bumpers & Lights
  addMesh(group, new THREE.BoxGeometry(1.95, 0.18, 0.15), chromeMat, [0, 0.4, 2.45], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.95, 0.18, 0.15), chromeMat, [0, 0.4, -2.45], [0, 0, 0], geometries);

  addMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), lightMat, [0.65, 0.58, 2.45], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), lightMat, [-0.65, 0.58, 2.45], [Math.PI / 2, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.4, 0.15, 0.08), tailMat, [0.6, 0.58, -2.44], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.4, 0.15, 0.08), tailMat, [-0.6, 0.58, -2.44], [0, 0, 0], geometries);

  // Wheels
  const wheelPositions: Array<[number, number, number]> = [
    [0.94, 0.35, 1.4],
    [-0.94, 0.35, 1.4],
    [0.94, 0.36, -1.4],
    [-0.94, 0.36, -1.4],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.35, 0.25, 0xcccccc, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 5.0,
    width: 1.95,
    height: 1.4,
  };
}

/**
 * 1985 Boxy Sedan:
 * Crisp 3-box geometry, angular proportions, black plastic bumpers, rectangular halogen headlights.
 */
export function build1985Sedan(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.4, 0.2);
  const plasticMat = createStandardMat(materials, 0x242424, 0.75, 0.1);
  const glassMat = createStandardMat(materials, 0x1a2630, 0.1, 0.9);
  const lightMat = createEmissiveMat(materials, 0xffeedd, 0xffd9aa, 1.3);
  const turnMat = createEmissiveMat(materials, 0xff9900, 0xff8800, 1.0);
  const tailMat = createEmissiveMat(materials, 0xdd1111, 0xbb0000, 1.1);

  // 1. Lower Body Box
  addMesh(group, new THREE.BoxGeometry(1.8, 0.48, 4.6), bodyMat, [0, 0.45, 0], [0, 0, 0], geometries);

  // 2. Black Plastic Side Rubbing Strips
  addMesh(group, new THREE.BoxGeometry(0.04, 0.08, 4.4), plasticMat, [0.92, 0.45, 0], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.04, 0.08, 4.4), plasticMat, [-0.92, 0.45, 0], [0, 0, 0], geometries);

  // 3. Angular Notchback Cabin
  addMesh(group, new THREE.BoxGeometry(1.65, 0.58, 2.1), glassMat, [0, 0.98, -0.1], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.68, 0.08, 2.1), bodyMat, [0, 1.28, -0.1], [0, 0, 0], geometries);

  // 4. Black Impact Bumpers
  addMesh(group, new THREE.BoxGeometry(1.86, 0.22, 0.25), plasticMat, [0, 0.38, 2.38], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.86, 0.22, 0.25), plasticMat, [0, 0.38, -2.38], [0, 0, 0], geometries);

  // 5. Rectangular Grille & Halogen Headlights
  addMesh(group, new THREE.BoxGeometry(0.8, 0.22, 0.06), plasticMat, [0, 0.58, 2.32], [0, 0, 0], geometries);
  // Rectangular Headlights
  addMesh(group, new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat, [0.6, 0.58, 2.32], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat, [-0.6, 0.58, 2.32], [0, 0, 0], geometries);
  // Amber Turn Signals
  addMesh(group, new THREE.BoxGeometry(0.12, 0.18, 0.08), turnMat, [0.82, 0.58, 2.3], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.12, 0.18, 0.08), turnMat, [-0.82, 0.58, 2.3], [0, 0, 0], geometries);

  // Rectangular Taillights
  addMesh(group, new THREE.BoxGeometry(0.55, 0.22, 0.08), tailMat, [0.55, 0.58, -2.32], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.55, 0.22, 0.08), tailMat, [-0.55, 0.58, -2.32], [0, 0, 0], geometries);

  // 6. Wheels (Steel with plastic wheel covers)
  const wheelPositions: Array<[number, number, number]> = [
    [0.88, 0.32, 1.4],
    [-0.88, 0.32, 1.4],
    [0.88, 0.32, -1.3],
    [-0.88, 0.32, -1.3],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.32, 0.2, 0xaaaaaa, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 4.8,
    width: 1.86,
    height: 1.4,
  };
}

/**
 * 1985 Boxy Station Wagon:
 * Extended flat roofline, vertical tailgate, simulated woodgrain side panels, roof rack.
 */
export function build1985Wagon(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.4, 0.2);
  const woodMat = createStandardMat(materials, 0x7a4d2e, 0.7, 0.1); // Woodgrain trim
  const plasticMat = createStandardMat(materials, 0x242424, 0.75, 0.1);
  const rackMat = createStandardMat(materials, 0xcccccc, 0.2, 0.8);
  const glassMat = createStandardMat(materials, 0x1a2630, 0.1, 0.9);
  const lightMat = createEmissiveMat(materials, 0xffeedd, 0xffd9aa, 1.3);
  const tailMat = createEmissiveMat(materials, 0xdd1111, 0xbb0000, 1.1);

  // 1. Lower Body
  addMesh(group, new THREE.BoxGeometry(1.85, 0.48, 5.0), bodyMat, [0, 0.45, 0], [0, 0, 0], geometries);

  // 2. Simulated Woodgrain Side Panel
  addMesh(group, new THREE.BoxGeometry(0.04, 0.25, 4.2), woodMat, [0.94, 0.52, -0.2], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.04, 0.25, 4.2), woodMat, [-0.94, 0.52, -0.2], [0, 0, 0], geometries);

  // 3. Extended Wagon Cabin & Roof
  addMesh(group, new THREE.BoxGeometry(1.68, 0.62, 3.2), glassMat, [0, 1.0, -0.6], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.72, 0.08, 3.3), bodyMat, [0, 1.33, -0.6], [0, 0, 0], geometries);

  // 4. Roof Luggage Rack
  addMesh(group, new THREE.BoxGeometry(1.3, 0.06, 2.2), rackMat, [0, 1.4, -0.6], [0, 0, 0], geometries);

  // 5. Impact Bumpers
  addMesh(group, new THREE.BoxGeometry(1.9, 0.22, 0.25), plasticMat, [0, 0.38, 2.58], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.9, 0.22, 0.25), plasticMat, [0, 0.38, -2.58], [0, 0, 0], geometries);

  // 6. Lights
  addMesh(group, new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat, [0.6, 0.58, 2.52], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat, [-0.6, 0.58, 2.52], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.45, 0.08), tailMat, [0.75, 0.75, -2.52], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.45, 0.08), tailMat, [-0.75, 0.75, -2.52], [0, 0, 0], geometries);

  // Wheels
  const wheelPositions: Array<[number, number, number]> = [
    [0.9, 0.32, 1.5],
    [-0.9, 0.32, 1.5],
    [0.9, 0.32, -1.4],
    [-0.9, 0.32, -1.4],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.32, 0.2, 0xaaaaaa, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 5.2,
    width: 1.9,
    height: 1.48,
  };
}

/**
 * 2005 Rounded Crossover / SUV:
 * Curved aerodynamic profile, high ground clearance, silver roof rails, clear-lens headlights.
 */
export function build2005Crossover(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.3, 0.5);
  const plasticMat = createStandardMat(materials, 0x333333, 0.8, 0.1);
  const silverMat = createStandardMat(materials, 0xd0d0d0, 0.25, 0.7);
  const glassMat = createStandardMat(materials, 0x14202c, 0.1, 0.9);
  const lightMat = createEmissiveMat(materials, 0xf0f8ff, 0xddeeff, 1.4);
  const tailMat = createEmissiveMat(materials, 0xee2222, 0xcc0000, 1.2);

  // 1. Lower Body (Rounded edges)
  addMesh(group, new THREE.BoxGeometry(1.88, 0.55, 4.5), bodyMat, [0, 0.55, 0], [0, 0, 0], geometries);
  // Lower plastic cladding
  addMesh(group, new THREE.BoxGeometry(1.9, 0.18, 4.52), plasticMat, [0, 0.36, 0], [0, 0, 0], geometries);

  // 2. Curved Greenhouse
  addMesh(group, new THREE.BoxGeometry(1.7, 0.65, 2.6), glassMat, [0, 1.15, -0.3], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.74, 0.08, 2.6), bodyMat, [0, 1.5, -0.3], [0, 0, 0], geometries);

  // 3. Silver Roof Rails
  addMesh(group, new THREE.BoxGeometry(0.06, 0.08, 2.2), silverMat, [0.72, 1.56, -0.3], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.06, 0.08, 2.2), silverMat, [-0.72, 1.56, -0.3], [0, 0, 0], geometries);

  // 4. Sloped Hood
  addMesh(group, new THREE.BoxGeometry(1.75, 0.22, 1.4), bodyMat, [0, 0.8, 1.3], [-0.1, 0, 0], geometries);

  // 5. Projector Curved Headlights & Taillights
  addMesh(group, new THREE.BoxGeometry(0.38, 0.2, 0.12), lightMat, [0.65, 0.72, 2.22], [-0.15, 0.2, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.38, 0.2, 0.12), lightMat, [-0.65, 0.72, 2.22], [-0.15, -0.2, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.25, 0.4, 0.08), tailMat, [0.72, 0.95, -2.25], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.25, 0.4, 0.08), tailMat, [-0.72, 0.95, -2.25], [0, 0, 0], geometries);

  // 6. Alloy Wheels
  const wheelPositions: Array<[number, number, number]> = [
    [0.92, 0.38, 1.35],
    [-0.92, 0.38, 1.35],
    [0.92, 0.38, -1.35],
    [-0.92, 0.38, -1.35],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.38, 0.24, 0xdddddd, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 4.6,
    width: 1.9,
    height: 1.68,
  };
}

/**
 * 2005 Compact Hatchback:
 * Short sloped front, tall curved greenhouse, chopped rear tailgate.
 */
export function build2005Hatchback(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.3, 0.5);
  const glassMat = createStandardMat(materials, 0x14202c, 0.1, 0.9);
  const lightMat = createEmissiveMat(materials, 0xf0f8ff, 0xddeeff, 1.4);
  const tailMat = createEmissiveMat(materials, 0xee2222, 0xcc0000, 1.2);

  // Lower Body
  addMesh(group, new THREE.BoxGeometry(1.78, 0.5, 4.0), bodyMat, [0, 0.48, 0], [0, 0, 0], geometries);

  // Sloped Hood
  addMesh(group, new THREE.BoxGeometry(1.68, 0.2, 1.2), bodyMat, [0, 0.72, 1.2], [-0.15, 0, 0], geometries);

  // Compact Hatch Cabin
  addMesh(group, new THREE.BoxGeometry(1.6, 0.6, 2.2), glassMat, [0, 1.05, -0.4], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(1.64, 0.08, 2.2), bodyMat, [0, 1.38, -0.4], [0, 0, 0], geometries);

  // Lights
  addMesh(group, new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat, [0.6, 0.65, 1.96], [-0.15, 0.2, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat, [-0.6, 0.65, 1.96], [-0.15, -0.2, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.45, 0.08), tailMat, [0.68, 0.85, -2.0], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.45, 0.08), tailMat, [-0.68, 0.85, -2.0], [0, 0, 0], geometries);

  // Wheels
  const wheelPositions: Array<[number, number, number]> = [
    [0.86, 0.32, 1.2],
    [-0.86, 0.32, 1.2],
    [0.86, 0.32, -1.2],
    [-0.86, 0.32, -1.2],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.32, 0.22, 0xcccccc, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 4.1,
    width: 1.8,
    height: 1.48,
  };
}

/**
 * 2025 Aerodynamic Modern EV:
 * Closed front aerodynamic grille, full-width front LED light bar, seamless panoramic glass canopy,
 * full-width slim OLED rear light bar, flush futuristic styling.
 */
export function build2025EVSedan(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = createStandardMat(materials, primaryColor, 0.2, 0.6);
  const aeroGlassMat = createStandardMat(materials, 0x0a1218, 0.05, 0.95);
  const ledHeadMat = createEmissiveMat(materials, 0xffffff, 0xe0f7fa, 2.0); // Bright 6000K LED bar
  const ledTailMat = createEmissiveMat(materials, 0xff1744, 0xd50000, 1.8); // Continuous red LED light bar
  const darkTrimMat = createStandardMat(materials, 0x181818, 0.7, 0.2);

  // 1. Sleek Aerodynamic Lower Body with Flush Nose (Closed Grille!)
  addMesh(group, new THREE.BoxGeometry(1.9, 0.48, 4.7), bodyMat, [0, 0.48, 0], [0, 0, 0], geometries);

  // Smooth Closed Front Fascia
  addMesh(group, new THREE.BoxGeometry(1.82, 0.32, 0.25), bodyMat, [0, 0.52, 2.32], [-0.15, 0, 0], geometries);
  // Lower aero diffuser
  addMesh(group, new THREE.BoxGeometry(1.75, 0.1, 0.2), darkTrimMat, [0, 0.28, 2.35], [0, 0, 0], geometries);

  // 2. Seamless Panoramic Glass Canopy (Windshield + Roof + Rear Glass)
  addMesh(group, new THREE.BoxGeometry(1.68, 0.58, 2.8), aeroGlassMat, [0, 1.05, -0.1], [0, 0, 0], geometries);
  // Glass canopy roof top
  addMesh(group, new THREE.BoxGeometry(1.65, 0.04, 2.4), aeroGlassMat, [0, 1.35, -0.1], [0, 0, 0], geometries);

  // 3. Full-Width Horizontal LED Light Bar (Signature 2025 EV Look)
  addMesh(group, new THREE.BoxGeometry(1.75, 0.06, 0.08), ledHeadMat, [0, 0.68, 2.42], [0, 0, 0], geometries);
  // Corner headlight pods
  addMesh(group, new THREE.BoxGeometry(0.28, 0.1, 0.1), ledHeadMat, [0.72, 0.66, 2.38], [0, 0.15, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.28, 0.1, 0.1), ledHeadMat, [-0.72, 0.66, 2.38], [0, -0.15, 0], geometries);

  // 4. Full-Width Continuous Rear OLED Tail Strip
  addMesh(group, new THREE.BoxGeometry(1.75, 0.05, 0.08), ledTailMat, [0, 0.72, -2.36], [0, 0, 0], geometries);

  // 5. Aerodynamic Turbine Alloy Wheels
  const wheelPositions: Array<[number, number, number]> = [
    [0.92, 0.35, 1.45],
    [-0.92, 0.35, 1.45],
    [0.92, 0.35, -1.45],
    [-0.92, 0.35, -1.45],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.35, 0.22, 0x222222, false);
    // Aero rim face insert
    const aeroFaceGeom = trackGeom(geometries, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 5));
    const aeroFaceMat = createStandardMat(materials, 0x999999, 0.2, 0.8);
    const aeroFace = new THREE.Mesh(aeroFaceGeom, aeroFaceMat);
    aeroFace.rotation.z = Math.PI / 2;
    w.add(aeroFace);

    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  return {
    group,
    wheels,
    geometries,
    materials,
    length: 4.8,
    width: 1.92,
    height: 1.45,
  };
}

/**
 * 2025 Electric Scooter (Micromobility):
 * Standing commuter with helmet on electric scooter with front LED headlight.
 */
export function build2025Scooter(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const frameMat = createStandardMat(materials, 0x1f2428, 0.4, 0.6);
  const deckMat = createStandardMat(materials, primaryColor, 0.5, 0.3);
  const lightMat = createEmissiveMat(materials, 0xffffff, 0xe0f7fa, 1.8);
  const tailMat = createEmissiveMat(materials, 0xff1744, 0xd50000, 1.5);
  const skinMat = createStandardMat(materials, 0xd4a373, 0.7, 0.0);
  const clothesMat = createStandardMat(materials, 0x2e3b4e, 0.6, 0.1);
  const helmetMat = createStandardMat(materials, 0x2ee6a8, 0.3, 0.4);

  // 1. Scooter Deck & Steering Stem
  addMesh(group, new THREE.BoxGeometry(0.2, 0.06, 0.95), deckMat, [0, 0.12, 0], [0, 0, 0], geometries);
  // Vertical Stem
  addMesh(group, new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8), frameMat, [0, 0.58, 0.42], [0.1, 0, 0], geometries);
  // Handlebars
  addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), frameMat, [0, 1.05, 0.38], [0, 0, Math.PI / 2], geometries);

  // Lights
  addMesh(group, new THREE.SphereGeometry(0.04, 8, 8), lightMat, [0, 0.98, 0.42], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.06, 0.04, 0.02), tailMat, [0, 0.14, -0.48], [0, 0, 0], geometries);

  // Wheels
  const wheelPositions: Array<[number, number, number]> = [
    [0, 0.1, 0.42],
    [0, 0.1, -0.42],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.1, 0.06, 0x111111, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  // 2. Standing Rider
  const rider = new THREE.Group();
  rider.position.set(0, 0.15, 0);

  // Legs (slightly staggered on deck)
  addMesh(rider, new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), clothesMat, [0.06, 0.35, -0.1], [0, 0, 0], geometries);
  addMesh(rider, new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), clothesMat, [-0.06, 0.35, 0.1], [0, 0, 0], geometries);

  // Torso
  addMesh(rider, new THREE.BoxGeometry(0.28, 0.45, 0.18), clothesMat, [0, 0.9, 0.05], [0.1, 0, 0], geometries);

  // Arms gripping handlebars
  addMesh(rider, new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), clothesMat, [0.16, 0.95, 0.22], [0.8, 0, -0.2], geometries);
  addMesh(rider, new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), clothesMat, [-0.16, 0.95, 0.22], [0.8, 0, 0.2], geometries);

  // Head & Helmet
  addMesh(rider, new THREE.SphereGeometry(0.1, 10, 10), skinMat, [0, 1.25, 0.1], [0, 0, 0], geometries);
  addMesh(rider, new THREE.SphereGeometry(0.12, 10, 10), helmetMat, [0, 1.28, 0.1], [0, 0, 0], geometries);

  group.add(rider);

  return {
    group,
    wheels,
    rider,
    geometries,
    materials,
    length: 1.1,
    width: 0.5,
    height: 1.75,
  };
}

/**
 * 2025 Cyclist / Bike Lane Rider (Micromobility):
 * Modern commuter bicycle with pedaling rider and commuter helmet.
 */
export function build2025Cyclist(
  primaryColor: string,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
): VehicleBuilderResult {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const frameMat = createStandardMat(materials, primaryColor, 0.3, 0.5);
  const metalMat = createStandardMat(materials, 0x888888, 0.2, 0.8);
  const skinMat = createStandardMat(materials, 0xd4a373, 0.7, 0.0);
  const clothesMat = createStandardMat(materials, 0x3d5a80, 0.6, 0.1);
  const helmetMat = createStandardMat(materials, 0xffd166, 0.3, 0.4);
  const lightMat = createEmissiveMat(materials, 0xffffff, 0xe0f7fa, 1.8);
  const tailMat = createEmissiveMat(materials, 0xff1744, 0xd50000, 1.5);

  // 1. Bicycle Frame
  // Top tube & Down tube
  addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8), frameMat, [0, 0.68, 0], [0, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), frameMat, [0, 0.52, 0.15], [-0.7, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), frameMat, [0, 0.52, -0.15], [0.7, 0, 0], geometries);

  // Handlebars & Fork
  addMesh(group, new THREE.CylinderGeometry(0.018, 0.018, 0.65, 8), metalMat, [0, 0.58, 0.48], [-0.3, 0, 0], geometries);
  addMesh(group, new THREE.CylinderGeometry(0.015, 0.015, 0.48, 8), metalMat, [0, 0.9, 0.42], [0, 0, Math.PI / 2], geometries);

  // Saddle / Seat
  addMesh(group, new THREE.BoxGeometry(0.14, 0.05, 0.22), createStandardMat(materials, 0x111111, 0.8, 0.1), [0, 0.75, -0.2], [0, 0, 0], geometries);

  // Lights
  addMesh(group, new THREE.SphereGeometry(0.035, 8, 8), lightMat, [0, 0.85, 0.46], [0, 0, 0], geometries);
  addMesh(group, new THREE.BoxGeometry(0.04, 0.04, 0.02), tailMat, [0, 0.68, -0.38], [0, 0, 0], geometries);

  // Spoke Wheels (Front & Rear)
  const wheelPositions: Array<[number, number, number]> = [
    [0, 0.32, 0.58],
    [0, 0.32, -0.58],
  ];

  for (const pos of wheelPositions) {
    const w = buildWheel(geometries, materials, 0.32, 0.04, 0xcccccc, false);
    w.position.set(...pos);
    group.add(w);
    const mesh = w.children[0] as THREE.Mesh;
    if (mesh) wheels.push(mesh);
  }

  // 2. Seated Cyclist Rider
  const rider = new THREE.Group();
  rider.position.set(0, 0.72, -0.2);

  // Torso leaning forward
  addMesh(rider, new THREE.BoxGeometry(0.26, 0.45, 0.18), clothesMat, [0, 0.32, 0.18], [-0.4, 0, 0], geometries);

  // Arms to handlebars
  addMesh(rider, new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), clothesMat, [0.15, 0.32, 0.42], [-0.8, 0, -0.2], geometries);
  addMesh(rider, new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), clothesMat, [-0.15, 0.32, 0.42], [-0.8, 0, 0.2], geometries);

  // Legs on pedals
  addMesh(rider, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), clothesMat, [0.12, -0.15, 0.1], [-0.5, 0, 0], geometries);
  addMesh(rider, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), clothesMat, [-0.12, -0.15, 0.1], [-0.5, 0, 0], geometries);

  // Head & Helmet
  addMesh(rider, new THREE.SphereGeometry(0.1, 10, 10), skinMat, [0, 0.62, 0.35], [0, 0, 0], geometries);
  addMesh(rider, new THREE.SphereGeometry(0.12, 10, 10), helmetMat, [0, 0.65, 0.35], [0, 0, 0], geometries);

  group.add(rider);

  return {
    group,
    wheels,
    rider,
    geometries,
    materials,
    length: 1.6,
    width: 0.5,
    height: 1.65,
  };
}

// ============================================================================
// Fleet Factory
// ============================================================================

export function createEraFleet(
  era: EraId,
  layout: BlockLayout,
  theme: EraTheme,
  options: FleetOptions = {},
  rng: Rng,
): {
  vehicles: VehicleInstance[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
} {
  const vehicles: VehicleInstance[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const lanes = layout.lanes;
  const laneCount = options.count ?? lanes.length;
  const includeMicromobility = options.includeMicromobility ?? (era === 2025);
  const colors = theme.vehicles.colors.length > 0
    ? theme.vehicles.colors
    : ['#2b2b2b', '#4a3b32', '#1f2d3d'];

  let vehicleCounter = 1;

  // Archetype selector based on Era
  switch (era) {
    case 1945: {
      // 40s rounded sedans and vintage delivery trucks
      for (let i = 0; i < Math.min(lanes.length, laneCount); i += 1) {
        const lane = lanes[i]!;
        const isTruck = i % 2 === 1;
        const archetype: VehicleArchetype = isTruck ? '1945_vintage_truck' : '1945_rounded_sedan';
        const color = colors[i % colors.length]!;

        const buildResult = isTruck
          ? build1945Truck(color, materials, geometries)
          : build1945Sedan(color, materials, geometries);

        const startDistance = (i * 22 + rng.range(5, 15)) % lane.flowPath.length;
        const speed = rng.range(theme.vehicles.speedRange[0], theme.vehicles.speedRange[1]);

        vehicles.push({
          id: `vehicle-1945-${vehicleCounter++}`,
          era,
          archetype,
          tags: ['1945', archetype, isTruck ? 'vintage_truck' : 'rounded_sedan', 'pre_war', 'curved_fenders'],
          mesh: buildResult.group,
          lane,
          path: lane.flowPath,
          distance: startDistance,
          baseSpeed: speed,
          currentSpeed: speed,
          length: buildResult.length,
          width: buildResult.width,
          height: buildResult.height,
          primaryColor: color,
          wheels: buildResult.wheels,
          isMicromobility: false,
        });
      }
      break;
    }

    case 1965: {
      // 60s finned cruisers with two-tone paint and muscle coupes
      for (let i = 0; i < lanes.length; i += 1) {
        const lane = lanes[i]!;
        const isCoupe = i % 2 === 1;
        const archetype: VehicleArchetype = isCoupe ? '1965_muscle_coupe' : '1965_finned_cruiser';
        const color = colors[i % colors.length]!;

        const buildResult = isCoupe
          ? build1965Coupe(color, materials, geometries)
          : build1965Cruiser(color, '#ffffff', materials, geometries);

        const startDistance = (i * 25 + rng.range(5, 15)) % lane.flowPath.length;
        const speed = rng.range(theme.vehicles.speedRange[0], theme.vehicles.speedRange[1]);

        vehicles.push({
          id: `vehicle-1965-${vehicleCounter++}`,
          era,
          archetype,
          tags: ['1965', archetype, isCoupe ? 'muscle_coupe' : 'finned_cruiser', 'tailfins', 'two_tone'],
          mesh: buildResult.group,
          lane,
          path: lane.flowPath,
          distance: startDistance,
          baseSpeed: speed,
          currentSpeed: speed,
          length: buildResult.length,
          width: buildResult.width,
          height: buildResult.height,
          primaryColor: color,
          secondaryColor: '#ffffff',
          wheels: buildResult.wheels,
          isMicromobility: false,
        });
      }
      break;
    }

    case 1985: {
      // 80s boxy sedans and station wagons with woodgrain trim
      for (let i = 0; i < lanes.length; i += 1) {
        const lane = lanes[i]!;
        const isWagon = i % 2 === 1;
        const archetype: VehicleArchetype = isWagon ? '1985_station_wagon' : '1985_boxy_sedan';
        const color = colors[i % colors.length]!;

        const buildResult = isWagon
          ? build1985Wagon(color, materials, geometries)
          : build1985Sedan(color, materials, geometries);

        const startDistance = (i * 24 + rng.range(5, 15)) % lane.flowPath.length;
        const speed = rng.range(theme.vehicles.speedRange[0], theme.vehicles.speedRange[1]);

        vehicles.push({
          id: `vehicle-1985-${vehicleCounter++}`,
          era,
          archetype,
          tags: ['1985', archetype, isWagon ? 'station_wagon' : 'boxy_sedan', 'angular', 'plastic_bumpers'],
          mesh: buildResult.group,
          lane,
          path: lane.flowPath,
          distance: startDistance,
          baseSpeed: speed,
          currentSpeed: speed,
          length: buildResult.length,
          width: buildResult.width,
          height: buildResult.height,
          primaryColor: color,
          wheels: buildResult.wheels,
          isMicromobility: false,
        });
      }
      break;
    }

    case 2005: {
      // 2000s rounded crossovers / SUVs and compact hatchbacks
      for (let i = 0; i < lanes.length; i += 1) {
        const lane = lanes[i]!;
        const isHatch = i % 2 === 1;
        const archetype: VehicleArchetype = isHatch ? '2005_hatchback' : '2005_crossover';
        const color = colors[i % colors.length]!;

        const buildResult = isHatch
          ? build2005Hatchback(color, materials, geometries)
          : build2005Crossover(color, materials, geometries);

        const startDistance = (i * 25 + rng.range(5, 15)) % lane.flowPath.length;
        const speed = rng.range(theme.vehicles.speedRange[0], theme.vehicles.speedRange[1]);

        vehicles.push({
          id: `vehicle-2005-${vehicleCounter++}`,
          era,
          archetype,
          tags: ['2005', archetype, isHatch ? 'hatchback' : 'crossover', 'rounded_suv', 'aerodynamic'],
          mesh: buildResult.group,
          lane,
          path: lane.flowPath,
          distance: startDistance,
          baseSpeed: speed,
          currentSpeed: speed,
          length: buildResult.length,
          width: buildResult.width,
          height: buildResult.height,
          primaryColor: color,
          wheels: buildResult.wheels,
          isMicromobility: false,
        });
      }
      break;
    }

    case 2025: {
      // 2025 EVs with closed grilles plus electric scooters and cyclists
      // 1. EVs in travel lanes
      for (let i = 0; i < lanes.length; i += 1) {
        const lane = lanes[i]!;
        const archetype: VehicleArchetype = '2025_ev_sedan';
        const color = colors[i % colors.length]!;
        const buildResult = build2025EVSedan(color, materials, geometries);

        const startDistance = (i * 28 + rng.range(5, 12)) % lane.flowPath.length;
        const speed = rng.range(theme.vehicles.speedRange[0], theme.vehicles.speedRange[1]);

        vehicles.push({
          id: `vehicle-2025-ev-${vehicleCounter++}`,
          era,
          archetype,
          tags: ['2025', archetype, 'ev_sedan', 'closed_grille', 'led_lightbar', 'panoramic_roof'],
          mesh: buildResult.group,
          lane,
          path: lane.flowPath,
          distance: startDistance,
          baseSpeed: speed,
          currentSpeed: speed,
          length: buildResult.length,
          width: buildResult.width,
          height: buildResult.height,
          primaryColor: color,
          wheels: buildResult.wheels,
          isMicromobility: false,
        });
      }

      // 2. Electric Scooter and Bike Cyclist (Micromobility)
      if (includeMicromobility) {
        const scooterLane = lanes[0]!;
        const scooterColor = '#2ee6a8';
        const scooterBuild = build2025Scooter(scooterColor, materials, geometries);
        vehicles.push({
          id: `vehicle-2025-scooter-${vehicleCounter++}`,
          era,
          archetype: '2025_electric_scooter',
          tags: ['2025', '2025_electric_scooter', 'electric_scooter', 'micromobility', 'standing_rider'],
          mesh: scooterBuild.group,
          lane: scooterLane,
          path: scooterLane.flowPath,
          distance: (scooterLane.flowPath.length * 0.45) % scooterLane.flowPath.length,
          baseSpeed: 5.5,
          currentSpeed: 5.5,
          length: scooterBuild.length,
          width: scooterBuild.width,
          height: scooterBuild.height,
          primaryColor: scooterColor,
          wheels: scooterBuild.wheels,
          rider: scooterBuild.rider,
          isMicromobility: true,
        });

        // 3. Bike / Cyclist (Protected bike lane participant)
        const bikeLane = lanes[1] ?? lanes[0]!;
        const bikeColor = '#ff5400';
        const bikeBuild = build2025Cyclist(bikeColor, materials, geometries);
        vehicles.push({
          id: `vehicle-2025-cyclist-${vehicleCounter++}`,
          era,
          archetype: '2025_bike_cyclist',
          tags: ['2025', '2025_bike_cyclist', 'bike_cyclist', 'bike_lane', 'micromobility', 'cyclist'],
          mesh: bikeBuild.group,
          lane: bikeLane,
          path: bikeLane.flowPath,
          distance: (bikeLane.flowPath.length * 0.75) % bikeLane.flowPath.length,
          baseSpeed: 4.8,
          currentSpeed: 4.8,
          length: bikeBuild.length,
          width: bikeBuild.width,
          height: bikeBuild.height,
          primaryColor: bikeColor,
          wheels: bikeBuild.wheels,
          rider: bikeBuild.rider,
          isMicromobility: true,
        });
      }

      break;
    }
  }

  return { vehicles, geometries, materials };
}

// ============================================================================
// Frame-Rate Independent Simulation & Anti-Collision Headway
// ============================================================================

export function updateVehicles(vehicles: VehicleInstance[], dt: number): void {
  const MIN_HEADWAY = 10.0; // minimum distance in meters between vehicles in same lane

  // 1. Group vehicles by path to enforce safe spacing
  const pathMap = new Map<string, VehicleInstance[]>();
  for (const v of vehicles) {
    const list = pathMap.get(v.path.id) ?? [];
    list.push(v);
    pathMap.set(v.path.id, list);
  }

  // 2. Safe following distance / anti-collision logic
  for (const [, list] of pathMap) {
    if (list.length > 1) {
      list.sort((a, b) => a.distance - b.distance);
      for (let i = 0; i < list.length; i += 1) {
        const current = list[i]!;
        const nextIndex = (i + 1) % list.length;
        const leader = list[nextIndex]!;

        let gap = leader.distance - current.distance;
        if (gap < 0) {
          gap += current.path.length;
        }

        if (gap < MIN_HEADWAY) {
          current.currentSpeed = Math.min(current.baseSpeed * 0.4, leader.currentSpeed * 0.9);
        } else if (gap < MIN_HEADWAY * 1.5) {
          current.currentSpeed = Math.min(current.baseSpeed, leader.currentSpeed);
        } else {
          current.currentSpeed = current.baseSpeed;
        }
      }
    } else if (list.length === 1) {
      list[0]!.currentSpeed = list[0]!.baseSpeed;
    }
  }

  // 3. Position and Orientation updates along layout path
  for (const v of vehicles) {
    const path = v.path;
    const pathLen = Math.max(1, path.length);

    v.distance = (v.distance + v.currentSpeed * dt) % pathLen;
    const t = v.distance / pathLen;
    const pos = sampleTrafficPath(path, t);

    // Look-ahead sample for smooth tangent heading
    const lookAheadDist = Math.min(pathLen, v.distance + 0.5);
    const posAhead = sampleTrafficPath(path, lookAheadDist / pathLen);

    const dx = posAhead.x - pos.x;
    const dz = posAhead.z - pos.z;
    let yaw = Math.atan2(dx, dz);
    if (Math.hypot(dx, dz) < 1e-4) {
      // Fallback to lane direction angle
      yaw = v.lane.direction === 'eastbound' ? Math.PI / 2 :
            v.lane.direction === 'westbound' ? (3 * Math.PI) / 2 :
            v.lane.direction === 'northbound' ? 0 : Math.PI;
    }

    // Offset micromobility (scooters/bikes) slightly to the outer shoulder
    let posX = pos.x;
    let posZ = pos.z;
    if (v.isMicromobility) {
      const normalX = -Math.cos(yaw);
      const normalZ = Math.sin(yaw);
      const shoulderOffset = 1.4; // shift 1.4m towards curb edge
      posX += normalX * shoulderOffset;
      posZ += normalZ * shoulderOffset;
    }

    v.mesh.position.set(posX, pos.y, posZ);
    v.mesh.rotation.y = yaw;

    // Wheel rotation around local pitch axis
    const wheelRadius = v.isMicromobility ? 0.15 : 0.35;
    const wheelRotDelta = (v.currentSpeed * dt) / wheelRadius;
    for (const w of v.wheels) {
      w.rotation.x += wheelRotDelta;
    }
  }
}
