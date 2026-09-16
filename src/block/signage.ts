/**
 * signage.ts — per-era storefront facades and building-mounted advertisements
 * for the block layer.
 *
 * Storefronts carry the period facade anatomy — awnings, display windows,
 * doors, and era-specific signage:
 *   1945 painted wall signs, 1965 neon + theater marquees, 1985 glowing neon,
 *   2005 backlit panels, 2025 LED strips and tickers.
 *
 * Advertisements are mounted on building rooftops and secondary street walls
 * and follow the era's display technology: painted posters, neon signs, CRT
 * billboards, backlit signs and giant LED billboards — each stamped with the
 * era's ad copy.
 *
 * Owned by the block layer; BlockLayer rebuilds these discreetly at the
 * transition midpoint and registers their materials as tunables.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { LotId } from '../core/blockLayout';
import type { EraDefinition, EraId } from '../eras/eraSystem';
import { makeTunable, type TunableMaterial } from './buildings';

export interface StorefrontFacadeOptions {
  readonly era: EraDefinition;
  readonly lotId: LotId;
  readonly centerX: number;
  readonly centerZ: number;
  readonly face: 'north' | 'south';
  readonly width: number;
  readonly variety: number;
}

/** One era-variant storefront facade with its countable anatomy. */
export interface StorefrontFacade {
  readonly eraId: EraId;
  readonly signageKey: EraDefinition['storefronts']['signage'];
  readonly shopType: string;
  readonly root: Group;
  readonly displayWindowCount: number;
  readonly doorCount: number;
  readonly awningCount: number;
  readonly marqueeCount: number;
  readonly wallSignCount: number;
  readonly neonTubeCount: number;
  readonly backlitPanelCount: number;
  readonly ledStripCount: number;
  readonly tunables: readonly TunableMaterial[];
}

function boxMesh(
  width: number,
  height: number,
  depth: number,
  material: MeshStandardMaterial,
  name: string,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  mesh.name = name;
  return mesh;
}

