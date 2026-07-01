/**
 * City block population.
 *
 * This module instantiates the visual population of a single city block for a
 * given era: buildings along the lot line, parked cars in the parking spots
 * laid out by the street-infrastructure builder, walking pedestrians scattered
 * across the sidewalks, and driving cars registered with the traffic system.
 *
 * It owns NO time/animation logic — it only lays out meshes once per
 * {@link populate} call and tears them down in {@link clear}. The walk/drive
 * animation itself is driven elsewhere (timeline runtime) via the rigs and the
 * traffic registry this module exposes.
 *
 * Every mesh added to the block flows through {@link applyRenderPolicy} so that
 * decals, props, vehicles and pedestrians share a single, z-fighting-free
 * render-ordering policy.
 */

import * as THREE from 'three';

import type {
  EraContent,
  ParkingSpot,
  VehicleRig,
  VehicleVariant,
} from './eras/types';
import type { PedestrianSpec, PedestrianRig } from './assetBuilder/pedestrian';
import { createPedestrian } from './assetBuilder/pedestrian';
import { buildStreetInfra } from './assetBuilder/streets';

// ---------------------------------------------------------------------------
// Render policy
// ---------------------------------------------------------------------------
//
// A localized render-policy helper. The centralized `renderPolicy` module is
// not yet present in the tree (the street builder notes the same), so this
// minimal implementation mirrors its documented contract: it assigns a stable
// per-kind render order and polygon offset to an object and all of its
// children, preventing z-fighting between the ground plane, road decals, props,
// vehicles and pedestrians. When the canonical helper lands it can replace this
// function verbatim.

/** Visual categories that share a render-ordering policy. */
export type RenderPolicyKind =
  | 'road'
  | 'marking'
  | 'prop'
  | 'pedestrian'
  | 'vehicle'
  | 'billboard';

interface PolicyEntry {
  /** Higher values draw later (on top). */
  renderOrder: number;
  /** Polygon offset for coplanar decals; null for non-coplanar geometry. */
  polygonOffset: { factor: number; units: number } | null;
}

/** Frozen per-kind render policy table. */
const RENDER_POLICIES: Readonly<Record<RenderPolicyKind, PolicyEntry>> =
  Object.freeze({
    road: { renderOrder: 0, polygonOffset: null },
    marking: { renderOrder: 1, polygonOffset: { factor: -1, units: -1 } },
    prop: { renderOrder: 2, polygonOffset: { factor: -2, units: -2 } },
    pedestrian: { renderOrder: 3, polygonOffset: { factor: -2, units: -2 } },
    vehicle: { renderOrder: 4, polygonOffset: { factor: -2, units: -2 } },
    billboard: { renderOrder: 5, polygonOffset: { factor: -3, units: -3 } },
  });

/**
 * Apply the render policy for `kind` to an object and all of its children.
 *
 * Walks the subtree assigning `renderOrder` and (for coplanar decals) the
 * polygon offset / depth-write flags on every material encountered. Returns the
 * same object reference for chaining.
 */
export function applyRenderPolicy<T extends THREE.Object3D>(
  object: T,
  kind: RenderPolicyKind,
): T {
  const policy = RENDER_POLICIES[kind];
  object.renderOrder = policy.renderOrder;
  object.traverse((child) => {
    child.renderOrder = policy.renderOrder;
    const mesh = child as THREE.Mesh;
    const material = mesh.material as
      | (THREE.Material & {
          polygonOffset?: boolean;
          polygonOffsetFactor?: number;
          polygonOffsetUnits?: number;
        })
      | undefined;
    if (!material) return;
    if (policy.polygonOffset) {
      material.polygonOffset = true;
      material.polygonOffsetFactor = policy.polygonOffset.factor;
      material.polygonOffsetUnits = policy.polygonOffset.units;
    }
    material.depthWrite = true;
    material.depthTest = true;
    material.needsUpdate = true;
  });
  return object;
}

