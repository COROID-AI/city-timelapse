/**
 * Procedural low-poly pedestrian figure construction.
 *
 * Every crowd body part is built from a fixed, per-slot list of primitive
 * "cells" (beveled-equivalent boxes and 8-sided cylinders) merged through the
 * shared procedural graphics library. Because the cell layout of a slot is
 * constant across every era and archetype, two era variants of the same slot
 * always share identical vertex topology, which lets the crowd morph an
 * instanced slot's vertex buffer straight from one era's silhouette to the
 * next (fedora -> pillbox -> bare head, A-line dress -> mod shift ->
 * power suit, newspaper -> flip phone -> smartphone) without ever swapping a
 * mesh or popping an instance.
 *
 * Conventions (local frame of the joint each part hangs from):
 * - y is up, +x is the direction the pedestrian faces, +/-z is left/right.
 * - Cells absent in an era are encoded as degenerate (epsilon-sized)
 *   primitives so the topology stays constant; their era blend weight 0
 *   therefore collapses them to a point.
 * - Per-instance color comes from `InstancedMesh.instanceColor`, so all
 *   figure materials use white-based procedural textures from the real
 *   `ProceduralGfxLibrary` and never tint twice.
 *
 * Nothing here downloads models or animations: all geometry is procedural.
 */

import * as THREE from 'three';
import type { EraYear } from '../../era/timeline';
import { ProceduralGfxLibrary } from '../../gfx/materials';

// ---------------------------------------------------------------------------
// Shared figure proportions (nominal 1.77 m adult, before per-person scale)
// ---------------------------------------------------------------------------

/**
 * Joint heights/offsets of the nominal figure. Geometry recipes author in
 * these frames; the animation module composes the same joint chain, so
 * geometry and pose always agree. Feet rest on the sole at local y=0 when the
 * root sits on the sidewalk top.
 */
export const FIGURE_PROPORTIONS = Object.freeze({
  /** Total height of the unscaled figure; per-person height / this = scale. */
  nominalHeight: 1.77,
  /** Hip joint height above the feet. */
  hipY: 0.92,
  /** Shoulder/neck line height above the hip joint (torso frame). */
  neckY: 0.6,
  /** Arm attachment height above the hip joint (torso frame). */
  shoulderY: 0.52,
  /** Half shoulder width (torso frame, z axis). */
  shoulderW: 0.175,
  /** Half hip width (torso frame, z axis). */
  hipW: 0.1,
  /** Shoulder-to-wrist arm length. */
  armLen: 0.6,
  /** Hip-to-ankle leg length. */
  legLen: 0.855,
  /** Head top height above the neck frame origin. */
  headTopY: 0.2475,
});

// ---------------------------------------------------------------------------
// Cell primitives
// ---------------------------------------------------------------------------

export type CellKind = 'box' | 'cyl';

/** All era stops in blend order; morph targets exist for every one. */
export const ALL_ERA_YEARS: readonly EraYear[] = Object.freeze([1945, 1965, 1985, 2005, 2025]);

/** Axis-aligned box cell. `s` is [width, depth-thickness, height] as [x,y,z]. */
export interface BoxCell {
  readonly kind: 'box';
  readonly p: [number, number, number];
  readonly s: [number, number, number];
  readonly r?: [number, number, number];
}

/**
 * Cylinder cell with 8 radial segments (low-poly). `s` is
 * [radiusTop, radiusBottom, height]; radiusTop 0 yields a cone with identical
 * topology.
 */
export interface CylCell {
  readonly kind: 'cyl';
  readonly p: [number, number, number];
  readonly s: [number, number, number];
  readonly r?: [number, number, number];
}

export type Cell = BoxCell | CylCell;

/** Build a box cell. */
export function box(
  p: [number, number, number],
  s: [number, number, number],
  r?: [number, number, number],
): BoxCell {
  return r ? { kind: 'box', p, s, r } : { kind: 'box', p, s };
}

/** Build an 8-segment cylinder cell. */
export function cyl(
  p: [number, number, number],
  s: [number, number, number],
  r?: [number, number, number],
): CylCell {
  return r ? { kind: 'cyl', p, s, r } : { kind: 'cyl', p, s };
}