/** Builds the era storefront on a lot's primary street frontage. */
export function buildStorefront(opts: StorefrontFacadeOptions): StorefrontFacade {
  const { era, lotId, centerX, centerZ, face, width, variety } = opts;
  const root = new Group();
  root.name = 'storefront';
  const signageKey = era.storefronts.signage;
  const shopType = era.storefronts.shopTypes[variety % era.storefronts.shopTypes.length];
  root.userData.eraId = era.id;
  root.userData.lotId = lotId;
  root.userData.signageKey = signageKey;
  root.userData.shopType = shopType;
  root.position.set(centerX, 0, centerZ);

  const sign = face === 'north' ? 1 : -1;
  const tunables: TunableMaterial[] = [];

  const wall = makeTunable(
    'accents',
    variety % era.palette.accents.length,
    era.palette.accents[variety % era.palette.accents.length],
  );
  const glass = makeTunable('light', 0, era.palette.light, true);
  glass.material.metalness = 0.6;
  glass.material.roughness = 0.15;
  const awning = makeTunable(
    'accents',
    (variety + 1) % era.palette.accents.length,
    era.storefronts.awningColors[variety % era.storefronts.awningColors.length],
  );
  const trim = makeTunable(
    'accents',
    (variety + 2) % era.palette.accents.length,
    era.palette.accents[(variety + 2) % era.palette.accents.length],
  );
  tunables.push(wall, glass, awning, trim);

  // Signage wall band above the display windows.
  const wallBand = boxMesh(width * 0.86, 0.9, 0.2, wall.material, 'storefront-wall');
  wallBand.position.set(0, 3.5, sign * 0.15);
  root.add(wallBand);

  // Three display windows.
  const panes = 3;
  const paneWidth = width * 0.22;
  const paneGap = width * 0.24;
  let displayWindowCount = 0;
  for (let i = 0; i < panes; i += 1) {
    const pane = boxMesh(paneWidth, 2.2, 0.14, glass.material, 'display-window');
    pane.position.set(-paneGap + i * paneGap, 1.8, sign * 0.1);
    root.add(pane);
    displayWindowCount += 1;
  }

  // Street door.
  const door = boxMesh(1.1, 2.5, 0.2, trim.material, 'door');
  door.position.set(width * 0.34, 1.25, sign * 0.15);
  root.add(door);

  // Canvas awning canopy over the display windows.
  const awningMesh = boxMesh(width * 0.8, 0.12, 1.5, awning.material, 'awning');
  awningMesh.position.set(0, 3.1, sign * 0.75);
  root.add(awningMesh);

  let marqueeCount = 0;
  let wallSignCount = 0;
  let neonTubeCount = 0;
  let backlitPanelCount = 0;
  let ledStripCount = 0;

  switch (signageKey) {
    case 'painted': {
      const paint = makeTunable(
        'signs',
        variety % era.palette.signs.length,
        era.palette.signs[variety % era.palette.signs.length],
      );
      const panel = boxMesh(width * 0.66, 0.7, 0.1, paint.material, 'wall-sign');
      panel.position.set(0, 3.85, sign * 0.28);
      panel.userData.copy = shopType.toUpperCase();
      root.add(panel);
      tunables.push(paint);
      wallSignCount += 1;
      break;
    }
    case 'neon': {
      const tubeMat = makeTunable(
        'signs',
        variety % era.palette.signs.length,
        era.palette.signs[variety % era.palette.signs.length],
        true,
      );
      const tubeCount = era.id === 1965 ? 3 : 4;
      // Horizontal tube along the wall band.
      const horizontal = new Mesh(
        new CylinderGeometry(0.07, 0.07, width * 0.9, 10),
        tubeMat.material,
      );
      horizontal.name = 'neon-tube';
      horizontal.rotation.z = Math.PI / 2;
      horizontal.position.set(0, 3.55, sign * 0.3);
      root.add(horizontal);
      neonTubeCount += 1;
      // Short vertical returns framing the sign.
      for (let v = 0; v < (tubeCount - 1) / 2; v += 1) {
        for (const side of [-1, 1]) {
          const vertical = new Mesh(
            new CylinderGeometry(0.07, 0.07, 0.8, 10),
            tubeMat.material,
          );
          vertical.name = 'neon-tube';
          vertical.position.set(side * (width * 0.3 + v * width * 0.12), 3.25, sign * 0.3);
          root.add(vertical);
          neonTubeCount += 1;
        }
      }
      tunables.push(tubeMat);

      // Classic mid-century theater marquee with scalloped bulbs.
      if (era.id === 1965) {
        const marqueeMat = makeTunable(
          'accents',
          (variety + 3) % era.palette.accents.length,
          era.palette.accents[(variety + 3) % era.palette.accents.length],
        );
        const marquee = boxMesh(width * 0.5, 1.0, 0.55, marqueeMat.material, 'marquee');
        marquee.position.set(0, 3.15, sign * 0.7);
        root.add(marquee);
        marqueeCount += 1;
        const bulbMat = makeTunable(
          'signs',
          (variety + 1) % era.palette.signs.length,
          era.palette.signs[(variety + 1) % era.palette.signs.length],
          true,
        );
        for (let bulb = -2; bulb <= 2; bulb += 1) {
          const ball = new Mesh(new SphereGeometry(0.12, 8, 6), bulbMat.material);
          ball.name = 'marquee-bulb';
          ball.position.set(bulb * 0.85, 3.15, sign * 1.0);
          root.add(ball);
        }
        tunables.push(marqueeMat, bulbMat);
      }
      break;
    }
    case 'crt': {
      // 1985-era CRT storefront sign (scanline panel + neon trim).
      const tubeMat = makeTunable(
        'signs',
        variety % era.palette.signs.length,
        era.palette.signs[variety % era.palette.signs.length],
        true,
      );
      const panel = boxMesh(width * 0.72, 0.9, 0.12, tubeMat.material, 'crt-storefront-sign');
      panel.position.set(0, 3.6, sign * 0.3);
      panel.userData.copy = shopType.toUpperCase();
      root.add(panel);
      for (let line = 0; line < 4; line += 1) {
        const scan = boxMesh(width * 0.68, 0.05, 0.16, wall.material, 'crt-scanline');
        scan.position.set(0, 3.25 + line * 0.22, sign * 0.34);
        root.add(scan);
      }
      tunables.push(tubeMat);
      neonTubeCount = 2;
      break;
    }
    case 'backlit': {
      const panelMat = makeTunable(
        'signs',
        variety % era.palette.signs.length,
        era.palette.signs[variety % era.palette.signs.length],
        true,
      );
      const panel = boxMesh(width * 0.72, 1.0, 0.12, panelMat.material, 'backlit-panel');
      panel.position.set(0, 3.6, sign * 0.3);
      panel.userData.copy = shopType.toUpperCase();
      root.add(panel);
      tunables.push(panelMat);
      backlitPanelCount += 1;
      break;
    }
    case 'led': {
      const ledMat = makeTunable(
        'signs',
        variety % era.palette.signs.length,
        era.palette.signs[variety % era.palette.signs.length],
        true,
      );
      const strip = boxMesh(width * 0.7, 0.35, 0.1, ledMat.material, 'led-strip');
      strip.position.set(0, 3.55, sign * 0.3);
      strip.userData.copy = shopType.toUpperCase();
      root.add(strip);
      const tickerMat = makeTunable(
        'signs',
        (variety + 1) % era.palette.signs.length,
        era.palette.signs[(variety + 1) % era.palette.signs.length],
        true,
      );
      const ticker = boxMesh(width * 0.5, 0.24, 0.1, tickerMat.material, 'led-strip');
      ticker.position.set(0, 3.15, sign * 0.3);
      root.add(ticker);
      tunables.push(ledMat, tickerMat);
      ledStripCount += 2;
      break;
    }
  }

  return {
    eraId: era.id,
    signageKey,
    shopType,
    root,
    displayWindowCount,
    doorCount: 1,
    awningCount: 1,
    marqueeCount,
    wallSignCount,
    neonTubeCount,
    backlitPanelCount,
    ledStripCount,
    tunables,
  };
}

