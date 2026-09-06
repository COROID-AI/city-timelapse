import * as THREE from 'three';

import { BLOCK, SIDEWALK, STREET } from '../../layout';
import { eraRegistry } from '../registry';
import type { AssetLoader, EraContent, EraContext, EraId } from '../../types';
import {
  makeBillboardMesh,
  makeBikeRackMesh,
  makeBuildingMesh,
  makeBusShelterMesh,
  makeNewspaperBoxMesh,
  makePedestrianMesh,
  makePlanterMesh,
  makeRoadMarkingMeshes,
  makeStorefrontMesh,
  makeTrafficCameraMesh,
  makeTrafficSignalMesh,
  makeVehicleMesh,
  type BuildingSpec,
  type PedestrianOutfit,
  type StorefrontSpec,
  type VehicleKind,
} from './2005.parts';

/**
 * 2005 era — an early-2000s city block.
 *
 * Art direction: mixed-use mid-rise buildings with glass/steel facades,
 * chain-retail / big-box / coffee storefronts with corporate fascias and vinyl
 * banners, dot-com billboards, a silver/black fleet of sedans/SUVs/hatchbacks/
 * vans, and pedestrians in 2000s casual fashion (baggy jeans, graphic tees,
 * hoodies, flip phones). Street furniture: thermoplastic road markings, modern
 * signals, a traffic camera, a bus shelter with ad panel, planters, bike racks
 * and newspaper boxes.
 *
 * All geometry and textures are procedural (no binary assets).
 */

const ERA: EraId = '2005';

/** Palette — 2000s silver/black/grey vehicle dominance. */
const VEHICLE_COLORS = [0xc0c0c0, 0x2b2b2b, 0x8a8a8a, 0x9aa0a6, 0x3a3a3a, 0xb8bdc2];

/** 2000s casual outfit variants for pedestrians. */
const OUTFITS: PedestrianOutfit[] = [
  { shirt: 0x2a7bb8, pants: 0x4a5a6a, skin: 0xd9a77a, hair: 0x2b2b2b, hoodie: false, flipPhone: true },
  { shirt: 0xd94f4f, pants: 0x3d4a5c, skin: 0xc98d62, hair: 0x1a1a1a, hoodie: false, flipPhone: false },
  { shirt: 0x3f7d2a, pants: 0x6b6b6b, skin: 0x8a5a3b, hair: 0x111111, hoodie: true, flipPhone: true },
  { shirt: 0x7a5a9a, pants: 0x2c2c2c, skin: 0xd9a77a, hair: 0x3a2a1a, hoodie: false, flipPhone: false },
  { shirt: 0x222222, pants: 0x55606a, skin: 0xc98d62, hair: 0x222222, hoodie: true, flipPhone: true },
  { shirt: 0xcf5f8a, pants: 0x4a4a4a, skin: 0xe0b088, hair: 0x6b4a2f, hoodie: false, flipPhone: false },
  { shirt: 0x3a6bb0, pants: 0x333333, skin: 0xd9a77a, hair: 0x1a1a1a, hoodie: true, flipPhone: true },
  { shirt: 0xb8c4cc, pants: 0x2f2f2f, skin: 0x8a5a3b, hair: 0x000000, hoodie: false, flipPhone: false },
  { shirt: 0x77a832, pants: 0x3d3d3d, skin: 0xc98d62, hair: 0x2b2b2b, hoodie: false, flipPhone: true },
  { shirt: 0x5a5a8a, pants: 0x222222, skin: 0xe0b088, hair: 0x4a2a1a, hoodie: true, flipPhone: false },
];

/** A no-op asset loader for headless build contexts. */
function makeLoader(): AssetLoader {
  return {
    load: async () => '#',
    release: () => undefined,
  };
}

/** Build a minimal EraContext for headless construction (tests). */
export function makeStubContext(): EraContext {
  const root = typeof document !== 'undefined' && typeof document.createElement === 'function'
    ? document.createElement('div')
    : ({} as HTMLElement);
  return {
    scene: new THREE.Group(),
    loader: makeLoader(),
    root,
    year: ERA,
  };
}

