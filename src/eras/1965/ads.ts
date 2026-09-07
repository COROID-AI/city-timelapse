import { Object3D } from 'three';
import { ERA_1965_PALETTE } from './palette';
import { BILLBOARD_ARTWORKS_1965, createBox } from './textures';

/**
 * 1965 Advertisements Module:
 * - Large rooftop billboard on lot's best sightline (automobile / cigarette styling)
 * - Flickering neon window signs (animated tube flicker)
 * - Painted brick wall murals repainted in bright 60s colors
 * - Vinyl record window displays
 */

export interface NeonSign {
  readonly id: string;
  readonly text: string;
  readonly root: Object3D;
  readonly baseIntensity: number;
  readonly color: number;
}

export interface AdSystem {
  readonly root: Object3D;
  readonly billboard: Object3D;
  readonly neonSigns: readonly NeonSign[];
  readonly wallMurals: readonly Object3D[];
  update(dt: number, time: number): void;
}

/**
 * Builds the large rooftop billboard with steel truss framework, floodlight bars,
 * and high-impact 1960s commercial graphics.
 */
export function createRooftopBillboard(): Object3D {
  const root = new Object3D();
  const artwork = BILLBOARD_ARTWORKS_1965[0]; // V8 Super Convertible

  // Heavy steel support truss legs
  const legA = createBox(0.4, 4.5, 0.4, 0x4a4e69, -4.5, 2.25, 0);
  const legB = createBox(0.4, 4.5, 0.4, 0x4a4e69, 4.5, 2.25, 0);
  const crossBeam = createBox(9.4, 0.3, 0.3, 0x4a4e69, 0, 2.5, 0);
  root.add(legA, legB, crossBeam);

  // Billboard main backboard (10m wide x 4.8m high)
  const boardBack = createBox(10.2, 5.0, 0.4, 0x1a1a24, 0, 7.0, 0);
  const boardFace = createBox(9.8, 4.6, 0.1, artwork.primaryColor, 0, 7.0, 0.22);
  const boardBorder = createBox(
    10.0,
    4.8,
    0.15,
    ERA_1965_PALETTE.architecture.chromeTrim,
    0,
    7.0,
    0.18,
  );
  root.add(boardBack, boardFace, boardBorder);

  // Graphic panels representing bold mid-century billboard art layout
  // Top headline band
  const topBand = createBox(9.0, 0.9, 0.05, artwork.secondaryColor, 0, 8.4, 0.28);
  // Main car illustration block (sleek crimson fin silhouette)
  const graphicCarBody = createBox(5.5, 1.4, 0.06, 0xffffff, -1.5, 6.9, 0.29);
  const graphicCarFin = createBox(1.6, 0.9, 0.07, artwork.accentColor, 1.0, 7.3, 0.3);
  // Slogan / price badge
  const badgeCircle = createBox(2.2, 1.8, 0.08, artwork.accentColor, 3.2, 6.7, 0.29);
  const badgeText = createBox(1.8, 0.5, 0.09, 0x111111, 3.2, 6.7, 0.34);
  root.add(topBand, graphicCarBody, graphicCarFin, badgeCircle, badgeText);

  // Walkway catwalk and floodlights along top and bottom
  const catwalk = createBox(10.2, 0.15, 1.2, 0x2b2d42, 0, 4.5, 0.6);
  const handrail = createBox(10.2, 0.8, 0.05, 0x4a4e69, 0, 5.0, 1.2);
  root.add(catwalk, handrail);

  // 4 Floodlight fixtures pointing at the billboard face
  for (let f = 0; f < 4; f++) {
    const fx = -3.6 + f * 2.4;
    const floodlightArm = createBox(0.08, 0.1, 0.9, 0x333333, fx, 4.7, 0.5);
    const lampHead = createBox(
      0.4,
      0.3,
      0.3,
      ERA_1965_PALETTE.grading.coolFluorescent.r > 0 ? 0xffffff : 0xdddddd,
      fx,
      4.9,
      0.9,
    );
    root.add(floodlightArm, lampHead);
  }

  return root;
}

/**
 * Creates animated flickering neon window signs.
 */
