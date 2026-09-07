import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { LotAnchor } from '../../layout/lotAnchors';
import { Vec2 } from '../../types/city';
import { era1945Palette, Rgb } from './palette';

/**
 * 1945 post-war architecture.
 *
 * Low-rise brick/stone facades with visible war-era repair patches and
 * bombed-lot gaps, coal-smoke-stained masonry, sash windows and fire escapes.
 * Each building is assembled from box primitives, so it renders in the Three.js
 * WebGL pipeline and type-checks against the narrow `three.d.ts` scaffold
 * declarations.
 */

/** A single window cut into a facade (local coords, meters). */
export interface SashWindow {
  /** Local x offset of the window centre along the facade. */
  x: number;
  /** Base height of the window above the ground. */
  y: number;
  width: number;
  height: number;
  /** Whether the window shows a warm 2700K glow (lit after dark). */
  lit: boolean;
}

/** A fire-escape landing or run placed on the facade. */
export interface FireEscape {
  /** Local x offset of the escape centre. */
  x: number;
  /** Number of landing levels. */
  levels: number;
}

/** A bombed-lot gap: a missing portion of the building volume. */
export interface BombedGap {
  /** Local x offset of the gap centre. */
  x: number;
  /** Gap width in meters. */
  width: number;
  /** Gap height in meters. */
  height: number;
}

/** A war-era repair patch (lighter brick infill) on the facade. */
export interface RepairPatch {
  /** Local x offset of the patch centre. */
  x: number;
  /** Patch base height. */
  y: number;
  width: number;
  height: number;
}

/** The data definition of one 1945 building. */
export interface EraBuilding {
  /** Which lot this building occupies. */
  lotId: string;
  /** Lot index into the layout. */
  lotIndex: number;
  /** Building height in meters. */
  height: number;
  /** Facade colour (brick or stone). */
  facade: Rgb;
  /** Whether the facade is coal-smoke stained. */
  smokeStained: boolean;
  /** Sash windows on the street facade. */
  windows: SashWindow[];
  /** Fire escapes on the street facade. */
  fireEscapes: FireEscape[];
  /** Bombed-lot gaps (missing volume). */
  gaps: BombedGap[];
  /** War-era repair patches. */
  patches: RepairPatch[];
}

const WINDOW_FRAME = era1945Palette.windowFrame;
const WINDOW_GLASS = era1945Palette.windowGlass;
const GLOW = era1945Palette.incandescent;

/** Build a mesh at a world position with a graded colour. */
function boxMesh(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: Rgb,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial());
  mesh.material.color.setRGB(color.r, color.g, color.b);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

/** Build a window pane (glass + frame) in front of a facade. */
function buildWindow(
  scene: Scene,
  world: Vec2,
  facadeZ: number,
  rotation: number,
  win: SashWindow,
): Mesh[] {
  const meshes: Mesh[] = [];
  const cx = world.x + win.x;
  const cy = win.y + win.height / 2;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  // Offset the pane out of the facade plane.
  const oz = 0.15;
  const z = facadeZ + (oz * cosR - 0 * sinR);
  const x = cx + (0 * cosR + oz * sinR);
  const frame = boxMesh(
    scene,
    x,
    cy,
    z,
    win.width + 0.18,
    win.height + 0.18,
    0.12,
    WINDOW_FRAME,
  );
  frame.rotation.y = rotation;
  meshes.push(frame);
  const glassColor = win.lit ? GLOW : WINDOW_GLASS;
  const pane = boxMesh(
    scene,
    x,
    cy,
    z,
    win.width,
    win.height,
    0.06,
    glassColor,
  );
  pane.rotation.y = rotation;
  meshes.push(pane);
  return meshes;
}