/** Static building footprints arranged around the block. */
const BUILDINGS: BuildingSpec[] = [
  { x: -40, z: -38, width: 22, depth: 16, height: 30, base: 0x9aa0a6, glass: 0x7fb2d9, frame: 0x3a3f44, floors: 8, cols: 6 },
  { x: -12, z: -40, width: 20, depth: 15, height: 26, base: 0x8a8f96, glass: 0x6ea8d0, frame: 0x2f3439, floors: 7, cols: 6 },
  { x: 16, z: -38, width: 24, depth: 16, height: 34, base: 0xa8adb4, glass: 0x8fc0e0, frame: 0x3a3f44, floors: 9, cols: 7 },
  { x: 44, z: -40, width: 20, depth: 15, height: 28, base: 0x7d8288, glass: 0x6aa0c8, frame: 0x2b3035, floors: 8, cols: 6 },
  { x: -42, z: 40, width: 22, depth: 16, height: 32, base: 0x949aa0, glass: 0x7fb2d9, frame: 0x363b40, floors: 9, cols: 7 },
  { x: -10, z: 42, width: 20, depth: 15, height: 24, base: 0x8a8f96, glass: 0x6ea8d0, frame: 0x2f3439, floors: 7, cols: 6 },
  { x: 20, z: 40, width: 22, depth: 16, height: 30, base: 0xa0a6ac, glass: 0x8fc0e0, frame: 0x3a3f44, floors: 8, cols: 6 },
  { x: 46, z: 40, width: 18, depth: 15, height: 26, base: 0x7d8288, glass: 0x6aa0c8, frame: 0x2b3035, floors: 7, cols: 5 },
];

/** Chain-retail / big-box / coffee storefronts with corporate fascias. */
const STOREFRONTS: StorefrontSpec[] = [
  { x: -52, z: -30, width: 12, height: 7, depth: 3, fascia: 0xc8102e, bannerText: 'MEGA MART', bannerBg: 0xc8102e, bannerFg: 0xffffff, rotationY: 0 },
  { x: -52, z: -8, width: 10, height: 7, depth: 3, fascia: 0x0b6b2e, bannerText: 'COFFEE HOUSE', bannerBg: 0x0b6b2e, bannerFg: 0xffffff, rotationY: 0 },
  { x: 52, z: -24, width: 13, height: 7, depth: 3, fascia: 0x1a3c8a, bannerText: 'BIG-BOX DEPOT', bannerBg: 0x1a3c8a, bannerFg: 0xffd200, rotationY: Math.PI },
  { x: 52, z: 6, width: 10, height: 7, depth: 3, fascia: 0x8a1a6b, bannerText: 'CELLPHONE ZONE', bannerBg: 0x8a1a6b, bannerFg: 0xffffff, rotationY: Math.PI },
];

/** Dot-com / graphic-design billboards. */
const BILLBOARDS: Array<{ style: number; x: number; y: number; z: number; rotationY: number; pole: boolean }> = [
  { style: 0, x: -66, y: 8, z: -30, rotationY: Math.PI / 2, pole: true },
  { style: 1, x: 66, y: 8, z: 10, rotationY: -Math.PI / 2, pole: true },
];

/** Vehicle fleet — silver/black/grey sedans, SUV, hatchback, van. */
const VEHICLES: Array<{ kind: VehicleKind; x: number; z: number; rotationY: number; color: number }> = [
  { kind: 'sedan', x: -30, z: -58, rotationY: 0, color: VEHICLE_COLORS[0] },
  { kind: 'suv', x: -8, z: 58, rotationY: Math.PI, color: VEHICLE_COLORS[1] },
  { kind: 'hatchback', x: 14, z: -58, rotationY: 0, color: VEHICLE_COLORS[2] },
  { kind: 'van', x: 40, z: 58, rotationY: Math.PI, color: VEHICLE_COLORS[3] },
  { kind: 'sedan', x: -44, z: 58, rotationY: Math.PI, color: VEHICLE_COLORS[4] },
  { kind: 'sedan', x: 30, z: -58, rotationY: 0, color: VEHICLE_COLORS[5] },
];

