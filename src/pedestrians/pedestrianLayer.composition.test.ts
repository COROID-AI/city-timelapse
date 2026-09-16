/**
 * pedestrianLayer.composition.test.ts — headless composition coverage.
 *
 * Verifies the PedestrianLayer integrates with the headless SceneRuntime:
 * attach registers into the scene graph, an era walk through all five eras
 * swaps outfit sets and walk patterns (driven by the EraSystem transition
 * events), pedestrians animate along routes inside world bounds, and dispose
 * clears the crowd.
 */
import { describe, expect, it } from 'vitest';
import { Group } from 'three';

import { WORLD_BOUNDS } from '../core/blockLayout';
import { SceneRuntime } from '../core/sceneRuntime';
import { ERA_IDS, EraSystem } from '../eras/eraSystem';
import {
  OUTFIT_PRESETS,
  PEDESTRIAN_LAYER_ID,
  PedestrianLayer,
  walkPatternFingerprint,
} from './pedestrianLayer';

/** Advances a system's tween to completion by ticking its clock. */
function driveToSettled(system: EraSystem, stepSeconds = 0.1, maxSteps = 200): void {
  let steps = 0;
  while (system.getState().phase === 'transitioning' && steps < maxSteps) {
    system.update(stepSeconds);
    steps += 1;
  }
}

describe('PedestrianLayer + headless SceneRuntime', () => {
  it('registers into the scene graph through the runtime layer API', () => {
    const runtime = new SceneRuntime();
    const layer = new PedestrianLayer({ era: 1945, seed: 7, count: 10 });
    runtime.attachLayer(layer);

    expect(runtime.layerCount).toBe(1);
    expect(runtime.hasLayer(PEDESTRIAN_LAYER_ID)).toBe(true);
    const root = runtime.scene.children.find((child) => child.name === 'pedestrians-root');
    expect(root).toBeDefined();
    // One actor rig per pedestrian, direct children of the layer root.
    expect(root!.children.length).toBe(10);
    expect(layer.getSnapshot().count).toBe(10);
    expect(layer.activeEra).toBe(1945);

    runtime.dispose();
  });

  it('attach mounts the pedestrian root into an arbitrary group', () => {
    const group = new Group();
    const layer = new PedestrianLayer({ count: 5 });
    layer.attach(group);

    expect(group.children.length).toBe(1);
    expect(group.getObjectByName('pedestrians-root')).toBeDefined();
    expect(group.children[0].children.length).toBe(5);

    layer.dispose();
  });

  it('applies era changes with explicit progress values', () => {
    const layer = new PedestrianLayer({ count: 6 });
    expect(layer.activeEra).toBe(1945);

    layer.applyEra(1965, 0.42);
    expect(layer.activeEra).toBe(1965);
    expect(layer.activeProgress).toBeCloseTo(0.42, 6);
    expect(layer.activeWalkPattern.era).toBe(1965);
    expect(layer.outfits().every((outfit) => outfit.era === 1965)).toBe(true);

    // Re-applying the same era keeps the crowd stable and reprocesses none.
    layer.applyEra(1965, 1);
    expect(layer.activeProgress).toBe(1);
    expect(layer.getSnapshot().count).toBe(6);

    layer.dispose();
  });

  it('walks all five eras and swaps outfits and walk patterns', () => {
    const runtime = new SceneRuntime();
    const layer = new PedestrianLayer({ era: 1945, seed: 11, count: 16, crossingRatio: 0.5 });
    runtime.attachLayer(layer);

    const system = new EraSystem(1945);
    system.subscribe('era-transition', ({ to, progress }) => layer.applyEra(to, progress));

    let previousFingerprint = walkPatternFingerprint(layer.activeWalkPattern);
    let previousStyles = new Set(layer.outfits().map((outfit) => outfit.preset.label));

    for (const eraId of ERA_IDS.slice(1)) {
      system.selectEra(eraId);
      driveToSettled(system);
      expect(system.getState().current).toBe(eraId);
      expect(layer.activeEra).toBe(eraId);

      // Outfit set belongs to the target era and gains new styles.
      const outfits = layer.outfits();
      expect(outfits.every((outfit) => outfit.era === eraId)).toBe(true);
      expect(outfits.every((outfit) => OUTFIT_PRESETS[eraId].includes(outfit.preset))).toBe(true);
      const styles = new Set(outfits.map((outfit) => outfit.preset.label));
      expect([...styles].some((label) => !previousStyles.has(label))).toBe(true);

      // Walk pattern swapped: era, speed, cadence and crossing all update.
      const fingerprint = walkPatternFingerprint(layer.activeWalkPattern);
      expect(fingerprint).not.toBe(previousFingerprint);
      expect(layer.activeWalkPattern.era).toBe(eraId);

      // Crossing routes exist and reference one of the block crosswalks.
      const crossings = layer
        .routes()
        .flatMap((route) => route.segments.filter((segment) => segment.kind === 'crossing'));
      expect(crossings.length).toBeGreaterThan(0);
      expect(crossings.every((segment) => segment.crossingLegId !== undefined)).toBe(true);

      previousStyles = styles;
      previousFingerprint = fingerprint;
    }

    runtime.dispose();
  });

  it('drives pedestrians along routes with animated walk cycles', () => {
    const runtime = new SceneRuntime();
    const layer = new PedestrianLayer({ era: 1965, seed: 3, count: 8, crossingRatio: 0.6 });
    runtime.attachLayer(layer);

    const before = layer.getSnapshot();
    for (let frame = 0; frame < 40; frame += 1) {
      runtime.step(0.1);
    }
    const after = layer.getSnapshot();

    // At least one pedestrian actually moved from its spawn position.
    const moved = after.positions.some((position, i) => {
      const dx = position.x - before.positions[i].x;
      const dz = position.z - before.positions[i].z;
      return Math.hypot(dx, dz) > 0.2;
    });
    expect(moved).toBe(true);

    // The walk cycle animates the limb pivots over time.
    const swingChanged = after.limbSwing.some((swing, i) => {
      return Math.abs(swing - before.limbSwing[i]) > 0.01;
    });
    expect(swingChanged).toBe(true);

    // Everyone stays inside the modeled world footprint.
    for (const position of after.positions) {
      expect(position.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.minX - 1);
      expect(position.x).toBeLessThanOrEqual(WORLD_BOUNDS.maxX + 1);
      expect(position.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.minZ - 1);
      expect(position.z).toBeLessThanOrEqual(WORLD_BOUNDS.maxZ + 1);
    }

    runtime.dispose();
  });

  it('dispose clears pedestrians and releases the scene cleanly', () => {
    const runtime = new SceneRuntime();
    const layer = new PedestrianLayer({ count: 9 });
    runtime.attachLayer(layer);
    expect(layer.pedestrianCount).toBe(9);

    layer.dispose();
    expect(layer.pedestrianCount).toBe(0);
    const root = runtime.scene.children.find((child) => child.name === 'pedestrians-root');
    expect(root!.children.length).toBe(0);

    // update() after dispose is a safe no-op.
    layer.update({ time: 1, delta: 0.1 });
    expect(layer.getSnapshot().count).toBe(0);

    // A later runtime.dispose() traverses the emptied layer without error.
    runtime.dispose();
    expect(runtime.scene.children).toHaveLength(0);
  });
});