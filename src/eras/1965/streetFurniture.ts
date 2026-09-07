import { Object3D } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { ERA_1965_PALETTE } from './palette';
import { createBox } from './textures';

/**
 * 1965 Street Furniture Module:
 * 1. Modernist double-lamp street lights (cool fluorescent luminaire heads on curved aluminum arms)
 * 2. Transit bus shelter with glass panels, integrated bench, and schedule poster
 * 3. Slender parking meters along the curbs with dual mechanical heads
 * 4. Classic rotary phone booth with glass enclosure and red/silver trim
 * 5. Mid-century cylindrical perforated metal trash cans
 * 6. High pressure fire hydrants
 */

export interface StreetFurnitureInstance {
  readonly id: string;
  readonly kind: 'lamp_double' | 'bus_shelter' | 'parking_meter' | 'phone_booth' | 'trash_can' | 'hydrant';
  readonly root: Object3D;
}

/**
 * 1. Modernist Double-Lamp Street Light (cool fluorescent dual fixture).
 */
export function createModernistDoubleLamp(): Object3D {
  const root = new Object3D();

  // Slender brushed aluminum central mast (8m tall)
  const pole = createBox(0.2, 7.8, 0.2, ERA_1965_PALETTE.architecture.chromeTrim, 0, 3.9, 0);
  const baseFlange = createBox(0.5, 0.3, 0.5, 0x333333, 0, 0.15, 0);
  root.add(pole, baseFlange);

  // Dual cantilevered curved/angular horizontal arms
  const armL = createBox(1.8, 0.1, 0.1, ERA_1965_PALETTE.architecture.chromeTrim, -0.9, 7.6, 0);
  const armR = createBox(1.8, 0.1, 0.1, ERA_1965_PALETTE.architecture.chromeTrim, 0.9, 7.6, 0);
  root.add(armL, armR);

  // Cool fluorescent luminaire heads (rectangular aerodynamic housings)
  const lampHeadL = createBox(
    1.2,
    0.2,
    0.4,
    ERA_1965_PALETTE.architecture.chromeTrim,
    -1.8,
    7.5,
    0,
  );
  const diffuserL = createBox(1.1, 0.05, 0.35, 0xe0f2fe, -1.8, 7.38, 0);

  const lampHeadR = createBox(
    1.2,
    0.2,
    0.4,
    ERA_1965_PALETTE.architecture.chromeTrim,
    1.8,
    7.5,
    0,
  );
  const diffuserR = createBox(1.1, 0.05, 0.35, 0xe0f2fe, 1.8, 7.38, 0);

  root.add(lampHeadL, diffuserL, lampHeadR, diffuserR);

  return root;
}

/**
 * 2. Transit Bus Shelter with tempered glass panels and bench.
 */
export function createBusShelter(): Object3D {
  const root = new Object3D();

  // Steel tube frame posts (4 vertical columns)
  const post1 = createBox(0.12, 2.8, 0.12, 0x2b2d42, -2.4, 1.4, -0.9);
  const post2 = createBox(0.12, 2.8, 0.12, 0x2b2d42, 2.4, 1.4, -0.9);
  const post3 = createBox(0.12, 2.8, 0.12, 0x2b2d42, -2.4, 1.4, 0.9);
  const post4 = createBox(0.12, 2.8, 0.12, 0x2b2d42, 2.4, 1.4, 0.9);
  root.add(post1, post2, post3, post4);

  // Flat cantilevered roof canopy (enameled turquoise/white)
  const roof = createBox(
    5.2,
    0.15,
    2.2,
    ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
    0,
    2.8,
    0,
  );
  const roofTrim = createBox(
    5.24,
    0.06,
    2.24,
    ERA_1965_PALETTE.architecture.chromeTrim,
    0,
    2.78,
    0,
  );
  root.add(roof, roofTrim);

  // Rear and side tempered glass panels
  const backGlass = createBox(4.6, 2.2, 0.05, 0x70d6ff, 0, 1.3, -0.9);
  const leftGlass = createBox(0.05, 2.2, 1.6, 0x70d6ff, -2.4, 1.3, 0);
  const rightGlass = createBox(0.05, 2.2, 1.6, 0x70d6ff, 2.4, 1.3, 0);
  root.add(backGlass, leftGlass, rightGlass);

  // Wooden slat waiting bench inside
  const bench = createBox(3.6, 0.08, 0.5, 0x85583b, 0, 0.5, -0.5);
  const benchLegL = createBox(0.08, 0.5, 0.45, 0x111111, -1.6, 0.25, -0.5);
  const benchLegR = createBox(0.08, 0.5, 0.45, 0x111111, 1.6, 0.25, -0.5);
  root.add(bench, benchLegL, benchLegR);

  // Bus schedule poster board
  const poster = createBox(
    0.8,
    1.2,
    0.04,
    ERA_1965_PALETTE.architecture.renovatedEnamelYellow,
    2.38,
    1.5,
    0,
  );
  root.add(poster);

  return root;
}

