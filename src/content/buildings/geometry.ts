/**
 * src/content/buildings/geometry.ts — procedural BufferGeometry builders.
 *
 * Every building mesh is procedural (no external model files). The facade
 * envelope, the window grid and the three unit anchor spots (doorway / window
 * / shelf) are built on a FIXED template topology whose per-era morph targets
 * are computed declaratively from the era specs in src/eras.ts.
 *
 * Lossless morph contract: every era contributes exactly the same vertex count
 * and winding to each templated mesh, so the shared morph engine can interpolate
 * between any adjacent era pair without index remapping. Cells that an era does
 * not use (stories / window columns beyond the era's count) collapse to an
 * invisible sliver in that era's target, so the topology never changes even
 * while the visible layout morphs.
 */

import * as THREE from 'three';

import {
  ERA_ANCHOR_SLOTS,
  ERA_IDS,
  type BuildingPlotSpec,
  type EraAnchorSet,
  type EraId,
} from '../../eras';

export type AnchorSlotName = keyof EraAnchorSet;
export const ANCHOR_SLOT_NAMES: readonly AnchorSlotName[] = ['doorway', 'window', 'shelf'];

export interface EnvelopeDims {
  width: number;
  depth: number;
  height: number;
}

export interface AnchorDims {
  /** Box center (absolute plot-local coordinates). */
  cx: number;
  cy: number;
  cz: number;
  /** Box size. */
  sx: number;
  sy: number;
  sz: number;
}

export interface WindowGridLayout {
  width: number;
  depth: number;
  storyHeight: number;
  stories: number;
  columns: number;
  rows: number;
  gapX: number;
  gapY: number;
  /** Horizontal inset of the window band from the facade edges. */
  insetX?: number;
  /** Vertical margin between the top of a story and the first window row. */
  edgeTop?: number;
  /** Vertical margin between the bottom of a story and the last window row. */
  edgeBottom?: number;
  /** Window protrusion depth. */
  windowDepth?: number;
}

export interface WindowGridTemplate {
  maxStories: number;
  maxRows: number;
  maxColumns: number;
}

/**
 * Shared unit-box topology used for every templated box in the block. It is a
 * single 1×1×1 box whose 24 indexed vertices / 12 triangles are reused for the
 * envelope, every window cell and every anchor slot.
 */
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
export const UNIT_BOX_VERTEX_COUNT = UNIT_BOX.getAttribute('position').count;

/** Total height of a plot's facade: stories plus parapet band. */
export function envelopeHeight(plot: BuildingPlotSpec): number {
  return plot.stories * plot.storyHeight + plot.parapetHeight;
}

/**
 * Fill `cursor` box vertices starting at `cursor` (vertex index) with an
 * axis-aligned box centered at (cx, cy, cz) and sized (sx, sy, sz). Returns the
 * next free vertex index.
 */
export function fillBoxPositions(
  out: Float32Array,
  cursor: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): number {
  const pos = UNIT_BOX.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    out[(cursor + i) * 3] = cx + pos.getX(i) * sx;
    out[(cursor + i) * 3 + 1] = cy + pos.getY(i) * sy;
    out[(cursor + i) * 3 + 2] = cz + pos.getZ(i) * sz;
  }
  return cursor + pos.count;
}

/** Absolute envelope box positions (bottom at y = 0) for one era. */
export function computeEnvelopePositions(dims: EnvelopeDims): Float32Array {
  const arr = new Float32Array(UNIT_BOX_VERTEX_COUNT * 3);
  fillBoxPositions(arr, 0, 0, dims.height / 2, 0, dims.width, dims.height, dims.depth);
  return arr;
}

/** Number of window cells in the fixed template (all eras share this count). */
export function windowGridCellCount(template: WindowGridTemplate): number {
  return template.maxStories * template.maxRows * template.maxColumns;
}

