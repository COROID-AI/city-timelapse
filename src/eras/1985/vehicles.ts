import { Object3D } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { createColoredBox } from './textures';
import { PALETTE_1985 } from './palette';

/**
 * 1985 Era Vehicles
 *
 * Requirements:
 * - Boxy 1980s sedans & station wagons (angular body lines, chrome/black trim, rectangular headlamps).
 * - Box van (commercial cube delivery truck making delivery stops).
 * - Yellow taxi cab (boxy 80s sedan with illuminated roof taxi medallion).
 * - Motorcycle (1980s street bike).
 * - Denser traffic simulation with moving traffic along road loops and parked curbside cars.
 */

export interface VehicleInstance {
  readonly root: Object3D;
  readonly type: 'sedan' | 'wagon' | 'taxi' | 'van' | 'motorcycle';
  update(dt: number): void;
}

export interface Era1985VehicleGroup {
  readonly root: Object3D;
  readonly vehicles: readonly VehicleInstance[];
  readonly parkedVehicles: readonly Object3D[];
  update(dt: number): void;
}

/** Builds an angular 1980s sedan */
export function createBoxySedan(bodyColor = '#2c3e50'): Object3D {
  const root = new Object3D();
  const trimColor = '#1c1d1f';
  const glassColor = '#4a6572';
  const chromeColor = PALETTE_1985.materials.chromeMetal;

  // Lower chassis / body
  const body = createColoredBox(1.9, 0.65, 4.4, bodyColor, { x: 0, y: 0.55, z: 0 });
  // Boxy cabin / roof
  const cabin = createColoredBox(1.65, 0.65, 2.2, bodyColor, { x: 0, y: 1.15, z: -0.2 });
  // Glass windshield, rear window, side windows
  const glassF = createColoredBox(1.5, 0.55, 0.1, glassColor, { x: 0, y: 1.15, z: 0.92 });
  const glassB = createColoredBox(1.5, 0.55, 0.1, glassColor, { x: 0, y: 1.15, z: -1.32 });
  const glassSides = createColoredBox(1.68, 0.45, 2.0, glassColor, { x: 0, y: 1.15, z: -0.2 });
  root.add(body, cabin, glassF, glassB, glassSides);

  // Black plastic / chrome front and rear bumpers
  const bumperF = createColoredBox(1.95, 0.25, 0.35, trimColor, { x: 0, y: 0.45, z: 2.25 });
  const bumperB = createColoredBox(1.95, 0.25, 0.35, trimColor, { x: 0, y: 0.45, z: -2.25 });
  const chromeTrimF = createColoredBox(1.8, 0.08, 0.37, chromeColor, { x: 0, y: 0.55, z: 2.26 });
  root.add(bumperF, bumperB, chromeTrimF);

  // Rectangular 80s headlights & amber turn indicators
  const lightL = createColoredBox(0.4, 0.18, 0.05, '#fffae0', { x: -0.65, y: 0.62, z: 2.22 });
  const lightR = createColoredBox(0.4, 0.18, 0.05, '#fffae0', { x: 0.65, y: 0.62, z: 2.22 });
  const turnL = createColoredBox(0.18, 0.18, 0.05, '#ff9900', { x: -0.88, y: 0.62, z: 2.22 });
  const turnR = createColoredBox(0.18, 0.18, 0.05, '#ff9900', { x: 0.88, y: 0.62, z: 2.22 });
  // Rectangular taillights
  const tailL = createColoredBox(0.5, 0.2, 0.05, '#cc1111', { x: -0.65, y: 0.62, z: -2.22 });
  const tailR = createColoredBox(0.5, 0.2, 0.05, '#cc1111', { x: 0.65, y: 0.62, z: -2.22 });
  root.add(lightL, lightR, turnL, turnR, tailL, tailR);

  // 4 Wheels
  const wheelGeomPositions = [
    { x: -0.9, z: 1.3 },
    { x: 0.9, z: 1.3 },
    { x: -0.9, z: -1.3 },
    { x: 0.9, z: -1.3 },
  ];
  wheelGeomPositions.forEach((pos) => {
    const tire = createColoredBox(0.28, 0.55, 0.55, '#18191a', { x: pos.x, y: 0.28, z: pos.z });
    const cap = createColoredBox(0.3, 0.28, 0.28, chromeColor, { x: pos.x * 1.02, y: 0.28, z: pos.z });
    root.add(tire, cap);
  });

  return root;
}

