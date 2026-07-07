import * as THREE from 'three';
import type { EraId } from '../eras.js';
import { createBuilding } from './building.js';
import { createVehicle } from './vehicle.js';
import { createPedestrian } from './pedestrian.js';
import { createStorefront } from './storefront.js';

/**
 * Complete asset set for an era
 */
export interface AssetSet {
  buildings: THREE.Group[];
  vehicles: THREE.Group[];
  pedestrians: THREE.Group[];
  storefronts: THREE.Group[];
  group: THREE.Group;
}

/**
 * Creates a complete set of era-specific assets
 */
export function createAssetSet(eraId: EraId): AssetSet {
  const group = new THREE.Group();
  const buildings: THREE.Group[] = [];
  const vehicles: THREE.Group[] = [];
  const pedestrians: THREE.Group[] = [];
  const storefronts: THREE.Group[] = [];

  // ========================================================================
  // City block layout
  // ------------------------------------------------------------------------
  // A coherent city block built around a central east-west street (along
  // the x-axis at z ≈ 0). Every object is kept well inside the ±100 block
  // boundary so nothing appears "outside the city":
  //   • Buildings flank the street on the north (z < 0) and south (z > 0).
  //   • Storefronts (with their era-specific signs / "billboards") sit on
  //     the building fronts and face inward toward the street.
  //   • Vehicles occupy two traffic lanes down the middle of the street.
  //   • Pedestrians walk along sidewalks on either side of the street.
  // ========================================================================

  const BUILDING_Z = 30;      // distance of building rows from street centre
  const STOREFRONT_Z = 24;    // storefronts sit just in front of buildings
  const SIDEWALK_Z = 15;      // sidewalk offset from street centre
  const LANE_Z = 4;           // traffic-lane offset from street centre

  // Evenly spaced x-positions across the block (within ±80 of the boundary)
  const buildingX = [-75, -45, -15, 15, 45, 75];
  const storefrontX = [-60, -20, 20, 60];
  const vehicleX = [-45, -15, 15, 45];
  const pedestrianX = [-70, -50, -30, -10, 10, 30, 50, 70];

  // --- Buildings: two rows (north / south) flanking the street ---
  const buildingTypes: Array<'residential' | 'commercial' | 'industrial' | 'skyscraper'> = [
    'residential', 'residential', 'commercial', 'commercial', 'industrial', 'skyscraper'
  ];

  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / 6);   // 0 = north row, 1 = south row
    const col = i % 6;
    const z = row === 0 ? -BUILDING_Z : BUILDING_Z;

    const building = createBuilding({
      position: [buildingX[col], 0, z],
      eraId,
      buildingType: buildingTypes[i % buildingTypes.length]
    });
    buildings.push(building);
    group.add(building);
  }

  // --- Storefronts: mounted on building fronts, facing the street ---
  // Their era-specific signage ("billboards") is therefore visible from
  // the street instead of floating far away from the buildings.
  const storeTypes: Array<'general-store' | 'clothing' | 'electronics' | 'restaurant' | 'cafe' | 'bank' | 'pharmacy' | 'grocery'> = [
    'general-store', 'clothing', 'electronics', 'restaurant', 'cafe', 'bank', 'pharmacy', 'grocery'
  ];

  for (let i = 0; i < 8; i++) {
    const side = Math.floor(i / 4);   // 0 = north, 1 = south
    const col = i % 4;
    const z = side === 0 ? -STOREFRONT_Z : STOREFRONT_Z;

    const storefront = createStorefront({
      position: [storefrontX[col], 0, z],
      eraId,
      storeType: storeTypes[i % storeTypes.length]
    });
    // South-side storefronts are rotated 180° so their signs face the street.
    if (side === 1) {
      storefront.rotation.y = Math.PI;
    }
    storefronts.push(storefront);
    group.add(storefront);
  }

  // --- Vehicles: two traffic lanes down the centre of the street ---
  for (let i = 0; i < 8; i++) {
    const lane = Math.floor(i / 4);   // 0 = eastbound (z < 0), 1 = westbound (z > 0)
    const col = i % 4;
    const z = lane === 0 ? -LANE_Z : LANE_Z;

    const vehicle = createVehicle({
      position: [vehicleX[col], 0, z],
      eraId,
      vehicleType: getRandomVehicleType(eraId)
    });
    vehicles.push(vehicle);
    group.add(vehicle);
  }

  // --- Pedestrians: sidewalks on either side of the street ---
  for (let i = 0; i < 16; i++) {
    const side = Math.floor(i / 8);   // 0 = north sidewalk, 1 = south sidewalk
    const col = i % 8;
    const x = pedestrianX[col] + (Math.random() - 0.5) * 4;
    const z = (side === 0 ? -SIDEWALK_Z : SIDEWALK_Z) + (Math.random() - 0.5) * 3;

    const pedestrian = createPedestrian({
      position: [x, 0, z],
      eraId,
      pedestrianType: getRandomPedestrianType()
    });
    pedestrians.push(pedestrian);
    group.add(pedestrian);
  }

  // Store metadata on the group
  group.userData = {
    eraId,
    buildingCount: buildings.length,
    vehicleCount: vehicles.length,
    pedestrianCount: pedestrians.length,
    storefrontCount: storefronts.length
  };

  return { buildings, vehicles, pedestrians, storefronts, group };
}

/**
 * Gets a random vehicle type appropriate for the era
 */
function getRandomVehicleType(eraId: EraId): 'car' | 'truck' | 'bus' | 'horse-drawn' | 'motorcycle' | 'electric' | 'autonomous' {
  if (eraId === '1945') {
    const types: Array<'car' | 'truck' | 'bus' | 'horse-drawn'> = ['car', 'truck', 'bus', 'horse-drawn'];
    return types[Math.floor(Math.random() * types.length)];
  } else if (eraId === '1965') {
    const types: Array<'car' | 'truck' | 'bus' | 'motorcycle'> = ['car', 'truck', 'bus', 'motorcycle'];
    return types[Math.floor(Math.random() * types.length)];
  } else if (eraId === '1985' || eraId === '2005') {
    const types: Array<'car' | 'truck' | 'bus' | 'motorcycle'> = ['car', 'truck', 'bus', 'motorcycle'];
    return types[Math.floor(Math.random() * types.length)];
  } else {
    const types: Array<'car' | 'truck' | 'bus' | 'motorcycle' | 'electric' | 'autonomous'> = ['car', 'truck', 'bus', 'motorcycle', 'electric', 'autonomous'];
    return types[Math.floor(Math.random() * types.length)];
  }
}

/**
 * Gets a random pedestrian type
 */
function getRandomPedestrianType(): 'business' | 'casual' | 'worker' | 'child' | 'elderly' {
  const types: Array<'business' | 'casual' | 'worker' | 'child' | 'elderly'> = ['business', 'casual', 'worker', 'child', 'elderly'];
  // Weight distribution: more casual adults, fewer children/elderly
  const weights = [0.2, 0.4, 0.2, 0.1, 0.1];
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < types.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) return types[i];
  }
  return 'casual';
}