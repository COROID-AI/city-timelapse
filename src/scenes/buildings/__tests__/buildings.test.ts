import { describe, expect, it } from 'vitest';
import {
  Buildings,
  buildBuildings,
  buildingInstanceCount,
  eraDataForYear,
  resolveBuilding,
} from '../index.js';
import { CITY_BLOCK_LAYOUT } from '../../layout/index.js';
import { ERA_YEARS, getEra } from '../../eras/index.js';

/** All five canonical era years. */
const YEARS = [1945, 1965, 1985, 2005, 2025];

describe('buildings: per-era architecture (1945–2025)', () => {
  it('mounts Buildings for each era via the lifecycle contract', () => {
    for (const year of YEARS) {
      const state = Buildings.instantiate(year);
      const attached = Buildings.attach(state);
      expect(attached.instanceCount).toBe(CITY_BLOCK_LAYOUT.lots.length);
      expect(state.attached).toBe(true);
      Buildings.dispose(state);
      expect(state.attached).toBe(false);
    }
  });

  it('produces distinct facade height/material/signage per era', () => {
    const byYear: Record<number, ReturnType<typeof buildBuildings>> = {};
    const styleIds = new Set<string>();
    const heights = new Set<number>();
    const media = new Set<string>();
    const palettes = new Set<string>();

    for (const year of YEARS) {
      const geometry = buildBuildings(year);
      byYear[year] = geometry;
      const first = resolveBuilding(CITY_BLOCK_LAYOUT.lots[0]!, year);
      styleIds.add(first.material.styleId);
      heights.add(Math.round(first.heightM));
      media.add(first.signage.medium);
      palettes.add(first.material.palette.join('|'));

      expect(geometry.instanceCount).toBeGreaterThan(0);
      expect(geometry.buildingBoxes.length).toBe(geometry.instanceCount);

      // Distinct per-era material identity.
      expect(first.material.styleId).toBe(getEra(year).architecture.styleId);
      expect(first.material.masonry).toBe(getEra(year).architecture.masonry);
      expect(first.material.glassRatio).toBe(getEra(year).architecture.glassRatio);
      expect(first.signage.medium).toBe(getEra(year).advertisements.medium);
    }

    // All five eras are genuinely distinct in style, height, signage, palette.
    expect(styleIds.size).toBe(5);
    expect(media.size).toBe(5);
    expect(palettes.size).toBe(5);
    // Heights strictly increase across eras (era max heights are monotonic).
    const heightList = YEARS.map((y) => Math.round(byYear[y]!.buildingBoxes[0]!.height));
    for (let i = 1; i < heightList.length; i++) {
      expect(heightList[i]!).toBeGreaterThan(heightList[i - 1]!);
    }
  });

  it('facades interpolate smoothly during era transitions', () => {
    const mid = eraDataForYear(1955);
    const from = getEra(1945);
    const to = getEra(1965);
    // Blended numeric aspects sit between the bracketing eras.
    expect(mid.architecture.masonry).toBeGreaterThan(to.architecture.masonry);
    expect(mid.architecture.masonry).toBeLessThan(from.architecture.masonry);
    expect(mid.architecture.maxHeightM).toBeCloseTo(
      (from.architecture.maxHeightM + to.architecture.maxHeightM) / 2,
      5,
    );

    // A building at an interpolated year is between the endpoint heights.
    const h45 = resolveBuilding(CITY_BLOCK_LAYOUT.lots[0]!, 1945).heightM;
    const h65 = resolveBuilding(CITY_BLOCK_LAYOUT.lots[0]!, 1965).heightM;
    const h55 = resolveBuilding(CITY_BLOCK_LAYOUT.lots[0]!, 1955).heightM;
    expect(h55).toBeGreaterThan(h45);
    expect(h55).toBeLessThan(h65);
  });

  it('detail elements are present and instanced/merged for performance', () => {
    for (const year of YEARS) {
      const g = buildBuildings(year);
      // Every instance contributes instanced detail boxes.
      expect(g.mullions.length).toBeGreaterThan(0);
      expect(g.rooftopMachinery.length).toBeGreaterThan(0);
      // At least one cornice or fire escape or awning across the block.
      expect(g.cornices.length + g.fireEscapes.length + g.awnings.length).toBeGreaterThan(0);
      // Merged buffers: vertex count reflects the flattened box geometry.
      const expectedVertices =
        (g.buildingBoxes.length +
          g.mullions.length +
          g.cornices.length +
          g.fireEscapes.length +
          g.awnings.length +
          g.rooftopMachinery.length +
          g.greenWalls.length +
          g.solarPanels.length +
          g.ledAccents.length) *
        8;
      expect(g.vertexCount).toBe(expectedVertices);
    }

    // 2025 specifically has green walls and rooftop solar.
    const g2025 = buildBuildings(2025);
    expect(g2025.greenWalls.length).toBeGreaterThan(0);
    expect(g2025.solarPanels.length).toBeGreaterThan(0);
  });

  it('occupies layout lot bounds and consumes the era registry read-only', () => {
    for (const year of YEARS) {
      const geometry = buildBuildings(year);
      for (let i = 0; i < geometry.buildingBoxes.length; i++) {
        const lot = CITY_BLOCK_LAYOUT.lots[i]!;
        const box = geometry.buildingBoxes[i]!;
        const b = lot.bounds;
        // Footprint stays inside the lot bounds (with facade inset).
        expect(box.x).toBeGreaterThanOrEqual(b.x);
        expect(box.x + box.width).toBeLessThanOrEqual(b.x + b.width);
        expect(box.z).toBeGreaterThanOrEqual(b.z);
        expect(box.z + box.depth).toBeLessThanOrEqual(b.z + b.depth);
      }
    }
  });

  it('exposes a stable instance count matching the lots', () => {
    expect(buildingInstanceCount()).toBe(CITY_BLOCK_LAYOUT.lots.length);
    expect(ERA_YEARS).toEqual([1945, 1965, 1985, 2005, 2025]);
  });
});