/** Pedestrian spawn slots on the sidewalks around the block. */
const PEDESTRIAN_SLOTS: Array<{ x: number; z: number; heading: number }> = [
  { x: -50, z: -2, heading: 0 },
  { x: -30, z: 2, heading: 0 },
  { x: -10, z: -2, heading: 0 },
  { x: 10, z: 2, heading: 0 },
  { x: 30, z: -2, heading: 0 },
  { x: 50, z: 2, heading: 0 },
  { x: -2, z: -50, heading: Math.PI / 2 },
  { x: 2, z: -30, heading: Math.PI / 2 },
  { x: -2, z: -10, heading: Math.PI / 2 },
  { x: 2, z: 10, heading: Math.PI / 2 },
  { x: -2, z: 30, heading: Math.PI / 2 },
  { x: 2, z: 50, heading: Math.PI / 2 },
];

/** Street furniture positions (planters, bike racks, newspaper boxes). */
const PLANTERS: Array<{ x: number; z: number; rotationY: number }> = [
  { x: -58, z: -20, rotationY: 0 },
  { x: -58, z: 16, rotationY: 0 },
  { x: 58, z: -16, rotationY: 0 },
  { x: 58, z: 20, rotationY: 0 },
];
const BIKE_RACKS: Array<{ x: number; z: number }> = [
  { x: -20, z: -54 },
  { x: 20, z: 54 },
];
const NEWSPAPER_BOXES: Array<{ x: number; z: number }> = [
  { x: -46, z: -54 },
  { x: 46, z: 54 },
];

/** Internal sim state: animated meshes so update() can mutate positions. */
const simState: { vehicles: THREE.Group[]; pedestrians: THREE.Group[]; t: number; rootGroup: THREE.Group | null } = {
  vehicles: [],
  pedestrians: [],
  t: 0,
  rootGroup: null,
};

