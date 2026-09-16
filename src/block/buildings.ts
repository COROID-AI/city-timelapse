/**
 * buildings.ts — per-era building structure generators for the block layer.
 *
 * Every era owns a distinct, detail-heavy structure variant across the four
 * lots: 1945 brick/brownstone low-rises, 1965 mid-century slabs, 1985
 * mirrored glass-and-neon towers, 2005 curtain-wall towers and 2025 glass
 * towers with LED crowns. The generators are pure three.js scene-graph
 * builders: they return a root Group plus a `TunableMaterial` registry so
 * BlockLayer can lerp facade colors continuously during era transitions and
 * swap the discrete shape variants at the transition midpoint.
 *
 * This module is owned by the block layer and is consumed read-only by the
 * signage generator and by BlockLayer itself.
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { LotExtent, LotId } from '../core/blockLayout';
import type { EraId, EraPalette } from '../eras/eraSystem';

/** Palette channels BlockLayer blends between eras. */
export type MaterialChannel = 'buildings' | 'accents' | 'signs' | 'ground' | 'light';

/**
 * A material whose color/glow is animated by BlockLayer during era
 * transitions. `channel` + `index` resolve into an era palette entry, so the
 * same registry works for every era pair.
 */
export interface TunableMaterial {
  readonly material: MeshStandardMaterial;
  readonly channel: MaterialChannel;
  /** Index into the era palette array for the channel. */
  readonly index: number;
  /** True when the material carries era-driven glow (windows, neon, LED). */
  readonly glow: boolean;
}

/** Builds a standard material and wraps it as a tunable registry record. */
export function makeTunable(
  channel: MaterialChannel,
  index: number,
  color: string,
  glow = false,
  metalness = 0.08,
): TunableMaterial {
  return {
    material: new MeshStandardMaterial({
      color,
      emissive: glow ? color : '#000000',
      emissiveIntensity: 0,
      roughness: glow ? 0.55 : 0.85,
      metalness,
    }),
    channel,
    index,
    glow,
  };
}

/** Per-era building structure variant keys (the acceptance-criteria names). */
export type BuildingVariantKey =
  | 'brick-brownstone'
  | 'midcentury-slab'
  | 'glass-neon-tower'
  | 'curtain-wall-tower'
  | 'glass-tower';

/** Map era -> building structure variant name, frozen and read-only. */
export const BUILDING_VARIANT_BY_ERA: Readonly<Record<EraId, BuildingVariantKey>> = Object.freeze({
  1945: 'brick-brownstone',
  1965: 'midcentury-slab',
  1985: 'glass-neon-tower',
  2005: 'curtain-wall-tower',
  2025: 'glass-tower',
});

/** Street-facing orientation of a lot's primary frontage. */
export type PrimaryFace = 'north' | 'south';
/** Secondary street-facing orientation of a lot's facade (wall-sign wall). */
export type FacadeFace = 'west' | 'east';

/** Where a building (and its storefront / ads) sits within one lot. */
export interface BuildingPlacement {
  readonly lotId: LotId;
  readonly centerX: number;
  readonly centerZ: number;
  readonly primaryFace: PrimaryFace;
  readonly facadeFace: FacadeFace;
  readonly footprintWidth: number;
  readonly footprintDepth: number;
}

/** One generated building for a single lot in a single era. */
export interface BuildingRecord {
  readonly lotId: LotId;
  readonly eraId: EraId;
  readonly variantKey: BuildingVariantKey;
  readonly kind: 'lowrise' | 'highrise';
  readonly heightMeters: number;
  readonly floors: number;
  readonly placement: BuildingPlacement;
  /** Main facade material, exposed so tests can verify continuous color lerp. */
  readonly facadeMaterial: MeshStandardMaterial;
  readonly root: Group;
  readonly tunables: readonly TunableMaterial[];
}

/** Footprint fractions per era: how much of a lot each variant occupies. */
const FOOTPRINT_FRACTIONS: Readonly<Record<EraId, { readonly width: number; readonly depth: number }>> =
  Object.freeze({
    1945: { width: 0.55, depth: 0.5 },
    1965: { width: 0.52, depth: 0.4 },
    1985: { width: 0.42, depth: 0.42 },
    2005: { width: 0.4, depth: 0.4 },
    2025: { width: 0.38, depth: 0.38 },
  });