/**
 * 3. Dual-Head Parking Meter.
 */
export function createParkingMeter(): Object3D {
  const root = new Object3D();

  // Slender galvanized steel pole
  const pole = createBox(0.08, 1.1, 0.08, ERA_1965_PALETTE.vehicles.chromeBumper, 0, 0.55, 0);
  const base = createBox(0.25, 0.08, 0.25, 0x333333, 0, 0.04, 0);

  // Dual mechanical meter head (die-cast metal with glass coin windows)
  const head = createBox(0.35, 0.3, 0.18, 0x6c757d, 0, 1.25, 0);
  const windowL = createBox(0.12, 0.1, 0.04, 0xd8f3dc, -0.09, 1.3, 0.08);
  const windowR = createBox(0.12, 0.1, 0.04, 0xd8f3dc, 0.09, 1.3, 0.08);
  const flagL = createBox(0.08, 0.04, 0.02, 0xd90429, -0.09, 1.3, 0.09); // red EXPIRED flag

  root.add(pole, base, head, windowL, windowR, flagL);
  return root;
}

/**
 * 4. Classic 1960s Rotary Phone Booth.
 */
export function createPhoneBooth(): Object3D {
  const root = new Object3D();

  // Aluminum frame corner extrusions
  const col1 = createBox(0.08, 2.3, 0.08, ERA_1965_PALETTE.architecture.chromeTrim, -0.5, 1.15, -0.5);
  const col2 = createBox(0.08, 2.3, 0.08, ERA_1965_PALETTE.architecture.chromeTrim, 0.5, 1.15, -0.5);
  const col3 = createBox(0.08, 2.3, 0.08, ERA_1965_PALETTE.architecture.chromeTrim, -0.5, 1.15, 0.5);
  const col4 = createBox(0.08, 2.3, 0.08, ERA_1965_PALETTE.architecture.chromeTrim, 0.5, 1.15, 0.5);
  root.add(col1, col2, col3, col4);

  // Red/Silver roof cap with illuminated "TELEPHONE" header
  const roof = createBox(1.1, 0.2, 1.1, 0xd90429, 0, 2.35, 0);
  const signHeader = createBox(
    1.0,
    0.15,
    1.02,
    ERA_1965_PALETTE.architecture.signBandWhite,
    0,
    2.2,
    0,
  );
  root.add(roof, signHeader);

  // Glass side & back panels
  const glassBack = createBox(0.9, 1.9, 0.04, 0x70d6ff, 0, 1.05, -0.48);
  const glassLeft = createBox(0.04, 1.9, 0.9, 0x70d6ff, -0.48, 1.05, 0);
  const glassRight = createBox(0.04, 1.9, 0.9, 0x70d6ff, 0.48, 1.05, 0);
  root.add(glassBack, glassLeft, glassRight);

  // Interior black rotary telephone unit on mounting backplate
  const phoneMount = createBox(0.35, 0.6, 0.15, 0x111111, 0, 1.25, -0.38);
  const phoneDial = createBox(0.16, 0.16, 0.05, 0xcccccc, 0, 1.25, -0.28);
  const handset = createBox(0.08, 0.35, 0.08, 0x111111, -0.15, 1.3, -0.28);
  root.add(phoneMount, phoneDial, handset);

  return root;
}

/**
 * 5. Cylindrical Metal Trash Can.
 */
