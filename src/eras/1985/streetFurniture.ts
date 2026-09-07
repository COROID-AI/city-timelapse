import { Object3D } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { createColoredBox } from './textures';
import { PALETTE_1985 } from './palette';

/**
 * 1985 Era Street Furniture
 *
 * Requirements:
 * - Modern cobra-head sodium vapor street lights (distinct curved mast arm, high-pressure sodium orange night glow).
 * - Bus stop with schedule sign (glass/steel transit shelter, bench, timetable map).
 * - Metal trash cans (ribbed galvanized/painted steel municipal bins).
 * - Phone booth (aluminum & glass payphone booth with illuminated blue/white top header).
 * - Parking meters retained along curbsides.
 * - Fire hydrants and newspaper coin-op vending boxes.
 */

export interface Era1985StreetFurnitureGroup {
  readonly root: Object3D;
  readonly cobraLights: readonly Object3D[];
  readonly busStop: Object3D;
  readonly phoneBooth: Object3D;
  readonly trashCans: readonly Object3D[];
  readonly parkingMeters: readonly Object3D[];
  update(timeOfDay: number): void;
}

/** Builds an iconic 1980s Cobra-Head Sodium Vapor Streetlight */
export function createCobraHeadStreetLight(glowColor = PALETTE_1985.night.sodiumGlow): Object3D {
  const root = new Object3D();
  const poleColor = '#4a5059';

  // Vertical steel pole (7.5m high)
  const pole = createColoredBox(0.2, 7.5, 0.2, poleColor, { x: 0, y: 3.75, z: 0 });
  root.add(pole);

  // Curved mast arm extending out over the street
  const arm = createColoredBox(0.15, 0.15, 2.2, poleColor, { x: 0, y: 7.4, z: 1.0 });
  // Diagonal brace
  const brace = createColoredBox(0.1, 0.8, 0.8, poleColor, { x: 0, y: 7.0, z: 0.4 }, { x: 0.7 });
  root.add(arm, brace);

  // Cobra-head aerodynamic luminaire fixture housing
  const cobraHousing = createColoredBox(0.4, 0.22, 0.85, poleColor, { x: 0, y: 7.35, z: 2.1 });
  // Orange high-pressure sodium vapor lamp lens
  const sodiumLens = createColoredBox(0.35, 0.08, 0.7, glowColor, { x: 0, y: 7.22, z: 2.1 });
  root.add(cobraHousing, sodiumLens);

  return root;
}

/** Builds a 1980s Transit Bus Stop Shelter with timetable schedule sign */
export function createBusStopShelter(): Object3D {
  const root = new Object3D();
  const frameColor = '#2b303a';
  const glassColor = '#5c768a';

  // Steel framework
  const canopy = createColoredBox(4.2, 0.15, 2.2, frameColor, { x: 0, y: 2.6, z: 0 });
  root.add(canopy);

  // 4 Support corner pillars
  const pillars = [
    { x: -1.9, z: -0.9 },
    { x: 1.9, z: -0.9 },
    { x: -1.9, z: 0.9 },
    { x: 1.9, z: 0.9 },
  ];
  pillars.forEach((p) => {
    const post = createColoredBox(0.12, 2.6, 0.12, frameColor, { x: p.x, y: 1.3, z: p.z });
    root.add(post);
  });

  // Glass wind-break back and side panels
  const backGlass = createColoredBox(3.6, 2.1, 0.06, glassColor, { x: 0, y: 1.3, z: -0.9 });
  const sideGlass = createColoredBox(0.06, 2.1, 1.6, glassColor, { x: 1.9, y: 1.3, z: 0 });
  root.add(backGlass, sideGlass);

  // Wooden commuter waiting bench
  const benchSeat = createColoredBox(3.2, 0.1, 0.5, '#78543d', { x: 0, y: 0.48, z: -0.5 });
  const benchLegL = createColoredBox(0.1, 0.45, 0.45, '#1e2124', { x: -1.4, y: 0.24, z: -0.5 });
  const benchLegR = createColoredBox(0.1, 0.45, 0.45, '#1e2124', { x: 1.4, y: 0.24, z: -0.5 });
  root.add(benchSeat, benchLegL, benchLegR);

  // Bus Route Map & Timetable Schedule Sign
  const signPillar = createColoredBox(0.1, 3.2, 0.1, frameColor, { x: -2.3, y: 1.6, z: 0.8 });
  const signBoard = createColoredBox(0.6, 0.9, 0.06, '#1d4ed8', { x: -2.3, y: 2.6, z: 0.8 });
  const scheduleWhite = createColoredBox(0.5, 0.4, 0.08, '#ffffff', { x: -2.3, y: 2.4, z: 0.8 });
  root.add(signPillar, signBoard, scheduleWhite);

  return root;
}