// ---------------------------------------------------------------------------
// Traffic system contract
// ---------------------------------------------------------------------------
//
// The block does not own per-frame vehicle motion; instead it hands each
// driving-car rig to a traffic system for the timeline runtime to animate.
// Downstream modules implement this interface; a default no-op registry keeps
// the module usable in isolation (e.g. tests / partial scenes).

/** A driving car registered with the traffic system for animation. */
export interface TrafficCar {
  /** The vehicle mesh group, already placed in its lane. */
  rig: THREE.Group;
  /** Travel direction along the street axis. */
  direction: 'forward' | 'backward';
  /** Lane offset across the carriageway, in metres. */
  laneX: number;
  /** Starting position along the street axis, in metres. */
  z: number;
  /** Vehicle descriptor used by the drive animator. */
  vehicle: VehicleRig;
  /** Body color. */
  color: string;
}

/**
 * Registry that owns the lifecycle and motion of driving cars. The city block
 * registers cars here during {@link populate}; the timeline runtime ticks them.
 */
export interface TrafficSystem {
  /** Register a driving car with the traffic system. */
  register(car: TrafficCar): void;
  /** Remove and forget all previously registered cars. */
  clear(): void;
}

/** No-op traffic system used when none is supplied. */
const NOOP_TRAFFIC: TrafficSystem = { register: () => {}, clear: () => {} };

// ---------------------------------------------------------------------------
// Block geometry constants
// ---------------------------------------------------------------------------
//
// These mirror the street-infrastructure builder's internal layout so the
// population lands in the correct lanes without a hard runtime dependency on
// its private constants.

/** Half-width of the road carriageway (one lane each side of the centerline). */
const CARRIAGEWAY_HALF_WIDTH = 6;
/** Block length along the street axis, in metres. */
const BLOCK_LENGTH = 120;
/** Sidewalk depth across the street axis, in metres. */
const SIDEWALK_DEPTH = 4;
/** Curb rise of the sidewalk above the road surface, in metres. */
const CURB_HEIGHT = 0.15;

/** Distance from the road edge to the building facade (setback + sidewalk). */
const BUILDING_SETBACK = SIDEWALK_DEPTH + 2;

// ---------------------------------------------------------------------------
// Era density
// ---------------------------------------------------------------------------

/**
 * Per-era population density multipliers. Earlier eras are sparser (fewer cars,
 * lighter foot traffic); density rises toward the present day. Counts honour
 * the era key as the canonical density field, scaled against generous baselines.
 */
const ERA_DENSITY: Record<EraContent['era'], { pedestrians: number; driving: number }> = {
  1945: { pedestrians: 4, driving: 2 },
  1965: { pedestrians: 6, driving: 3 },
  1985: { pedestrians: 8, driving: 4 },
  2005: { pedestrians: 10, driving: 5 },
  2025: { pedestrians: 12, driving: 6 },
};

/** Era-aware body-color palettes for vehicles, derived from the accent tone. */
const ERA_CAR_COLORS: Record<EraContent['era'], string[]> = {
  1945: ['#5a4a3a', '#3b3b3a', '#6b4f3a'],
  1965: ['#c8b9a5', '#a87b5b', '#d4a5a5', '#7a8a6a'],
  1985: ['#3d6d98', '#b0b0b0', '#4a4a4a', '#8a3b3b'],
  2005: ['#4a9e8e', '#c0c0c0', '#2a2a2a', '#3d6d98'],
  2025: ['#6a5acd', '#e0e0e0', '#2a2a2a', '#4a9e8e'],
};

