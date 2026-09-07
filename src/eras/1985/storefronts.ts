import { Mesh, Object3D } from 'three';
import { LotAnchor } from '../../layout/lotAnchors';
import { createColoredBox } from './textures';
import { PALETTE_1985 } from './palette';

/**
 * 1985 Era Storefronts
 *
 * Requirements:
 * 1. Video rental store with hand-lettered VHS posters ("VHS WORLD / VIDEO PALACE")
 * 2. Arcade with glowing cabinets visible through smoky glass ("GALAXY ARCADE / NEON ZONE")
 * 3. Newsstand with magazines ("80s NEWS & PERIODICALS")
 * 4. Deli with neon sandwich sign ("METRO DELI")
 * 5. Record / cassette shop ("SOUND VIBES CASSETTES & VINYL")
 */

export interface Era1985StorefrontGroup {
  readonly root: Object3D;
  readonly videoStore: Object3D;
  readonly arcade: Object3D;
  readonly newsstand: Object3D;
  readonly deli: Object3D;
  readonly recordShop: Object3D;
  readonly neonMeshes: readonly Mesh[];
  update(timeOfDay: number, dt: number): void;
}

/** Builds the Video Rental Store */
export function createVideoRentalStore(anchor: LotAnchor): Object3D {
  const root = new Object3D();
  const w = anchor.width - 2.5;

  // Base storefront facade recess
  const facade = createColoredBox(w, 4.0, 0.4, '#1b2028', {
    x: 0,
    y: 2.0,
    z: 0,
  });
  root.add(facade);

  // Large display windows (blue/yellow themed 80s video store)
  const windowL = createColoredBox(w * 0.42, 2.6, 0.1, '#3b5f7d', {
    x: -w * 0.25,
    y: 1.8,
    z: 0.15,
  });
  const windowR = createColoredBox(w * 0.42, 2.6, 0.1, '#3b5f7d', {
    x: w * 0.25,
    y: 1.8,
    z: 0.15,
  });
  root.add(windowL, windowR);

  // Video Store Main Neon Marquee ("VHS VIDEO RENTAL")
  const signBacking = createColoredBox(w * 0.95, 0.9, 0.2, '#0c1b33', {
    x: 0,
    y: 3.8,
    z: 0.25,
  });
  const signLettersBlue = createColoredBox(w * 0.5, 0.5, 0.08, PALETTE_1985.night.neonCyan, {
    x: -w * 0.2,
    y: 3.8,
    z: 0.35,
  });
  const signLettersYellow = createColoredBox(w * 0.35, 0.5, 0.08, PALETTE_1985.night.neonYellow, {
    x: w * 0.25,
    y: 3.8,
    z: 0.35,
  });
  root.add(signBacking, signLettersBlue, signLettersYellow);

  // Hand-lettered VHS movie posters in window
  // Poster 1: Sci-Fi Blockbuster (Neon magenta/cyan)
  const poster1 = createColoredBox(0.8, 1.2, 0.04, '#ff007f', {
    x: -w * 0.32,
    y: 1.8,
    z: 0.22,
  });
  // Poster 2: Martial Arts VHS
  const poster2 = createColoredBox(0.8, 1.2, 0.04, '#ffea00', {
    x: -w * 0.16,
    y: 1.8,
    z: 0.22,
  });
  // Poster 3: Horror VHS (Blood red/black)
  const poster3 = createColoredBox(0.8, 1.2, 0.04, '#ff2222', {
    x: w * 0.16,
    y: 1.8,
    z: 0.22,
  });
  // Poster 4: 80s Action Movie (Electric cyan)
  const poster4 = createColoredBox(0.8, 1.2, 0.04, '#00e5ff', {
    x: w * 0.32,
    y: 1.8,
    z: 0.22,
  });
  root.add(poster1, poster2, poster3, poster4);

  // VHS Shelves visible inside
  for (let s = 0; s < 3; s++) {
    const shelf = createColoredBox(w * 0.8, 0.1, 0.3, '#ffffff', {
      x: 0,
      y: 0.9 + s * 0.6,
      z: -0.1,
    });
    root.add(shelf);
  }

  // Entrance door with brass push-bar
  const door = createColoredBox(1.2, 2.4, 0.08, '#2a313d', {
    x: 0,
    y: 1.2,
    z: 0.12,
  });
  const handle = createColoredBox(0.8, 0.08, 0.08, '#c2c8cf', {
    x: 0,
    y: 1.1,
    z: 0.18,
  });
  root.add(door, handle);

  return root;
}