/** Build a vertical fire-escape run on the facade. */
function buildFireEscape(
  scene: Scene,
  world: Vec2,
  facadeZ: number,
  rotation: number,
  escape: FireEscape,
): Mesh[] {
  const meshes: Mesh[] = [];
  const cx = world.x + escape.x;
  const railColor = { r: 0.13, g: 0.12, b: 0.12 };
  const levelHeight = 2.6;
  const landingDepth = 0.9;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const oz = 0.55;
  const z = facadeZ + (oz * cosR - 0 * sinR);
  const x = cx + (0 * cosR + oz * sinR);
  for (let i = 0; i < escape.levels; i++) {
    const y = 2.2 + i * levelHeight;
    // Landing platform.
    const land = boxMesh(scene, x, y, z, 1.4, 0.12, landingDepth, railColor);
    land.rotation.y = rotation;
    meshes.push(land);
    // Two vertical rails.
    for (const side of [-0.6, 0.6]) {
      const rail = boxMesh(
        scene,
        x + side * cosR,
        y + 0.6,
        z + side * sinR,
        0.08,
        levelHeight,
        0.08,
        railColor,
      );
      rail.rotation.y = rotation;
      meshes.push(rail);
    }
  }
  return meshes;
}

/** Build a bombed-lot gap as a dark recessed panel in the facade. */
function buildGap(
  scene: Scene,
  world: Vec2,
  facadeZ: number,
  rotation: number,
  gap: BombedGap,
): Mesh[] {
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const cx = world.x + gap.x;
  const cy = gap.height / 2;
  const oz = -0.1; // slightly recessed
  const z = facadeZ + (oz * cosR - 0 * sinR);
  const x = cx + (0 * cosR + oz * sinR);
  const panel = boxMesh(
    scene,
    x,
    cy,
    z,
    gap.width,
    gap.height,
    0.15,
    { r: 0.1, g: 0.09, b: 0.08 },
  );
  panel.rotation.y = rotation;
  return [panel];
}

/** Build a war-era repair patch (lighter brick infill) on the facade. */
function buildPatch(
  scene: Scene,
  world: Vec2,
  facadeZ: number,
  rotation: number,
  patch: RepairPatch,
): Mesh[] {
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const cx = world.x + patch.x;
  const cy = patch.y + patch.height / 2;
  const oz = 0.08;
  const z = facadeZ + (oz * cosR - 0 * sinR);
  const x = cx + (0 * cosR + oz * sinR);
  const panel = boxMesh(
    scene,
    x,
    cy,
    z,
    patch.width,
    patch.height,
    0.1,
    { r: 0.55, g: 0.42, b: 0.34 },
  );
  panel.rotation.y = rotation;
  return [panel];
}

/**
 * Derive the world-space facade plane for a lot.
 * `facadeZ` is the z coordinate of the lot's street-facing edge and
 * `rotation` the building's yaw (0 or 180°) about the lot origin.
 */
function facadePlane(lot: LotAnchor): { z: number; rotation: number } {
  // Lots at rotation 0 face north (min z edge); lots at 180 face south.
  const rotation = (lot.rotation * Math.PI) / 180;
  const z = lot.rotation === 0 ? lot.origin.z : lot.origin.z + lot.depth;
  return { z, rotation };
}

/**
 * Build the 1945 building on a lot. Returns the meshes created (for tests and
 * disposal). `lit` selects whether sash windows glow warm after dark.
 */
export function buildEraBuilding(
  scene: Scene,
  layout: CityBlockLayout,
  lotIndex: number,
  building: EraBuilding,
  lit: boolean,
): Mesh[] {
  const meshes: Mesh[] = [];
  const lot = layout.lots[lotIndex];
  if (!lot) return meshes;

  const { z: facadeZ, rotation } = facadePlane(lot);
  const world = { x: lot.origin.x, z: lot.origin.z };

  // Main body (full lot width, minus small side setbacks).
  const bodyW = lot.width - 1.0;
  const bodyD = lot.depth - 2.0;
  const bodyZ = lot.origin.z + (lot.depth - bodyD) / 2;
  const main = boxMesh(
    scene,
    world.x + bodyW / 2,
    building.height / 2,
    bodyZ + bodyD / 2,
    bodyW,
    building.height,
    bodyD,
    building.facade,
  );
  main.rotation.y = rotation;
  meshes.push(main);

  // Coal-smoke stain strip near the roofline.
  if (building.smokeStained) {
    const stain = boxMesh(
      scene,
      world.x + bodyW / 2,
      building.height - 0.8,
      bodyZ + bodyD / 2,
      bodyW,
      1.6,
      bodyD,
      era1945Palette.smokeStainedBrick,
    );
    stain.rotation.y = rotation;
    meshes.push(stain);
  }

  // War-era repair patches.
  for (const patch of building.patches) {
    meshes.push(...buildPatch(scene, world, facadeZ, rotation, patch));
  }

  // Bombed-lot gaps.
  for (const gap of building.gaps) {
    meshes.push(...buildGap(scene, world, facadeZ, rotation, gap));
  }

  // Sash windows.
  for (const win of building.windows) {
    meshes.push(...buildWindow(scene, world, facadeZ, rotation, {
      ...win,
      lit: lit && win.lit,
    }));
  }

  // Fire escapes.
  for (const escape of building.fireEscapes) {
    meshes.push(...buildFireEscape(scene, world, facadeZ, rotation, escape));
  }

  return meshes;
}

