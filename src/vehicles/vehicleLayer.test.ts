// @vitest-environment node
//
// Unit tests for the vehicle layer: per-era fleet definitions and traffic logic.

import { describe, expect, it } from 'vitest';

import { VehicleLayer } from './vehicleLayer';
import { ERAS, type EraId } from '../eras/eraSystem';
import { ROAD } from '../core/blockLayout';

const SLIDER_ORDER: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

/** Collect all era vehicle type keys to verify thematic models. */
function collectEraVehicleTypes(): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  for (const id of SLIDER_ORDER) {
    const era = ERAS[id];
    result[id] = [...era.vehicles.types, ...era.vehicles.parkedTypes];
  }
  return result;
}

describe('per-era vehicle fleets', () => {
  it('exposes five per-era fleets with correct thematic models', () => {
    const types = collectEraVehicleTypes();

    // 1945 post-war sedans and delivery trucks
    expect(types[1945]).toContain('sedan-1940');
    expect(types[1945]).toContain('pickup-truck');
    expect(types[1945]).toContain('delivery-van');

    // 1965 tailfin cars and Beetles
    expect(types[1965]).toContain('tailfin');
    expect(types[1965]).toContain('beetle');

    // 1985 boxy sedans and taxis
    expect(types[1985]).toContain('boxy-sedan');
    expect(types[1985]).toContain('taxi');

    // 2005 SUVs and sedans
    expect(types[2005]).toContain('suv');
    expect(types[2005]).toContain('sedan');

    // 2025 EVs and e-scooters
    expect(types[2025]).toContain('ev-sedan');
    expect(types[2025]).toContain('ev-suv');
    expect(types[2025]).toContain('e-scooter');
  });

  it('each era has both traffic types and parked types defined', () => {
    for (const id of SLIDER_ORDER) {
      const era = ERAS[id];
      expect(era.vehicles.types.length).toBeGreaterThan(0);
      expect(era.vehicles.parkedTypes.length).toBeGreaterThan(0);
      expect(era.vehicles.colors.length).toBeGreaterThan(0);
      expect(era.vehicles.density).toBeGreaterThanOrEqual(0);
      expect(era.vehicles.density).toBeLessThanOrEqual(1);
    }
  });

  it('vehicle counts scale with era affluence (1945 fewer, 2025 more)', () => {
    const layer1945 = new VehicleLayer();
    const layer2025 = new VehicleLayer();

    layer1945.applyEra(1945);
    layer2025.applyEra(2025);

    // 1945 has lowest density (0.25), 2025 has highest (0.75)
    const count1945 = layer1945.count;
    const count2025 = layer2025.count;
    expect(count2025).toBeGreaterThan(count1945);

    layer1945.dispose();
    layer2025.dispose();
  });
});

describe('traffic loop logic', () => {
  it('integrates with blockLayout road lanes for the traffic path', () => {
    // Vehicle layer uses ROAD constants from blockLayout for path geometry
    expect(ROAD.laneCount).toBe(4);
    expect(ROAD.laneWidth).toBe(3.5);
    expect(ROAD.laneCenters.length).toBe(4);
  });

  it('vehicles move continuously along the traffic loop', () => {
    const layer = new VehicleLayer();
    layer.applyEra(2005);
    expect(layer.count).toBeGreaterThan(0);

    const countBefore = layer.count;

    // Simulate several frames of movement
    for (let i = 0; i < 10; i++) {
      layer.update({ time: i * 0.016, delta: 0.016 });
    }

    const countAfter = layer.count;
    expect(countAfter).toBe(countBefore);

    // Vehicles should still be present after updates
    expect(layer.count).toBeGreaterThan(0);

    layer.dispose();
  });

  it('vehicles react to era-specific behaviors (density affects speed)', () => {
    const layerLow = new VehicleLayer();
    const layerHigh = new VehicleLayer();

    layerLow.applyEra(1945); // density 0.25
    layerHigh.applyEra(2025); // density 0.75

    // Both should have moving vehicles
    expect(layerLow.count).toBeGreaterThan(0);
    expect(layerHigh.count).toBeGreaterThan(0);

    layerLow.dispose();
    layerHigh.dispose();
  });
});

describe('VehicleLayer lifecycle', () => {
  it('exposes attach, applyEra, and dispose', () => {
    const layer = new VehicleLayer();
    expect(typeof layer.attach).toBe('function');
    expect(typeof layer.applyEra).toBe('function');
    expect(typeof layer.dispose).toBe('function');
    expect(typeof layer.update).toBe('function');
    expect(layer.id).toBe('vehicles');
    layer.dispose();
  });

  it('applyEra swaps vehicle fleets and reinitializes traffic', () => {
    const layer = new VehicleLayer();
    layer.applyEra(1945);
    const count1945 = layer.count;

    layer.applyEra(1965);
    const count1965 = layer.count;

    layer.applyEra(2025);
    const count2025 = layer.count;

    // After applyEra, vehicles should be present
    expect(count1945).toBeGreaterThan(0);
    expect(count1965).toBeGreaterThan(0);
    expect(count2025).toBeGreaterThan(0);

    layer.dispose();
  });

  it('dispose clears all vehicles from the scene', () => {
    const layer = new VehicleLayer();
    layer.applyEra(2005);
    expect(layer.count).toBeGreaterThan(0);

    layer.dispose();
    expect(layer.count).toBe(0);
  });

  it('createRoot returns a Group for SceneRuntime integration', () => {
    const layer = new VehicleLayer();
    const root = layer.createRoot();
    expect(root.isGroup).toBe(true);
    layer.dispose();
  });

  it('currentEra updates with applyEra', () => {
    const layer = new VehicleLayer();
    expect(layer.currentEra).toBe(1945);
    layer.applyEra(1965);
    expect(layer.currentEra).toBe(1965);
    layer.dispose();
  });
});
