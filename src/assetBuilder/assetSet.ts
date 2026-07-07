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

  // Create buildings for the era
  const buildingTypes: Array<'residential' | 'commercial' | 'industrial' | 'skyscraper'> = [
    'residential', 'residential', 'commercial', 'commercial', 'industrial', 'skyscraper'
  ];

  for (let i = 0; i < 12; i++) {
    const building = createBuilding({
      position: [
        -40 + (i % 6) * 16,
        0,
        -40 + Math.floor(i / 6) * 32
      ],
      eraId,
      buildingType: buildingTypes[i % buildingTypes.length]
    });
    buildings.push(building);
    group.add(building);
  }

  // Create vehicles for the era
  for (let i = 0; i < 8; i++) {
    const vehicle = createVehicle({
      position: [
        -60 + i * 16,
        0,
        -60
      ],
      eraId,
      vehicleType: getRandomVehicleType(eraId)
    });
    vehicles.push(vehicle);
    group.add(vehicle);
  }

  // Create pedestrians for the era
  for (let i = 0; i < 16; i++) {
    const pedestrian = createPedestrian({
      position: [
        -60 + i * 8 + (Math.random() - 0.5) * 4,
        0,
        -40 + (Math.random() - 0.5) * 20
      ],
      eraId,
      pedestrianType: getRandomPedestrianType()
    });
    pedestrians.push(pedestrian);
    group.add(pedestrian);
  }

  // Create storefronts for the era
  const storeTypes: Array<'general-store' | 'clothing' | 'electronics' | 'restaurant' | 'cafe' | 'bank' | 'pharmacy' | 'grocery'> = [
    'general-store', 'clothing', 'electronics', 'restaurant', 'cafe', 'bank', 'pharmacy', 'grocery'
  ];

  for (let i = 0; i < 8; i++) {
    const storefront = createStorefront({
      position: [
        -60 + i * 16,
        0,
        60
      ],
      eraId,
      storeType: storeTypes[i % storeTypes.length]
    });
    storefronts.push(storefront);
    group.add(storefront);
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