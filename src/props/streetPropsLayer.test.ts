/**
 * streetPropsLayer.test.ts — per-era prop inventories, placement and layer API.
 *
 * Runs in the default Node environment: three.js scene graph work needs no
 * DOM and no WebGL renderer.
 */
import { Box3, Group } from 'three';
import { describe, expect, it } from 'vitest';
import { CROSSWALK, ROAD, SIDEWALK, type Rect } from '../core/blockLayout';
import { type EraId } from '../eras/eraSystem';
import {
  StreetPropsLayer,
  getEraPropInventory,
  type GroundRect,
  type LampVariant,
  type PropKind,
  type SideId,
  type TreeMaturity,
} from './streetPropsLayer';

/* ------------------------------------------------------------------ *
 * Shared geometry predicates
 * ------------------------------------------------------------------ */

interface RectLike {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Strict interior overlap: sharing only an edge/corner is not an overlap. */
function overlapsStrict(a: RectLike, b: RectLike): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/** True when `inner` lies inside `outer` (boundary contact allowed). */
function contains(outer: RectLike, inner: RectLike, epsilon = 1e-4): boolean {
  return (
    outer.minX <= inner.minX + epsilon &&
    outer.maxX >= inner.maxX - epsilon &&
    outer.minZ <= inner.minZ + epsilon &&
    outer.maxZ >= inner.maxZ - epsilon
  );
}

const SIDEWALK_BY_SIDE: Readonly<Record<SideId, Rect>> = {
  north: SIDEWALK.north,
  east: SIDEWALK.east,
  south: SIDEWALK.south,
  west: SIDEWALK.west,
};

const ROAD_RECTS: readonly Rect[] = [ROAD.north, ROAD.east, ROAD.south, ROAD.west];

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

/** All eras in slider order. */
const ERAS_TO_TEST: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

/* ------------------------------------------------------------------ *
 * Expected per-era inventories (derived from the task acceptance data)
 * ------------------------------------------------------------------ */

const EXPECTED_COUNTS: Readonly<Record<EraId, Readonly<Record<PropKind, number>>>> = {
  1945: {
    lamp: 10,
    tree: 14,
    hydrant: 8,
    bench: 8,
    trash: 8,
    'parking-meter': 0,
    'newspaper-stand': 4,
    'phone-booth': 0,
    'ev-charger': 0,
  },
  1965: {
    lamp: 10,
    tree: 14,
    hydrant: 8,
    bench: 8,
    trash: 8,
    'parking-meter': 12,
    'newspaper-stand': 4,
    'phone-booth': 4,
    'ev-charger': 0,
  },
  1985: {
    lamp: 10,
    tree: 14,
    hydrant: 8,
    bench: 8,
    trash: 8,
    'parking-meter': 12,
    'newspaper-stand': 4,
    'phone-booth': 4,
    'ev-charger': 0,
  },
  2005: {
    lamp: 10,
    tree: 14,
    hydrant: 8,
    bench: 8,
    trash: 8,
    'parking-meter': 12,
    'newspaper-stand': 0,
    'phone-booth': 0,
    'ev-charger': 0,
  },
  2025: {
    lamp: 10,
    tree: 14,
    hydrant: 8,
    bench: 8,
    trash: 8,
    'parking-meter': 12,
    'newspaper-stand': 0,
    'phone-booth': 0,
    'ev-charger': 8,
  },
};

const EXPECTED_TOTAL: Readonly<Record<EraId, number>> = {
  1945: 52,
  1965: 68,
  1985: 68,
  2005: 60,
  2025: 68,
};

const EXPECTED_LAMP_VARIANT: Readonly<Record<EraId, LampVariant>> = {
  1945: 'incandescent',
  1965: 'mercury',
  1985: 'sodium-vapor',
  2005: 'early-led',
  2025: 'led',
};

const EXPECTED_TREE_MATURITY: Readonly<Record<EraId, TreeMaturity>> = {
  1945: 'mature',
  1965: 'mature',
  1985: 'established',
  2005: 'established',
  2025: 'young',
};

/* ------------------------------------------------------------------ *
 * Built-scene helpers
 * ------------------------------------------------------------------ */

function eraGroup(layer: StreetPropsLayer, eraId: EraId): Group | undefined {
  return layer.root.children.find((child) => child.userData.eraId === eraId) as Group | undefined;
}

function propGroups(layer: StreetPropsLayer, eraId: EraId): Group[] {
  const era = eraGroup(layer, eraId);
  return era ? (era.children as Group[]) : [];
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe('era prop inventories', () => {
  it('exposes the exact acceptance-criteria composition for every era', () => {
    for (const eraId of ERAS_TO_TEST) {
      const inventory = getEraPropInventory(eraId);
      const expected = EXPECTED_COUNTS[eraId];
      for (const kind of Object.keys(expected) as PropKind[]) {
        expect(inventory.counts[kind], `era ${eraId} ${kind}`).toBe(expected[kind]);
      }
    }
  });

  it('maps lamp technology and tree maturity per era', () => {
    for (const eraId of ERAS_TO_TEST) {
      const inventory = getEraPropInventory(eraId);
      // Lamps: incandescent -> mercury -> sodium-vapor -> early LED -> LED.
      expect(inventory.lampVariant, `era ${eraId}`).toBe(EXPECTED_LAMP_VARIANT[eraId]);
      // Trees carry era-appropriate maturity.
      expect(inventory.treeMaturity, `era ${eraId}`).toBe(EXPECTED_TREE_MATURITY[eraId]);
    }
  });

  it('keeps phone booths to 1965/1985 and chargers to 2025 only', () => {
    const phoneBoothEras = ERAS_TO_TEST.filter((eraId) => getEraPropInventory(eraId).counts['phone-booth'] > 0);
    const chargerEras = ERAS_TO_TEST.filter((eraId) => getEraPropInventory(eraId).counts['ev-charger'] > 0);
    const meterEras = ERAS_TO_TEST.filter((eraId) => getEraPropInventory(eraId).counts['parking-meter'] > 0);
    const kioskEras = ERAS_TO_TEST.filter((eraId) => getEraPropInventory(eraId).counts['newspaper-stand'] > 0);

    expect(phoneBoothEras).toEqual([1965, 1985]);
    expect(chargerEras).toEqual([2025]);
    expect(meterEras).toEqual([1965, 1985, 2005, 2025]);
    expect(kioskEras).toEqual([1945, 1965, 1985]);
  });

  it('rejects unknown era ids', () => {
    expect(() => getEraPropInventory(2055 as unknown as EraId)).toThrow(/unknown era/i);
  });
});

describe('street props placement', () => {
  it('builds exactly the expected prop counts on the sidewalk', () => {
    for (const eraId of ERAS_TO_TEST) {
      const layer = new StreetPropsLayer(eraId);
      const props = propGroups(layer, eraId);
      expect(props.length, `era ${eraId} total`).toBe(EXPECTED_TOTAL[eraId]);
      for (const kind of Object.keys(EXPECTED_COUNTS[eraId]) as PropKind[]) {
        const count = props.filter((prop) => prop.userData.kind === kind).length;
        expect(count, `era ${eraId} ${kind}`).toBe(EXPECTED_COUNTS[eraId][kind]);
      }
      layer.dispose();
    }
  });

  it('places every prop on its sidewalk band without touching roads or crosswalks', () => {
    for (const eraId of ERAS_TO_TEST) {
      const layer = new StreetPropsLayer(eraId);
      const props = propGroups(layer, eraId);
      expect(props.length).toBeGreaterThan(0);

      for (const prop of props) {
        const side = prop.userData.side as SideId;
        const band = SIDEWALK_BY_SIDE[side];
        const footprint = prop.userData.footprint as GroundRect;

        // The standing footprint must sit inside exactly that side's band.
        expect(contains(band, footprint), `era ${eraId} ${prop.name} footprint on ${side}`).toBe(true);

        // The footprint must not overlap any road lane or crosswalk.
        for (const road of ROAD_RECTS) {
          expect(overlapsStrict(footprint, road), `era ${eraId} ${prop.name} vs road`).toBe(false);
        }
        for (const crosswalk of CROSSWALK_RECTS) {
          expect(overlapsStrict(footprint, crosswalk), `era ${eraId} ${prop.name} vs crosswalk`).toBe(false);
        }

        // The actual mesh geometry (incl. lamp arms and tree canopies) must
        // also stay inside the sidewalk band and clear of roads/crosswalks.
        const box = new Box3().setFromObject(prop);
        const aabb: GroundRect = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
        expect(contains(band, aabb, 1e-3), `era ${eraId} ${prop.name} AABB on ${side}`).toBe(true);
        for (const road of ROAD_RECTS) {
          expect(overlapsStrict(aabb, road), `era ${eraId} ${prop.name} AABB vs road`).toBe(false);
        }
        for (const crosswalk of CROSSWALK_RECTS) {
          expect(overlapsStrict(aabb, crosswalk), `era ${eraId} ${prop.name} AABB vs crosswalk`).toBe(false);
        }
      }
      layer.dispose();
    }
  });

  it('records kind, era variant and side metadata on every built prop', () => {
    for (const eraId of ERAS_TO_TEST) {
      const layer = new StreetPropsLayer(eraId);
      for (const prop of propGroups(layer, eraId)) {
        expect(prop.userData.kind).toBeDefined();
        expect(prop.userData.side).toBeDefined();
        expect(prop.userData.footprint).toBeDefined();
        if (prop.userData.kind === 'lamp') {
          expect(prop.userData.variant).toBe(EXPECTED_LAMP_VARIANT[eraId]);
        }
        if (prop.userData.kind === 'tree') {
          expect(prop.userData.variant).toBe(EXPECTED_TREE_MATURITY[eraId]);
        }
      }
      layer.dispose();
    }
  });
});

describe('StreetPropsLayer API', () => {
  it('attaches to a host group and shows only the initial era', () => {
    const host = new Group();
    const layer = new StreetPropsLayer(1945);
    layer.attach(host);

    expect(host.children).toContain(layer.root);
    const visible = layer.root.children.filter((group) => group.visible && group.userData.eraId !== undefined);
    expect(visible).toHaveLength(1);
    expect(visible[0].userData.eraId).toBe(1945);
    expect(layer.getState()).toEqual({ activeEra: 1945, pendingEra: null });
  });

  it('applyEra swaps the visible era composition', () => {
    const layer = new StreetPropsLayer(1945);
    layer.applyEra(1965);

    expect(layer.getState().activeEra).toBe(1965);
    const visible = layer.root.children.filter((group) => group.visible && group.userData.eraId !== undefined);
    expect(visible).toHaveLength(1);
    expect(visible[0].userData.eraId).toBe(1965);
    // The previous era is hidden but its props still exist for restoration.
    expect(eraGroup(layer, 1945)?.visible).toBe(false);
    expect(propGroups(layer, 1965).length).toBe(EXPECTED_TOTAL[1965]);
  });

  it('defers the swap while transition progress < 1 and commits at 1', () => {
    const layer = new StreetPropsLayer(1945);

    layer.applyEra(1985, 0.35);
    expect(layer.getState()).toEqual({ activeEra: 1945, pendingEra: 1985 });
    expect(eraGroup(layer, 1945)?.visible).toBe(true);
    expect(eraGroup(layer, 1985)?.visible).toBe(false);

    layer.applyEra(1985, 0.99);
    expect(layer.getState().activeEra).toBe(1945);
    expect(eraGroup(layer, 1985)?.visible).toBe(false);

    layer.applyEra(1985, 1);
    expect(layer.getState()).toEqual({ activeEra: 1985, pendingEra: null });
    expect(eraGroup(layer, 1985)?.visible).toBe(true);
    expect(eraGroup(layer, 1945)?.visible).toBe(false);
  });

  it('restores absent-era props when returning to an earlier era', () => {
    const layer = new StreetPropsLayer(1945);
    layer.applyEra(2025);
    expect(propGroups(layer, 2025).some((prop) => prop.userData.kind === 'ev-charger')).toBe(true);

    layer.applyEra(1965);
    const booths = propGroups(layer, 1965).filter((prop) => prop.userData.kind === 'phone-booth');
    expect(booths).toHaveLength(4);
    expect(propGroups(layer, 1965).some((prop) => prop.userData.kind === 'ev-charger')).toBe(false);
  });

  it('rejects unknown eras and disposed reuse', () => {
    const layer = new StreetPropsLayer();
    expect(() => layer.applyEra(2055 as unknown as EraId)).toThrow(/unknown era/i);
    expect(() => new StreetPropsLayer(2055 as unknown as EraId)).toThrow(/unknown era/i);

    layer.dispose();
    expect(() => layer.applyEra(1945)).toThrow(/disposed/i);
    expect(() => layer.attach(new Group())).toThrow(/disposed/i);
  });

  it('dispose removes the root and releases all scene objects', () => {
    const host = new Group();
    const layer = new StreetPropsLayer();
    layer.attach(host);
    expect(host.children).toContain(layer.root);

    layer.dispose();

    expect(layer.isDisposed).toBe(true);
    expect(host.children).toHaveLength(0);
    expect(layer.root.children).toHaveLength(0);
    expect(layer.root.parent).toBeNull();
    expect(layer.root.userData.layerType).toBe('street-props');
    expect(layer.dispose()).toBeUndefined(); // idempotent
  });
});