/** Plans one lot's street-front footprint for a given era. */
export function planBuildingPlacement(
  lot: LotExtent,
  width: number,
  depth: number,
): BuildingPlacement {
  switch (lot.id) {
    case 'NW':
      return {
        lotId: 'NW',
        centerX: lot.minX + width * 0.52,
        centerZ: lot.maxZ - depth * 0.5,
        primaryFace: 'north',
        facadeFace: 'west',
        footprintWidth: width,
        footprintDepth: depth,
      };
    case 'NE':
      return {
        lotId: 'NE',
        centerX: lot.maxX - width * 0.52,
        centerZ: lot.maxZ - depth * 0.5,
        primaryFace: 'north',
        facadeFace: 'east',
        footprintWidth: width,
        footprintDepth: depth,
      };
    case 'SW':
      return {
        lotId: 'SW',
        centerX: lot.minX + width * 0.52,
        centerZ: lot.minZ + depth * 0.5,
        primaryFace: 'south',
        facadeFace: 'west',
        footprintWidth: width,
        footprintDepth: depth,
      };
    case 'SE':
      return {
        lotId: 'SE',
        centerX: lot.maxX - width * 0.52,
        centerZ: lot.minZ + depth * 0.5,
        primaryFace: 'south',
        facadeFace: 'east',
        footprintWidth: width,
        footprintDepth: depth,
      };
  }
}

/** Per-era footprint for a lot (used by storefront/ad placement too). */
export function planBuildingPlacementForEra(lot: LotExtent, eraId: EraId): BuildingPlacement {
  const fraction = FOOTPRINT_FRACTIONS[eraId];
  return planBuildingPlacement(lot, lot.width * fraction.width, lot.depth * fraction.depth);
}