/**
 * The data-driven set of 1945 buildings for the 10 lots. Some lots are
 * bombed gaps / repair sites; storefront lots get their windows in the
 * storefronts module.
 */
export const era1945Buildings: readonly EraBuilding[] = Object.freeze([
  {
    lotId: 'lot-0',
    lotIndex: 0,
    height: 12,
    facade: era1945Palette.brick,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.4, width: 1.2, height: 1.8, lit: true },
      { x: -1.2, y: 5.4, width: 1.2, height: 1.8, lit: false },
      { x: 1.2, y: 5.4, width: 1.2, height: 1.8, lit: true },
      { x: 3.6, y: 5.4, width: 1.2, height: 1.8, lit: false },
      { x: -3.6, y: 8.6, width: 1.2, height: 1.8, lit: false },
      { x: -1.2, y: 8.6, width: 1.2, height: 1.8, lit: false },
      { x: 1.2, y: 8.6, width: 1.2, height: 1.8, lit: false },
      { x: 3.6, y: 8.6, width: 1.2, height: 1.8, lit: false },
    ],
    fireEscapes: [{ x: -4.8, levels: 3 }],
    gaps: [],
    patches: [{ x: 2.4, y: 6.2, width: 1.6, height: 2.2 }],
  },
  {
    lotId: 'lot-1',
    lotIndex: 1,
    height: 11,
    facade: era1945Palette.brick,
    smokeStained: false,
    windows: [
      { x: -3.6, y: 5.2, width: 1.2, height: 1.8, lit: false },
      { x: -1.2, y: 5.2, width: 1.2, height: 1.8, lit: true },
      { x: 1.2, y: 5.2, width: 1.2, height: 1.8, lit: false },
      { x: 3.6, y: 5.2, width: 1.2, height: 1.8, lit: true },
    ],
    fireEscapes: [{ x: 4.6, levels: 2 }],
    gaps: [{ x: -4.4, width: 2.2, height: 5.5 }],
    patches: [],
  },
  {
    lotId: 'lot-2',
    lotIndex: 2,
    height: 12,
    facade: era1945Palette.stone,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.4, width: 1.2, height: 1.8, lit: true },
      { x: -1.2, y: 5.4, width: 1.2, height: 1.8, lit: false },
      { x: 1.2, y: 5.4, width: 1.2, height: 1.8, lit: true },
      { x: 3.6, y: 5.4, width: 1.2, height: 1.8, lit: false },
    ],
    fireEscapes: [],
    gaps: [],
    patches: [{ x: -2.4, y: 7.0, width: 1.8, height: 2.4 }],
  },
  {
    lotId: 'lot-3',
    lotIndex: 3,
    height: 10,
    facade: era1945Palette.brick,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.0, width: 1.2, height: 1.6, lit: false },
      { x: -1.2, y: 5.0, width: 1.2, height: 1.6, lit: true },
      { x: 1.2, y: 5.0, width: 1.2, height: 1.6, lit: false },
      { x: 3.6, y: 5.0, width: 1.2, height: 1.6, lit: true },
    ],
    fireEscapes: [{ x: -4.6, levels: 2 }],
    gaps: [],
    patches: [{ x: 2.2, y: 6.0, width: 1.4, height: 2.0 }],
  },
  {
    lotId: 'lot-4',
    lotIndex: 4,
    height: 11,
    facade: era1945Palette.brick,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.2, width: 1.2, height: 1.8, lit: true },
      { x: -1.2, y: 5.2, width: 1.2, height: 1.8, lit: false },
      { x: 1.2, y: 5.2, width: 1.2, height: 1.8, lit: true },
      { x: 3.6, y: 5.2, width: 1.2, height: 1.8, lit: false },
    ],
    fireEscapes: [],
    gaps: [{ x: 4.4, width: 2.0, height: 4.6 }],
    patches: [],
  },
  {
    lotId: 'lot-5',
    lotIndex: 5,
    height: 12,
    facade: era1945Palette.brick,
    smokeStained: false,
    windows: [
      { x: -3.6, y: 5.4, width: 1.2, height: 1.8, lit: false },
      { x: -1.2, y: 5.4, width: 1.2, height: 1.8, lit: true },
      { x: 1.2, y: 5.4, width: 1.2, height: 1.8, lit: false },
      { x: 3.6, y: 5.4, width: 1.2, height: 1.8, lit: true },
    ],
    fireEscapes: [{ x: -4.8, levels: 3 }],
    gaps: [],
    patches: [{ x: -2.0, y: 6.4, width: 1.6, height: 2.2 }],
  },
  {
    lotId: 'lot-6',
    lotIndex: 6,
    height: 11,
    facade: era1945Palette.stone,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.2, width: 1.2, height: 1.8, lit: true },
      { x: -1.2, y: 5.2, width: 1.2, height: 1.8, lit: false },
      { x: 1.2, y: 5.2, width: 1.2, height: 1.8, lit: true },
      { x: 3.6, y: 5.2, width: 1.2, height: 1.8, lit: false },
    ],
    fireEscapes: [],
    gaps: [{ x: -4.4, width: 2.4, height: 5.0 }],
    patches: [],
  },
  {
    lotId: 'lot-7',
    lotIndex: 7,
    height: 12,
    facade: era1945Palette.brick,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.4, width: 1.2, height: 1.8, lit: false },
      { x: -1.2, y: 5.4, width: 1.2, height: 1.8, lit: false },
      { x: 1.2, y: 5.4, width: 1.2, height: 1.8, lit: true },
      { x: 3.6, y: 5.4, width: 1.2, height: 1.8, lit: false },
    ],
    fireEscapes: [{ x: 4.6, levels: 3 }],
    gaps: [],
    patches: [{ x: -3.2, y: 6.8, width: 1.6, height: 2.4 }],
  },
  {
    lotId: 'lot-8',
    lotIndex: 8,
    height: 10,
    facade: era1945Palette.brick,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.0, width: 1.2, height: 1.6, lit: true },
      { x: -1.2, y: 5.0, width: 1.2, height: 1.6, lit: false },
      { x: 1.2, y: 5.0, width: 1.2, height: 1.6, lit: true },
      { x: 3.6, y: 5.0, width: 1.2, height: 1.6, lit: false },
    ],
    fireEscapes: [],
    gaps: [{ x: 4.4, width: 2.0, height: 4.4 }],
    patches: [],
  },
  {
    lotId: 'lot-9',
    lotIndex: 9,
    height: 11,
    facade: era1945Palette.stone,
    smokeStained: true,
    windows: [
      { x: -3.6, y: 5.2, width: 1.2, height: 1.8, lit: false },
      { x: -1.2, y: 5.2, width: 1.2, height: 1.8, lit: true },
      { x: 1.2, y: 5.2, width: 1.2, height: 1.8, lit: false },
      { x: 3.6, y: 5.2, width: 1.2, height: 1.8, lit: true },
    ],
    fireEscapes: [{ x: -4.6, levels: 2 }],
    gaps: [],
    patches: [{ x: 2.0, y: 6.2, width: 1.4, height: 2.0 }],
  },
]);

/**
 * Create a mesh footprint (used by tests / composition to prove buildings land
 * on their lot anchors). Returns world-space rects keyed by lot index.
 */
export function buildingFootprints(
  layout: CityBlockLayout,
): { lotIndex: number; x: number; z: number; width: number; depth: number }[] {
  return era1945Buildings.map((b) => {
    const lot = layout.lots[b.lotIndex];
    return {
      lotIndex: b.lotIndex,
      x: lot.origin.x + 0.5,
      z: lot.origin.z + 1.0,
      width: lot.width - 1.0,
      depth: lot.depth - 2.0,
    };
  });
}