/**
 * Absolute window-cell box positions for one era. Cells beyond the era's story
 * / row / column count collapse to an invisible sliver so the template keeps a
 * constant vertex count across every era.
 */
export function computeWindowGridPositions(
  layout: WindowGridLayout,
  template: WindowGridTemplate,
): Float32Array {
  const cells = windowGridCellCount(template);
  const arr = new Float32Array(cells * UNIT_BOX_VERTEX_COUNT * 3);
  const insetX = layout.insetX ?? 0.18;
  const edgeTop = layout.edgeTop ?? 0.15;
  const edgeBottom = layout.edgeBottom ?? 0.1;
  const windowDepth = layout.windowDepth ?? 0.06;
  const usableW = layout.width - 2 * insetX;
  const usableH = layout.storyHeight - (edgeTop + edgeBottom);
  const winW = Math.max(0.12, (usableW - (layout.columns - 1) * layout.gapX) / layout.columns);
  const winH = Math.max(0.14, (usableH - (layout.rows - 1) * layout.gapY) / layout.rows);
  const exteriorZ = layout.depth / 2;
  const sliverY = layout.storyHeight * layout.stories;
  let cursor = 0;
  for (let b = 0; b < template.maxStories; b += 1) {
    for (let r = 0; r < template.maxRows; r += 1) {
      for (let c = 0; c < template.maxColumns; c += 1) {
        const isWindow = b < layout.stories && r < layout.rows && c < layout.columns;
        if (!isWindow) {
          cursor = fillBoxPositions(
            arr,
            cursor,
            0,
            sliverY,
            exteriorZ - 0.01,
            0.001,
            0.001,
            0.001,
          );
          continue;
        }
        const cx = -usableW / 2 + winW * (c + 0.5) + c * layout.gapX;
        const cy = b * layout.storyHeight + edgeBottom + winH * (r + 0.5) + r * layout.gapY;
        cursor = fillBoxPositions(arr, cursor, cx, cy, exteriorZ - windowDepth / 2, winW, winH, windowDepth);
      }
    }
  }
  return arr;
}

/**
 * Per-era unit anchor dimensions for a plot. The doorway / shelf heights come
 * from the shared ERA_ANCHOR_SLOTS contract (the same slot keys every era must
 * provide), while widths scale with the plot; the window unit follows the era's
 * declarative window pattern cell size.
 */
export function computeAnchorDims(
  slot: AnchorSlotName,
  plot: BuildingPlotSpec,
  eraId: EraId,
  eraAnchors: Record<EraId, EraAnchorSet> = ERA_ANCHOR_SLOTS,
): AnchorDims {
  const doorwayH = eraAnchors[eraId].doorway.height;
  const shelfH = eraAnchors[eraId].shelf.height;
  const pattern = plot.windows;
  const usableW = plot.width - 2 * 0.18;
  const winW = Math.max(
    0.2,
    (usableW - (pattern.columns - 1) * pattern.gapX) / pattern.columns,
  );
  const winH = Math.max(
    0.25,
    (plot.storyHeight - 0.25 - (pattern.rows - 1) * pattern.gapY) / pattern.rows,
  );
  switch (slot) {
    case 'doorway':
      return {
        cx: 0,
        cy: doorwayH / 2,
        cz: plot.depth / 2 + 0.006,
        sx: Math.min(plot.width * 0.22, 1.1),
        sy: doorwayH,
        sz: 0.12,
      };
    case 'window':
      return {
        cx: 0,
        cy: doorwayH + 0.2 + winH / 2,
        cz: plot.depth / 2 - 0.01,
        sx: winW,
        sy: winH,
        sz: 0.07,
      };
    case 'shelf':
      return {
        cx: 0,
        cy: doorwayH + 0.04 + shelfH / 2,
        cz: plot.depth / 2 + 0.02,
        sx: plot.width * 0.5,
        sy: shelfH,
        sz: 0.09,
      };
  }
}

