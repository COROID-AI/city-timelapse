// @vitest-environment node
/**
 * blockLayer.test.ts — BlockLayer geometry, era building variants and
 * storefront/advertisement content tests.
 *
 * Runs in the default Node environment: three.js scene-graph work needs no DOM
 * and no WebGL renderer.
 */

import { Box3, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import {
  CROSSWALK,
  LOT_EXTENTS,
  ROAD,
  SIDEWALK,
  type Rect,
} from '../core/blockLayout';
import { getEraDefinition, type EraId } from '../eras/eraSystem';
import { BUILDING_VARIANT_BY_ERA } from './buildings';
import { BlockLayer, BLOCK_LOT_IDS, GLOW_GAIN } from './blockLayer';

const CROSSWALK_RECTS: readonly Rect[] = [
  CROSSWALK.northWest,
  CROSSWALK.northEast,
  CROSSWALK.eastNorth,
  CROSSWALK.eastSouth,
  CROSSWALK.southEast,
  CROSSWALK.southWest,
  CROSSWALK.westSouth,
  CROSSWALK.westNorth,
];

const ERA_WALK: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

function meshesNamed(root: Group, name: string): Mesh[] {
  return root
    .getObjectsByProperty('name', name)
    .filter((object): object is Mesh => object instanceof Mesh);
}

function insideRect(rect: Rect, x: number, z: number): boolean {
  return x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ;
}

function atCenter(mesh: Mesh, rect: Rect, y: number): boolean {
  return (
    Math.abs(mesh.position.x - (rect.minX + rect.maxX) / 2) < 0.01 &&
    Math.abs(mesh.position.z - (rect.minZ + rect.maxZ) / 2) < 0.01 &&
    Math.abs(mesh.position.y - y) < 0.03
  );
}

/** Euclidean distance between two colors in RGB space. */
function colorDistance(a: Color, b: Color): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

describe('BlockLayer geometry follows blockLayout', () => {
  it('tiles the four lot buildings inside the block bounds', () => {
    const layer = new BlockLayer();
    const group = new Group();
    layer.attach(group);

    for (const lotId of BLOCK_LOT_IDS) {
      const building = layer.lotBuildings[lotId];
      const box = new Box3().setFromObject(building.root);
      const lot = LOT_EXTENTS[lotId];
      expect(box.min.x).toBeGreaterThanOrEqual(lot.minX - 0.75);
      expect(box.max.x).toBeLessThanOrEqual(lot.maxX + 0.75);
      expect(box.min.z).toBeGreaterThanOrEqual(lot.minZ - 0.75);
      expect(box.max.z).toBeLessThanOrEqual(lot.maxZ + 0.75);
      expect(box.min.y).toBeGreaterThanOrEqual(-0.1);
      expect(box.max.y).toBeGreaterThan(0);
    }
    expect(layer.lotBuildings).toHaveProperty('NW');
    expect(layer.lotBuildings).toHaveProperty('NE');
    expect(layer.lotBuildings).toHaveProperty('SW');
    expect(layer.lotBuildings).toHaveProperty('SE');
  });

  it('places the sidewalk and road bands at the shared layout offsets', () => {
    const layer = new BlockLayer();
    const group = new Group();
    layer.attach(group);

    const sidewalks = meshesNamed(group, 'sidewalk');
    expect(sidewalks).toHaveLength(4);
    for (const band of [SIDEWALK.north, SIDEWALK.east, SIDEWALK.south, SIDEWALK.west]) {
      expect(sidewalks.some((mesh) => atCenter(mesh, band, 0.05))).toBe(true);
    }

    const roads = meshesNamed(group, 'road');
    expect(roads).toHaveLength(4);
    for (const band of [ROAD.north, ROAD.east, ROAD.south, ROAD.west]) {
      expect(roads.some((mesh) => atCenter(mesh, band, 0.03))).toBe(true);
    }
  });

  it('marks every corner crossing with crosswalk stripes inside the road band', () => {
    const layer = new BlockLayer();
    const group = new Group();
    layer.attach(group);

    const stripes = meshesNamed(group, 'crosswalk-stripe');
    expect(stripes.length).toBeGreaterThanOrEqual(CROSSWALK_RECTS.length * 4);
    for (const stripe of stripes) {
      expect(
        CROSSWALK_RECTS.some((rect) => insideRect(rect, stripe.position.x, stripe.position.z)),
      ).toBe(true);
    }
    for (const rect of CROSSWALK_RECTS) {
      expect(stripes.some((stripe) => insideRect(rect, stripe.position.x, stripe.position.z))).toBe(
        true,
      );
    }
  });
});

describe('five per-era building variants across the four lots', () => {
  it('walks all five eras and swaps the structure variant on every lot', () => {
    const layer = new BlockLayer({ initialEra: 1945 });

    const heights: number[] = [];
    for (const eraId of ERA_WALK) {
      layer.applyEra(eraId, 1);
      expect(layer.currentEra).toBe(eraId);
      for (const lotId of BLOCK_LOT_IDS) {
        const record = layer.lotBuildings[lotId];
        expect(record.variantKey).toBe(BUILDING_VARIANT_BY_ERA[eraId]);
        expect(record.eraId).toBe(eraId);
        expect(record.floors).toBeGreaterThan(0);
        expect(record.root.userData.variantKey).toBe(BUILDING_VARIANT_BY_ERA[eraId]);
      }
      heights.push(layer.lotBuildings.NW.heightMeters);
    }
    // 1945 low-rises grow into 2025 glass towers.
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });

  it('keeps every variant building above ground with street-facing parts', () => {
    const layer = new BlockLayer();
    const group = new Group();
    layer.attach(group);

    expect(meshesNamed(group, 'roof').length).toBeGreaterThan(0); // 1945 pitched roofs
    expect(meshesNamed(group, 'building-body').length).toBeGreaterThan(0);
    expect(meshesNamed(group, 'window-strip').length).toBeGreaterThan(0);
    expect(meshesNamed(group, 'entry').length).toBeGreaterThan(0);
  });
});

describe('storefronts and advertisements change per era', () => {
  it('serves the era storefront anatomy across all four lots', () => {
    const layer = new BlockLayer({ initialEra: 1945 });

    for (const eraId of ERA_WALK) {
      const era = getEraDefinition(eraId);
      layer.applyEra(eraId, 1);
      expect(layer.storefronts).toHaveLength(4);
      for (const storefront of layer.storefronts) {
        expect(storefront.signageKey).toBe(era.storefronts.signage);
        expect(storefront.eraId).toBe(eraId);
        expect(storefront.displayWindowCount).toBeGreaterThan(0);
        expect(storefront.doorCount).toBe(1);
        expect(storefront.awningCount).toBeGreaterThan(0);
        expect(storefront.shopType.length).toBeGreaterThan(0);
      }

      if (eraId === 1945) {
        for (const storefront of layer.storefronts) {
          expect(storefront.wallSignCount).toBeGreaterThan(0);
          expect(storefront.marqueeCount).toBe(0);
        }
      } else if (eraId === 1965) {
        for (const storefront of layer.storefronts) {
          expect(storefront.marqueeCount).toBeGreaterThan(0);
          expect(storefront.neonTubeCount).toBeGreaterThan(0);
        }
      } else if (eraId === 1985) {
        for (const storefront of layer.storefronts) {
          expect(storefront.neonTubeCount).toBeGreaterThan(0);
          expect(storefront.marqueeCount).toBe(0);
        }
      } else if (eraId === 2005) {
        for (const storefront of layer.storefronts) {
          expect(storefront.backlitPanelCount).toBeGreaterThan(0);
        }
      } else if (eraId === 2025) {
        for (const storefront of layer.storefronts) {
          expect(storefront.ledStripCount).toBeGreaterThan(0);
        }
      }
    }
  });

  it('swaps advertisement technology and copy per era', () => {
    const layer = new BlockLayer({ initialEra: 1945 });

    for (const eraId of ERA_WALK) {
      const era = getEraDefinition(eraId);
      layer.applyEra(eraId, 1);
      expect(layer.advertisements.length).toBeGreaterThanOrEqual(4);
      for (const ad of layer.advertisements) {
        expect(ad.technology).toBe(era.advertisements.technology);
        expect(ad.animated).toBe(era.advertisements.animated);
        expect(era.advertisements.copy).toContain(ad.copy);
        expect(ad.root.userData.copy).toBe(ad.copy);
      }
      expect(layer.advertisements.some((ad) => ad.kind === 'rooftop')).toBe(true);
      expect(layer.advertisements.some((ad) => ad.kind === 'facade')).toBe(true);
    }
  });

  it('glows brighter in the neon/CRT and LED eras than in painted 1945', () => {
    const layer = new BlockLayer({ initialEra: 1945 });
    layer.applyEra(1945, 1);
    const glow1945 = layer.maxGlowIntensity();
    layer.applyEra(1985, 1);
    const glow1985 = layer.maxGlowIntensity();
    layer.applyEra(2025, 1);
    const glow2025 = layer.maxGlowIntensity();

    expect(glow1945).toBeCloseTo(getEraDefinition(1945).atmosphere.bloom * GLOW_GAIN, 5);
    expect(glow1985).toBeGreaterThan(glow1945);
    expect(glow2025).toBeGreaterThan(glow1945);
  });
});

describe('street surface changes per era', () => {
  it('lays trolley tracks in 1945 and a marked bike lane in 2025', () => {
    const layer = new BlockLayer({ initialEra: 1945 });
    const group = new Group();
    layer.attach(group);

    layer.applyEra(1945, 1);
    expect(layer.street.styleLabel).toBe('worn-asphalt');
    expect(layer.street.trolleyRailCount).toBeGreaterThanOrEqual(2);
    expect(layer.street.trolleyTieCount).toBeGreaterThan(0);
    expect(meshesNamed(group, 'trolley-track').length).toBeGreaterThanOrEqual(2);
    expect(meshesNamed(group, 'bike-lane')).toHaveLength(0);

    layer.applyEra(2025, 1);
    expect(layer.street.styleLabel).toBe('crisp-asphalt');
    expect(layer.street.bikeLaneBandCount).toBe(4);
    expect(layer.street.bikeLaneDashCount).toBeGreaterThan(0);
    expect(meshesNamed(group, 'bike-lane')).toHaveLength(4);
    expect(meshesNamed(group, 'bike-lane-dash').length).toBeGreaterThan(0);
    expect(meshesNamed(group, 'trolley-track')).toHaveLength(0);
  });

  it('styles the crosswalk markings per era', () => {
    const layer = new BlockLayer({ initialEra: 1945 });
    const group = new Group();
    layer.attach(group);

    const stripes = meshesNamed(group, 'crosswalk-stripe');
    expect(stripes.length).toBeGreaterThan(0);
    const marking1945 = new Color('#d2c8b2');
    const marking2025 = new Color('#ffffff');
    expect(
      colorDistance((stripes[0].material as MeshStandardMaterial).color, marking1945),
    ).toBeLessThan(0.05);

    layer.applyEra(2025, 1);
    const stripes2025 = meshesNamed(group, 'crosswalk-stripe');
    expect(stripes2025.length).toBeGreaterThan(0);
    expect(
      colorDistance((stripes2025[0].material as MeshStandardMaterial).color, marking2025),
    ).toBeLessThan(0.05);
  });
});

describe('applyEra lerps continuous materials and swaps discrete variants', () => {
  it('blends facade materials between eras before the midpoint swap', () => {
    const layer = new BlockLayer({ initialEra: 1945 });

    const srcBrick = new Color(getEraDefinition(1945).palette.buildings[0]);
    const dstSlab = new Color(getEraDefinition(1965).palette.buildings[0]);

    layer.applyEra(1965, 0.25);
    expect(layer.deployedEra).toBe(1945);
    expect(layer.lotBuildings.NW.variantKey).toBe('brick-brownstone');
    const expectedMid = new Color().copy(srcBrick).lerp(dstSlab, 0.25);
    expect(colorDistance(layer.lotBuildings.NW.facadeMaterial.color, expectedMid)).toBeLessThan(
      0.02,
    );
    // Sign glow has started creeping from the 1945 base.
    const midGlow = layer.maxGlowIntensity();
    const low = getEraDefinition(1945).atmosphere.bloom * GLOW_GAIN;
    const high = getEraDefinition(1965).atmosphere.bloom * GLOW_GAIN;
    expect(midGlow).toBeGreaterThan(low);
    expect(midGlow).toBeLessThan(high);

    layer.applyEra(1965, 0.75);
    expect(layer.deployedEra).toBe(1965);
    expect(layer.lotBuildings.NW.variantKey).toBe('midcentury-slab');

    layer.applyEra(1965, 1);
    expect(layer.currentEra).toBe(1965);
    // The settled slab facade reached its era palette entry exactly (idempotent
    // settle), and has moved fully off the 1945 brick.
    const settled = layer.lotBuildings.NW.facadeMaterial.color.clone();
    layer.applyEra(1965, 1);
    expect(colorDistance(layer.lotBuildings.NW.facadeMaterial.color, settled)).toBeLessThan(
      0.0001,
    );
    expect(colorDistance(settled, srcBrick)).toBeGreaterThan(0.2);
  });

  it('retargets cleanly and remains idempotent for the active era', () => {
    const layer = new BlockLayer({ initialEra: 1945 });

    layer.applyEra(1965, 0.4);
    expect(layer.lotBuildings.NW.variantKey).toBe('brick-brownstone');
    layer.applyEra(1985, 0.2);
    expect(layer.deployedEra).toBe(1945);
    layer.applyEra(1985, 1);
    expect(layer.currentEra).toBe(1985);
    expect(layer.lotBuildings.NW.variantKey).toBe('glass-neon-tower');

    const settledColor = layer.lotBuildings.NW.facadeMaterial.color.clone();
    layer.applyEra(1985, 1);
    expect(colorDistance(layer.lotBuildings.NW.facadeMaterial.color, settledColor)).toBeLessThan(
      0.0001,
    );
  });
});

describe('BlockLayer lifecycle', () => {
  it('attaches into a group and dispose removes everything', () => {
    const layer = new BlockLayer();
    const group = new Group();
    layer.attach(group);
    expect(group.children).toContain(layer.root);
    expect(group.getObjectsByProperty('name', 'building').length).toBeGreaterThan(0);

    layer.dispose();
    expect(group.children).toHaveLength(0);
    expect(() => layer.applyEra(1965, 1)).toThrow(/disposed/i);
    expect(() => layer.attach(group)).toThrow(/disposed/i);
  });
});