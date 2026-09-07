import { describe, expect, it } from 'vitest';
import {
  createCityBlockLayout,
  createDefaultBuildingShells,
} from '../src/layout/cityBlockLayout';
import { createLotAnchor } from '../src/layout/lotAnchors';
import { validateBuildingShell } from '../src/types/buildingShell';
import { validateStreetFeature, StreetFeature } from '../src/types/streetFeature';

describe('CityBlockLayout', () => {
  it('produces 10 lots', () => {
    const layout = createCityBlockLayout();
    expect(layout.lots).toHaveLength(10);
  });

  it('has a cross street and an intersection', () => {
    const layout = createCityBlockLayout();
    expect(layout.crossStreet.id).toBe('cross-street');
    expect(layout.crossStreet.rect.depth).toBeGreaterThan(0);
    expect(layout.intersection.id).toBe('intersection-se');
    expect(layout.intersection.rect.width).toBeGreaterThan(0);
  });

  it('has perimeter streets and sidewalks', () => {
    const layout = createCityBlockLayout();
    expect(layout.streets.length).toBe(4);
    expect(layout.sidewalks.length).toBe(4);
  });

  it('bounds contain all lots', () => {
    const layout = createCityBlockLayout();
    for (const lot of layout.lots) {
      expect(lot.origin.x).toBeGreaterThanOrEqual(layout.bounds.minX);
      expect(lot.origin.z).toBeGreaterThanOrEqual(layout.bounds.minZ);
      expect(lot.origin.x + lot.width).toBeLessThanOrEqual(layout.bounds.maxX);
      expect(lot.origin.z + lot.depth).toBeLessThanOrEqual(layout.bounds.maxZ);
    }
  });

  it('lots are non-overlapping and within the block', () => {
    const layout = createCityBlockLayout();
    const rects = layout.lots.map((l) => ({ x: l.origin.x, z: l.origin.z, w: l.width, d: l.depth }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
        const overlapZ = a.z < b.z + b.d && b.z < a.z + a.d;
        expect(overlapX && overlapZ).toBe(false);
      }
    }
  });

  it('default building shells validate and occupy lots', () => {
    const layout = createCityBlockLayout();
    const shells = createDefaultBuildingShells(layout, 1945);
    expect(shells).toHaveLength(10);
    for (const shell of shells) {
      expect(validateBuildingShell(shell)).toBeNull();
    }
  });

  it('lot anchor transform maps local space to world space', () => {
    const anchor = createLotAnchor({ x: 10, z: 20 }, 12, 28, 0);
    const p = anchor.transform(6, 5, 14);
    expect(p.x).toBeCloseTo(16, 5);
    expect(p.y).toBeCloseTo(5, 5);
    expect(p.z).toBeCloseTo(34, 5);
    expect(anchor.center.x).toBeCloseTo(16, 5);
    expect(anchor.center.z).toBeCloseTo(34, 5);
  });

  it('lot anchor transform applies rotation', () => {
    const anchor = createLotAnchor({ x: 0, z: 0 }, 12, 28, 90);
    const p = anchor.transform(12, 0, 0);
    // Rotating (12,0) by 90deg about origin -> (0,12) in (x,z).
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.z).toBeCloseTo(12, 5);
  });
});

describe('StreetFeature reference implementations', () => {
  const trafficLight: StreetFeature = {
    kind: 'traffic_light',
    rect: { origin: { x: 0, z: 0 }, width: 0.5, depth: 0.5 },
    rotation: 0,
    eras: [1965, 1985, 2005, 2025],
  };
  const hydrant: StreetFeature = {
    kind: 'hydrant',
    rect: { origin: { x: 5, z: 5 }, width: 0.4, depth: 0.4 },
    rotation: 0,
    eras: [1945, 1965, 1985, 2005, 2025],
  };

  it('validates at least two reference implementations', () => {
    expect(validateStreetFeature(trafficLight)).toBeNull();
    expect(validateStreetFeature(hydrant)).toBeNull();
  });

  it('rejects invalid street features', () => {
    expect(validateStreetFeature({ ...trafficLight, rect: { ...trafficLight.rect, width: 0 } })).toContain('width');
    expect(validateStreetFeature({ ...trafficLight, eras: [] })).toContain('era');
    expect(
      validateStreetFeature({ ...trafficLight, eras: [1999 as unknown as never] }),
    ).toContain('era');
  });
});