/** Builds the 1980s Arcade with glowing cabinets visible through smoky glass */
export function createArcade(anchor: LotAnchor): Object3D {
  const root = new Object3D();
  const w = anchor.width - 2.5;

  // Dark facade
  const facade = createColoredBox(w, 4.0, 0.4, '#121418', {
    x: 0,
    y: 2.0,
    z: 0,
  });
  root.add(facade);

  // Smoky tinted dark glass window
  const smokyGlass = createColoredBox(w * 0.85, 2.7, 0.1, '#18242b', {
    x: 0,
    y: 1.8,
    z: 0.15,
  });
  root.add(smokyGlass);

  // Neon Marquee ("GALAXY ARCADE")
  const marquee = createColoredBox(w * 0.95, 0.9, 0.2, '#180e29', {
    x: 0,
    y: 3.8,
    z: 0.25,
  });
  const neonPink = createColoredBox(w * 0.4, 0.45, 0.08, PALETTE_1985.night.neonMagenta, {
    x: -w * 0.22,
    y: 3.8,
    z: 0.35,
  });
  const neonCyan = createColoredBox(w * 0.4, 0.45, 0.08, PALETTE_1985.night.neonCyan, {
    x: w * 0.22,
    y: 3.8,
    z: 0.35,
  });
  root.add(marquee, neonPink, neonCyan);

  // Row of 4 glowing arcade cabinets visible inside
  const cabColors = ['#ff007f', '#00ff66', '#00e5ff', '#ffea00'];
  for (let c = 0; c < 4; c++) {
    const cx = -w * 0.32 + c * (w * 0.21);
    // Cabinet chassis
    const cab = createColoredBox(0.8, 1.8, 0.8, '#1a1d24', {
      x: cx,
      y: 1.0,
      z: -0.1,
    });
    // Glowing screen
    const screen = createColoredBox(0.5, 0.4, 0.05, cabColors[c], {
      x: cx,
      y: 1.25,
      z: 0.32,
    });
    // Glowing marquee header
    const cabMarquee = createColoredBox(0.6, 0.2, 0.05, cabColors[(c + 1) % 4], {
      x: cx,
      y: 1.75,
      z: 0.32,
    });
    // Coin door
    const coinDoor = createColoredBox(0.3, 0.4, 0.02, '#383d47', {
      x: cx,
      y: 0.4,
      z: 0.32,
    });
    root.add(cab, screen, cabMarquee, coinDoor);
  }

  return root;
}