interface BuildingVariantResult {
  readonly root: Group;
  readonly tunables: readonly TunableMaterial[];
  readonly heightMeters: number;
  readonly floors: number;
  readonly kind: 'lowrise' | 'highrise';
  readonly facadeMaterial: MeshStandardMaterial;
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

/** Signed distance from a building center to its primary street face. */
function frontOffset(face: PrimaryFace, depth: number): number {
  return face === 'north' ? depth / 2 : -depth / 2;
}

interface WindowStripOptions {
  readonly width: number;
  readonly depth: number;
  readonly heightMin: number;
  readonly heightMax: number;
  readonly rows: number;
  readonly cols: number;
  readonly glass: MeshStandardMaterial;
  readonly primaryFace: PrimaryFace;
  readonly facadeFace: FacadeFace;
}

/** Adds punched window strips on the two street-facing facades of a building. */
function addWindowStrips(parent: Group, opts: WindowStripOptions): void {
  const { width, depth, heightMin, heightMax, rows, cols, glass, primaryFace, facadeFace } = opts;
  const rowHeight = (heightMax - heightMin) / rows;
  const colGap = width / (cols + 1);
  const frontZ = frontOffset(primaryFace, depth) + (primaryFace === 'north' ? 0.1 : -0.1);
  for (let col = 1; col <= cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const win = boxMesh(width * 0.24, rowHeight * 0.55, 0.18, glass, 'window-strip');
      win.position.set(-width / 2 + colGap * col, heightMin + rowHeight * (row + 0.5), frontZ);
      parent.add(win);
    }
  }
  const sideX = (facadeFace === 'west' ? -1 : 1) * (width / 2 + 0.1);
  for (let col = 1; col <= cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      // Thin pane flush with the facade wall: 0.18 m in x, a tall strip of
      // depth * 0.24 m running along the wall.
      const win = boxMesh(0.18, rowHeight * 0.55, depth * 0.24, glass, 'window-strip');
      win.position.set(sideX, heightMin + rowHeight * (row + 0.5), -depth / 2 + colGap * col);
      parent.add(win);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 1945 — brick/brownstone low-rises (row-house style, pitched roofs).
 * ------------------------------------------------------------------ */

function buildBrownstone(
  place: BuildingPlacement,
  palette: EraPalette,
  variety: number,
): BuildingVariantResult {
  const root = new Group();
  root.name = 'building';

  const brick = makeTunable(
    'buildings',
    variety,
    palette.buildings[variety % palette.buildings.length],
  );
  const brickBase = makeTunable(
    'buildings',
    (variety + 2) % palette.buildings.length,
    palette.buildings[(variety + 2) % palette.buildings.length],
  );
  const trim = makeTunable(
    'accents',
    variety % palette.accents.length,
    palette.accents[variety % palette.accents.length],
  );
  const sign = makeTunable(
    'signs',
    variety % palette.signs.length,
    palette.signs[variety % palette.signs.length],
  );
  const windowGlass = makeTunable('light', 0, palette.light, true);

  const height = 13;
  const floors = 4;
  const wallHeight = height - 2.4;
  const w = place.footprintWidth;
  const d = place.footprintDepth;

  const body = boxMesh(w, wallHeight, d, brick.material, 'building-body');
  body.position.y = wallHeight / 2;
  root.add(body);

  // Ground-floor retail band in a darker brick.
  const base = boxMesh(w, 3.2, d, brickBase.material, 'building-base');
  base.position.y = 1.6;
  root.add(base);

  // Street-facing entry: stoop, door and cornice.
  const entry = boxMesh(1.6, 2.6, 0.5, sign.material, 'entry');
  entry.position.set(
    -w * 0.18,
    1.3,
    frontOffset(place.primaryFace, d) + (place.primaryFace === 'north' ? 0.3 : -0.3),
  );
  root.add(entry);

  const cornice = boxMesh(w + 0.7, 0.4, d + 0.7, trim.material, 'cornice');
  cornice.position.y = height - 0.8;
  root.add(cornice);

  // Pyramidal shingle roof (apex aligned with the facade midpoints).
  const roof = new Mesh(new ConeGeometry(Math.min(w, d) * 0.5, 2.8, 4), trim.material);
  roof.name = 'roof';
  roof.position.y = height + 1.2;
  root.add(roof);

  const chimney = boxMesh(0.6, 1.6, 0.6, brickBase.material, 'chimney');
  chimney.position.set(w * 0.2, height + 0.6, -d * 0.2);
  root.add(chimney);

  addWindowStrips(root, {
    width: w,
    depth: d,
    heightMin: 4.2,
    heightMax: height - 3.2,
    rows: 2,
    cols: 2,
    glass: windowGlass.material,
    primaryFace: place.primaryFace,
    facadeFace: place.facadeFace,
  });

  return {
    root,
    tunables: [brick, brickBase, trim, sign, windowGlass],
    heightMeters: height,
    floors,
    kind: 'lowrise',
    facadeMaterial: brick.material,
  };
}

/* ------------------------------------------------------------------ *
 * 1965 — mid-century slabs: retail podium, tile slab, ribbon windows.
 * ------------------------------------------------------------------ */

function buildMidcenturySlab(
  place: BuildingPlacement,
  palette: EraPalette,
  variety: number,
): BuildingVariantResult {
  const root = new Group();
  root.name = 'building';

  const tile = makeTunable(
    'buildings',
    (variety + 1) % palette.buildings.length,
    palette.buildings[(variety + 1) % palette.buildings.length],
  );
  const tileDark = makeTunable(
    'buildings',
    variety % palette.buildings.length,
    palette.buildings[variety % palette.buildings.length],
  );
  const chrome = makeTunable(
    'accents',
    variety % palette.accents.length,
    palette.accents[variety % palette.accents.length],
    false,
    0.92,
  );
  const windowGlass = makeTunable('light', 0, '#22303a', true);
  const ribbon = makeTunable(
    'signs',
    variety % palette.signs.length,
    palette.signs[variety % palette.signs.length],
    true,
  );

  const height = 34;
  const floors = 8;
  const podiumHeight = 5;
  const towerWidth = place.footprintWidth * 0.55;
  const towerDepth = place.footprintDepth * 0.5;
  const towerHeight = height - podiumHeight;
  const w = place.footprintWidth;
  const d = place.footprintDepth;

  const podium = boxMesh(w, podiumHeight, d, tileDark.material, 'retail-podium');
  podium.position.y = podiumHeight / 2;
  root.add(podium);

  const slab = boxMesh(towerWidth, towerHeight, towerDepth, tile.material, 'slab-tower');
  slab.position.y = podiumHeight + towerHeight / 2;
  root.add(slab);

  const parapet = boxMesh(towerWidth + 0.5, 0.6, towerDepth + 0.5, chrome.material, 'parapet');
  parapet.position.y = height - 0.3;
  root.add(parapet);

  const penthouse = boxMesh(towerWidth * 0.5, 3, towerDepth * 0.5, tileDark.material, 'penthouse');
  penthouse.position.y = height + 1.5;
  root.add(penthouse);

  // Ribbon windows across the primary facade + decorative vertical fins.
  const frontZ = frontOffset(place.primaryFace, towerDepth) + 0.1;
  for (let row = 0; row < floors; row += 1) {
    const band = boxMesh(towerWidth * 0.94, 0.22, 0.14, windowGlass.material, 'window-strip');
    band.position.set(0, podiumHeight + 1.6 + row * ((towerHeight - 4) / floors), frontZ);
    root.add(band);
  }
  for (let col = 0; col < 4; col += 1) {
    const fin = boxMesh(0.2, towerHeight, 0.12, chrome.material, 'facade-fin');
    fin.position.set(-towerWidth / 2 + ((col + 1) * towerWidth) / 5, podiumHeight + towerHeight / 2, frontZ - 0.4);
    root.add(fin);
  }

  // Neon storefront accent band on the podium edge (marquee-style strip).
  const neonBand = boxMesh(w * 0.6, 0.12, 0.1, ribbon.material, 'neon-storefront-band');
  neonBand.position.set(0, podiumHeight - 0.7, frontOffset(place.primaryFace, d) + 0.15);
  root.add(neonBand);

  return {
    root,
    tunables: [tile, tileDark, chrome, windowGlass, ribbon],
    heightMeters: height,
    floors,
    kind: 'highrise',
    facadeMaterial: tile.material,
  };
}

/* ------------------------------------------------------------------ *
 * 1985 — mirrored glass-and-neon towers with glowing edge strips.
 * ------------------------------------------------------------------ */

function buildGlassNeonTower(
  place: BuildingPlacement,
  palette: EraPalette,
  variety: number,
): BuildingVariantResult {
  const root = new Group();
  root.name = 'building';

  const mirror = makeTunable(
    'buildings',
    variety % palette.buildings.length,
    palette.buildings[variety % palette.buildings.length],
    false,
    0.95,
  );
  const baseDark = makeTunable(
    'buildings',
    (variety + 2) % palette.buildings.length,
    palette.buildings[(variety + 2) % palette.buildings.length],
    false,
    0.35,
  );
  const neonA = makeTunable(
    'signs',
    variety % palette.signs.length,
    palette.signs[variety % palette.signs.length],
    true,
  );
  const neonB = makeTunable(
    'signs',
    (variety + 1) % palette.signs.length,
    palette.signs[(variety + 1) % palette.signs.length],
    true,
  );
  const windowGlass = makeTunable('light', 0, '#1c2733', true);

  const height = 72;
  const floors = 18;
  const baseHeight = 8;
  const towerWidth = place.footprintWidth * 0.36;
  const towerDepth = place.footprintDepth * 0.36;
  const towerHeight = height - baseHeight;
  const w = place.footprintWidth;
  const d = place.footprintDepth;

  const baseBox = boxMesh(w, baseHeight, d, baseDark.material, 'tower-base');
  baseBox.position.y = baseHeight / 2;
  root.add(baseBox);

  const tower = boxMesh(towerWidth, towerHeight, towerDepth, mirror.material, 'tower-shaft');
  tower.position.y = baseHeight + towerHeight / 2;
  root.add(tower);

  // Glowing neon edge strips on all four tower corners.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const edge = new Mesh(
        new CylinderGeometry(0.14, 0.14, towerHeight, 10),
        neonA.material,
      );
      edge.name = 'neon-strip';
      edge.position.set((sx * towerWidth) / 2, baseHeight + towerHeight / 2, (sz * towerDepth) / 2);
      root.add(edge);
    }
  }

  const crown = boxMesh(towerWidth + 0.4, 1.4, towerDepth + 0.4, neonB.material, 'neon-crown');
  crown.position.y = baseHeight + towerHeight + 0.7;
  root.add(crown);

  addWindowStrips(root, {
    width: towerWidth,
    depth: towerDepth,
    heightMin: baseHeight + 2,
    heightMax: height - 3,
    rows: 5,
    cols: 3,
    glass: windowGlass.material,
    primaryFace: place.primaryFace,
    facadeFace: place.facadeFace,
  });

  return {
    root,
    tunables: [mirror, baseDark, neonA, neonB, windowGlass],
    heightMeters: height,
    floors,
    kind: 'highrise',
    facadeMaterial: mirror.material,
  };
}

