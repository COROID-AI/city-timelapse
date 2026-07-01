import * as THREE from 'three';
import { Era } from '../eras/types';
import { getEra } from '../eras/data';
import { makeBuilding, BuiltBuilding } from './building';
import { makeStorefront, BuiltStorefront } from './storefront';
import { makeVehicle, BuiltVehicle } from './vehicle';
import { makePedestrian, BuiltPedestrian } from './pedestrian';
import { makeProp, BuiltProp } from './props';

/** A fully assembled scene for one era, ready to be added/removed from the root. */
export interface BuiltEra {
  era: Era;
  group: THREE.Group;
  vehicles: BuiltVehicle[];
  pedestrians: BuiltPedestrian[];
  buildings: BuiltBuilding[];
  storefronts: BuiltStorefront[];
  props: BuiltProp[];
  /** spin props (holograms) collected for the animation loop */
  spinners: THREE.Object3D[];
  dispose: () => void;
}

// Layout constants
const BLOCK = 80; // total block extent
const ROAD_W = 10;

/** Build the entire era scene (buildings, vehicles, pedestrians, storefronts, props). */
export function buildEraScene(era: Era): BuiltEra {
  const def = getEra(era);
  const group = new THREE.Group();
  group.name = `era-${era}`;

  const buildings: BuiltBuilding[] = [];
  const storefronts: BuiltStorefront[] = [];
  const vehicles: BuiltVehicle[] = [];
  const pedestrians: BuiltPedestrian[] = [];
  const props: BuiltProp[] = [];
  const spinners: THREE.Object3D[] = [];

  const buildable = BLOCK - ROAD_W * 2; // 60
  const lotSize = 15; // 4 lots per side

  // Place buildings around the 4 sides of the block (excluding road).
  // Each side is a row of 4 lots.
  const sides: Array<{ x: number; z: number; rotY: number }> = [];
  // North & South rows (z fixed, x varies)
  const half = buildable / 2;
  for (let i = 0; i < 4; i++) {
    const cx = -half + lotSize * (i + 0.5);
    sides.push({ x: cx, z: -half - 3, rotY: 0 }); // back facing south (toward camera)
    sides.push({ x: cx, z: half + 3, rotY: Math.PI });
  }
  // East & West rows
  for (let i = 0; i < 4; i++) {
    const cz = -half + lotSize * (i + 0.5);
    sides.push({ x: -half - 3, z: cz, rotY: Math.PI / 2 });
    sides.push({ x: half + 3, z: cz, rotY: -Math.PI / 2 });
  }

  const lotTypes: Array<'residential' | 'commercial' | 'office'> = [
    'commercial', 'office', 'residential', 'commercial',
    'residential', 'office', 'commercial', 'residential',
    'office', 'commercial', 'residential', 'office',
    'commercial', 'residential', 'office', 'commercial',
  ];

  sides.forEach((side, idx) => {
    const type = lotTypes[idx % lotTypes.length] ?? 'residential';
    const seed = era + idx * 13 + 1;
    const w = lotSize - 2;
    const d = 8;
    const b = makeBuilding(era, type, seed, w, d);
    b.group.position.set(side.x, 0, side.z);
    b.group.rotation.y = side.rotY;
    buildings.push(b);
    group.add(b.group);

    // storefront on commercial lots, mounted on the street-facing wall
    if (type === 'commercial') {
      const sf = def.storefronts[idx % def.storefronts.length] ?? def.storefronts[0]!;
      const store = makeStorefront(sf, w);
      // place near top of ground floor, facing the street (outward)
      const outward = new THREE.Vector3(Math.sin(side.rotY), 0, -Math.cos(side.rotY));
      store.group.position.set(
        side.x + outward.x * (d / 2 + 0.05),
        3.2,
        side.z + outward.z * (d / 2 + 0.05),
      );
      store.group.rotation.y = side.rotY;
      storefronts.push(store);
      group.add(store.group);
    }
  });

  // Vehicles: up to 8, placed on the road ring, traveling along roads.
  const vCount = Math.min(8, def.vehicles.length * 2);
  for (let i = 0; i < vCount; i++) {
    const style = def.vehicles[i % def.vehicles.length] ?? def.vehicles[0]!;
    const variant = i % 5 === 0 ? 'truck' : 'car';
    const v = makeVehicle(style, variant);
    // place on one of 4 road edges
    const edge = i % 4;
    const lane = (Math.floor(i / 4) % 2 === 0 ? 1 : -1) * 2.5;
    const offset = ((i * 17) % 40) - 20;
    if (edge === 0) {
      v.group.position.set(offset, 0, BLOCK / 2 - ROAD_W / 2 + lane);
      v.group.rotation.y = Math.PI; // travel -z
    } else if (edge === 1) {
      v.group.position.set(offset, 0, -BLOCK / 2 + ROAD_W / 2 + lane);
      v.group.rotation.y = 0;
    } else if (edge === 2) {
      v.group.position.set(BLOCK / 2 - ROAD_W / 2 + lane, 0, offset);
      v.group.rotation.y = -Math.PI / 2;
    } else {
      v.group.position.set(-BLOCK / 2 + ROAD_W / 2 + lane, 0, offset);
      v.group.rotation.y = Math.PI / 2;
    }
    v.group.userData.axis = edge < 2 ? 'x' : 'z';
    v.group.userData.speed = 6 + (i % 3) * 1.5;
    v.group.userData.dir = edge % 2 === 0 ? -1 : 1;
    vehicles.push(v);
    group.add(v.group);
  }

  // Pedestrians: up to ~24, scattered on sidewalks.
  const pCount = Math.min(24, def.outfits.length * 8);
  for (let i = 0; i < pCount; i++) {
    const outfit = def.outfits[i % def.outfits.length] ?? def.outfits[0]!;
    const p = makePedestrian(outfit, era * 100 + i);
    const onSide = i % 4;
    const along = ((i * 23) % 50) - 25;
    const sideOff = BLOCK / 2 - ROAD_W + 1;
    if (onSide === 0) p.group.position.set(along, 0, sideOff);
    else if (onSide === 1) p.group.position.set(along, 0, -sideOff);
    else if (onSide === 2) p.group.position.set(sideOff, 0, along);
    else p.group.position.set(-sideOff, 0, along);
    p.group.rotation.y = Math.random() * Math.PI * 2;
    pedestrians.push(p);
    group.add(p.group);
  }

  // Props: place a few street props around.
  def.props.forEach((propData, idx) => {
    for (let k = 0; k < 2; k++) {
      const pp = makeProp(propData);
      const along = (idx * 19 + k * 31) % 50 - 25;
      const sideOff = BLOCK / 2 - ROAD_W + 3;
      const side = (idx + k) % 4;
      if (side === 0) pp.group.position.set(along, 0, sideOff);
      else if (side === 1) pp.group.position.set(along, 0, -sideOff);
      else if (side === 2) pp.group.position.set(sideOff, 0, along);
      else pp.group.position.set(-sideOff, 0, along);
      if (pp.group.userData.spin) spinners.push(pp.group);
      props.push(pp);
      group.add(pp.group);
    }
  });

  return {
    era,
    group,
    vehicles,
    pedestrians,
    buildings,
    storefronts,
    props,
    spinners,
    dispose: () => {
      buildings.forEach((b) => b.dispose());
      storefronts.forEach((s) => s.dispose());
      vehicles.forEach((v) => v.dispose());
      pedestrians.forEach((p) => p.dispose());
      props.forEach((p) => p.dispose());
    },
  };
}

// NOTE: do not re-export from '.' (index) here to avoid a circular import.
// Consumers import the asset builders and the era-scene builder from './assetBuilder'.
