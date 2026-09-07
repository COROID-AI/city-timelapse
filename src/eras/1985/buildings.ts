import { Object3D } from 'three';
import { LotAnchor } from '../../layout/lotAnchors';
import { createColoredBox, createFireEscape, createRooftopHVAC, createWaterTower } from './textures';
import { PALETTE_1985 } from './palette';

/**
 * 1985 Era Buildings
 *
 * Requirements:
 * - The block's first true high-rise rises over the low-rise neighbors
 *   (glass/steel office tower with mirrored skin replacing older 60s renovations).
 * - Brick walk-ups weathered with grime, fire escapes retained.
 * - Rooftop water tower and HVAC units.
 * - Parking lot infill where older buildings were demolished (with parked cars & stalls).
 * - Placed accurately on the 10 layout lot anchors.
 */

export interface Era1985BuildingGroup {
  readonly root: Object3D;
  readonly highRiseMesh: Object3D;
  readonly buildings: readonly Object3D[];
  readonly parkingLot: Object3D;
}

/** Builds the mirrored glass & steel 1985 high-rise tower */
export function createMirroredHighRise(anchor: LotAnchor, height = 48): Object3D {
  const root = new Object3D();
  const w = anchor.width - 2;
  const d = anchor.depth - 2;

  // Steel/concrete base podium (floors 1-2)
  const podiumH = 7;
  const podium = createColoredBox(w, podiumH, d, '#2a313d', {
    x: 0,
    y: podiumH / 2,
    z: 0,
  });
  root.add(podium);

  // Glass revolving door & lobby framing
  const lobbyGlass = createColoredBox(w * 0.7, 3.8, 0.2, '#508dae', {
    x: 0,
    y: 1.9,
    z: d / 2 + 0.05,
  });
  const lobbyFrame = createColoredBox(w * 0.75, 4.2, 0.3, '#1e242b', {
    x: 0,
    y: 2.1,
    z: d / 2,
  });
  root.add(lobbyGlass, lobbyFrame);

  // Main reflective mirrored glass shaft
  const shaftH = height - podiumH - 5;
  const shaftW = w * 0.92;
  const shaftD = d * 0.92;
  const shaftY = podiumH + shaftH / 2;

  // Main cyan/blue mirrored curtain wall
  const curtainWall = createColoredBox(
    shaftW,
    shaftH,
    shaftD,
    PALETTE_1985.materials.glassTower,
    { x: 0, y: shaftY, z: 0 },
  );
  root.add(curtainWall);

  // Horizontal steel spandrel / floor bands
  const floorCount = 12;
  const floorStep = shaftH / floorCount;
  for (let f = 1; f < floorCount; f++) {
    const spandrel = createColoredBox(
      shaftW + 0.1,
      0.45,
      shaftD + 0.1,
      '#1b2834',
      { x: 0, y: podiumH + f * floorStep, z: 0 },
    );
    root.add(spandrel);
  }

  // Vertical steel mullions
  const mullionCols = 6;
  const mullionSpacing = shaftW / mullionCols;
  for (let m = 0; m <= mullionCols; m++) {
    const mx = -shaftW / 2 + m * mullionSpacing;
    const mullionF = createColoredBox(0.18, shaftH, 0.2, '#15202b', {
      x: mx,
      y: shaftY,
      z: shaftD / 2 + 0.05,
    });
    const mullionB = createColoredBox(0.18, shaftH, 0.2, '#15202b', {
      x: mx,
      y: shaftY,
      z: -shaftD / 2 - 0.05,
    });
    root.add(mullionF, mullionB);
  }

  // Upper setback / Penthouse crown
  const crownH = 5;
  const crownW = shaftW * 0.75;
  const crownD = shaftD * 0.75;
  const crownY = podiumH + shaftH + crownH / 2;
  const crown = createColoredBox(crownW, crownH, crownD, '#253e54', {
    x: 0,
    y: crownY,
    z: 0,
  });
  root.add(crown);

  // Rooftop communications mast / antenna
  const antenna = createColoredBox(0.3, 9, 0.3, '#c2c8cf', {
    x: 0,
    y: podiumH + shaftH + crownH + 4.5,
    z: 0,
  });
  const beacon = createColoredBox(0.5, 0.5, 0.5, '#ff2222', {
    x: 0,
    y: podiumH + shaftH + crownH + 9,
    z: 0,
  });
  root.add(antenna, beacon);

  // Rooftop HVAC arrays on high-rise
  const hvac1 = createRooftopHVAC(3.8, 1.8, 2.4);
  hvac1.position.set(-crownW * 0.25, podiumH + shaftH, -crownD * 0.2);
  const hvac2 = createRooftopHVAC(3.2, 1.6, 2.0);
  hvac2.position.set(crownW * 0.25, podiumH + shaftH, crownD * 0.2);
  root.add(hvac1, hvac2);

  return root;
}