/* ------------------------------------------------------------------ *
 * 2005 — curtain-wall towers with spandrel bands and backlit signage.
 * ------------------------------------------------------------------ */

function buildCurtainWallTower(
  place: BuildingPlacement,
  palette: EraPalette,
  variety: number,
): BuildingVariantResult {
  const root = new Group();
  root.name = 'building';

  const glass = makeTunable(
    'buildings',
    variety % palette.buildings.length,
    palette.buildings[variety % palette.buildings.length],
    false,
    0.45,
  );
  const spandrel = makeTunable(
    'accents',
    variety % palette.accents.length,
    palette.accents[variety % palette.accents.length],
    false,
    0.15,
  );
  const backlit = makeTunable(
    'signs',
    0,
    palette.signs[0 % palette.signs.length],
    true,
  );
  const windowGlass = makeTunable('light', 0, '#2b3a48', true);

  const height = 85;
  const floors = 22;
  const baseHeight = 7;
  const setbackHeight = 6;
  const towerHeight = height - baseHeight - setbackHeight;
  const towerWidth = place.footprintWidth * 0.44;
  const towerDepth = place.footprintDepth * 0.44;
  const w = place.footprintWidth;
  const d = place.footprintDepth;

  const baseBox = boxMesh(w, baseHeight, d, spandrel.material, 'tower-base');
  baseBox.position.y = baseHeight / 2;
  root.add(baseBox);

  const tower = boxMesh(towerWidth, towerHeight, towerDepth, glass.material, 'tower-shaft');
  tower.position.y = baseHeight + towerHeight / 2;
  root.add(tower);

  // Spandrel bands wrap the tower every few floors.
  for (let band = 0; band < 8; band += 1) {
    const strip = boxMesh(towerWidth + 0.06, 0.5, towerDepth + 0.06, spandrel.material, 'spandrel-band');
    strip.position.y = baseHeight + 3 + band * ((towerHeight - 6) / 8);
    root.add(strip);
  }

  // Setback crown floor.
  const crown = boxMesh(towerWidth * 0.62, setbackHeight, towerDepth * 0.62, glass.material, 'setback-crown');
  crown.position.y = height - setbackHeight / 2;
  root.add(crown);

  // Backlit sign band near the tower top, facing the primary street.
  const backlitBand = boxMesh(towerWidth * 0.8, 1.4, 0.16, backlit.material, 'backlit-band');
  backlitBand.position.set(0, height - 9.5, frontOffset(place.primaryFace, towerDepth) + 0.45);
  root.add(backlitBand);

  addWindowStrips(root, {
    width: towerWidth,
    depth: towerDepth,
    heightMin: baseHeight + 2,
    heightMax: height - setbackHeight - 2,
    rows: 5,
    cols: 3,
    glass: windowGlass.material,
    primaryFace: place.primaryFace,
    facadeFace: place.facadeFace,
  });

  return {
    root,
    tunables: [glass, spandrel, backlit, windowGlass],
    heightMeters: height,
    floors,
    kind: 'highrise',
    facadeMaterial: glass.material,
  };
}