/** The 2005 era content, satisfying the shared EraContent contract. */
export const era2005: EraContent = {
  isFastPath: false,

  interactivePoints: [
    {
      id: '2005-megamart',
      position: new THREE.Vector3(-52, 4, -30),
      label: 'MEGA MART — big-box chain retail',
    },
    {
      id: '2005-coffee',
      position: new THREE.Vector3(-52, 4, -8),
      label: 'COFFEE HOUSE — coffee chain, vinyl banner',
    },
    {
      id: '2005-dotcom-billboard',
      position: new THREE.Vector3(-66, 9, -30),
      label: 'Dot-com era billboard',
    },
    {
      id: '2005-suv',
      position: new THREE.Vector3(-8, 1, 58),
      label: '2000s SUV',
    },
    {
      id: '2005-bus-shelter',
      position: new THREE.Vector3(-60, 2, -2),
      label: 'Bus shelter with ad panel',
    },
    {
      id: '2005-pedestrian',
      position: new THREE.Vector3(-50, 1.5, -2),
      label: 'Pedestrian — baggy jeans, flip phone',
    },
  ],

  build(context: EraContext) {
    const scene = context.scene;
    // Own the whole era graph under a single root so dispose() can detach it
    // from the shared scene on era switch (no leaks across transitions).
    const rootGroup = new THREE.Group();
    rootGroup.name = 'era-2005';
    simState.rootGroup = rootGroup;

    // Ground plane (road + sidewalks + block).
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK.width + STREET.width * 2 + 40, 0.2, BLOCK.depth + STREET.width * 2 + 40),
      new THREE.MeshBasicMaterial({ color: 0x3a3d40 }),
    );
    ground.position.y = -0.1;
    rootGroup.add(ground);

    // Sidewalk slabs lining the block.
    const sidewalkMat = new THREE.MeshBasicMaterial({ color: 0x8f8f8f });
    const sw = SIDEWALK.width;
    const side = BLOCK.depth / 2 + STREET.width / 2 + sw / 2;
    for (const [x, z, rot] of [
      [0, side, 0],
      [0, -side, 0],
      [side, 0, Math.PI / 2],
      [-side, 0, Math.PI / 2],
    ] as Array<[number, number, number]>) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK.width + 24, SIDEWALK.height, sw),
        sidewalkMat,
      );
      slab.rotation.set(0, rot, 0);
      slab.position.set(x, SIDEWALK.height / 2, z);
      rootGroup.add(slab);
    }

    // Buildings.
    for (const spec of BUILDINGS) {
      rootGroup.add(makeBuildingMesh(spec));
    }

    // Storefronts (corporate fascias + vinyl banners).
    for (const spec of STOREFRONTS) {
      rootGroup.add(makeStorefrontMesh(spec));
    }

    // Billboards.
    for (const b of BILLBOARDS) {
      rootGroup.add(makeBillboardMesh(b.style, b.x, b.y, b.z, b.rotationY, b.pole));
    }

    // Vehicles.
    for (const v of VEHICLES) {
      const mesh = makeVehicleMesh(v.kind, v.color);
      mesh.position.set(v.x, 0, v.z);
      mesh.rotation.set(0, v.rotationY, 0);
      simState.vehicles.push(mesh);
      rootGroup.add(mesh);
    }

    // Pedestrians.
    for (let i = 0; i < PEDESTRIAN_SLOTS.length; i++) {
      const slot = PEDESTRIAN_SLOTS[i];
      const outfit = OUTFITS[i % OUTFITS.length];
      const ped = makePedestrianMesh(outfit);
      ped.position.set(slot.x, 0, slot.z);
      ped.rotation.set(0, slot.heading, 0);
      simState.pedestrians.push(ped);
      rootGroup.add(ped);
    }

    // Thermoplastic road markings.
    for (const marking of makeRoadMarkingMeshes()) {
      rootGroup.add(marking);
    }

    // Modern signals + traffic camera.
    rootGroup.add(makeTrafficSignalMesh(-58, -54));
    rootGroup.add(makeTrafficSignalMesh(58, -54));
    rootGroup.add(makeTrafficSignalMesh(-58, 54));
    rootGroup.add(makeTrafficSignalMesh(58, 54));
    rootGroup.add(makeTrafficCameraMesh(0, -66));

    // Bus shelter with ad panel.
    rootGroup.add(makeBusShelterMesh(-60, -2));

    // Planters, bike racks, newspaper boxes.
    for (const p of PLANTERS) rootGroup.add(makePlanterMesh(p.x, p.z, p.rotationY));
    for (const r of BIKE_RACKS) rootGroup.add(makeBikeRackMesh(r.x, r.z));
    for (const n of NEWSPAPER_BOXES) rootGroup.add(makeNewspaperBoxMesh(n.x, n.z));

    scene.add(rootGroup);
    simState.t = 0;
  },

  update(delta: number) {
    // Gentle ambient drift so the block feels alive: rotate each vehicle's
    // wheels and nudge pedestrians along their sidewalks.
    simState.t += delta;
    for (const ped of simState.pedestrians) {
      ped.position.x += Math.sin(simState.t * 0.6) * 0.004;
      ped.rotation.set(0, Math.sin(simState.t * 0.3) * 0.4, 0);
    }
    for (const vehicle of simState.vehicles) {
      vehicle.position.x += Math.sin(simState.t * 0.4) * 0.002;
    }
  },

  dispose() {
    // Detach the whole era graph from the shared scene so switching away never
    // leaks the 2005 scene into subsequent eras.
    if (simState.rootGroup) {
      if (simState.rootGroup.parent) {
        simState.rootGroup.parent.remove(simState.rootGroup);
      }
      simState.rootGroup = null;
    }
    // Release animated mesh references so they are GC-eligible.
    simState.vehicles = [];
    simState.pedestrians = [];
    simState.t = 0;
  },
};

/**
 * Mesh providers handed to the sim / main-integration at era switch. Exposes
 * the procedural outfit and vehicle builders so the simulation can spawn
 * additional 2000s pedestrians and vehicles while the era is active.
 */
export const era2005Providers = {
  era: ERA,
  outfits: OUTFITS,
  vehicleColors: VEHICLE_COLORS,
  makePedestrian: makePedestrianMesh,
  makeVehicle: makeVehicleMesh,
};

// Side-effect registration on import.
eraRegistry.registerEra(ERA, era2005);