/** Builds the 1980s Newsstand with magazines and candy/tobacco */
export function createNewsstand(anchor: LotAnchor): Object3D {
  const root = new Object3D();
  const w = anchor.width - 2.5;

  const facade = createColoredBox(w, 4.0, 0.4, '#242830', {
    x: 0,
    y: 2.0,
    z: 0,
  });
  root.add(facade);

  // Striped awning
  const awning = createColoredBox(w * 0.9, 0.4, 1.2, '#962b2b', {
    x: 0,
    y: 3.2,
    z: 0.6,
  });
  root.add(awning);

  // Newsstand Signboard
  const sign = createColoredBox(w * 0.85, 0.6, 0.15, '#e0d5a8', {
    x: 0,
    y: 3.8,
    z: 0.22,
  });
  const signText = createColoredBox(w * 0.7, 0.35, 0.05, '#1e2430', {
    x: 0,
    y: 3.8,
    z: 0.3,
  });
  root.add(sign, signText);

  // Magazine Racks (multiple rows with colorful 80s magazine covers)
  const magColors = ['#ff0055', '#ffe600', '#00ccff', '#ffffff', '#33ff33', '#ff8800'];
  for (let row = 0; row < 3; row++) {
    const ry = 1.0 + row * 0.55;
    const rack = createColoredBox(w * 0.75, 0.08, 0.2, '#484b50', {
      x: 0,
      y: ry - 0.2,
      z: 0.25,
    });
    root.add(rack);
    for (let m = 0; m < 6; m++) {
      const mx = -w * 0.3 + m * (w * 0.12);
      const mag = createColoredBox(0.24, 0.35, 0.04, magColors[(row + m) % magColors.length], {
        x: mx,
        y: ry,
        z: 0.28,
      });
      root.add(mag);
    }
  }

  // Cigarette / Candy Counter
  const counter = createColoredBox(w * 0.8, 0.9, 0.4, '#32363d', {
    x: 0,
    y: 0.45,
    z: 0.2,
  });
  root.add(counter);

  return root;
}

/** Builds the Deli with glowing neon sandwich sign */
export function createDeli(anchor: LotAnchor): Object3D {
  const root = new Object3D();
  const w = anchor.width - 2.5;

  const facade = createColoredBox(w, 4.0, 0.4, '#2d241e', {
    x: 0,
    y: 2.0,
    z: 0,
  });
  root.add(facade);

  // Deli Signboard ("METRO DELI")
  const sign = createColoredBox(w * 0.9, 0.8, 0.15, '#1a3322', {
    x: 0,
    y: 3.8,
    z: 0.22,
  });
  const signText = createColoredBox(w * 0.5, 0.4, 0.06, '#ffea00', {
    x: -w * 0.15,
    y: 3.8,
    z: 0.3,
  });
  root.add(sign, signText);

  // Glowing Neon Sandwich Sign (Bread layers in gold + meat/lettuce in pink/green)
  const sandwichTop = createColoredBox(0.9, 0.15, 0.06, PALETTE_1985.night.neonYellow, {
    x: w * 0.25,
    y: 3.95,
    z: 0.32,
  });
  const sandwichFill = createColoredBox(0.95, 0.12, 0.06, PALETTE_1985.night.neonMagenta, {
    x: w * 0.25,
    y: 3.8,
    z: 0.32,
  });
  const sandwichBtm = createColoredBox(0.9, 0.15, 0.06, PALETTE_1985.night.neonYellow, {
    x: w * 0.25,
    y: 3.65,
    z: 0.32,
  });
  root.add(sandwichTop, sandwichFill, sandwichBtm);

  // Glass counter & menu
  const deliWindow = createColoredBox(w * 0.7, 2.2, 0.1, '#668a99', {
    x: 0,
    y: 1.6,
    z: 0.15,
  });
  const coldCutsDisplay = createColoredBox(w * 0.6, 0.8, 0.4, '#8a3c3c', {
    x: 0,
    y: 0.8,
    z: 0.0,
  });
  root.add(deliWindow, coldCutsDisplay);

  return root;
}