const DEGENERATE_EPS = 0.0006;

/** An epsilon-sized cell of the given kind: visually a point, topologically valid. */
export function degenerateCell(kind: CellKind): Cell {
  return kind === 'box'
    ? box([0, 0, 0], [DEGENERATE_EPS, DEGENERATE_EPS, DEGENERATE_EPS])
    : cyl([0, 0, 0], [DEGENERATE_EPS, DEGENERATE_EPS, DEGENERATE_EPS]);
}

/** True when every cell is epsilon-sized (the variant is visually absent). */
export function isDegenerate(cells: readonly Cell[]): boolean {
  return cells.every((c) => Math.max(c.s[0], c.s[1], c.s[2]) <= DEGENERATE_EPS * 4);
}

/** Fill a cell list with degenerate cells (used by `none` style recipes). */
export function degenerateCells(kinds: readonly CellKind[]): Cell[] {
  return kinds.map((k) => degenerateCell(k));
}

// ---------------------------------------------------------------------------
// Slots and their fixed cell layouts
// ---------------------------------------------------------------------------

/** Every renderable part slot of a figure. */
export const FIGURE_SLOTS = [
  'head',
  'handL',
  'handR',
  'hair',
  'hat',
  'face',
  'torso',
  'armL',
  'armR',
  'legL',
  'legR',
  'footL',
  'footR',
  'propA',
  'propB',
] as const;

export type FigureSlot = (typeof FIGURE_SLOTS)[number];

/** Era-static base slots: one mesh each, indexed directly by pedestrian index. */
export const BASE_SLOTS = ['head', 'handL', 'handR'] as const;
export type BaseSlot = (typeof BASE_SLOTS)[number];

/** Era-morphing slots: one instanced mesh per (slot, archetype slot). */
export const GRID_SLOTS = [
  'hair',
  'hat',
  'face',
  'torso',
  'armL',
  'armR',
  'legL',
  'legR',
  'footL',
  'footR',
  'propA',
  'propB',
] as const;
export type GridSlot = (typeof GRID_SLOTS)[number];

/**
 * Fixed cell-kind layout per slot. Every style recipe for a slot must return
 * exactly these kinds in this order; `buildFigureMorphSet` validates it, which
 * is what guarantees vertex-identical era morph targets.
 */
export const SLOT_CELL_KINDS: Readonly<Record<FigureSlot, readonly CellKind[]>> = Object.freeze({
  // cranium, nose, neck, earL, earR
  head: ['box', 'box', 'box', 'cyl', 'cyl'],
  // palm, thumb
  handL: ['box', 'cyl'],
  handR: ['box', 'cyl'],
  // volume, fringe, bun
  hair: ['cyl', 'box', 'cyl'],
  // brim, crown, band
  hat: ['cyl', 'cyl', 'box'],
  // mask, strapL, strapR, earbudL, earbudR
  face: ['box', 'box', 'box', 'cyl', 'cyl'],
  // pelvis, chest, shoulderL, shoulderR, skirt/flare, lapelL, lapelR, collar
  torso: ['box', 'box', 'box', 'box', 'cyl', 'box', 'box', 'cyl'],
  // upper, lower/cuff, relief stripe
  armL: ['box', 'box', 'cyl'],
  armR: ['box', 'box', 'cyl'],
  // thigh, shin, hem/pocket/cuff
  legL: ['cyl', 'cyl', 'box'],
  legR: ['cyl', 'cyl', 'box'],
  // sole, upper, toe/lace
  footL: ['box', 'box', 'box'],
  footR: ['box', 'box', 'box'],
  // main, lid/handle, detail, wheel1, wheel2
  propA: ['box', 'box', 'box', 'cyl', 'cyl'],
  // body, flap, strap
  propB: ['box', 'box', 'box'],
});

/** Narrow a slot to the base group (type-level). */
export function isBaseSlot(slot: FigureSlot): slot is BaseSlot {
  return (BASE_SLOTS as readonly string[]).includes(slot);
}