/** Era-aware building facade colors, derived from the ground/facade palette. */
const ERA_FACADE_COLORS: Record<EraContent['era'], string[]> = {
  1945: ['#8a7a6a', '#6b5a4a', '#7a6a5a'],
  1965: ['#9a8a7a', '#7a6a5a', '#8a7a6a'],
  1985: ['#b0b0b0', '#8a8a8a', '#9a9a9a'],
  2005: ['#a0b0b0', '#708090', '#b0a89a'],
  2025: ['#88a0b8', '#7a8a9a', '#a8b8c8'],
};

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Pick an element from `items` deterministically using `seed`. */
function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.floor(seeded(seed) * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Mesh factories
// ---------------------------------------------------------------------------

/**
 * Build a compact vehicle mesh group. The dedicated vehicle factory is not yet
 * wired into the asset bundle, so this assembles a simple chassis + cabin +
 * four wheels. The pose described by `rig` is applied (parked cars lock their
 * wheels straight; driving cars roll and steer via the traffic system later).
 */
function buildVehicle(
  variant: VehicleVariant,
  color: string,
  accent: string,
  glassColor = '#9ac3e0',
): THREE.Group {
  const group = new THREE.Group();
  group.name = `vehicle:${variant}`;

  const isTruck = variant === 'truck';
  const bodyLen = isTruck ? 5.2 : 4.2;
  const bodyWidth = isTruck ? 2.1 : 1.9;
  const bodyHeight = isTruck ? 1.5 : 1.1;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.55,
    metalness: 0.45,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isTruck ? accent : color),
    roughness: 0.5,
    metalness: 0.4,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(glassColor),
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.65,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.85,
    metalness: 0.1,
  });

  // Chassis body.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLen),
    bodyMat,
  );
  body.position.y = bodyHeight / 2 + 0.35;
  body.name = 'body';
  group.add(body);

  // Cabin / cargo. Trucks get a taller rear cargo box; cars get a cabin.
  const cabinLen = isTruck ? bodyLen * 0.6 : bodyLen * 0.45;
  const cabinHeight = isTruck ? 1.4 : 0.7;
  const cabinZ = isTruck ? -bodyLen * 0.15 : bodyLen * 0.1;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.96, cabinHeight, cabinLen),
    isTruck ? cabinMat : bodyMat,
  );
  cabin.position.set(0, bodyHeight + cabinHeight / 2 + 0.35, cabinZ);
  cabin.name = 'cabin';
  group.add(cabin);

  // Windows (windshield + rear) — omitted on truck cargo.
  if (!isTruck) {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.92, cabinHeight * 0.7, cabinLen * 0.95),
      glassMat,
    );
    glass.position.copy(cabin.position);
    glass.position.y += 0.02;
    glass.name = 'windows';
    group.add(glass);
  }

  // Head/tail light dots.
  const lightGeo = new THREE.BoxGeometry(bodyWidth * 0.9, 0.12, 0.05);
  const headLight = new THREE.Mesh(
    lightGeo,
    new THREE.MeshStandardMaterial({
      color: 0xfff4d6,
      emissive: 0xfff4d6,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    }),
  );
  headLight.position.set(0, bodyHeight * 0.7 + 0.35, bodyLen / 2);
  headLight.name = 'lights';
  group.add(headLight);

  // Four wheels grouped under a `wheels` parent with named pivots so the
  // traffic animator can spin/steer them.
  const wheels = new THREE.Group();
  wheels.name = 'wheels';
  const wheelRadius = 0.35;
  const wheelGeo = new THREE.CylinderGeometry(
    wheelRadius,
    wheelRadius,
    0.3,
    16,
  );
  const wheelHalfW = bodyWidth / 2 - 0.05;
  const wheelHalfL = bodyLen / 2 - 0.8;
  const wheelPositions: Array<[string, number, number]> = [
    ['wheel_FL', wheelHalfW, wheelHalfL],
    ['wheel_FR', -wheelHalfW, wheelHalfL],
    ['wheel_RL', wheelHalfW, -wheelHalfL],
    ['wheel_RR', -wheelHalfW, -wheelHalfL],
  ];
  for (const [name, x, z] of wheelPositions) {
    const pivot = new THREE.Group();
    pivot.name = name;
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2; // cylinder axis across the car width
    pivot.add(wheel);
    pivot.position.set(x, wheelRadius, z);
    wheels.add(pivot);
  }
  group.add(wheels);

  return group;
}

/**
 * Build a simple building mesh (extruded box) with an era-appropriate facade
 * color. Buildings are placed along the lot line behind the sidewalk.
 */