/** Builds an 80s Station Wagon with faux woodgrain paneling */
export function createStationWagon(): Object3D {
  const root = new Object3D();
  const bodyColor = '#8c593b';
  const woodPanelColor = '#5c381e';
  const glassColor = '#4a6572';

  // Lower chassis
  const body = createColoredBox(1.95, 0.7, 4.8, bodyColor, { x: 0, y: 0.58, z: 0 });
  // Long wagon greenhouse / roof
  const cabin = createColoredBox(1.7, 0.68, 3.2, bodyColor, { x: 0, y: 1.2, z: -0.6 });
  // Glass wrap
  const glassF = createColoredBox(1.55, 0.55, 0.1, glassColor, { x: 0, y: 1.2, z: 1.02 });
  const glassB = createColoredBox(1.55, 0.55, 0.1, glassColor, { x: 0, y: 1.2, z: -2.22 });
  const glassSides = createColoredBox(1.72, 0.45, 3.0, glassColor, { x: 0, y: 1.2, z: -0.6 });
  root.add(body, cabin, glassF, glassB, glassSides);

  // Woodgrain side trim panels
  const woodL = createColoredBox(0.04, 0.4, 4.0, woodPanelColor, { x: -0.99, y: 0.65, z: -0.1 });
  const woodR = createColoredBox(0.04, 0.4, 4.0, woodPanelColor, { x: 0.99, y: 0.65, z: -0.1 });
  root.add(woodL, woodR);

  // Roof rack with luggage rails
  const railL = createColoredBox(0.06, 0.1, 2.8, '#c2c8cf', { x: -0.65, y: 1.6, z: -0.6 });
  const railR = createColoredBox(0.06, 0.1, 2.8, '#c2c8cf', { x: 0.65, y: 1.6, z: -0.6 });
  root.add(railL, railR);

  // Bumpers & lights
  const bumperF = createColoredBox(2.0, 0.28, 0.35, '#1e2024', { x: 0, y: 0.48, z: 2.45 });
  const bumperB = createColoredBox(2.0, 0.28, 0.35, '#1e2024', { x: 0, y: 0.48, z: -2.45 });
  const lightL = createColoredBox(0.42, 0.2, 0.05, '#fffae0', { x: -0.68, y: 0.65, z: 2.42 });
  const lightR = createColoredBox(0.42, 0.2, 0.05, '#fffae0', { x: 0.68, y: 0.65, z: 2.42 });
  const tailL = createColoredBox(0.4, 0.3, 0.05, '#cc1111', { x: -0.7, y: 0.65, z: -2.42 });
  const tailR = createColoredBox(0.4, 0.3, 0.05, '#cc1111', { x: 0.7, y: 0.65, z: -2.42 });
  root.add(bumperF, bumperB, lightL, lightR, tailL, tailR);

  // Wheels
  [-1.5, 1.4].forEach((z) => {
    [-0.92, 0.92].forEach((x) => {
      const tire = createColoredBox(0.28, 0.58, 0.58, '#18191a', { x, y: 0.29, z });
      root.add(tire);
    });
  });

  return root;
}

/** Builds an iconic 1980s Yellow Taxi Cab */
export function createYellowTaxiCab(): Object3D {
  const root = new Object3D();
  const taxi = createBoxySedan(PALETTE_1985.materials.taxiYellow);
  root.add(taxi);

  // Roof Taxi Sign / Medallion Light
  const signBase = createColoredBox(0.7, 0.1, 0.3, '#1c1c1c', { x: 0, y: 1.55, z: -0.2 });
  const signGlow = createColoredBox(0.65, 0.22, 0.25, '#fff066', { x: 0, y: 1.7, z: -0.2 });
  const taxiLetters = createColoredBox(0.4, 0.1, 0.27, '#111111', { x: 0, y: 1.7, z: -0.2 });
  root.add(signBase, signGlow, taxiLetters);

  // Checker side stripe
  const checkerL = createColoredBox(0.04, 0.12, 3.2, '#111111', { x: -0.96, y: 0.85, z: 0 });
  const checkerR = createColoredBox(0.04, 0.12, 3.2, '#111111', { x: 0.96, y: 0.85, z: 0 });
  root.add(checkerL, checkerR);

  return root;
}