/** Builds an aluminum & glass 1980s Payphone Booth */
export function createPhoneBooth(): Object3D {
  const root = new Object3D();
  const frameColor = '#8e9aaf';
  const glassColor = '#66879e';

  // Roof cap with illuminated "TELEPHONE" header
  const roof = createColoredBox(1.1, 0.3, 1.1, '#1e3a8a', { x: 0, y: 2.35, z: 0 });
  const phoneSign = createColoredBox(0.9, 0.18, 1.12, '#ffffff', { x: 0, y: 2.35, z: 0 });
  root.add(roof, phoneSign);

  // 4 Corner Aluminum uprights
  [
    { x: -0.48, z: -0.48 },
    { x: 0.48, z: -0.48 },
    { x: -0.48, z: 0.48 },
    { x: 0.48, z: 0.48 },
  ].forEach((pos) => {
    const post = createColoredBox(0.08, 2.2, 0.08, frameColor, { x: pos.x, y: 1.1, z: pos.z });
    root.add(post);
  });

  // 3 Glass side panels
  const glassBack = createColoredBox(0.9, 1.7, 0.04, glassColor, { x: 0, y: 1.25, z: -0.48 });
  const glassL = createColoredBox(0.04, 1.7, 0.9, glassColor, { x: -0.48, y: 1.25, z: 0 });
  const glassR = createColoredBox(0.04, 1.7, 0.9, glassColor, { x: 0.48, y: 1.25, z: 0 });
  root.add(glassBack, glassL, glassR);

  // Payphone metal unit on back wall (coin slot, dial pad, handset)
  const phoneBox = createColoredBox(0.35, 0.6, 0.22, '#212529', { x: 0, y: 1.35, z: -0.32 });
  const handset = createColoredBox(0.1, 0.35, 0.1, '#111111', { x: -0.12, y: 1.35, z: -0.2 });
  root.add(phoneBox, handset);

  return root;
}

/** Builds a 1980s municipal ribbed metal trash can */
export function createMetalTrashCan(): Object3D {
  const root = new Object3D();
  const metalColor = '#3e444c';

  // Cylindrical body (faceted approximation)
  const can1 = createColoredBox(0.65, 0.9, 0.65, metalColor, { x: 0, y: 0.45, z: 0 });
  const can2 = createColoredBox(
    0.65,
    0.9,
    0.65,
    metalColor,
    { x: 0, y: 0.45, z: 0 },
    { y: Math.PI / 4 },
  );
  // Domed lid with swing door
  const lid = createColoredBox(0.72, 0.2, 0.72, '#282b30', { x: 0, y: 0.98, z: 0 });
  root.add(can1, can2, lid);

  return root;
}

/** Builds a mechanical curbside parking meter */
export function createParkingMeter(): Object3D {
  const root = new Object3D();
  // Pole
  const pole = createColoredBox(0.08, 1.1, 0.08, '#59606d', { x: 0, y: 0.55, z: 0 });
  // Meter head with coin slot and red violation flag window
  const head = createColoredBox(0.24, 0.35, 0.18, '#828a99', { x: 0, y: 1.2, z: 0 });
  const meterGlass = createColoredBox(0.18, 0.14, 0.2, '#cc2222', { x: 0, y: 1.25, z: 0 });
  root.add(pole, head, meterGlass);
  return root;
}

/** Builds classic yellow & red fire hydrants */
export function createHydrant(): Object3D {
  const root = new Object3D();
  const body = createColoredBox(0.3, 0.75, 0.3, '#ffcc00', { x: 0, y: 0.375, z: 0 });
  const topCap = createColoredBox(0.36, 0.15, 0.36, '#cc1111', { x: 0, y: 0.8, z: 0 });
  const nozzleL = createColoredBox(0.45, 0.15, 0.15, '#cc1111', { x: 0, y: 0.45, z: 0 });
  root.add(body, topCap, nozzleL);
  return root;
}

