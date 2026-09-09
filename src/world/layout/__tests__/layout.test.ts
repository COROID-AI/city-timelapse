/**
 * Unit tests for the static city-block layout invariants.
 *
 * These assert the pure-data guarantees the whole era system chain relies on:
 *
 * - plots stay inside the block and never overlap each other,
 * - single frontage planes face their street,
 * - lane centerlines stay on road, crosswalks/parking are inside the
 *   carriageway, and walking-path samples stay on roads/sidewalks,
 * - determinism (same seed -> identical layout; different seeds differ),
 * - `buildGroundMeshes` builds the road/sidewalk/curb/crosswalk frame and
 *   `disposeGroundMeshes` releases it cleanly.
 */
import { Group } from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { GridPoint2D, GridRect } from '../types';
import { createCityBlockLayout, pointInRect, rectsOverlap } from '../cityBlockLayout';
import { buildGroundMeshes, disposeGroundMeshes } from '../ground';
import { createCrosswalkTexture, createStreetTexture } from '../groundTextures';

const SEEDS = ['seed-1', 'seed-42', 'seed-9001', 'seed-123456'];

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Sample a segment at well-spaced parameters inside [0,1]. */
function sampleSegment(a: GridPoint2D, b: GridPoint2D): GridPoint2D[] {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  }));
}

/** Point-in-rect with a small outward epsilon so path samples never touch edges. */
function pointInRectEps(p: GridPoint2D, rect: GridRect, eps = 1e-5): boolean {
  return (
    p.x >= rect.minX + eps &&
    p.x <= rect.maxX - eps &&
    p.z >= rect.minZ + eps &&
    p.z <= rect.maxZ - eps
  );
}

function rectCenter(rect: GridRect): GridPoint2D {
  return { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 };
}

/* ------------------------------------------------------------------ */
/* jsdom canvas 2D stub (jsdom lacks a real 2D context)                */
/* ------------------------------------------------------------------ */

let stubSpy: ReturnType<typeof vi.spyOn> | undefined;

const STUB_2D = {
  fillStyle: '',
  strokeStyle: '',
  fillRect: () => {},
  clearRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  setLineDash: () => {},
  fill: () => {},
  stroke: () => {},
  putImageData: () => {},
  createImageData: (w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  }),
} as unknown as CanvasRenderingContext2D;

beforeAll(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  stubSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function getContext(this: HTMLCanvasElement, contextId: string) {
      if (contextId === '2d') return STUB_2D;
      return original.call(this, contextId);
    });
});

afterAll(() => {
  stubSpy?.mockRestore();
});

/* ------------------------------------------------------------------ */
/* Layout invariants                                                   */
/* ------------------------------------------------------------------ */

describe('createCityBlockLayout determinism', () => {
  it('returns identical layouts for the same seed', () => {
    expect(createCityBlockLayout('seed-42')).toEqual(createCityBlockLayout('seed-42'));
  });

  it('returns different layouts for different seeds', () => {
    expect(createCityBlockLayout('seed-42')).not.toEqual(createCityBlockLayout('seed-43'));
  });

  it('produces 6-8 building plots for every seed', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      expect(layout.plots.length).toBeGreaterThanOrEqual(6);
      expect(layout.plots.length).toBeLessThanOrEqual(8);
    }
  });

  it('seed string is preserved on the layout', () => {
    expect(createCityBlockLayout('seed-42').seed).toBe('seed-42');
  });
});

