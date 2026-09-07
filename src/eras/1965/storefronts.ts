import { Object3D } from 'three';
import { ERA_1965_PALETTE } from './palette';
import { createBox } from './textures';

/**
 * 1965 Detailed Storefront Modules:
 * 1. TV & Appliance Shop: glowing CRT wall display (stacked consoles, scanline glow)
 * 2. Record Store: vinyl LP discs, album jackets, listening booths/turntables
 * 3. Googie Diner: booth seating, chrome counter stools, glowing jukebox
 * 4. Tobacconist: cedar/teak display cases, pipe racks, cigar boxes
 * 5. Laundromat: row of front-loading washers visible through glass
 */

export interface StorefrontInstance {
  readonly kind: 'appliance_tv' | 'record_store' | 'diner' | 'tobacconist' | 'laundromat';
  readonly name: string;
  readonly root: Object3D;
  update(dt: number, time: number): void;
}

/**
 * 1. Television & Appliance Shop ("Electro-Vision Hi-Fi & TV")
 * Features a wall display of glowing CRT television sets with blue screen flicker.
 */
export function createApplianceStorefront(): StorefrontInstance {
  const root = new Object3D();

  // Shop base interior / wall
  const backWall = createBox(9.5, 3.8, 0.3, 0x3d3a45, 0, 1.9, -1.8);
  const floor = createBox(9.5, 0.1, 3.8, 0x4a4e69, 0, 0.05, 0);
  root.add(backWall, floor);

  // CRT screen meshes to animate screen glow
  const crtScreens: Object3D[] = [];

  // 3x2 Grid of TV console cabinets on display shelving
  const tvPositions = [
    { x: -3.0, y: 0.8 },
    { x: -1.0, y: 0.8 },
    { x: 1.0, y: 0.8 },
    { x: 3.0, y: 0.8 },
    { x: -2.0, y: 2.1 },
    { x: 0.0, y: 2.1 },
    { x: 2.0, y: 2.1 },
  ];

  for (const pos of tvPositions) {
    // Walnut wood cabinet
    const cabinet = createBox(
      1.3,
      1.0,
      0.9,
      ERA_1965_PALETTE.storefronts.tvCabinetWalnut,
      pos.x,
      pos.y,
      -1.0,
    );

    // Gold speaker grille cloth
    const grille = createBox(
      0.35,
      0.75,
      0.05,
      0xd4af37,
      pos.x + 0.38,
      pos.y - 0.05,
      -0.52,
    );

    // Glowing curved CRT screen
    const screen = createBox(
      0.75,
      0.65,
      0.08,
      ERA_1965_PALETTE.storefronts.tvScreenGlow,
      pos.x - 0.18,
      pos.y + 0.05,
      -0.51,
    );

    // Channel dial / knobs
    const knob = createBox(0.08, 0.08, 0.05, 0x111111, pos.x + 0.38, pos.y + 0.3, -0.5);

    root.add(cabinet, grille, screen, knob);
    crtScreens.push(screen);
  }

  // Large floor display console with turntable lid
  const consoleStereo = createBox(2.2, 0.9, 1.0, 0x462211, 0, 0.45, 0.6);
  const turntableMat = createBox(0.4, 0.05, 0.4, 0x111111, -0.4, 0.92, 0.6);
  const receiverDial = createBox(0.8, 0.2, 0.05, 0x38bdf8, 0.4, 0.8, 1.12);
  root.add(consoleStereo, turntableMat, receiverDial);

  return {
    kind: 'appliance_tv',
    name: 'Electro-Vision Hi-Fi & TV',
    root,
    update(_dt: number, time: number) {
      // Subtle phosphor scanline oscillation across the CRT screens
      crtScreens.forEach((scr, idx) => {
        scr.position.z = -0.51 + 0.005 * Math.sin(time * 12 + idx * 2.1);
      });
    },
  };
}

/**
 * 2. Record Store ("Groove & Spin Records")
 * Features vinyl LP record window displays, browsing bins, and album art racks.
 */