// ---------------------------------------------------------------------------
// Base (era-static) cell definitions
// ---------------------------------------------------------------------------

/** Static base-geometry cells, authored in each base slot's joint frame. */
export const BASE_SLOT_CELLS: Readonly<Record<BaseSlot, readonly Cell[]>> = Object.freeze({
  // Neck frame sits on the shoulder line (torso y = neckY).
  head: [
    box([0, 0.135, 0], [0.185, 0.225, 0.165]), // cranium
    box([0.1, 0.115, 0], [0.035, 0.05, 0.03]), // nose (+x front)
    box([0, -0.01, 0], [0.075, 0.09, 0.075]), // neck into collar
    cyl([0.01, 0.125, 0.088], [0.024, 0.024, 0.036], [Math.PI / 2, 0, 0]), // ear L
    cyl([0.01, 0.125, -0.088], [0.024, 0.024, 0.036], [Math.PI / 2, 0, 0]), // ear R
  ],
  // Wrist frame (arm tip).
  handL: [
    box([0, -0.04, 0], [0.055, 0.085, 0.05]), // palm
    cyl([0.02, -0.03, 0.03], [0.013, 0.013, 0.04], [0, 0, Math.PI / 2]), // thumb
  ],
  handR: [
    box([0, -0.04, 0], [0.055, 0.085, 0.05]),
    cyl([0.02, -0.03, -0.03], [0.013, 0.013, 0.04], [0, 0, Math.PI / 2]),
  ],
});

// ---------------------------------------------------------------------------
// Geometry construction
// ---------------------------------------------------------------------------

function cellToGeometry(cell: Cell): THREE.BufferGeometry {
  const geom =
    cell.kind === 'box'
      ? new THREE.BoxGeometry(cell.s[0], cell.s[1], cell.s[2])
      : new THREE.CylinderGeometry(cell.s[0], cell.s[1], cell.s[2], 8, 1);
  if (cell.r) {
    if (cell.r[0]) geom.rotateX(cell.r[0]);
    if (cell.r[1]) geom.rotateY(cell.r[1]);
    if (cell.r[2]) geom.rotateZ(cell.r[2]);
  }
  geom.translate(cell.p[0], cell.p[1], cell.p[2]);
  return geom;
}

function assertSlotCells(slot: FigureSlot, cells: readonly Cell[]): void {
  const kinds = SLOT_CELL_KINDS[slot];
  if (cells.length !== kinds.length) {
    throw new Error(
      `Figure slot "${slot}" expects ${kinds.length} cells but received ${cells.length}.`,
    );
  }
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].kind !== kinds[i]) {
      throw new Error(
        `Figure slot "${slot}" cell ${i} must be "${kinds[i]}" but received "${cells[i].kind}".`,
      );
    }
  }
}

/**
 * Build one static (non-morphing) figure geometry from its cells, merging
 * through the shared procedural graphics library.
 */
export function buildFigureGeometry(
  slot: FigureSlot,
  cells: readonly Cell[],
  library: typeof ProceduralGfxLibrary = ProceduralGfxLibrary,
): THREE.BufferGeometry {
  assertSlotCells(slot, cells);
  return library.mergeBufferGeometries(cells.map(cellToGeometry));
}

/**
 * Era-variant vertex data for one (slot, archetype) pair. All five era
 * entries share the same vertex count and index buffer, so blending them by
 * era weight is a straight per-vertex lerp.
 */
export interface FigureMorphSet {
  readonly slot: FigureSlot;
  readonly vertexCount: number;
  /** Packed xyz positions per era, in `ERA_YEARS` order lookups by year. */
  readonly positionsByEra: Readonly<Record<EraYear, Float32Array>>;
  readonly uv: Float32Array;
  readonly index: Uint16Array | Uint32Array;
  /** Eras in which this variant is actually visible (non-degenerate). */
  readonly liveEras: readonly EraYear[];
}

