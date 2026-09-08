import { describe, expect, it } from 'vitest';
import {
  buildLotGrid,
  lotAt,
  lotsInCell,
  nearestLot,
} from '../helpers.js';
import {
  CITY_BLOCK_LAYOUT,
  findFocusPointById,
  findLotById,
  pathLength,
} from '../layout.js';
import type { Point2 } from '../types.js';

const p = (x: number, z: number): Point2 => ({ x, z });

describe('city block layout anchors', () => {
  it('exports all required anchor categories', () => {
    expect(CITY_BLOCK_LAYOUT.roads.length).toBeGreaterThan(0);
    expect(CITY_BLOCK_LAYOUT.lanes.length).toBeGreaterThan(0);
    expect(CITY_BLOCK_LAYOUT.sidewalks.length).toBeGreaterThan(0);
    expect(CITY_BLOCK_LAYOUT.lots.length).toBeGreaterThan(0);
    expect(CITY_BLOCK_LAYOUT.storefronts.length).toBeGreaterThan(0);
    expect(CITY_BLOCK_LAYOUT.walkway.length).toBeGreaterThan(0);
    expect(CITY_BLOCK_LAYOUT.trafficLoops.length).toBeGreaterThan(0);
    expect(CITY_BLOCK_LAYOUT.cameraFocusPoints.length).toBeGreaterThan(0);
  });

  it('provides one storefront per lot, keyed to the lot', () => {
    const lotIds = new Set(CITY_BLOCK_LAYOUT.lots.map((lot) => lot.id));
    expect(CITY_BLOCK_LAYOUT.storefronts.length).toBe(CITY_BLOCK_LAYOUT.lots.length);
    for (const storefront of CITY_BLOCK_LAYOUT.storefronts) {
      expect(lotIds).toContain(storefront.lotId);
      expect(storefront.spanStart).toBe(0);
      expect(storefront.spanEnd).toBe(1);
    }
  });

  it('provides a per-building focus point plus an overview', () => {
    const focusIds = new Set(CITY_BLOCK_LAYOUT.cameraFocusPoints.map((f) => f.id));
    expect(focusIds).toContain('focus-overview');
    for (const lot of CITY_BLOCK_LAYOUT.lots) {
      expect(focusIds).toContain(`focus-${lot.id}`);
    }
  });

  it('keeps the layout era-invariant (no per-year fields)', () => {
    const json = JSON.stringify(CITY_BLOCK_LAYOUT);
    for (const year of ['1945', '1965', '1985', '2005', '2025', '2055']) {
      expect(json).not.toContain(`"${year}"`);
    }
  });
});

describe('lot grid lookup', () => {
  it('is deterministic', () => {
    const a = buildLotGrid(4, 4);
    const b = buildLotGrid(4, 4);
    expect(a).toEqual(b);
  });

  it('contains every lot across the cells', () => {
    const cells = buildLotGrid(4, 4);
    const found = new Set<string>();
    for (const cell of cells) {
      for (const lot of lotsInCell(cell)) {
        found.add(lot.id);
      }
    }
    expect(found.size).toBe(CITY_BLOCK_LAYOUT.lots.length);
    for (const lot of CITY_BLOCK_LAYOUT.lots) {
      expect(found).toContain(lot.id);
    }
  });
});

describe('lot lookup helpers', () => {
  it('finds a lot by id', () => {
    const first = CITY_BLOCK_LAYOUT.lots[0]!;
    expect(findLotById(first.id)?.id).toBe(first.id);
    expect(findLotById('missing')).toBeUndefined();
  });

  it('finds a focus point by id', () => {
    expect(findFocusPointById('focus-overview')?.id).toBe('focus-overview');
    expect(findFocusPointById('missing')).toBeUndefined();
  });

  it('lotAt returns the containing lot', () => {
    const first = CITY_BLOCK_LAYOUT.lots[0]!;
    const inside = p(first.facadeCenter.x, first.facadeCenter.z);
    expect(lotAt(inside)?.id).toBe(first.id);
    expect(lotAt(p(0, 0))).toBeUndefined();
  });

  it('nearestLot returns the closest facade center', () => {
    const first = CITY_BLOCK_LAYOUT.lots[0]!;
    expect(nearestLot(first.facadeCenter)?.id).toBe(first.id);
  });
});

describe('path length helper', () => {
  it('computes polyline length deterministically', () => {
    expect(pathLength([p(0, 0), p(3, 4)])).toBeCloseTo(5, 6);
    expect(pathLength([])).toBe(0);
    expect(pathLength([p(0, 0)])).toBe(0);
  });
});