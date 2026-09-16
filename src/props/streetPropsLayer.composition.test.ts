/**
 * streetPropsLayer.composition.test.ts — headless SceneRuntime composition.
 *
 * Verifies the layer integrated with the headless runtime: attach through
 * SceneRuntime, an era walk across all five eras that swaps prop variants,
 * per-era observable prop inventories, and full disposal that releases every
 * object. Runs in the default Node environment.
 */
import { describe, expect, it } from 'vitest';
import type { Group } from 'three';
import { SceneRuntime } from '../core/sceneRuntime';
import { type EraId } from '../eras/eraSystem';
import {
  StreetPropsLayer,
  getEraPropInventory,
  type PropKind,
} from './streetPropsLayer';

const ERA_WALK: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];
const ALL_KINDS: readonly PropKind[] = [
  'lamp',
  'tree',
  'hydrant',
  'bench',
  'trash',
  'parking-meter',
  'newspaper-stand',
  'phone-booth',
  'ev-charger',
];

/** The era group currently visible in the layer root (exactly one). */
function visibleEraGroup(root: Group): Group | undefined {
  const visible = root.children.filter((child) => child.visible && child.userData.eraId !== undefined);
  if (visible.length !== 1) return undefined;
  return visible[0] as Group;
}

/** Count of props of one kind in the currently visible era group. */
function countKind(root: Group, kind: PropKind): number {
  const era = visibleEraGroup(root);
  if (!era) return 0;
  return era.children.filter((child) => child.userData.kind === kind).length;
}

/** Era variant metadata (lamp technology / tree maturity) for a kind. */
function variantsOfKind(root: Group, kind: PropKind): string[] {
  const era = visibleEraGroup(root);
  if (!era) return [];
  return era.children
    .filter((child) => child.userData.kind === kind)
    .map((child) => child.userData.variant as string);
}

function sumCounts(inventory: ReturnType<typeof getEraPropInventory>): number {
  return ALL_KINDS.reduce((total, kind) => total + inventory.counts[kind], 0);
}

describe('StreetPropsLayer × SceneRuntime composition', () => {
  it('walks all five eras in the headless runtime, swapping props, then disposes', () => {
    const runtime = new SceneRuntime();
    const layer = new StreetPropsLayer(1945);
    runtime.attachLayer(layer);

    // The layer root is part of the runtime scene graph.
    expect(runtime.scene.children).toContain(layer.root);
    expect(layer.getState().activeEra).toBe(1945);
    expect(visibleEraGroup(layer.root)?.userData.eraId).toBe(1945);

    // Initial 1945 composition: incandescent lamps, mature trees, kiosks,
    // and no parking meters / booths / chargers.
    expect(countKind(layer.root, 'lamp')).toBe(10);
    expect(variantsOfKind(layer.root, 'lamp')).toEqual(Array(10).fill('incandescent'));
    expect(variantsOfKind(layer.root, 'tree')).toEqual(Array(14).fill('mature'));
    expect(countKind(layer.root, 'newspaper-stand')).toBe(4);
    expect(countKind(layer.root, 'parking-meter')).toBe(0);
    expect(countKind(layer.root, 'phone-booth')).toBe(0);
    expect(countKind(layer.root, 'ev-charger')).toBe(0);

    // Walk the remaining eras; each settled swap exchanges the visible props.
    for (const eraId of ERA_WALK.slice(1)) {
      const previous = layer.getState().activeEra;
      layer.applyEra(eraId, 0.3); // mid-tween: swap deferred, old era stays
      expect(visibleEraGroup(layer.root)?.userData.eraId).toBe(previous);
      runtime.step(1 / 60); // exercises the SceneLayer update hook

      layer.applyEra(eraId, 1); // transition settled: props swap
      runtime.step(1 / 60);
      expect(layer.getState().activeEra).toBe(eraId);
      expect(visibleEraGroup(layer.root)?.userData.eraId).toBe(eraId);

      const inventory = getEraPropInventory(eraId);
      expect(visibleEraGroup(layer.root)?.children.length).toBe(sumCounts(inventory));
      for (const kind of ALL_KINDS) {
        expect(countKind(layer.root, kind), `era ${eraId} ${kind}`).toBe(inventory.counts[kind]);
      }
    }

    // 2025 final composition: LED lamps, young trees, meters, chargers; no
    // newspaper stands and no phone booths.
    expect(variantsOfKind(layer.root, 'lamp')).toEqual(Array(10).fill('led'));
    expect(variantsOfKind(layer.root, 'tree')).toEqual(Array(14).fill('young'));
    expect(countKind(layer.root, 'ev-charger')).toBe(8);
    expect(countKind(layer.root, 'newspaper-stand')).toBe(0);
    expect(countKind(layer.root, 'phone-booth')).toBe(0);

    // Returning to an earlier era restores that era's props and hides 2025.
    layer.applyEra(1965);
    expect(variantsOfKind(layer.root, 'lamp')).toEqual(Array(10).fill('mercury'));
    expect(countKind(layer.root, 'phone-booth')).toBe(4);
    expect(countKind(layer.root, 'ev-charger')).toBe(0);
    expect(countKind(layer.root, 'newspaper-stand')).toBe(4);

    layer.applyEra(1945);
    expect(countKind(layer.root, 'parking-meter')).toBe(0);
    expect(countKind(layer.root, 'phone-booth')).toBe(0);

    // Dispose through the runtime: layer released, scene graph emptied.
    runtime.dispose();

    expect(layer.isDisposed).toBe(true);
    expect(layer.root.children).toHaveLength(0);
    expect(layer.root.parent).toBeNull();
    expect(runtime.layerCount).toBe(0);
    expect(runtime.scene.children).toHaveLength(0);
    expect(() => layer.applyEra(1945)).toThrow(/disposed/i);
  });
});