/* ------------------------------------------------------------------ *
 * 2025 — glass towers with LED strips, crown and helipad.
 * ------------------------------------------------------------------ */

function buildGlassTower(
  place: BuildingPlacement,
  palette: EraPalette,
  variety: number,
): BuildingVariantResult {
  const root = new Group();
  root.name = 'building';

  const glass = makeTunable(
    'buildings',
    variety % palette.buildings.length,
    palette.buildings[variety % palette.buildings.length],
    false,
    0.85,
  );
  const baseDark = makeTunable(
    'buildings',
    2 % palette.buildings.length,
    palette.buildings[2 % palette.buildings.length],
    false,
    0.4,
  );
  const ledA = makeTunable(
    'signs',
    0,
    palette.signs[0 % palette.signs.length],
    true,
  );
  const ledB = makeTunable(
    'signs',
    1,
    palette.signs[1 % palette.signs.length],
    true,
  );
  const windowGlass = makeTunable('light', 0, '#cfe0ea', true);

  const height = 100;
  const floors = 26;
  const baseHeight = 7;
  const towerHeight = height - baseHeight - 5;
  const towerWidth = place.footprintWidth * 0.42;
  const towerDepth = place.footprintDepth * 0.42;
  const w = place.footprintWidth;
  const d = place.footprintDepth;

  const baseBox = boxMesh(w, baseHeight, d, baseDark.material, 'tower-base');
  baseBox.position.y = baseHeight / 2;
  root.add(baseBox);

  const tower = boxMesh(towerWidth, towerHeight, towerDepth, glass.material, 'tower-shaft');
  tower.position.y = baseHeight + towerHeight / 2;
  root.add(tower);

  // Vertical LED strips along the primary facade.
  for (let col = 0; col < 6; col += 1) {
    const strip = boxMesh(0.22, towerHeight, 0.22, ledA.material, 'led-strip');
    strip.position.set(
      -towerWidth / 2 + ((col + 1) * towerWidth) / 7,
      baseHeight + towerHeight / 2,
      frontOffset(place.primaryFace, towerDepth) + 0.35,
    );
    root.add(strip);
  }

  // LED crown ring on the roof corners.
  for (const sx of [-1, 1]) {
    const crown = boxMesh(towerWidth * 0.7, 0.35, 0.35, ledB.material, 'led-crown');
    crown.position.set((sx * towerWidth) / 2.8, height - 0.8, frontOffset(place.primaryFace, towerDepth));
    root.add(crown);
  }

  const helipad = new Mesh(new CylinderGeometry(3.2, 3.2, 0.25, 24), glass.material);
  helipad.name = 'helipad';
  helipad.position.y = height - 0.5;
  root.add(helipad);

  addWindowStrips(root, {
    width: towerWidth,
    depth: towerDepth,
    heightMin: baseHeight + 2,
    heightMax: height - 6,
    rows: 6,
    cols: 4,
    glass: windowGlass.material,
    primaryFace: place.primaryFace,
    facadeFace: place.facadeFace,
  });

  return {
    root,
    tunables: [glass, baseDark, ledA, ledB, windowGlass],
    heightMeters: height,
    floors,
    kind: 'highrise',
    facadeMaterial: glass.material,
  };
}

