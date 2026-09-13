import { describe, expect, it } from 'vitest';
import { createBlockLayout } from '../layout';
import { ERA_YEARS, type EraId } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';
import { buildStreetSurface } from './street';

const SEED = 90210;

function buildFor(era: EraId) {
  return buildStreetSurface(createBlockLayout(SEED), era, SEED);
}

describe('Street surfaces (src/world/furniture/street.ts)', () => {
  it('paints each era asphalt with its palette color', () => {
    for (const era of ERA_YEARS) {
      const surface = buildFor(era);
      expect(surface.asphalt.baseColor).toBe(ERA_PALETTES[era]!.asphalt);
      expect(surface.asphalt.roadWidth).toBe(14);
      expect(surface.asphalt.textureGrain).toBeGreaterThan(0);
    }
  });

  it('ages painted markings: white 1945 center line, yellow double from 1965', () => {
    const center1945 = buildFor(1945).asphalt.markings.find((m) => m.kind === 'center_line')!;
    expect(center1945.style).toBe('single');
    expect(center1945.color).toMatch(/^#e8e4da$/);
    expect(center1945.segments.length).toBeGreaterThan(0);

    for (const era of [1965, 1985, 2005, 2025] as const) {
      const center = buildFor(era).asphalt.markings.find((m) => m.kind === 'center_line')!;
      expect(center.style).toBe('double');
      expect(center.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(center.segments.length).toBeGreaterThanOrEqual(8); // two spans × two lines per axis
    }
  });

  it('introduces edge lines in 1965 and keeps them through 2025', () => {
    expect(buildFor(1945).asphalt.markings.filter((m) => m.kind === 'edge_line')).toHaveLength(0);
    for (const era of [1965, 1985, 2005, 2025] as const) {
      const edges = buildFor(era).asphalt.markings.filter((m) => m.kind === 'edge_line');
      expect(edges).toHaveLength(4);
      for (const edge of edges) {
        expect(edge.segments.length).toBeGreaterThan(0);
      }
    }
  });

  it('paints four crosswalks with era-varying bar count', () => {
    const barsByEra: Record<EraId, number> = { 1945: 5, 1965: 6, 1985: 7, 2005: 8, 2025: 8 };
    for (const era of ERA_YEARS) {
      const crosswalks = buildFor(era).asphalt.markings.filter((m) => m.kind === 'crosswalk');
      expect(crosswalks).toHaveLength(4);
      for (const cw of crosswalks) {
        expect(cw.segments).toHaveLength(barsByEra[era]!);
      }
    }
  });

  it('adds stop lines on every approach', () => {
    for (const era of ERA_YEARS) {
      const stops = buildFor(era).asphalt.markings.filter((m) => m.kind === 'stop_line');
      expect(stops).toHaveLength(1);
      expect(stops[0]!.segments).toHaveLength(4);
    }
  });

  it('introduces bike infrastructure in 2005 and green cycle tracks in 2025', () => {
    for (const era of [1945, 1965, 1985] as const) {
      expect(buildFor(era).asphalt.markings.filter((m) => m.kind === 'bike_lane')).toHaveLength(0);
      expect(buildFor(era).asphalt.pictograms).toHaveLength(0);
    }
    const bike2005 = buildFor(2005).asphalt.markings.filter((m) => m.kind === 'bike_lane');
    expect(bike2005).toHaveLength(1);
    expect(bike2005[0]!.style).toBe('dashed');
    expect(buildFor(2005).asphalt.pictograms.length).toBeGreaterThan(0);

    const bike2025 = buildFor(2025).asphalt.markings.filter((m) => m.kind === 'bike_lane');
    expect(bike2025).toHaveLength(2); // stripe + green band
    expect(bike2025.some((m) => m.style === 'solid' && m.color === '#4fae6a')).toBe(true);
    expect(buildFor(2025).asphalt.pictograms.length).toBeGreaterThan(0);
  });

  it('wears the pavement hardest in the smog era and finest in 2025', () => {
    const wears: Partial<Record<EraId, number>> = {};
    for (const era of ERA_YEARS) {
      wears[era] = buildFor(era).asphalt.wear;
    }
    expect(wears[1985]!).toBeGreaterThan(wears[1945]!);
    expect(wears[1945]!).toBeGreaterThan(wears[1965]!);
    expect(wears[2005]!).toBeLessThan(wears[1985]!);
    expect(wears[2025]!).toBeLessThan(wears[2005]!);
  });

  it('furnishes drains, manholes and (from 1985) road reflectors', () => {
    for (const era of ERA_YEARS) {
      const surface = buildFor(era);
      expect(surface.asphalt.drains.length).toBeGreaterThan(0);
      expect(surface.asphalt.manholes.length).toBeGreaterThan(0);
      expect(surface.asphalt.tarPatches.length).toBeGreaterThan(0);
    }
    expect(buildFor(1945).asphalt.reflectors).toHaveLength(0);
    expect(buildFor(1965).asphalt.reflectors).toHaveLength(0);
    expect(buildFor(1985).asphalt.reflectors.length).toBeGreaterThan(0);
    expect(buildFor(2025).asphalt.reflectors.length).toBeGreaterThan(0);
  });

  it('defines detailed curb geometry on every sidewalk band', () => {
    for (const era of ERA_YEARS) {
      const curbs = buildFor(era).curbs;
      expect(curbs).toHaveLength(4);
      for (const curb of curbs) {
        expect(curb.height).toBe(0.15);
        expect(curb.topWidth).toBe(0.25);
        expect(curb.segments.length).toBeGreaterThan(10);
        for (const seg of curb.segments) {
          expect(seg.faceHeight).toBe(0.15);
          expect(seg.faceSlope).toBeGreaterThan(0);
          expect(seg.maxX - seg.minX > 0 || seg.maxZ - seg.minZ > 0).toBe(true);
        }
      }
    }
  });

  it('styles sidewalk materials and joints per era', () => {
    const materials: Record<EraId, string> = { 1945: 'concrete', 1965: 'concrete', 1985: 'pavers', 2005: 'pavers', 2025: 'tiles' };
    for (const era of ERA_YEARS) {
      const sidewalks = buildFor(era).sidewalks;
      expect(sidewalks.bands).toHaveLength(4);
      for (const band of sidewalks.bands) {
        expect(band.material).toBe(materials[era]!);
        expect(band.baseColor).toBe(ERA_PALETTES[era]!.sidewalk);
        expect(band.jointSpacing).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic for identical seeds', () => {
    const a = buildFor(1985);
    const b = buildFor(1985);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = buildFor(2005);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});