/** Builds coin-operated newspaper vending machines (e.g. USA Today blue box) */
export function createNewspaperVendingBox(boxColor = '#1d4ed8'): Object3D {
  const root = new Object3D();
  const box = createColoredBox(0.55, 1.1, 0.5, boxColor, { x: 0, y: 0.55, z: 0 });
  const windowGlass = createColoredBox(0.42, 0.35, 0.05, '#5c768a', { x: 0, y: 0.75, z: 0.26 });
  const handle = createColoredBox(0.25, 0.06, 0.1, '#c2c8cf', { x: 0, y: 0.95, z: 0.28 });
  root.add(box, windowGlass, handle);
  return root;
}

/**
 * Creates all 1985 Street Furniture and anchors them along the sidewalks and intersections
 */
export function create1985StreetFurniture(_layout: CityBlockLayout): Era1985StreetFurnitureGroup {
  const root = new Object3D();
  const cobraLights: Object3D[] = [];
  const trashCans: Object3D[] = [];
  const parkingMeters: Object3D[] = [];

  // 1. Cobra-Head Sodium Vapor Lights (8 streetlights spaced around the perimeter)
  const lightLocations = [
    { x: -28, z: -32, rotY: 0 },
    { x: 0, z: -32, rotY: 0 },
    { x: 28, z: -32, rotY: 0 },
    { x: 32, z: 0, rotY: -Math.PI / 2 },
    { x: 28, z: 32, rotY: Math.PI },
    { x: 0, z: 32, rotY: Math.PI },
    { x: -28, z: 32, rotY: Math.PI },
    { x: -32, z: 0, rotY: Math.PI / 2 },
  ];

  lightLocations.forEach((loc) => {
    const light = createCobraHeadStreetLight();
    light.position.set(loc.x, 0, loc.z);
    light.rotation.y = loc.rotY;
    root.add(light);
    cobraLights.push(light);
  });

  // 2. Bus Stop Shelter (Near south-east intersection sidewalk)
  const busStop = createBusStopShelter();
  busStop.position.set(22, 0, 31);
  busStop.rotation.y = Math.PI;
  root.add(busStop);

  // 3. 1980s Phone Booth (Placed on west sidewalk near corner)
  const phoneBooth = createPhoneBooth();
  phoneBooth.position.set(-31, 0, -18);
  phoneBooth.rotation.y = Math.PI / 2;
  root.add(phoneBooth);

  // 4. Metal Trash Cans (4 placed at sidewalk corners)
  const trashCoords = [
    { x: -29, z: -29 },
    { x: 29, z: -29 },
    { x: -29, z: 29 },
    { x: 29, z: 29 },
  ];
  trashCoords.forEach((tc) => {
    const can = createMetalTrashCan();
    can.position.set(tc.x, 0, tc.z);
    root.add(can);
    trashCans.push(can);
  });

  // 5. Retained Parking Meters along curbs
  const meterCoords = [
    { x: -20, z: -31 },
    { x: -10, z: -31 },
    { x: 10, z: -31 },
    { x: 20, z: -31 },
    { x: -20, z: 31 },
    { x: -10, z: 31 },
    { x: 10, z: 31 },
  ];
  meterCoords.forEach((mc) => {
    const meter = createParkingMeter();
    meter.position.set(mc.x, 0, mc.z);
    root.add(meter);
    parkingMeters.push(meter);
  });

  // 6. Hydrants & Newspaper Vending Boxes
  const hydrant = createHydrant();
  hydrant.position.set(28, 0, 27);
  root.add(hydrant);

  const newsBox1 = createNewspaperVendingBox('#1d4ed8');
  newsBox1.position.set(-27, 0, 31);
  newsBox1.rotation.y = Math.PI;
  const newsBox2 = createNewspaperVendingBox('#dc2626');
  newsBox2.position.set(-26.2, 0, 31);
  newsBox2.rotation.y = Math.PI;
  root.add(newsBox1, newsBox2);

  return {
    root,
    cobraLights,
    busStop,
    phoneBooth,
    trashCans,
    parkingMeters,
    update(_timeOfDay: number) {
      // Dynamic updates if needed
    },
  };
}