/** Builds a 1980s Box Van / Delivery truck */
export function createBoxVan(): Object3D {
  const root = new Object3D();
  const cabColor = '#d9dcd6';
  const boxColor = '#3a506b';

  // Front cab
  const cab = createColoredBox(2.2, 1.6, 2.0, cabColor, { x: 0, y: 1.1, z: 1.8 });
  const windshield = createColoredBox(1.9, 0.7, 0.1, '#4a6572', { x: 0, y: 1.4, z: 2.82 });
  root.add(cab, windshield);

  // Large cargo box
  const cargoBox = createColoredBox(2.35, 2.4, 4.2, boxColor, { x: 0, y: 1.6, z: -1.2 });
  const rollDoor = createColoredBox(2.0, 2.0, 0.06, '#8e9aaf', { x: 0, y: 1.4, z: -3.32 });
  root.add(cargoBox, rollDoor);

  // Chassis / bumper
  const bumper = createColoredBox(2.25, 0.35, 0.4, '#1c1d1f', { x: 0, y: 0.45, z: 2.9 });
  const lightL = createColoredBox(0.4, 0.25, 0.05, '#fffae0', { x: -0.8, y: 0.65, z: 3.12 });
  const lightR = createColoredBox(0.4, 0.25, 0.05, '#fffae0', { x: 0.8, y: 0.65, z: 3.12 });
  root.add(bumper, lightL, lightR);

  // 6 Wheels (dual rear)
  const wheelZ = [2.0, -1.2, -2.4];
  wheelZ.forEach((z) => {
    [-1.05, 1.05].forEach((x) => {
      const tire = createColoredBox(0.35, 0.75, 0.75, '#18191a', { x, y: 0.38, z });
      root.add(tire);
    });
  });

  return root;
}

/** Builds an 80s Sport Motorcycle */
export function createMotorcycle(): Object3D {
  const root = new Object3D();
  const fairingColor = '#e63946';

  // Frame & engine block
  const frame = createColoredBox(0.4, 0.6, 1.4, '#2b2d42', { x: 0, y: 0.55, z: 0 });
  const engine = createColoredBox(0.35, 0.35, 0.6, '#8d99ae', { x: 0, y: 0.4, z: 0 });
  root.add(frame, engine);

  // 80s Angular fairing & seat
  const fairing = createColoredBox(0.5, 0.5, 0.7, fairingColor, { x: 0, y: 0.8, z: 0.5 });
  const windscreen = createColoredBox(0.35, 0.3, 0.05, '#111111', { x: 0, y: 1.1, z: 0.7 });
  const seat = createColoredBox(0.35, 0.15, 0.7, '#111111', { x: 0, y: 0.85, z: -0.3 });
  root.add(fairing, windscreen, seat);

  // Square Headlight
  const headlight = createColoredBox(0.22, 0.18, 0.05, '#fffae0', { x: 0, y: 0.82, z: 0.86 });
  root.add(headlight);

  // Wheels
  const frontWheel = createColoredBox(0.15, 0.6, 0.6, '#18191a', { x: 0, y: 0.3, z: 0.9 });
  const rearWheel = createColoredBox(0.18, 0.6, 0.6, '#18191a', { x: 0, y: 0.3, z: -0.8 });
  root.add(frontWheel, rearWheel);

  return root;
}

/**
 * Creates dynamic 1985 traffic and parked vehicles
 */