/**
 * Build a BufferGeometry from one or more absolute-position unit boxes.
 * Normals / UVs / index all come from the shared unit box, so every morph
 * target built by callers is guaranteed the same topology.
 */
function buildBoxArrayGeometry(positions: Float32Array): THREE.BufferGeometry {
  const cellCount = positions.length / (UNIT_BOX_VERTEX_COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const srcNormals = UNIT_BOX.getAttribute('normal') as THREE.BufferAttribute;
  const srcUvs = UNIT_BOX.getAttribute('uv') as THREE.BufferAttribute;
  const srcIndex = UNIT_BOX.getIndex() as THREE.BufferAttribute;

  const normals = new Float32Array(cellCount * UNIT_BOX_VERTEX_COUNT * 3);
  const uvs = new Float32Array(cellCount * UNIT_BOX_VERTEX_COUNT * 2);
  for (let c = 0; c < cellCount; c += 1) {
    normals.set(srcNormals.array, c * UNIT_BOX_VERTEX_COUNT * 3);
    uvs.set(srcUvs.array, c * UNIT_BOX_VERTEX_COUNT * 2);
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const indices = new Uint16Array(cellCount * srcIndex.count);
  for (let c = 0; c < cellCount; c += 1) {
    for (let k = 0; k < srcIndex.count; k += 1) {
      indices[c * srcIndex.count + k] = srcIndex.getX(k) + c * UNIT_BOX_VERTEX_COUNT;
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

/** Attach the per-era position morph targets (same topology by construction). */
function withMorphTargets(
  geometry: THREE.BufferGeometry,
  targetsByEra: Record<EraId, Float32Array>,
): THREE.BufferGeometry {
  geometry.morphAttributes.position = ERA_IDS.map(
    (id) => new THREE.BufferAttribute(targetsByEra[id], 3),
  );
  return geometry;
}

/** Facade envelope geometry: one box per plot, morphed per era. */
export function buildEnvelopeGeometry(
  baseDims: EnvelopeDims,
  targetsByEra: Record<EraId, EnvelopeDims>,
): THREE.BufferGeometry {
  const targets = {} as Record<EraId, Float32Array>;
  for (const id of ERA_IDS) {
    targets[id] = computeEnvelopePositions(targetsByEra[id]);
  }
  return withMorphTargets(buildBoxArrayGeometry(computeEnvelopePositions(baseDims)), targets);
}

/** Window grid geometry: fixed template of cells, morphed per era. */
export function buildWindowGridGeometry(
  baseLayout: WindowGridLayout,
  template: WindowGridTemplate,
  targetsByEra: Record<EraId, WindowGridLayout>,
): THREE.BufferGeometry {
  const targets = {} as Record<EraId, Float32Array>;
  for (const id of ERA_IDS) {
    targets[id] = computeWindowGridPositions(targetsByEra[id], template);
  }
  return withMorphTargets(
    buildBoxArrayGeometry(computeWindowGridPositions(baseLayout, template)),
    targets,
  );
}

/** Unit anchor slot geometry: one origin-centered box per slot, morphed per era.
 *  The *center* is applied by the caller as the anchor group position so detail
 *  meshes can ride the same group during morphs. */
export function buildAnchorGeometry(
  baseDims: AnchorDims,
  targetsByEra: Record<EraId, AnchorDims>,
): THREE.BufferGeometry {
  const targets = {} as Record<EraId, Float32Array>;
  for (const id of ERA_IDS) {
    const d = targetsByEra[id];
    const arr = new Float32Array(UNIT_BOX_VERTEX_COUNT * 3);
    fillBoxPositions(arr, 0, 0, 0, 0, d.sx, d.sy, d.sz);
    targets[id] = arr;
  }
  const base = new Float32Array(UNIT_BOX_VERTEX_COUNT * 3);
  fillBoxPositions(base, 0, 0, 0, 0, baseDims.sx, baseDims.sy, baseDims.sz);
  return withMorphTargets(buildBoxArrayGeometry(base), targets);
}