describe('plot invariants', () => {
  it('keeps every plot footprint inside the block bounds', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      for (const plot of layout.plots) {
        expect(plot.footprint.minX).toBeGreaterThanOrEqual(layout.blockBounds.minX + 1e-6);
        expect(plot.footprint.maxX).toBeLessThanOrEqual(layout.blockBounds.maxX - 1e-6);
        expect(plot.footprint.minZ).toBeGreaterThanOrEqual(layout.blockBounds.minZ + 1e-6);
        expect(plot.footprint.maxZ).toBeLessThanOrEqual(layout.blockBounds.maxZ - 1e-6);
      }
    }
  });

  it('never overlaps two plot footprints', () => {
    for (const seed of SEEDS) {
      const plots = createCityBlockLayout(seed).plots;
      for (let i = 0; i < plots.length; i += 1) {
        for (let j = i + 1; j < plots.length; j += 1) {
          expect(rectsOverlap(plots[i].footprint, plots[j].footprint)).toBe(false);
        }
      }
    }
  });

  it('gives every plot a valid height range', () => {
    for (const seed of SEEDS) {
      for (const plot of createCityBlockLayout(seed).plots) {
        expect(plot.heightRange.min).toBeGreaterThan(0);
        expect(plot.heightRange.max).toBeGreaterThan(plot.heightRange.min);
      }
    }
  });
});

/** Sample the segments of a walking path (including endpoints). */
function samplePathPoints(points: GridPoint2D[]): GridPoint2D[] {
  const out: GridPoint2D[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    out.push(...sampleSegment(points[i], points[i + 1]));
  }
  return out;
}

describe('frontage planes', () => {
  it('orients each frontage plane toward its street and matches the frontage width', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      for (const plot of layout.plots) {
        const street = layout.streets.find((s) => s.id === plot.frontageStreet);
        expect(street).toBeDefined();
        if (!street) continue;

        // The plane anchors on the street-facing edge of the footprint.
        const fp = plot.frontagePlane;
        const frontageSide = street.axis === 'x' ? 'maxX' : 'maxZ';
        const backSide = street.axis === 'x' ? 'minX' : 'minZ';
        const footprint = plot.footprint as unknown as Record<string, number>;

        expect(fp.width).toBeCloseTo(footprint[frontageSide] - footprint[backSide], 6);
        expect(almostOn(fp.width)).toBe(false);
        expect(fp.height).toBeGreaterThan(0);

        // The facing is perpendicular to the street's travel axis...
        const streetDir = street.axis === 'x' ? { x: 1, z: 0 } : { x: 0, z: 1 };
        const perpendicular =
          Math.abs(fp.facing.x * streetDir.x + fp.facing.z * streetDir.z);
        expect(perpendicular).toBeLessThan(1e-9);

        // ...and points from the block toward the street carriageway.
        const crossingCenter = rectCenter(street.carriageway);
        const blockCenter = rectCenter(layout.blockBounds);
        const toward = {
          x: crossingCenter.x - blockCenter.x,
          z: crossingCenter.z - blockCenter.z,
        };
        const radius = Math.hypot(toward.x, toward.z);
        expect(radius).toBeGreaterThan(0);
        const dot = (toward.x * fp.facing.x + toward.z * fp.facing.z) / radius;
        expect(dot).toBeGreaterThan(0.99);
      }
    }
  });
});

function almostOn(n: number): boolean {
  return Math.abs(n) < 1e-9;
}

describe('street invariants', () => {
  it('defines two perpendicular streets with two lanes each', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      expect(layout.streets).toHaveLength(2);
      for (const street of layout.streets) {
        expect(street.lanes).toHaveLength(2);
        expect(street.crosswalks.length).toBeGreaterThan(0);
        expect(street.parkingSlots.length).toBeGreaterThan(0);
        expect(street.markings.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps lane centerlines on the road surface at each lane middle', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      for (const street of layout.streets) {
        for (const lane of street.lanes) {
          for (const point of sampleSegment(lane.centerLine[0], lane.centerLine[1])) {
            expect(pointInRect(point, street.carriageway)).toBe(true);
          }
          const p0 = lane.centerLine[0];
          const centered = street.axis === 'x' ? p0.z : p0.x;
          const laneCenter =
            street.axis === 'x'
              ? (lane.bounds.minZ + lane.bounds.maxZ) / 2
              : (lane.bounds.minX + lane.bounds.maxX) / 2;
          expect(almostOn(centered - laneCenter)).toBe(true);
        }
      }
    }
  });

  it('keeps crosswalk and parking-slot centers inside the carriageway', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      for (const street of layout.streets) {
        for (const c of street.crosswalks) {
          expect(pointInRect(rectCenter(c.bounds), street.carriageway)).toBe(true);
        }
        for (const slot of street.parkingSlots) {
          expect(pointInRect(rectCenter(slot.bounds), street.carriageway)).toBe(true);
        }
      }
    }
  });
});

