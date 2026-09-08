import { CITY_BLOCK_LAYOUT, distance } from './layout.js';
import type { Lot, Point2 } from './types.js';

/**
 * Deterministic lookup helpers for the shared block layout.
 *
 * These helpers are pure functions over the era-invariant anchors so that
 * consumers (buildings, vehicles, storefronts, pedestrians, navigation) can
 * resolve geometry without redefining it.
 */

/**
 * Find the lot that contains the given point, or `undefined` if the point is
 * not inside any lot. Uses simple AABB containment.
 */
export function lotAt(point: Point2): Lot | undefined {
  for (const lot of CITY_BLOCK_LAYOUT.lots) {
    const b = lot.bounds;
    if (
      point.x >= b.x &&
      point.x <= b.x + b.width &&
      point.z >= b.z &&
      point.z <= b.z + b.depth
    ) {
      return lot;
    }
  }
  return undefined;
}

/**
 * Find the lot whose facade center is nearest to the given point.
 * Deterministic: ties break toward the earlier lot in the layout array.
 */
export function nearestLot(point: Point2): Lot | undefined {
  const lots = CITY_BLOCK_LAYOUT.lots;
  if (lots.length === 0) {
    return undefined;
  }
  let best = lots[0]!;
  let bestDist = distance(point, best.facadeCenter);
  for (let i = 1; i < lots.length; i++) {
    const candidate = lots[i]!;
    const d = distance(point, candidate.facadeCenter);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

/**
 * A coarse grid over the block used to bucket lots for spatial queries.
 * Each cell lists the ids of lots that intersect it.
 */
export interface LotGridCell {
  col: number;
  row: number;
  lotIds: string[];
}

/**
 * Build a deterministic lot grid over the block. The block is divided into a
 * `cols x rows` grid, and each cell lists the ids of lots whose bounds
 * intersect the cell.
 */
export function buildLotGrid(cols: number, rows: number): LotGridCell[] {
  const { block, lots } = CITY_BLOCK_LAYOUT;
  const cellW = block.width / cols;
  const cellD = block.depth / rows;
  const cells: LotGridCell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = {
        col,
        row,
        lotIds: [] as string[],
      };
      const cx0 = block.x + col * cellW;
      const cz0 = block.z + row * cellD;
      const cx1 = cx0 + cellW;
      const cz1 = cz0 + cellD;
      for (const lot of lots) {
        const b = lot.bounds;
        const overlaps =
          b.x < cx1 && b.x + b.width > cx0 && b.z < cz1 && b.z + b.depth > cz0;
        if (overlaps) {
          cell.lotIds.push(lot.id);
        }
      }
      cells.push(cell);
    }
  }
  return cells;
}

/**
 * Look up the lots in the grid cell containing the given point.
 * Returns an empty array if the point is outside the block.
 */
export function lotsInCell(cell: LotGridCell): Lot[] {
  const byId = new Map(CITY_BLOCK_LAYOUT.lots.map((lot) => [lot.id, lot] as const));
  const result: Lot[] = [];
  for (const id of cell.lotIds) {
    const lot = byId.get(id);
    if (lot) {
      result.push(lot);
    }
  }
  return result;
}