/* ------------------------------------------------------------------ *
 * Advertisements.
 * ------------------------------------------------------------------ */

export interface AdvertisementOptions {
  readonly era: EraDefinition;
  readonly copy: string;
  readonly kind: 'rooftop' | 'facade';
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly facing: 'north' | 'south' | 'east' | 'west';
  readonly width: number;
  readonly height: number;
}

/** One building-mounted advertisement with its era display technology. */
export interface Advertisement {
  readonly eraId: EraId;
  readonly technology: EraDefinition['advertisements']['technology'];
  readonly copy: string;
  readonly kind: 'rooftop' | 'facade';
  readonly animated: boolean;
  readonly root: Group;
  readonly panelMaterial: MeshStandardMaterial;
  /** Emissive intensity target derived from the era atmosphere bloom. */
  readonly baseGlow: number;
  /** Deterministic per-ad flicker phase. */
  readonly phase: number;
  readonly tunables: readonly TunableMaterial[];
}

/** Rotation that orients a +z-facing panel toward a cardinal direction. */
function facingRotation(facing: AdvertisementOptions['facing']): number {
  switch (facing) {
    case 'north':
      return 0;
    case 'south':
      return Math.PI;
    case 'east':
      return Math.PI / 2;
    case 'west':
      return -Math.PI / 2;
  }
}

/**
 * Builds an advertisement panel for the era's display technology. Panels are
 * built in north-facing local space; `facingRotation` orients them outward.
 */