function positionsOf(geom: THREE.BufferGeometry): Float32Array {
  const attr = geom.getAttribute('position');
  if (!attr) throw new Error('Figure geometry is missing a position attribute.');
  return new Float32Array(attr.array as Float32Array);
}

/**
 * Build the five morph-target position buffers for one (slot, archetype)
 * from per-era cell recipes. Returns null when no era uses the slot for this
 * archetype (the mesh can then be skipped entirely).
 */
export function buildFigureMorphSet(
  slot: FigureSlot,
  eraCells: Readonly<Record<EraYear, readonly Cell[]>>,
  library: typeof ProceduralGfxLibrary = ProceduralGfxLibrary,
): FigureMorphSet | null {
  const eras = ALL_ERA_YEARS;
  if (eras.length === 0) return null;

  const positionsByEra = {} as Record<EraYear, Float32Array>;
  const liveEras: EraYear[] = [];
  let vertexCount = -1;
  let uv: Float32Array | null = null;
  let index: Uint16Array | Uint32Array | null = null;

  for (const era of eras) {
    const cells = eraCells[era];
    const geom = buildFigureGeometry(slot, cells, library);
    const pos = positionsOf(geom);
    if (vertexCount === -1) {
      vertexCount = pos.length;
      const uvAttr = geom.getAttribute('uv');
      const idxAttr = geom.getIndex();
      if (!uvAttr || !idxAttr) {
        throw new Error(`Figure slot "${slot}" geometry lost its uv/index attributes.`);
      }
      uv = new Float32Array(uvAttr.array as Float32Array);
      index =
        idxAttr.array instanceof Uint32Array
          ? new Uint32Array(idxAttr.array)
          : new Uint16Array(idxAttr.array as Uint16Array);
    } else if (pos.length !== vertexCount) {
      throw new Error(
        `Figure slot "${slot}" era ${era} has ${pos.length} position floats; expected ${vertexCount}. Topology must match across eras.`,
      );
    }
    positionsByEra[era] = pos;
    if (!isDegenerate(cells)) liveEras.push(era);
    geom.dispose();
  }

  if (liveEras.length === 0) return null;
  return {
    slot,
    vertexCount,
    positionsByEra,
    uv: uv as Float32Array,
    index: index as Uint16Array | Uint32Array,
    liveEras,
  };
}

/** Create a renderable BufferGeometry seeded at one era of a morph set. */
export function createMorphGeometry(set: FigureMorphSet, initialEra: EraYear): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    'position',
    new THREE.BufferAttribute(set.positionsByEra[initialEra].slice(), 3),
  );
  geom.setAttribute('uv', new THREE.BufferAttribute(set.uv, 2));
  geom.setIndex(new THREE.BufferAttribute(set.index, 1));
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// Figure materials (all textures generated by the shared gfx library)
// ---------------------------------------------------------------------------

export type FigureMaterialRole =
  | 'skin'
  | 'hair'
  | 'garment'
  | 'shoe'
  | 'face'
  | 'fabric'
  | 'paper'
  | 'tech';

export const FIGURE_MATERIAL_ROLES = [
  'skin',
  'hair',
  'garment',
  'shoe',
  'face',
  'fabric',
  'paper',
  'tech',
] as const;

/** userData flag proving a texture came from `ProceduralGfxLibrary`. */
export const GFX_TEXTURE_SOURCE = 'ProceduralGfxLibrary.createProceduralTexture';

interface RoleSurface {
  readonly texture: 'fabric' | 'metal';
  readonly options: Record<string, unknown>;
  readonly roughness: number;
  readonly metalness: number;
}

/**
 * White-based procedural surfaces per role. Base color is white on purpose:
 * `instanceColor` carries the era- and person-specific hue, so the era
 * palettes tint outfits without a second multiply from the texture.
 */