/** Builds a grimy weathered brick tenement with fire escape and rooftop water tower */
export function createGrimyBrickWalkup(
  anchor: LotAnchor,
  floors = 4,
  options?: { hasWaterTower?: boolean; hasFireEscape?: boolean; brickTint?: string },
): Object3D {
  const root = new Object3D();
  const floorH = 3.6;
  const totalH = floors * floorH;
  const w = anchor.width - 2;
  const d = anchor.depth - 2;
  const brickColor = options?.brickTint ?? PALETTE_1985.materials.weatheredBrick;
  const darkGrime = PALETTE_1985.materials.grimyBrickDark;

  // Main brick body
  const body = createColoredBox(w, totalH, d, brickColor, {
    x: 0,
    y: totalH / 2,
    z: 0,
  });
  root.add(body);

  // Weathered grime base / lower water-stained masonry
  const grimeBase = createColoredBox(w + 0.05, 1.8, d + 0.05, darkGrime, {
    x: 0,
    y: 0.9,
    z: 0,
  });
  root.add(grimeBase);

  // Roof cornice with dark stone coping
  const cornice = createColoredBox(w + 0.4, 0.6, d + 0.4, '#2c221e', {
    x: 0,
    y: totalH + 0.3,
    z: 0,
  });
  root.add(cornice);

  // Window bays (recessed dark glass with concrete lintels and sills)
  const cols = 3;
  const colSpacing = w / (cols + 1);
  for (let f = 1; f <= floors; f++) {
    const wy = (f - 0.5) * floorH;
    for (let c = 1; c <= cols; c++) {
      const wx = -w / 2 + c * colSpacing;
      // Front window
      const winF = createColoredBox(1.2, 1.8, 0.1, '#1b2228', {
        x: wx,
        y: wy,
        z: d / 2 + 0.02,
      });
      const sillF = createColoredBox(1.4, 0.15, 0.25, '#44464a', {
        x: wx,
        y: wy - 0.95,
        z: d / 2 + 0.08,
      });
      root.add(winF, sillF);

      // Back window
      const winB = createColoredBox(1.2, 1.8, 0.1, '#1b2228', {
        x: wx,
        y: wy,
        z: -d / 2 - 0.02,
      });
      root.add(winB);
    }
  }

  // Fire escape on the front facade
  if (options?.hasFireEscape !== false) {
    const fireEscape = createFireEscape(floors - 1, floorH, 2.6, 1.3);
    fireEscape.position.set(w * 0.22, 0, d / 2 + 0.05);
    root.add(fireEscape);
  }

  // Rooftop details: Water tower or HVAC
  if (options?.hasWaterTower) {
    const wt = createWaterTower(5.5, 1.6);
    wt.position.set(-w * 0.2, totalH + 0.6, -d * 0.15);
    root.add(wt);
  } else {
    const hvac = createRooftopHVAC(2.6, 1.4, 1.8);
    hvac.position.set(w * 0.15, totalH + 0.6, -d * 0.1);
    root.add(hvac);
  }

  // Elevator / Stair bulkhead
  const bulkhead = createColoredBox(2.8, 2.2, 3.2, darkGrime, {
    x: -w * 0.25,
    y: totalH + 1.1,
    z: d * 0.2,
  });
  root.add(bulkhead);

  return root;
}