function buildBuilding(
  width: number,
  depth: number,
  height: number,
  color: string,
  roofColor: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'building';

  const shellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.85,
    metalness: 0.05,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(roofColor),
    roughness: 0.9,
    metalness: 0.05,
  });

  const shell = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), shellMat);
  shell.position.y = height / 2;
  group.add(shell);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.04, 0.3, depth * 1.04),
    roofMat,
  );
  roof.position.y = height + 0.15;
  group.add(roof);

  return group;
}

// ---------------------------------------------------------------------------
// City block controller
// ---------------------------------------------------------------------------

/** A walking pedestrian placed on the block, with its rig exposed for animation. */
export interface BlockPedestrian {
  /** The rigged pedestrian group (added to the scene). */
  rig: PedestrianRig;
  /** Sidewalk side the pedestrian walks along. */
  side: 'left' | 'right';
  /** Starting position along the street axis, in metres. */
  z: number;
}

/**
 * Controller that owns the lifetime of all city-block population meshes.
 *
 * Create one per scene; call {@link populate} whenever the era changes (it
 * clears first) and {@link clear} on teardown.
 */
export interface CityBlockController {
  /** Root group holding every block mesh; add it to the THREE scene once. */
  readonly root: THREE.Group;
  /** Pedestrians placed on the block during the last {@link populate}. */
  readonly pedestrians: readonly BlockPedestrian[];
  /** Driving cars registered with the traffic system during the last populate. */
  readonly cars: readonly TrafficCar[];
  /** Populate the block for an era. Clears any previous population first. */
  populate(eraContent: EraContent): void;
  /** Remove every block object and unregister driving cars. */
  clear(): void;
}

/**
 * Create a city block controller.
 *
 * @param traffic  Optional traffic system that owns driving-car motion. When
 *                 omitted, a no-op registry is used (cars are still placed on
 *                 the block but not animated by a traffic system).
 */