describe('sidewalk walking paths', () => {
  it('keeps every sampled segment point on a road, crosswalk, or sidewalk', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      const pads: GridRect[] = [
        ...layout.sidewalks.map((s) => s.bounds),
        ...layout.streets.map((s) => s.carriageway),
        ...layout.streets.flatMap((s) => s.crosswalks.map((c) => c.bounds)),
      ];
      for (const path of layout.walkingPaths) {
        for (const point of samplePathPoints(path.points)) {
          expect(pads.some((rect) => pointInRect(point, rect))).toBe(true);
        }
      }
    }
  });

  it('has a crossing path over every street crosswalk', () => {
    const layout = createCityBlockLayout('seed-42');
    for (const street of layout.streets) {
      const crossing = street.crosswalks[0];
      const found = layout.walkingPaths.some((p) =>
        samplePathPoints(p.points).some((pt) => pointInRectEps(pt, crossing.bounds, 0.05)),
      );
      expect(found).toBe(true);
    }
  });
});

describe('street-furniture anchors', () => {
  it('provides all six furniture kinds deterministically on paving', () => {
    for (const seed of SEEDS) {
      const layout = createCityBlockLayout(seed);
      const kinds = [...new Set(layout.furniture.map((f) => f.kind))].sort();
      expect(kinds).toEqual(['bench', 'busStop', 'fireHydrant', 'lamp', 'mailbox', 'trashCan']);
      for (const f of layout.furniture) {
        const onPaving = layout.sidewalks.some((s) => pointInRect(f.position, s.bounds));
        expect(onPaving).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Ground meshes                                                       */
/* ------------------------------------------------------------------ */

describe('buildGroundMeshes', () => {
  it('constructs ground, roads, sidewalks, curbs and crosswalks', () => {
    const layout = createCityBlockLayout('seed-42');
    const group = buildGroundMeshes(layout);
    expect(group).toBeInstanceOf(Group);
    expect(group.name).toBe('city-block-ground');

    const names = group.children.map((m) => m.name);
    expect(names).toContain('ground');
    expect(names.filter((n) => n.startsWith('road-'))).toHaveLength(2);
    expect(names.filter((n) => n.startsWith('sidewalk-'))).toHaveLength(4);
    expect(names.filter((n) => n.startsWith('crosswalk-'))).toHaveLength(2);
    expect(names.filter((n) => n.startsWith('curb-'))).toHaveLength(4);

    const resources = group.userData.groundResources as { materials: unknown[] };
    expect(resources.materials.length).toBeGreaterThan(0);

    disposeGroundMeshes(group);
  });

  it('releases materials on dispose and detaches the group from its parent', () => {
    const layout = createCityBlockLayout('seed-1');
    const group = buildGroundMeshes(layout);
    const resources = group.userData.groundResources as { materials: { dispose: () => void }[] };
    const spy = vi.spyOn(resources.materials[0], 'dispose');

    const scene = new Group();
    scene.add(group);
    expect(scene.children).toHaveLength(1);

    disposeGroundMeshes(group);

    expect(scene.children).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* Texture builders                                                    */
/* ------------------------------------------------------------------ */

describe('texture builders', () => {
  it('createStreetTexture and createCrosswalkTexture produce canvases', () => {
    const layout = createCityBlockLayout('seed-42');
    const street = layout.streets[0];
    const streetTexture = createStreetTexture(street, 'seed-42');
    expect(streetTexture.image).toBeInstanceOf(HTMLCanvasElement);

    const crossing = street.crosswalks[0];
    const crossTexture = createCrosswalkTexture(crossing, 'seed-42');
    expect(crossTexture.image).toBeInstanceOf(HTMLCanvasElement);
    expect(crossing.stripeCount).toBeGreaterThan(1);

    streetTexture.dispose();
    crossTexture.dispose();
  });
});