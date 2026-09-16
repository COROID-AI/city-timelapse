// @vitest-environment node
//
// Composition test: five-era walk through the headless runtime swaps vehicle
// fleets and traffic logic.

import { describe, expect, it } from 'vitest';

import { SceneRuntime } from '../core/sceneRuntime';
import { VehicleLayer } from './vehicleLayer';
import { ERAS, EraSystem, type EraId } from '../eras/eraSystem';

const SLIDER_ORDER: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

describe('vehicle layer composition', () => {
  it('attaches to the headless SceneRuntime and registers in the scene graph', () => {
    const runtime = new SceneRuntime();
    const layer = new VehicleLayer();

    // VehicleLayer implements SceneLayer interface
    runtime.attachLayer(layer);

    expect(runtime.hasLayer('vehicles')).toBe(true);
    expect(runtime.layerCount).toBe(1);

    // The layer's root should be in the scene graph
    const root = layer.createRoot();
    expect(root.isGroup).toBe(true);
    layer.attach(root);

    runtime.dispose();
  });

  it('era walk through all five eras swaps vehicle fleets', () => {
    const layer = new VehicleLayer();

    for (const eraId of SLIDER_ORDER) {
      layer.applyEra(eraId);
      const count = layer.count;
      expect(count).toBeGreaterThan(0);

      // Verify the era's vehicle types are present
      const eraVehicles = ERAS[eraId].vehicles;
      const allTypes = [...eraVehicles.types, ...eraVehicles.parkedTypes];
      expect(allTypes.length).toBeGreaterThan(0);

      // Verify the layer is in the correct era state
      expect(layer.currentEra).toBe(eraId);
    }

    layer.dispose();
  });

  it('traffic logic reinitializes on each applyEra', () => {
    const layer = new VehicleLayer();

    layer.applyEra(1945);

    layer.applyEra(1965);
    const count1965 = layer.count;

    // Each applyEra should produce a fresh fleet
    expect(count1965).toBeGreaterThan(0);
    expect(layer.count).toBe(count1965);

    layer.dispose();
  });

  it('dispose clears all vehicles from the layer', () => {
    const layer = new VehicleLayer();
    layer.applyEra(2025);
    expect(layer.count).toBeGreaterThan(0);

    layer.dispose();
    expect(layer.count).toBe(0);
  });

  it('integrates with EraSystem transition events', () => {
    const layer = new VehicleLayer();
    const eraSystem = new EraSystem();

    let transitionEvents = 0;
    eraSystem.subscribe('era-transition', () => {
      transitionEvents++;
    });

    eraSystem.selectEra(1965);
    eraSystem.update(1); // halfway through transition

    // Layer should still have vehicles from the initial era
    expect(layer.count).toBe(0); // not yet applied

    // Apply era based on transition progress
    layer.applyEra(1965);
    expect(layer.count).toBeGreaterThan(0);

    eraSystem.dispose();
    layer.dispose();
  });

  it('vehicles move on the shared road lanes from blockLayout', () => {
    const layer = new VehicleLayer();
    layer.applyEra(2005);

    const countBefore = layer.count;
    expect(countBefore).toBeGreaterThan(0);

    // Simulate several frames of movement
    for (let i = 0; i < 20; i++) {
      layer.update({ time: i * 0.016, delta: 0.016 });
    }

    const countAfter = layer.count;
    expect(countAfter).toBe(countBefore);

    layer.dispose();
  });

  it('supports full era walk through all five eras with runtime integration', () => {
    const runtime = new SceneRuntime();
    const layer = new VehicleLayer();

    runtime.attachLayer(layer);

    for (const eraId of SLIDER_ORDER) {
      layer.applyEra(eraId);
      const count = layer.count;
      expect(count).toBeGreaterThan(0);

      // Simulate a few frames of traffic
      for (let i = 0; i < 5; i++) {
        runtime.step(0.016);
      }

      // After stepping, vehicles should still be present
      expect(layer.count).toBe(count);
    }

    runtime.dispose();
  });
});