const ROLE_SURFACES: Readonly<Record<FigureMaterialRole, RoleSurface>> = Object.freeze({
  skin: {
    texture: 'fabric',
    options: {
      striped: false,
      weaveNoise: true,
      weathering: 0.04,
      primaryColor: '#ffffff',
      secondaryColor: '#efefef',
      seed: 401,
    },
    roughness: 0.62,
    metalness: 0,
  },
  hair: {
    texture: 'fabric',
    options: {
      striped: true,
      stripeCount: 6,
      stripeColor: '#d6d6d6',
      weaveNoise: false,
      weathering: 0.08,
      primaryColor: '#ffffff',
      secondaryColor: '#e4e4e4',
      seed: 402,
    },
    roughness: 0.48,
    metalness: 0,
  },
  garment: {
    texture: 'fabric',
    options: {
      striped: false,
      weaveNoise: true,
      weathering: 0.14,
      primaryColor: '#ffffff',
      secondaryColor: '#e7e7e7',
      seed: 403,
    },
    roughness: 0.86,
    metalness: 0,
  },
  shoe: {
    texture: 'fabric',
    options: {
      striped: false,
      weaveNoise: true,
      weathering: 0.34,
      primaryColor: '#ffffff',
      secondaryColor: '#dcdcdc',
      seed: 404,
    },
    roughness: 0.55,
    metalness: 0.05,
  },
  face: {
    texture: 'fabric',
    options: {
      striped: false,
      weaveNoise: false,
      weathering: 0.02,
      primaryColor: '#ffffff',
      secondaryColor: '#f4f4f4',
      seed: 405,
    },
    roughness: 0.45,
    metalness: 0,
  },
  fabric: {
    texture: 'fabric',
    options: {
      striped: false,
      weaveNoise: true,
      weathering: 0.22,
      primaryColor: '#ffffff',
      secondaryColor: '#e6e6e6',
      seed: 406,
    },
    roughness: 0.9,
    metalness: 0,
  },
  paper: {
    texture: 'fabric',
    options: {
      striped: true,
      stripeCount: 14,
      stripeColor: '#e0e0e0',
      weaveNoise: true,
      weathering: 0.38,
      primaryColor: '#ffffff',
      secondaryColor: '#f0f0f0',
      seed: 407,
    },
    roughness: 0.95,
    metalness: 0,
  },
  tech: {
    texture: 'metal',
    options: {
      primaryColor: '#f7f7f7',
      secondaryColor: '#d0d0d0',
      weathering: 0.1,
      seed: 408,
    },
    roughness: 0.35,
    metalness: 0.45,
  },
});

export type FigureMaterialSet = Record<FigureMaterialRole, THREE.MeshStandardMaterial>;

/**
 * Create the nine shared figure materials. Textures are produced by the real
 * procedural graphics library, so a composition test can verify the crowd is
 * wired to it (via `material.map` + `userData.gfxSource`).
 */
export function createFigureMaterialSet(
  library: typeof ProceduralGfxLibrary = ProceduralGfxLibrary,
): FigureMaterialSet {
  const set = {} as FigureMaterialSet;
  for (const role of FIGURE_MATERIAL_ROLES) {
    const surface = ROLE_SURFACES[role];
    const map = library.createProceduralTexture(surface.texture, {
      ...surface.options,
      repeatX: 1,
      repeatY: 1,
    });
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map,
      roughness: surface.roughness,
      metalness: surface.metalness,
      vertexColors: false,
    });
    material.name = `crowd-${role}`;
    material.userData.gfxSource = GFX_TEXTURE_SOURCE;
    material.userData.role = role;
    set[role] = material;
  }
  return set;
}

/** Dispose a material set including its generated textures. */
export function disposeFigureMaterials(set: FigureMaterialSet): void {
  for (const role of FIGURE_MATERIAL_ROLES) {
    const material = set[role];
    material.map?.dispose();
    material.dispose();
  }
}

/** Which material role a slot renders with. */
export function slotMaterialRole(slot: FigureSlot): FigureMaterialRole {
  switch (slot) {
    case 'head':
    case 'handL':
    case 'handR':
      return 'skin';
    case 'hair':
      return 'hair';
    case 'face':
      return 'face';
    case 'footL':
    case 'footR':
      return 'shoe';
    case 'propA':
    case 'propB':
      return 'fabric'; // overridden per-variant by the module for tech/paper props
    default:
      return 'garment';
  }
}