export function create1985Vehicles(layout: CityBlockLayout): Era1985VehicleGroup {
  const root = new Object3D();
  const activeVehicles: VehicleInstance[] = [];
  const parkedVehicles: Object3D[] = [];

  // Define driving loop around the block perimeter
  const pad = 3.5;
  const loop = [
    { x: layout.bounds.minX + pad, z: layout.bounds.minZ + pad },
    { x: layout.bounds.maxX - pad, z: layout.bounds.minZ + pad },
    { x: layout.bounds.maxX - pad, z: layout.bounds.maxZ - pad },
    { x: layout.bounds.minX + pad, z: layout.bounds.maxZ - pad },
  ];

  function getLoopPoint(dist: number): { x: number; z: number; angle: number } {
    const lengths = [
      Math.hypot(loop[1].x - loop[0].x, loop[1].z - loop[0].z),
      Math.hypot(loop[2].x - loop[1].x, loop[2].z - loop[1].z),
      Math.hypot(loop[3].x - loop[2].x, loop[3].z - loop[2].z),
      Math.hypot(loop[0].x - loop[3].x, loop[0].z - loop[3].z),
    ];
    const total = lengths.reduce((a, b) => a + b, 0);
    let d = ((dist % total) + total) % total;

    for (let i = 0; i < 4; i++) {
      if (d <= lengths[i]) {
        const frac = d / lengths[i];
        const p1 = loop[i];
        const p2 = loop[(i + 1) % 4];
        const x = p1.x + (p2.x - p1.x) * frac;
        const z = p1.z + (p2.z - p1.z) * frac;
        const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
        return { x, z, angle };
      }
      d -= lengths[i];
    }
    return { x: loop[0].x, z: loop[0].z, angle: 0 };
  }

  // 1. Moving Vehicles (Denser traffic with delivery stops)
  const vehicleDefs = [
    { type: 'taxi' as const, speed: 11, offset: 0, factory: createYellowTaxiCab },
    { type: 'sedan' as const, speed: 9.5, offset: 35, factory: () => createBoxySedan('#3a5a40') },
    { type: 'wagon' as const, speed: 8.5, offset: 70, factory: createStationWagon },
    { type: 'van' as const, speed: 7.0, offset: 110, factory: createBoxVan },
    { type: 'motorcycle' as const, speed: 13.0, offset: 145, factory: createMotorcycle },
    { type: 'taxi' as const, speed: 10.5, offset: 180, factory: createYellowTaxiCab },
    { type: 'sedan' as const, speed: 9.0, offset: 215, factory: () => createBoxySedan('#7f1d1d') },
  ];

  vehicleDefs.forEach((def) => {
    const mesh = def.factory();
    root.add(mesh);
    let currentDist = def.offset;

    const instance: VehicleInstance = {
      root: mesh,
      type: def.type,
      update(dt: number) {
        currentDist += def.speed * dt;
        const pt = getLoopPoint(currentDist);
        mesh.position.set(pt.x, 0, pt.z);
        mesh.rotation.y = pt.angle;
      },
    };
    instance.update(0);
    activeVehicles.push(instance);
  });

  // 2. Parked Vehicles (Parking lot & curbside delivery stop)
  // Parked in Parking Lot (Lot 4)
  const lot4Anchor = layout.lots[4];
  const parked1 = createBoxySedan('#475569');
  parked1.position.set(lot4Anchor.center.x - 2, 0, lot4Anchor.center.z - 4);
  parked1.rotation.y = Math.PI / 2;
  const parked2 = createStationWagon();
  parked2.position.set(lot4Anchor.center.x + 2, 0, lot4Anchor.center.z + 2);
  parked2.rotation.y = -Math.PI / 2;
  const parked3 = createYellowTaxiCab();
  parked3.position.set(lot4Anchor.center.x - 2, 0, lot4Anchor.center.z + 5);
  parked3.rotation.y = Math.PI / 2;
  root.add(parked1, parked2, parked3);
  parkedVehicles.push(parked1, parked2, parked3);

  // Delivery box van parked curbside near Deli / Market
  const deliveryVan = createBoxVan();
  deliveryVan.position.set(layout.bounds.minX + 8, 0, layout.crossStreet.rect.origin.z + 2);
  deliveryVan.rotation.y = 0;
  root.add(deliveryVan);
  parkedVehicles.push(deliveryVan);

  return {
    root,
    vehicles: activeVehicles,
    parkedVehicles,
    update(dt: number) {
      for (const v of activeVehicles) {
        v.update(dt);
      }
    },
  };
}