/* ------------------------------------------------------------------ *
 * Public generator.
 * ------------------------------------------------------------------ */

/** Builds the era-specific structure for one lot and stamps era metadata. */
export function buildBuilding(
  lot: LotExtent,
  eraId: EraId,
  palette: EraPalette,
  variety: number,
): BuildingRecord {
  const placement = planBuildingPlacementForEra(lot, eraId);
  const variantKey = BUILDING_VARIANT_BY_ERA[eraId];

  let result: BuildingVariantResult;
  switch (eraId) {
    case 1945:
      result = buildBrownstone(placement, palette, variety);
      break;
    case 1965:
      result = buildMidcenturySlab(placement, palette, variety);
      break;
    case 1985:
      result = buildGlassNeonTower(placement, palette, variety);
      break;
    case 2005:
      result = buildCurtainWallTower(placement, palette, variety);
      break;
    case 2025:
      result = buildGlassTower(placement, palette, variety);
      break;
    default:
      throw new Error(`buildBuilding: unsupported era ${String(eraId)}`);
  }

  const root = result.root;
  root.name = 'building';
  root.userData.variantKey = variantKey;
  root.userData.eraId = eraId;
  root.userData.lotId = lot.id;
  root.position.set(placement.centerX, 0, placement.centerZ);

  return {
    lotId: lot.id,
    eraId,
    variantKey,
    kind: result.kind,
    heightMeters: result.heightMeters,
    floors: result.floors,
    placement,
    facadeMaterial: result.facadeMaterial,
    root,
    tunables: result.tunables,
  };
}