export function createRecordStorefront(): StorefrontInstance {
  const root = new Object3D();

  // Floor & back wall
  const backWall = createBox(9.5, 3.8, 0.3, 0x2b2d42, 0, 1.9, -1.8);
  const floor = createBox(9.5, 0.1, 3.8, 0x8d99ae, 0, 0.05, 0);
  root.add(backWall, floor);

  // Record browsing bins (plywood record racks with dividers)
  const binPositions = [-3.0, -1.0, 1.0, 3.0];
  const vinylCovers = [
    ERA_1965_PALETTE.storefronts.recordCoverRed,
    ERA_1965_PALETTE.storefronts.recordCoverGold,
    ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
    ERA_1965_PALETTE.architecture.renovatedEnamelYellow,
  ];

  for (let i = 0; i < binPositions.length; i++) {
    const bx = binPositions[i];
    // Wooden rack bin
    const bin = createBox(1.4, 0.9, 1.4, 0x85583b, bx, 0.45, -0.4);
    root.add(bin);

    // Tiered album covers visible inside bins
    for (let r = 0; r < 4; r++) {
      const coverColor = vinylCovers[(i + r) % vinylCovers.length];
      const lpCover = createBox(
        1.1,
        0.4,
        0.05,
        coverColor,
        bx,
        0.95 + r * 0.05,
        -0.8 + r * 0.25,
      );
      root.add(lpCover);
    }
  }

  // Window display: circular vinyl record discs hanging in showcase
  const windowDisplayX = [-2.8, -1.2, 0.8, 2.4];
  const spinningDiscs: Object3D[] = [];

  for (let i = 0; i < windowDisplayX.length; i++) {
    const wx = windowDisplayX[i];
    // Vinyl outer black disc
    const vinylDisc = createBox(
      0.8,
      0.8,
      0.02,
      ERA_1965_PALETTE.storefronts.recordVinylBlack,
      wx,
      2.0 + (i % 2) * 0.4,
      1.1,
    );
    // Center label (red / yellow)
    const centerLabel = createBox(
      0.28,
      0.28,
      0.04,
      i % 2 === 0 ? 0xd90429 : 0xffd166,
      wx,
      2.0 + (i % 2) * 0.4,
      1.11,
    );
    root.add(vinylDisc, centerLabel);
    spinningDiscs.push(vinylDisc);
  }

  // In-store listening booth with headphones prop
  const booth = createBox(1.5, 2.4, 1.2, 0x3d314a, -3.6, 1.2, 0.8);
  const turntable = createBox(0.5, 0.4, 0.5, 0x111111, -3.6, 1.0, 0.8);
  root.add(booth, turntable);

  return {
    kind: 'record_store',
    name: 'Groove & Spin Records',
    root,
    update(dt: number) {
      for (const disc of spinningDiscs) {
        disc.rotation.z += dt * 0.6;
      }
    },
  };
}

/**
 * 3. Googie Diner ("Sunny Side Diner")
 * Features red/turquoise vinyl booth seating, chrome counter stools, and a glowing jukebox.
 */
export function createDinerStorefront(): StorefrontInstance {
  const root = new Object3D();

  // Floor (black & white checkerboard style)
  const floor = createBox(9.5, 0.1, 4.0, 0xede0d4, 0, 0.05, 0);
  const backWall = createBox(9.5, 3.8, 0.3, 0xfff3b0, 0, 1.9, -1.9);
  root.add(floor, backWall);

  // Classic Formica serving counter
  const counter = createBox(7.0, 1.0, 0.9, 0xf77f00, 0.5, 0.5, -0.9);
  const counterTop = createBox(7.2, 0.1, 1.1, 0xfaf0ca, 0.5, 1.05, -0.9);
  const chromeEdge = createBox(
    7.24,
    0.06,
    1.14,
    ERA_1965_PALETTE.storefronts.dinerCounterChrome,
    0.5,
    1.02,
    -0.9,
  );
  root.add(counter, counterTop, chromeEdge);

  // 5 Chrome diner stools with red vinyl round cushions
  for (let s = 0; s < 5; s++) {
    const sx = -2.2 + s * 1.3;
    const post = createBox(
      0.08,
      0.75,
      0.08,
      ERA_1965_PALETTE.storefronts.dinerCounterChrome,
      sx,
      0.38,
      -0.15,
    );
    const seat = createBox(0.45, 0.12, 0.45, 0xd90429, sx, 0.8, -0.15);
    root.add(post, seat);
  }

  // Booth seating on the left (two facing turquoise vinyl benches and table)
  const boothBenchA = createBox(
    1.6,
    0.9,
    0.5,
    ERA_1965_PALETTE.storefronts.dinerBoothTurquoise,
    -3.5,
    0.45,
    0.8,
  );
  const boothBenchB = createBox(
    1.6,
    0.9,
    0.5,
    ERA_1965_PALETTE.storefronts.dinerBoothTurquoise,
    -3.5,
    0.45,
    1.7,
  );
  const boothTable = createBox(1.5, 0.75, 0.6, 0xf4f1de, -3.5, 0.38, 1.25);
  root.add(boothBenchA, boothBenchB, boothTable);

  // Iconic 1960s Wurlitzer-style Jukebox with multi-color glowing glass arches
  const jukeboxBody = createBox(1.0, 1.6, 0.7, 0x8b0000, 3.8, 0.8, 0.5);
  const jukeboxGlowArch = createBox(
    0.7,
    0.8,
    0.08,
    ERA_1965_PALETTE.storefronts.jukeboxGlowAmber,
    3.8,
    1.1,
    0.87,
  );
  const jukeboxTitleStripes = createBox(0.6, 0.3, 0.05, 0x00f5d4, 3.8, 0.6, 0.88);
  const jukeboxChromeTrim = createBox(
    1.04,
    0.08,
    0.74,
    ERA_1965_PALETTE.storefronts.dinerCounterChrome,
    3.8,
    0.8,
    0.5,
  );
  root.add(jukeboxBody, jukeboxGlowArch, jukeboxTitleStripes, jukeboxChromeTrim);

  return {
    kind: 'diner',
    name: 'Sunny Side Diner',
    root,
    update(_dt: number, time: number) {
      // Dynamic pulsing jukebox illumination
      jukeboxGlowArch.position.z = 0.87 + 0.01 * Math.sin(time * 3.5);
    },
  };
}