/** Builds the Record / Cassette shop ("SOUND WAVES CASSETTES & VINYL") */
export function createRecordCassetteShop(anchor: LotAnchor): Object3D {
  const root = new Object3D();
  const w = anchor.width - 2.5;

  const facade = createColoredBox(w, 4.0, 0.4, '#1e1c24', {
    x: 0,
    y: 2.0,
    z: 0,
  });
  root.add(facade);

  // Signboard with glowing neon music notes
  const sign = createColoredBox(w * 0.9, 0.8, 0.15, '#2b1b3d', {
    x: 0,
    y: 3.8,
    z: 0.22,
  });
  const signText = createColoredBox(w * 0.55, 0.4, 0.06, PALETTE_1985.night.neonMagenta, {
    x: -w * 0.1,
    y: 3.8,
    z: 0.3,
  });
  const neonNote = createColoredBox(0.4, 0.5, 0.06, PALETTE_1985.night.neonCyan, {
    x: w * 0.28,
    y: 3.8,
    z: 0.32,
  });
  root.add(sign, signText, neonNote);

  // Large display window showing vinyl records and cassette displays
  const windowL = createColoredBox(w * 0.4, 2.5, 0.1, '#506680', {
    x: -w * 0.25,
    y: 1.7,
    z: 0.15,
  });
  const windowR = createColoredBox(w * 0.4, 2.5, 0.1, '#506680', {
    x: w * 0.25,
    y: 1.7,
    z: 0.15,
  });
  root.add(windowL, windowR);

  // Cassette tape bins (multi-tiered racks)
  const cassetteBin1 = createColoredBox(1.2, 0.8, 0.3, '#30343f', {
    x: -w * 0.25,
    y: 0.8,
    z: 0.1,
  });
  const cassetteBin2 = createColoredBox(1.2, 0.8, 0.3, '#30343f', {
    x: w * 0.25,
    y: 0.8,
    z: 0.1,
  });
  root.add(cassetteBin1, cassetteBin2);

  // Vinyl record LP album cover displays in window
  const lp1 = createColoredBox(0.9, 0.9, 0.04, '#ff0055', {
    x: -w * 0.25,
    y: 1.9,
    z: 0.22,
  });
  const lp2 = createColoredBox(0.9, 0.9, 0.04, '#00e5ff', {
    x: w * 0.25,
    y: 1.9,
    z: 0.22,
  });
  root.add(lp1, lp2);

  return root;
}

/**
 * Creates all 5 required storefronts and mounts them to corresponding lot facades.
 */
export function create1985Storefronts(lots: readonly LotAnchor[]): Era1985StorefrontGroup {
  const root = new Object3D();
  const neonMeshes: Mesh[] = [];

  // Lot 0: Video Rental Store
  const videoStore = createVideoRentalStore(lots[0]);
  videoStore.position.set(lots[0].center.x, 0, lots[0].center.z + (lots[0].depth / 2 - 1.2));
  videoStore.rotation.y = (lots[0].rotation * Math.PI) / 180;
  root.add(videoStore);

  // Lot 1: Arcade ("GALAXY ARCADE")
  const arcade = createArcade(lots[1]);
  arcade.position.set(lots[1].center.x, 0, lots[1].center.z + (lots[1].depth / 2 - 1.2));
  arcade.rotation.y = (lots[1].rotation * Math.PI) / 180;
  root.add(arcade);

  // Lot 3: Newsstand
  const newsstand = createNewsstand(lots[3]);
  newsstand.position.set(lots[3].center.x, 0, lots[3].center.z + (lots[3].depth / 2 - 1.2));
  newsstand.rotation.y = (lots[3].rotation * Math.PI) / 180;
  root.add(newsstand);

  // Lot 5: Deli
  const deli = createDeli(lots[5]);
  deli.position.set(lots[5].center.x, 0, lots[5].center.z - (lots[5].depth / 2 - 1.2));
  deli.rotation.y = (lots[5].rotation * Math.PI) / 180;
  root.add(deli);

  // Lot 6: Record / Cassette Shop
  const recordShop = createRecordCassetteShop(lots[6]);
  recordShop.position.set(lots[6].center.x, 0, lots[6].center.z - (lots[6].depth / 2 - 1.2));
  recordShop.rotation.y = (lots[6].rotation * Math.PI) / 180;
  root.add(recordShop);

  return {
    root,
    videoStore,
    arcade,
    newsstand,
    deli,
    recordShop,
    neonMeshes,
    update(_timeOfDay: number, _dt: number) {
      // Subtle pulse or animation if needed
    },
  };
}