export function buildAdvertisement(opts: AdvertisementOptions): Advertisement {
  const { era, copy, kind, position, facing, width, height } = opts;
  const root = new Group();
  root.name = 'advertisement';
  const technology = era.advertisements.technology;
  root.userData.technology = technology;
  root.userData.copy = copy;
  root.userData.kind = kind;
  root.position.set(position.x, position.y, position.z);
  root.rotation.y = facingRotation(facing);

  const tunables: TunableMaterial[] = [];
  let panelMaterial: MeshStandardMaterial;
  let animated = era.advertisements.animated;

  switch (technology) {
    case 'painted-poster': {
      const paper = makeTunable('signs', 3, era.advertisements.colors[3 % era.advertisements.colors.length]);
      const ink = makeTunable(
        'signs',
        0,
        era.advertisements.colors[0 % era.advertisements.colors.length],
      );
      const frame = makeTunable(
        'signs',
        1,
        era.advertisements.colors[1 % era.advertisements.colors.length],
      );
      const panel = boxMesh(width, height, 0.3, paper.material, 'billboard-panel');
      root.add(panel);
      panelMaterial = paper.material;
      // Painted poster frame.
      const top = boxMesh(width + 0.24, 0.24, 0.34, frame.material, 'poster-frame');
      top.position.y = height / 2 + 0.08;
      root.add(top);
      const bottom = boxMesh(width + 0.24, 0.24, 0.34, frame.material, 'poster-frame');
      bottom.position.y = -height / 2 - 0.08;
      root.add(bottom);
      // War-effort poster stripe.
      const stripe = boxMesh(width * 0.7, 0.35, 0.4, ink.material, 'poster-stripe');
      root.add(stripe);
      tunables.push(paper, ink, frame);
      break;
    }
    case 'neon-sign': {
      const plate = makeTunable('signs', 1, era.advertisements.colors[1 % era.advertisements.colors.length]);
      const neon = makeTunable('signs', 0, era.advertisements.colors[0 % era.advertisements.colors.length], true);
      const panel = boxMesh(width, height, 0.3, plate.material, 'billboard-panel');
      root.add(panel);
      panelMaterial = plate.material;
      // Neon border tubes around the panel edge.
      const long = new Mesh(new CylinderGeometry(0.09, 0.09, width + 0.3, 8), neon.material);
      long.name = 'sign-neon-tube';
      long.rotation.z = Math.PI / 2;
      long.position.y = height / 2 + 0.22;
      root.add(long);
      const longBottom = long.clone();
      longBottom.position.y = -height / 2 - 0.22;
      root.add(longBottom);
      const short = new Mesh(new CylinderGeometry(0.09, 0.09, height + 0.3, 8), neon.material);
      short.name = 'sign-neon-tube';
      short.position.x = -width / 2 - 0.22;
      root.add(short);
      const shortRight = short.clone();
      shortRight.position.x = width / 2 + 0.22;
      root.add(shortRight);
      tunables.push(plate, neon);
      break;
    }
    case 'crt-billboard': {
      const screen = makeTunable('signs', 0, era.advertisements.colors[0 % era.advertisements.colors.length], true);
      const ledger = makeTunable('accents', 0, era.palette.accents[0 % era.palette.accents.length], false, 0.6);
      const panel = boxMesh(width, height, 0.35, screen.material, 'billboard-panel');
      root.add(panel);
      panelMaterial = screen.material;
      // CRT scanlines on the screen surface.
      for (let line = 0; line < 5; line += 1) {
        const scan = boxMesh(width * 0.98, 0.08, 0.04, ledger.material, 'crt-scanline');
        scan.position.set(0, -height / 2 + ((line + 0.5) * height) / 5, 0.2);
        root.add(scan);
      }
      // Glowing neon trim on the bottom edge.
      const neon = makeTunable('signs', 1, era.advertisements.colors[1 % era.advertisements.colors.length], true);
      const trimTube = new Mesh(new CylinderGeometry(0.1, 0.1, width * 0.8, 8), neon.material);
      trimTube.name = 'sign-neon-tube';
      trimTube.rotation.z = Math.PI / 2;
      trimTube.position.y = -height / 2 - 0.35;
      root.add(trimTube);
      tunables.push(screen, ledger, neon);
      break;
    }
    case 'backlit-sign': {
      const face = makeTunable('signs', 0, era.advertisements.colors[0 % era.advertisements.colors.length], true);
      const frameMat = makeTunable('accents', 1, era.palette.accents[1 % era.palette.accents.length], false, 0.5);
      const panel = boxMesh(width, height, 0.3, face.material, 'billboard-panel');
      root.add(panel);
      panelMaterial = face.material;
      const bezel = boxMesh(width + 0.3, 0.3, 0.36, frameMat.material, 'backlit-frame');
      bezel.position.y = height / 2;
      root.add(bezel);
      const bezelBottom = bezel.clone();
      bezelBottom.position.y = -height / 2;
      root.add(bezelBottom);
      tunables.push(face, frameMat);
      break;
    }
    case 'giant-led': {
      const face = makeTunable('signs', 0, era.advertisements.colors[0 % era.advertisements.colors.length], true);
      const cellMat = makeTunable('signs', 1, era.advertisements.colors[1 % era.advertisements.colors.length], true);
      const panel = boxMesh(width, height, 0.35, face.material, 'billboard-panel');
      root.add(panel);
      panelMaterial = face.material;
      // The familiar big-LED cell grid.
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const cell = boxMesh(width * 0.16, height * 0.3, 0.06, cellMat.material, 'led-cell');
          cell.position.set(
            -width / 2 + ((col + 0.5) * width) / 4,
            -height / 2 + ((row + 0.5) * height) / 2,
            0.2,
          );
          root.add(cell);
        }
      }
      tunables.push(face, cellMat);
      break;
    }
  }

  // Mounting legs for rooftop billboards (wall signs use flush brackets).
  if (kind === 'rooftop') {
    const legMat = makeTunable(
      'accents',
      0,
      era.palette.accents[0 % era.palette.accents.length],
      false,
      0.7,
    );
    const legLeft = boxMesh(0.3, 1.2, 0.3, legMat.material, 'billboard-leg');
    legLeft.position.set(-width * 0.35, -height / 2 - 0.6, 0);
    root.add(legLeft);
    const legRight = boxMesh(0.3, 1.2, 0.3, legMat.material, 'billboard-leg');
    legRight.position.set(width * 0.35, -height / 2 - 0.6, 0);
    root.add(legRight);
    tunables.push(legMat);
  } else {
    const bracket = boxMesh(0.25, 0.4, 0.5, tunables[0].material, 'billboard-bracket');
    bracket.position.set(0, 0, -0.32);
    root.add(bracket);
  }

  return {
    eraId: era.id,
    technology,
    copy,
    kind,
    animated,
    root,
    panelMaterial,
    baseGlow: era.atmosphere.bloom * 1.4,
    phase: (kind === 'rooftop' ? 1.7 : 3.1) + width * 0.13,
    tunables,
  };
}