/**
 * 4. Tobacconist ("Apex Tobacconist & Fine Pipes")
 * Features teak/cedar display cabinets, pipe racks, and brass details.
 */
export function createTobacconistStorefront(): StorefrontInstance {
  const root = new Object3D();

  // Rich timber flooring and wood panelled back
  const floor = createBox(9.5, 0.1, 3.8, 0x582f0e, 0, 0.05, 0);
  const backWall = createBox(
    9.5,
    3.8,
    0.3,
    ERA_1965_PALETTE.storefronts.tobacconistTeak,
    0,
    1.9,
    -1.8,
  );
  root.add(floor, backWall);

  // Large wall humidor cabinet with glass doors
  const humidor = createBox(5.5, 2.6, 0.6, 0x3f2212, 0, 1.6, -1.4);
  const cigarBoxes = [
    createBox(0.9, 0.25, 0.3, 0xd4a373, -1.8, 1.2, -1.05),
    createBox(0.9, 0.25, 0.3, 0xbc6c25, -0.6, 1.2, -1.05),
    createBox(0.9, 0.25, 0.3, 0x8a5a36, 0.6, 1.2, -1.05),
    createBox(0.9, 0.25, 0.3, 0xdda15e, 1.8, 1.2, -1.05),
  ];
  root.add(humidor, ...cigarBoxes);

  // Front counter with pipe display stand
  const counter = createBox(6.0, 1.0, 1.0, 0x4a2810, 0, 0.5, 0.3);
  const glassTop = createBox(5.8, 0.15, 0.9, 0xa8dadc, 0, 1.05, 0.3);
  const pipeRack = createBox(1.2, 0.3, 0.3, 0x2b1704, 0, 1.25, 0.3);
  root.add(counter, glassTop, pipeRack);

  return {
    kind: 'tobacconist',
    name: 'Apex Tobacconist & Fine Pipes',
    root,
    update() {
      // Static display
    },
  };
}

/**
 * 5. Laundromat ("Speedy Wash Laundromat")
 * Features front-loading washers visible through glass, chrome drums, and folding table.
 */
export function createLaundromatStorefront(): StorefrontInstance {
  const root = new Object3D();

  // Light cyan/porcelain tiled floor and light mint back wall
  const floor = createBox(9.5, 0.1, 3.8, 0xdee2e6, 0, 0.05, 0);
  const backWall = createBox(9.5, 3.8, 0.3, 0xc8d6af, 0, 1.9, -1.8);
  root.add(floor, backWall);

  const washerDrums: Object3D[] = [];

  // Row of 6 front-loading commercial washing machines
  for (let w = 0; w < 6; w++) {
    const wx = -3.5 + w * 1.4;
    // Porcelain white/turquoise enamel machine body
    const body = createBox(
      1.1,
      1.3,
      1.1,
      ERA_1965_PALETTE.storefronts.laundromatPorcelain,
      wx,
      0.65,
      -0.8,
    );
    // Upper turquoise control band
    const panel = createBox(
      1.1,
      0.25,
      0.05,
      ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
      wx,
      1.15,
      -0.23,
    );
    // Chrome circular door bezel
    const bezel = createBox(
      0.65,
      0.65,
      0.05,
      ERA_1965_PALETTE.storefronts.washerDrumChrome,
      wx,
      0.6,
      -0.23,
    );
    // Inner glass porthole (dark cyan/blue)
    const drum = createBox(0.45, 0.45, 0.06, 0x0077b6, wx, 0.6, -0.22);

    root.add(body, panel, bezel, drum);
    washerDrums.push(drum);
  }

  // Central folding table with laundry basket
  const table = createBox(4.0, 0.85, 1.2, 0xf8f9fa, 0, 0.43, 0.6);
  const basket = createBox(0.8, 0.4, 0.6, 0xffb703, 0.8, 0.95, 0.6);
  root.add(table, basket);

  return {
    kind: 'laundromat',
    name: 'Speedy Wash Laundromat',
    root,
    update(_dt: number, time: number) {
      // Animate washing machine drums spinning
      washerDrums.forEach((drum, i) => {
        drum.rotation.z = time * (3.0 + (i % 3) * 1.2);
      });
    },
  };
}