export function createTrashCan(): Object3D {
  const root = new Object3D();

  // Perforated green/blue painted metal body
  const body = createBox(0.55, 0.8, 0.55, 0x2b4c3f, 0, 0.4, 0);
  // Domed swing lid (chrome)
  const lid = createBox(0.58, 0.15, 0.58, ERA_1965_PALETTE.architecture.chromeTrim, 0, 0.85, 0);
  const swingFlap = createBox(0.3, 0.12, 0.05, 0x111111, 0, 0.78, 0.28);
  root.add(body, lid, swingFlap);

  return root;
}

/**
 * 6. Fire Hydrant.
 */
export function createHydrant(): Object3D {
  const root = new Object3D();
  const body = createBox(0.35, 0.75, 0.35, 0xd90429, 0, 0.38, 0);
  const cap = createBox(0.42, 0.12, 0.42, 0xd90429, 0, 0.8, 0);
  const nozzleL = createBox(0.12, 0.12, 0.45, ERA_1965_PALETTE.vehicles.chromeBumper, 0, 0.5, 0);
  root.add(body, cap, nozzleL);
  return root;
}

/**
 * Builds and arranges all 1965 Street Furniture instances across the city block.
 */
export function create1965StreetFurniture(_layout: CityBlockLayout): {
  items: StreetFurnitureInstance[];
  root: Object3D;
} {
  const root = new Object3D();
  const items: StreetFurnitureInstance[] = [];

  function addItem(
    inst: Object3D,
    kind: StreetFurnitureInstance['kind'],
    x: number,
    z: number,
    rotY = 0,
  ): void {
    inst.position.set(x, 0, z);
    inst.rotation.y = rotY;
    root.add(inst);
    items.push({
      id: `sf-1965-${kind}-${items.length}`,
      kind,
      root: inst,
    });
  }

  // Modernist double lamps on north and south sidewalks
  const lampX = [-24, -8, 8, 24];
  for (const lx of lampX) {
    // North sidewalk (z ~ -31)
    const lampNorth = createModernistDoubleLamp();
    addItem(lampNorth, 'lamp_double', lx, -31.5, 0);

    // South sidewalk (z ~ 31)
    const lampSouth = createModernistDoubleLamp();
    addItem(lampSouth, 'lamp_double', lx, 31.5, Math.PI);
  }

  // East & West sidewalks double lamps
  const lampZ = [-18, 0, 18];
  for (const lz of lampZ) {
    const lampWest = createModernistDoubleLamp();
    addItem(lampWest, 'lamp_double', -31.5, lz, Math.PI / 2);

    const lampEast = createModernistDoubleLamp();
    addItem(lampEast, 'lamp_double', 31.5, lz, -Math.PI / 2);
  }

  // Bus Shelter on South sidewalk near intersection
  const busShelter = createBusShelter();
  addItem(busShelter, 'bus_shelter', 14.0, 31.5, 0);

  // Rotary Phone Booths (one on North sidewalk near diner, one on South-west corner)
  const phone1 = createPhoneBooth();
  addItem(phone1, 'phone_booth', -26.0, -31.5, 0);

  const phone2 = createPhoneBooth();
  addItem(phone2, 'phone_booth', -20.0, 31.5, Math.PI);

  // Parking meters along curb line
  const meterSpots = [-20, -14, -6, 2, 10, 18, 26];
  for (const mx of meterSpots) {
    const meterN = createParkingMeter();
    addItem(meterN, 'parking_meter', mx, -32.8, 0);

    const meterS = createParkingMeter();
    addItem(meterS, 'parking_meter', mx, 32.8, Math.PI);
  }

  // Trash cans near busy storefronts and corners
  const trashSpots = [
    { x: -28.0, z: -31.5 },
    { x: -10.0, z: -31.5 },
    { x: 10.0, z: -31.5 },
    { x: -28.0, z: 31.5 },
    { x: 8.0, z: 31.5 },
  ];
  for (const ts of trashSpots) {
    const can = createTrashCan();
    addItem(can, 'trash_can', ts.x, ts.z, 0);
  }

  // Hydrants near corners
  const hydrant1 = createHydrant();
  addItem(hydrant1, 'hydrant', -29.0, -32.8, 0);

  const hydrant2 = createHydrant();
  addItem(hydrant2, 'hydrant', 29.0, 32.8, 0);

  return { items, root };
}