export function createCityBlock(
  traffic: TrafficSystem = NOOP_TRAFFIC,
): CityBlockController {
  const root = new THREE.Group();
  root.name = 'cityBlock';

  let pedestrians: BlockPedestrian[] = [];
  let cars: TrafficCar[] = [];

  /** Remove and dispose every block object, unregistering driving cars. */
  function clear(): void {
    traffic.clear();
    for (const child of [...root.children]) {
      root.remove(child);
      child.traverse((node) => {
      const mesh = node as THREE.Mesh;
        const geom = mesh.geometry;
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        geom?.dispose?.();
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
    }
    pedestrians = [];
    cars = [];
  }

  /** Lay out buildings along both lot lines behind the sidewalks. */
  function populateBuildings(content: EraContent): void {
    const facadeColors = ERA_FACADE_COLORS[content.era];
    const accent = content.palette.accent;
    // Buildings line the block on both sides, behind the sidewalk.
    for (const side of [-1, 1] as const) {
      const lotX = side * (CARRIAGEWAY_HALF_WIDTH + BUILDING_SETBACK);
      // Deterministic building strip: a handful of varying-width towers.
      const strip: Array<{ width: number; height: number; depth: number }> = [];
      let cursor = -BLOCK_LENGTH / 2 + 4;
      let seedBase = side * 1000;
      while (cursor < BLOCK_LENGTH / 2 - 8) {
        const width = 8 + seeded(seedBase) * 10;
        const depth = 8 + seeded(seedBase + 1) * 6;
        // Tower height scales with era modernity.
        const heightBase = 8 + (content.era - 1945) * 4;
        const height = heightBase + seeded(seedBase + 2) * heightBase;
        strip.push({ width, height, depth });
        cursor += width + 1.5;
        seedBase += 7;
      }
      let z = -BLOCK_LENGTH / 2 + 4;
      for (const b of strip) {
        const color = pick(facadeColors, seedBase + z);
        const building = buildBuilding(b.width, b.depth, b.height, color, accent);
        building.position.set(lotX, 0, z + b.width / 2);
        applyRenderPolicy(building, 'prop');
        root.add(building);
        z += b.width + 1.5;
      }
    }
  }

  /** Place parked cars in the occupied parking spots. */
  function populateParkedCars(content: EraContent): void {
    const infra = buildStreetInfra(content.era);
    const carColors = ERA_CAR_COLORS[content.era];
    const accent = content.palette.accent;

    let i = 0;
    for (const marker of infra.parkingMarkers) {
      const spot: ParkingSpot = marker.spot;
      if (!spot.occupied) continue;
      // Parallel parking: cars face along the street axis.
      const variant: VehicleVariant = seeded(i + spot.position) > 0.75 ? 'truck' : 'car';
      const color = pick(carColors, i + spot.position);
      const vehicle = buildVehicle(variant, color, accent);
      // Place at the marker center, yawed along the street (parallel spots).
      vehicle.position.set(marker.rect.x, 0, marker.rect.z);
      // Parallel-parked cars face along the street axis (yaw 90deg, facing +X/-X).
      vehicle.rotation.y = spot.side === 'right' ? Math.PI / 2 : -Math.PI / 2;
      applyRenderPolicy(vehicle, 'vehicle');
      root.add(vehicle);
      i += 1;
    }
  }

  /** Scatter walking pedestrians across both sidewalks. */
  function populatePedestrians(content: EraContent): void {
    const density = ERA_DENSITY[content.era];
    const count = density.pedestrians;
    const sidewalkEdgeX = CARRIAGEWAY_HALF_WIDTH + SIDEWALK_DEPTH / 2;

    for (let i = 0; i < count; i += 1) {
      const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
      const sideSign = side === 'right' ? 1 : -1;
      const z = -BLOCK_LENGTH / 2 + 6 + seeded(i * 13 + content.era) * (BLOCK_LENGTH - 12);
      // Spread pedestrians across the sidewalk width.
      const lateral = (seeded(i * 29 + content.era) - 0.5) * (SIDEWALK_DEPTH - 1);
      const x = sideSign * (sidewalkEdgeX + lateral);

      const spec: PedestrianSpec = {
        era: content.era,
        walkCycle: content.walkCycle,
        seed: content.era * 1000 + i,
      };
      const rig = createPedestrian(spec);
      rig.position.set(x, CURB_HEIGHT, z);
      // Face along the street; flip for variety.
      rig.rotation.y = side === 'right' ? 0 : Math.PI;
      applyRenderPolicy(rig, 'pedestrian');
      root.add(rig);
      pedestrians.push({ rig, side, z });
    }
  }

  /** Register driving cars with the traffic system, placing them in lanes. */
  function populateDrivingCars(content: EraContent): void {
    const density = ERA_DENSITY[content.era];
    const count = density.driving;
    const carColors = ERA_CAR_COLORS[content.era];
    const accent = content.palette.accent;

    for (let i = 0; i < count; i += 1) {
      const direction: 'forward' | 'backward' = i % 2 === 0 ? 'forward' : 'backward';
      // Two travel lanes offset from the centerline.
      const laneX = direction === 'forward'
        ? CARRIAGEWAY_HALF_WIDTH / 2
        : -CARRIAGEWAY_HALF_WIDTH / 2;
      const z = -BLOCK_LENGTH / 2 + (i / count) * BLOCK_LENGTH;
      const variant: VehicleVariant = seeded(i + 50 + content.era) > 0.8 ? 'truck' : 'car';
      const color = pick(carColors, i + 50);
      const vehicle = content.vehicles[variant] as VehicleRig | undefined;
      if (!vehicle) continue;

      const rig = buildVehicle(variant, color, accent);
      rig.position.set(laneX, 0, z);
      rig.rotation.y = direction === 'forward' ? 0 : Math.PI;
      applyRenderPolicy(rig, 'vehicle');
      root.add(rig);

      const car: TrafficCar = {
        rig,
        direction,
        laneX,
        z,
        vehicle,
        color,
      };
      cars.push(car);
      traffic.register(car);
    }
  }

  /** Populate the full block for an era, clearing any previous population. */
  function populate(content: EraContent): void {
    clear();
    populateBuildings(content);
    populateParkedCars(content);
    populatePedestrians(content);
    populateDrivingCars(content);
  }

  return {
    root,
    get pedestrians() {
      return pedestrians;
    },
    get cars() {
      return cars;
    },
    populate,
    clear,
  };
}
