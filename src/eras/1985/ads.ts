import { Object3D } from 'three';
import { LotAnchor } from '../../layout/lotAnchors';
import { createColoredBox } from './textures';
import { PALETTE_1985 } from './palette';

/**
 * 1985 Era Advertisements & Signage
 *
 * Requirements:
 * - Huge billboard now lit at night with backlit panels (80s electronics / cassette / blockbuster movie).
 * - Video-store VHS posters.
 * - Arcade marquees.
 * - Cassette / boombox ads in windows ("NEW BASS BOOST WALKMAN").
 * - Litter of band flyers, gig posters, and stickers on lampposts and walls.
 */

export interface Era1985AdGroup {
  readonly root: Object3D;
  readonly mainBillboard: Object3D;
  readonly vhsPosters: readonly Object3D[];
  readonly boomboxAds: readonly Object3D[];
  readonly flyersAndStickers: readonly Object3D[];
  update(timeOfDay: number, dt: number): void;
}

/**
 * Builds the huge rooftop backlit billboard structure
 * (Steel truss support frame, large advertising panel, fluorescent backlight tubes)
 */
export function createBacklitBillboard(width = 12, height = 6): Object3D {
  const root = new Object3D();
  const trussColor = '#32363e';

  // Support posts & cross-trusses
  const postL = createColoredBox(0.3, 4.0, 0.3, trussColor, {
    x: -width * 0.35,
    y: 2.0,
    z: 0,
  });
  const postR = createColoredBox(0.3, 4.0, 0.3, trussColor, {
    x: width * 0.35,
    y: 2.0,
    z: 0,
  });
  const diagonalTruss1 = createColoredBox(width * 0.8, 0.15, 0.15, trussColor, {
    x: 0,
    y: 2.0,
    z: 0,
  });
  root.add(postL, postR, diagonalTruss1);

  // Billboard main back enclosure / frame
  const frame = createColoredBox(width + 0.6, height + 0.6, 0.5, '#1e2126', {
    x: 0,
    y: 4.0 + height / 2,
    z: 0,
  });
  root.add(frame);

  // Backlit graphic billboard panel (80s Hi-Tech Boombox / Cassette Player ad)
  const adBackground = createColoredBox(
    width,
    height,
    0.1,
    '#0c142b',
    { x: 0, y: 4.0 + height / 2, z: 0.22 },
  );
  root.add(adBackground);

  // Ad graphic art elements:
  // 1. Bold neon headline ("SONY WALKMAN / TURBO BASS")
  const adTextNeon = createColoredBox(
    width * 0.75,
    0.9,
    0.06,
    PALETTE_1985.night.neonMagenta,
    { x: 0, y: 4.0 + height * 0.75, z: 0.3 },
  );
  // 2. Graphic boombox / cassette illustration
  const boomboxBody = createColoredBox(
    width * 0.45,
    height * 0.38,
    0.06,
    '#c2c8cf',
    { x: -width * 0.18, y: 4.0 + height * 0.38, z: 0.3 },
  );
  const speakerL = createColoredBox(
    height * 0.3,
    height * 0.3,
    0.08,
    '#111111',
    { x: -width * 0.3, y: 4.0 + height * 0.38, z: 0.32 },
  );
  const speakerR = createColoredBox(
    height * 0.3,
    height * 0.3,
    0.08,
    '#111111',
    { x: -width * 0.06, y: 4.0 + height * 0.38, z: 0.32 },
  );
  // 3. Electric cyan tagline
  const adSubtext = createColoredBox(
    width * 0.35,
    0.45,
    0.06,
    PALETTE_1985.night.neonCyan,
    { x: width * 0.22, y: 4.0 + height * 0.38, z: 0.3 },
  );
  root.add(adTextNeon, boomboxBody, speakerL, speakerR, adSubtext);

  // Fluorescent / Sodium backlit light fixtures (top & bottom light hoods)
  const topLightHood = createColoredBox(width + 0.4, 0.3, 0.6, '#ff8a14', {
    x: 0,
    y: 4.0 + height + 0.3,
    z: 0.35,
  });
  const btmLightHood = createColoredBox(width + 0.4, 0.3, 0.6, '#ff8a14', {
    x: 0,
    y: 3.7,
    z: 0.35,
  });
  root.add(topLightHood, btmLightHood);

  // Maintenance catwalk with railing
  const catwalk = createColoredBox(width + 0.8, 0.15, 0.8, '#43464d', {
    x: 0,
    y: 3.5,
    z: 0.5,
  });
  const catwalkRail = createColoredBox(width + 0.8, 0.7, 0.05, '#5a5e66', {
    x: 0,
    y: 3.9,
    z: 0.9,
  });
  root.add(catwalk, catwalkRail);

  return root;
}

/**
 * Builds window cassette / boombox ads
 */