/** Builds parking lot infill where older buildings were demolished */
export function createParkingLotInfill(anchor: LotAnchor): Object3D {
  const root = new Object3D();
  const w = anchor.width;
  const d = anchor.depth;

  // Dark asphalt surface with cracks/grime
  const asphalt = createColoredBox(
    w - 0.2,
    0.15,
    d - 0.2,
    PALETTE_1985.materials.asphaltParking,
    { x: 0, y: 0.075, z: 0 },
  );
  root.add(asphalt);

  // Low concrete curb / perimeter parking stops
  const curbColor = '#606266';
  const curbLeft = createColoredBox(0.25, 0.3, d - 0.6, curbColor, {
    x: -w / 2 + 0.3,
    y: 0.15,
    z: 0,
  });
  const curbRight = createColoredBox(0.25, 0.3, d - 0.6, curbColor, {
    x: w / 2 - 0.3,
    y: 0.15,
    z: 0,
  });
  const curbBack = createColoredBox(w - 0.6, 0.3, 0.25, curbColor, {
    x: 0,
    y: 0.15,
    z: -d / 2 + 0.3,
  });
  root.add(curbLeft, curbRight, curbBack);

  // Painted parking stall lines (faded yellow/white)
  const stallColor = '#d6b840';
  const stallCount = 4;
  for (let s = 0; s < stallCount; s++) {
    const sz = -d / 2 + 3.5 + s * 4.8;
    const stripeL = createColoredBox(4.5, 0.02, 0.12, stallColor, {
      x: -w / 4,
      y: 0.16,
      z: sz,
    });
    const stripeR = createColoredBox(4.5, 0.02, 0.12, stallColor, {
      x: w / 4,
      y: 0.16,
      z: sz,
    });
    root.add(stripeL, stripeR);
  }

  // Parking attendant booth / wooden shed
  const booth = createColoredBox(2.2, 2.6, 2.2, '#525458', {
    x: -w / 2 + 2.0,
    y: 1.3,
    z: d / 2 - 2.2,
  });
  const boothGlass = createColoredBox(1.8, 1.0, 0.05, '#5c7e96', {
    x: -w / 2 + 2.0,
    y: 1.8,
    z: d / 2 - 1.08,
  });
  const boothSign = createColoredBox(1.8, 0.5, 0.1, '#ffea00', {
    x: -w / 2 + 2.0,
    y: 2.8,
    z: d / 2 - 1.1,
  });
  root.add(booth, boothGlass, boothSign);

  // Industrial Floodlight / pole
  const pole = createColoredBox(0.2, 8.5, 0.2, '#383a3d', {
    x: w / 2 - 1.5,
    y: 4.25,
    z: -d / 2 + 1.5,
  });
  const lampFixture = createColoredBox(0.8, 0.4, 0.8, '#ff8a14', {
    x: w / 2 - 1.5,
    y: 8.5,
    z: -d / 2 + 1.5,
  });
  root.add(pole, lampFixture);

  // Green waste dumpster in corner
  const dumpster = createColoredBox(2.4, 1.5, 1.6, '#264a2f', {
    x: w / 2 - 2.2,
    y: 0.75,
    z: -d / 2 + 3.5,
  });
  root.add(dumpster);

  return root;
}

/**
 * Builds all 10 lot buildings for 1985:
 * - Lot 2: The landmark Mirrored High-Rise
 * - Lot 0, 1, 3, 5, 6, 8, 9: Weathered brick walk-ups with fire escapes, water towers, HVAC
 * - Lot 4: Parking lot infill
 * - Lot 7: Commercial mid-rise office
 */
export function create1985Buildings(lots: readonly LotAnchor[]): Era1985BuildingGroup {
  const root = new Object3D();
  const buildings: Object3D[] = [];

  let highRiseMesh: Object3D = new Object3D();
  let parkingLot: Object3D = new Object3D();

  lots.forEach((anchor, i) => {
    let building: Object3D;

    if (i === 2) {
      // Lot 2: Landmark Mirrored High-Rise Tower (46m high)
      building = createMirroredHighRise(anchor, 46);
      highRiseMesh = building;
    } else if (i === 4) {
      // Lot 4: Demolished infill turned into 80s commercial parking lot
      building = createParkingLotInfill(anchor);
      parkingLot = building;
    } else if (i === 7) {
      // Lot 7: 6-story 80s commercial office with tinted horizontal ribbon windows
      building = createGrimyBrickWalkup(anchor, 6, {
        hasWaterTower: false,
        hasFireEscape: true,
        brickTint: '#383c44',
      });
    } else {
      // Brick walk-ups with grime and varying heights
      const floors = 3 + (i % 3);
      const hasWaterTower = i % 2 === 0;
      building = createGrimyBrickWalkup(anchor, floors, {
        hasWaterTower,
        hasFireEscape: true,
        brickTint: i % 2 === 1 ? PALETTE_1985.materials.weatheredBrick : '#4d3328',
      });
    }

    // Position according to lot anchor transform
    // Lot center in world space:
    const center = anchor.center;
    building.position.set(center.x, 0, center.z);
    building.rotation.y = (anchor.rotation * Math.PI) / 180;

    root.add(building);
    buildings.push(building);
  });

  return {
    root,
    highRiseMesh,
    buildings,
    parkingLot,
  };
}
