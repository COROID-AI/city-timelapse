/**
 * Unit tests for the buildings system: era data completeness, per-plot
 * building counts, deterministic geometry, and palette interpolation.
 *
 * These tests never touch a real renderer — jsdom canvas 2D is stubbed with a
 * no-op context (the same trick the layout suite uses) so THREE material
 * constructors that reference textures don't need real pixels.
 */

import { Group, InstancedMesh, Mesh } from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import { buildingEraData, ERA_IDS } from '../buildingEraData';
import {
  buildingHeightFor,
  createBuildingGroup,
  createBuildingRng,
  getEraData,
  interpolateBuildingStyle,
  windowGridFor,
  windowIsLit,
} from '../buildingFactory';
import { createFacadeTexture, createRoofTexture } from '../facadeTextures';

/* ------------------------------------------------------------------ */
/* jsdom canvas 2D stub                                                */
/* ------------------------------------------------------------------ */

let stubSpy: ReturnType<typeof vi.spyOn> | undefined;

const STUB_2D = {
  fillStyle: '',
  strokeStyle: '',
  fill: () => {},
  stroke: () => {},
  fillRect: () => {},
  clearRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
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
/* Era data completeness                                               */
/* ------------------------------------------------------------------ */

describe('buildingEraData', () => {
  it('covers all five eras with era-distinct architecture', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025']);
    for (const eraId of ERA_IDS) {
      const data = buildingEraData[eraId];
      expect(data).toBeDefined();
      expect(data.spec.facadePalette.length).toBeGreaterThan(0);
      expect(data.spec.heightScale).toBeGreaterThan(0);
      expect(data.spec.windowIlluminationRate).toBeGreaterThanOrEqual(0);
      expect(data.spec.windowIlluminationRate).toBeLessThanOrEqual(1);
    }
  });

  it('evolves roof props through the era arc', () => {
    const props = ERA_IDS.map((id) => buildingEraData[id].roofProp);
    expect(props).toEqual([
      'water_tower',
      'ac_units',
      'antennas',
      'satellite_dishes',
      'solar_panels',
    ]);
  });

  it('increases heightScale monotonically across eras', () => {
    const scales = ERA_IDS.map((id) => buildingEraData[id].spec.heightScale);
    for (let i = 1; i < scales.length; i += 1) {
      expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

describe('interpolateBuildingStyle', () => {
  it('lerps palette/emissive/height between two eras', () => {
    const style = interpolateBuildingStyle('1945', '2025', 0.5);
    expect(style.heightScale).toBeCloseTo(
      (buildingEraData['1945'].spec.heightScale + buildingEraData['2025'].spec.heightScale) / 2,
      2,
    );
    expect(style.emissiveColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(style.facadeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns the from-era emissive at t=0 and to-era emissive at t=1', () => {
    const at0 = interpolateBuildingStyle('1945', '2025', 0);
    expect(at0.emissiveColor).toBe(buildingEraData['1945'].spec.windowEmissiveColor);
    const at1 = interpolateBuildingStyle('1945', '2025', 1);
    expect(at1.emissiveColor).toBe(buildingEraData['2025'].spec.windowEmissiveColor);
  });

  it('is deterministic for a fixed channel', () => {
    const a = interpolateBuildingStyle('1965', '1985', 0.37);
    const b = interpolateBuildingStyle('1965', '1985', 0.37);
    expect(a).toEqual(b);
  });
});

describe('windowGridFor + windowIsLit', () => {
  it('produces a sane grid for a facade', () => {
    const grid = windowGridFor(12, 24);
    expect(grid.columns).toBeGreaterThanOrEqual(2);
    expect(grid.rows).toBeGreaterThanOrEqual(2);
    expect(grid.windowWidth).toBeLessThan(12);
    expect(grid.windowHeight).toBeLessThan(24);
  });

  it('windowIsLit is deterministic and rate-driven', () => {
    expect(windowIsLit('seed-42', 3, 1)).toBe(true);
    expect(windowIsLit('seed-42', 3, 0)).toBe(false);
    expect(windowIsLit('seed-42', 7, 0.5)).toBe(windowIsLit('seed-42', 7, 0.5));
  });
});

describe('buildingHeightFor', () => {
  it('stays inside the plot height range scaled by heightScale', () => {
    const layout = createCityBlockLayout('seed-42');
    for (const plot of layout.plots) {
      const h = buildingHeightFor(plot, 1, 'seed-42');
      expect(h).toBeGreaterThanOrEqual(plot.heightRange.min * 0.999);
      expect(h).toBeLessThanOrEqual(plot.heightRange.max * 1.001);
      const hTall = buildingHeightFor(plot, 2.2, 'seed-42');
      expect(hTall).toBeGreaterThan(h);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Building group construction                                         */
/* ------------------------------------------------------------------ */

function collectMeshCount(group: Group): number {
  let count = 0;
  for (const child of group.children) {
    if (child instanceof Mesh || child instanceof InstancedMesh) {
      count += 1;
    } else if (child instanceof Group) {
      count += collectMeshCount(child);
    }
  }
  return count;
}

describe('createBuildingGroup', () => {
  it('builds one merged body + windows + roof props per plot', () => {
    const layout = createCityBlockLayout('seed-42');
    const totalByPlot = new Map<string, number>();
    for (const plot of layout.plots) {
      const era = getEraData('1985');
      const style = interpolateBuildingStyle('1985', '1985', 1);
      const height = buildingHeightFor(plot, style.heightScale, 'seed-42');
      const building = createBuildingGroup({
        plot,
        era,
        style,
        height,
        seed: `unit:${plot.id}`,
      });

      totalByPlot.set(plot.id, collectMeshCount(building.group));

      // Every building owns a merged body, roof props, and window instances.
      expect(building.body).toBeDefined();
      expect(building.geometry).toBeDefined();
      expect(building.roofGroup.children.length).toBeGreaterThan(0);
      expect(building.windows.length).toBeGreaterThan(0);
      expect(building.materials.length).toBeGreaterThan(0);
      expect(building.textures.length).toBeGreaterThan(0);

      building.dispose();
    }
    // Every plot got a real building (no plot skipped).
    expect(totalByPlot.size).toBe(layout.plots.length);
  });

  it('generates era-distinct roof props (water tower vs solar panels)', () => {
    const layout = createCityBlockLayout('seed-42');
    const plot = layout.plots[0];

    const oldEra = getEraData('1945');
    const oldStyle = interpolateBuildingStyle('1945', '1945', 1);
    const oldH = buildingHeightFor(plot, oldStyle.heightScale, 'seed-42');
    const oldBuilding = createBuildingGroup({
      plot,
      era: oldEra,
      style: oldStyle,
      height: oldH,
      seed: 'distinct:old',
    });
    const oldNames = roofPropNames(oldBuilding);
    expect(oldNames.some((n) => n.includes('water-tower'))).toBe(true);

    const newEra = getEraData('2025');
    const newStyle = interpolateBuildingStyle('2025', '2025', 1);
    const newH = buildingHeightFor(plot, newStyle.heightScale, 'seed-42');
    const newBuilding = createBuildingGroup({
      plot,
      era: newEra,
      style: newStyle,
      height: newH,
      seed: 'distinct:new',
    });
    const newNames = roofPropNames(newBuilding);
    expect(newNames.some((n) => n.includes('solar'))).toBe(true);
    expect(newNames.some((n) => n.includes('water-tower'))).toBe(false);

    oldBuilding.dispose();
    newBuilding.dispose();
  });

  it('dispose is idempotent and detaches from parent', () => {
    const layout = createCityBlockLayout('seed-42');
    const plot = layout.plots[0];
    const era = getEraData('1965');
    const style = interpolateBuildingStyle('1965', '1965', 1);
    const building = createBuildingGroup({
      plot,
      era,
      style,
      height: buildingHeightFor(plot, style.heightScale, 'seed-42'),
      seed: 'dispose-test',
    });
    const scene = new Group();
    scene.add(building.group);
    expect(scene.children).toHaveLength(1);

    building.dispose();
    building.dispose(); // idempotent

    expect(scene.children).toHaveLength(0);
  });
});

function roofPropNames(building: ReturnType<typeof createBuildingGroup>): string[] {
  const names: string[] = [];
  const walk = (group: Group) => {
    for (const child of group.children) {
      if (child instanceof Mesh) {
        names.push(child.name ?? '');
      } else if (child instanceof Group) {
        walk(child);
      }
    }
  };
  walk(building.roofGroup);
  return names;
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */

describe('procedural facade/roof textures', () => {
  it('creates deterministic canvases per era', () => {
    for (const eraId of ERA_IDS) {
      const era = buildingEraData[eraId];
      const facade = createFacadeTexture({
        era,
        columns: 6,
        rows: 9,
        widthMeters: 12,
        heightMeters: 24,
        seed: `tex:${eraId}`,
        kind: era.windowLayout === 'curtain' ? 'curtain' : 'brick',
      });
      expect(facade.image).toBeInstanceOf(HTMLCanvasElement);
      facade.dispose();
    }
    const roof = createRoofTexture({
      era: buildingEraData['2025'],
      widthMeters: 10,
      depthMeters: 8,
      seed: 'tex:roof',
    });
    expect(roof.image).toBeInstanceOf(HTMLCanvasElement);
    roof.dispose();
  });
});

/* ------------------------------------------------------------------ */
/* RNG determinism                                                     */
/* ------------------------------------------------------------------ */

describe('createBuildingRng', () => {
  it('produces identical streams for the same seed', () => {
    const a = createBuildingRng('seed-42');
    const b = createBuildingRng('seed-42');
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('produces different streams for different seeds', () => {
    const a = createBuildingRng('seed-1');
    const b = createBuildingRng('seed-2');
    expect(b()).not.toBe(a());
  });
});