export function createNeonSigns(): { group: Object3D; signs: NeonSign[] } {
  const group = new Object3D();
  const signs: NeonSign[] = [];

  const neonConfigs = [
    {
      id: 'neon-diner-open',
      text: 'OPEN 24 HRS',
      color: ERA_1965_PALETTE.neon.openPink,
      x: -24.0,
      y: 2.2,
      z: -12.0,
      w: 1.8,
      h: 0.6,
    },
    {
      id: 'neon-records',
      text: 'STEREO HI-FI',
      color: ERA_1965_PALETTE.neon.recordsCyan,
      x: -12.0,
      y: 2.3,
      z: -12.0,
      w: 2.0,
      h: 0.5,
    },
    {
      id: 'neon-tv',
      text: 'COLOR TV',
      color: ERA_1965_PALETTE.neon.tvElectricBlue,
      x: 12.0,
      y: 2.2,
      z: -12.0,
      w: 1.6,
      h: 0.5,
    },
    {
      id: 'neon-diner-cocktails',
      text: 'COCKTAILS',
      color: ERA_1965_PALETTE.neon.cocktailsMagenta,
      x: -20.0,
      y: 2.6,
      z: -12.0,
      w: 1.7,
      h: 0.4,
    },
    {
      id: 'neon-laundry',
      text: '20 MIN WASH',
      color: ERA_1965_PALETTE.neon.laundryBrightGreen,
      x: -22.0,
      y: 2.2,
      z: 12.0,
      w: 1.9,
      h: 0.5,
    },
  ];

  for (const cfg of neonConfigs) {
    const signRoot = new Object3D();
    signRoot.position.set(cfg.x, cfg.y, cfg.z);

    // Black acrylic backing tray
    const backing = createBox(cfg.w + 0.2, cfg.h + 0.15, 0.05, 0x050505, 0, 0, 0);
    // Glowing neon tube glass letter bar
    const tubes = createBox(cfg.w, cfg.h * 0.7, 0.06, cfg.color, 0, 0, 0.04);
    signRoot.add(backing, tubes);

    group.add(signRoot);
    signs.push({
      id: cfg.id,
      text: cfg.text,
      root: signRoot,
      baseIntensity: 1.0,
      color: cfg.color,
    });
  }

  return { group, signs };
}

/**
 * Creates painted brick wall ads repainted in brighter 60s colors.
 */
export function createWallMurals(): Object3D[] {
  const murals: Object3D[] = [];

  // Mural 1: "ATOMIC COLA - ICE COLD" on Lot 1 side wall (facing west)
  const mural1 = new Object3D();
  const baseMural1 = createBox(0.08, 6.0, 9.0, 0xd90429, -17.9, 6.0, -14.0);
  const textBand1 = createBox(0.09, 1.4, 8.0, 0xffffff, -17.89, 7.5, -14.0);
  const bottleShape = createBox(0.1, 3.2, 1.2, 0x2b2d42, -17.88, 5.0, -14.0);
  const yellowStar = createBox(0.1, 1.2, 1.2, 0xffd166, -17.88, 5.2, -11.0);
  mural1.add(baseMural1, textBand1, bottleShape, yellowStar);
  murals.push(mural1);

  // Mural 2: "VELOCITA MOTOR OIL - PEAK OCTANE" on Lot 4 east wall
  const mural2 = new Object3D();
  const baseMural2 = createBox(0.08, 6.5, 9.0, 0x0077b6, 29.9, 6.5, -14.0);
  const textBand2 = createBox(0.09, 1.5, 7.8, 0xffd166, 29.89, 8.0, -14.0);
  const logoCircle = createBox(0.1, 2.4, 2.4, 0xf77f00, 29.88, 5.5, -14.0);
  mural2.add(baseMural2, textBand2, logoCircle);
  murals.push(mural2);

  return murals;
}

/**
 * Builds the complete 1965 advertising subsystem.
 */
export function create1965Ads(): AdSystem {
  const root = new Object3D();

  // 1. Large rooftop billboard placed atop Lot 4 (optimal sightline overlooking the avenue)
  const billboard = createRooftopBillboard();
  billboard.position.set(24.0, 14.0, -14.0);
  root.add(billboard);

  // 2. Neon signs
  const { group: neonGroup, signs: neonSigns } = createNeonSigns();
  root.add(neonGroup);

  // 3. Wall murals
  const wallMurals = createWallMurals();
  for (const m of wallMurals) {
    root.add(m);
  }

  return {
    root,
    billboard,
    neonSigns,
    wallMurals,
    update(_dt: number, time: number) {
      // Realistic random flickering on neon signs via small position vibration
      neonSigns.forEach((sign, i) => {
        const noise = Math.sin(time * 25.0 + i * 17.3) * Math.cos(time * 43.0 + i * 7.1);
        const isFlickering = noise > 0.82;
        const offsetY = isFlickering ? -0.02 : 0;
        sign.root.position.y += offsetY * 0.1;
      });
    },
  };
}