export function createCassetteWindowAd(w = 1.4, h = 1.8): Object3D {
  const root = new Object3D();
  const posterMat = createColoredBox(w, h, 0.02, '#18243b', { x: 0, y: 0, z: 0 });
  const title = createColoredBox(w * 0.8, 0.3, 0.04, PALETTE_1985.night.neonYellow, {
    x: 0,
    y: h * 0.3,
    z: 0.02,
  });
  const cassette = createColoredBox(w * 0.6, h * 0.35, 0.04, '#e63946', {
    x: 0,
    y: -h * 0.05,
    z: 0.02,
  });
  const spool1 = createColoredBox(0.2, 0.2, 0.06, '#ffffff', {
    x: -w * 0.15,
    y: -h * 0.05,
    z: 0.03,
  });
  const spool2 = createColoredBox(0.2, 0.2, 0.06, '#ffffff', {
    x: w * 0.15,
    y: -h * 0.05,
    z: 0.03,
  });
  root.add(posterMat, title, cassette, spool1, spool2);
  return root;
}

/**
 * Builds street-level flyers and stickers
 */
export function createStreetFlyersAndStickers(): Object3D[] {
  const items: Object3D[] = [];
  const flyerColors = ['#ff007f', '#00e5ff', '#ffe600', '#ffffff', '#ff3333', '#111111'];

  // 12 Gig flyers and club stickers placed at various street corners
  const flyerCoords = [
    { x: -28, y: 1.2, z: 12, rotY: 0 },
    { x: -28, y: 1.6, z: 12.1, rotY: 0.05 },
    { x: -14, y: 1.1, z: 30, rotY: Math.PI / 2 },
    { x: 0, y: 1.3, z: 30, rotY: Math.PI / 2 },
    { x: 16, y: 1.4, z: 30, rotY: Math.PI / 2 },
    { x: 28, y: 1.0, z: -10, rotY: Math.PI },
    { x: 28, y: 1.5, z: -10.1, rotY: Math.PI + 0.1 },
    { x: 12, y: 1.2, z: -30, rotY: -Math.PI / 2 },
    { x: -8, y: 1.3, z: -30, rotY: -Math.PI / 2 },
    { x: -22, y: 1.1, z: -30, rotY: -Math.PI / 2 },
    { x: 5, y: 1.5, z: 15, rotY: 0.4 },
    { x: -12, y: 1.4, z: -15, rotY: -0.3 },
  ];

  flyerCoords.forEach((coord, i) => {
    const root = new Object3D();
    const bg = createColoredBox(
      0.35,
      0.5,
      0.02,
      flyerColors[i % flyerColors.length],
      { x: 0, y: 0, z: 0 },
    );
    // Band name bars
    const bar = createColoredBox(0.28, 0.08, 0.03, flyerColors[(i + 1) % flyerColors.length], {
      x: 0,
      y: 0.12,
      z: 0.01,
    });
    root.add(bg, bar);
    root.position.set(coord.x, coord.y, coord.z);
    root.rotation.y = coord.rotY;
    items.push(root);
  });

  return items;
}

/**
 * Creates all 1985 Advertisements and signs
 */
export function create1985Ads(lots: readonly LotAnchor[]): Era1985AdGroup {
  const root = new Object3D();
  const vhsPosters: Object3D[] = [];
  const boomboxAds: Object3D[] = [];

  // 1. Huge Rooftop Backlit Billboard on Lot 0 rooftop (height ~16m)
  const billboardAnchor = lots[0];
  const mainBillboard = createBacklitBillboard(11, 5.5);
  // Position atop the Lot 0 building (y = 15m)
  mainBillboard.position.set(
    billboardAnchor.center.x,
    14.5,
    billboardAnchor.center.z,
  );
  mainBillboard.rotation.y = (billboardAnchor.rotation * Math.PI) / 180;
  root.add(mainBillboard);

  // 2. Second Billboard atop Lot 8 building (facing east street)
  const billboard2 = createBacklitBillboard(9, 4.5);
  billboard2.position.set(lots[8].center.x, 15.0, lots[8].center.z);
  billboard2.rotation.y = ((lots[8].rotation + 90) * Math.PI) / 180;
  root.add(billboard2);

  // 3. Boombox and cassette posters on storefront windows
  const cassetteAd1 = createCassetteWindowAd(1.2, 1.6);
  cassetteAd1.position.set(lots[6].center.x - 3, 2.2, lots[6].center.z - lots[6].depth / 2 + 1.35);
  cassetteAd1.rotation.y = (lots[6].rotation * Math.PI) / 180;
  root.add(cassetteAd1);
  boomboxAds.push(cassetteAd1);

  // 4. Street flyers and stickers
  const flyersAndStickers = createStreetFlyersAndStickers();
  for (const item of flyersAndStickers) {
    root.add(item);
  }

  return {
    root,
    mainBillboard,
    vhsPosters,
    boomboxAds,
    flyersAndStickers,
    update(_timeOfDay: number, _dt: number) {
      // Dynamic updates if needed
    },
  };
}
