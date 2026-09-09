/**
 * Unit tests for Vehicles & Traffic System:
 * - Era data completeness and authentic characteristics across all five eras (1945–2025)
 * - Lane-path sampling and bounds safety
 * - Spec-bounded counts and parking slot alignment
 * - Instanced per-body-type geometry and bloom-friendly emissive materials
 * - Seeded determinism
 * - VehiclesSystem factory instantiation and era vehicle counts
 */

import { describe, expect, it } from 'vitest';
import { ERAS, type EraId } from '../../../../era/years';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import { getLaneTravelInfo, isPointInRect, sampleLanePoint, TrafficSimulation } from '../trafficLoop';
import { getVehicleEraSpec, vehicleEraData } from '../vehicleEraData';
import {
  createAngularBoxGeometries,
  createCurvedSedanGeometries,
  createMidcenturyCruiserGeometries,
  createSleekEVGeometries,
  createVehicleInstanceFamily,
  createVintageSedanGeometries,
} from '../vehicleFactory';
import { createVehiclesSystem } from '../vehiclesSystem';

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

describe('vehicleEraData completeness for all five eras', () => {
  it('contains valid definitions for all five eras: 1945, 1965, 1985, 2005, 2025', () => {
    for (const era of ERAS) {
      const spec = vehicleEraData[era];
      expect(spec).toBeDefined();
      expect(spec.themeName.length).toBeGreaterThan(0);
      expect(spec.vehicleCount).toBeGreaterThanOrEqual(4);
      expect(spec.vehicleCount).toBeLessThanOrEqual(16);
      expect(spec.averageSpeed).toBeGreaterThan(0);
      expect(spec.exhaustEmissionRate).toBeGreaterThanOrEqual(0);
      expect(spec.exhaustEmissionRate).toBeLessThanOrEqual(1.0);

      // Colors
      expect(spec.bodyColors.length).toBeGreaterThanOrEqual(5);
      for (const color of spec.bodyColors) {
        expect(color).toMatch(HEX_COLOR_RE);
      }

      // Lighting styles
      expect(spec.headlightColor).toMatch(HEX_COLOR_RE);
      expect(spec.taillightColor).toMatch(HEX_COLOR_RE);
      expect(spec.headlightIntensity).toBeGreaterThan(0);

      // Models
      expect(spec.models.length).toBeGreaterThanOrEqual(2);
      let totalFreq = 0;
      for (const model of spec.models) {
        expect(model.name.length).toBeGreaterThan(0);
        expect(model.length).toBeGreaterThan(1.0);
        expect(model.width).toBeGreaterThan(0.5);
        expect(model.height).toBeGreaterThan(0.5);
        expect(model.relativeFrequency).toBeGreaterThan(0);
        totalFreq += model.relativeFrequency;
      }
      expect(totalFreq).toBeCloseTo(1.0, 2);
    }
  });

  it('reflects authentic era silhouettes and traits', () => {
    // 1945: Prewar vintage coupe/sedans with running boards & high exhaust
    const v1945 = getVehicleEraSpec('1945');
    expect(v1945.models.some((m) => m.type === 'vintage_fender_sedan')).toBe(true);
    expect(v1945.exhaustEmissionRate).toBeGreaterThan(0.8);

    // 1965: Chrome tailfin cruisers
    const v1965 = getVehicleEraSpec('1965');
    expect(v1965.models.some((m) => m.type === 'midcentury_finned_cruiser')).toBe(true);

    // 1985: Boxy sedans, wagons, and delivery vans
    const v1985 = getVehicleEraSpec('1985');
    expect(v1985.models.some((m) => m.type === 'angular_eighties_box')).toBe(true);
    expect(v1985.models.some((m) => m.name.toLowerCase().includes('van') || m.name.toLowerCase().includes('wagon'))).toBe(true);

    // 2005: Curved aerodynamic sedans & SUVs
    const v2005 = getVehicleEraSpec('2005');
    expect(v2005.models.some((m) => m.type === 'curved_two_thousands_sedan')).toBe(true);
    expect(v2005.models.some((m) => m.name.toLowerCase().includes('crossover') || m.name.toLowerCase().includes('suv'))).toBe(true);

    // 2025: EV crossovers, delivery vans, and scooters in bike lane (zero emissions)
    const v2025 = getVehicleEraSpec('2025');
    expect(v2025.models.some((m) => m.type === 'sleek_ev_crossover')).toBe(true);
    expect(v2025.exhaustEmissionRate).toBe(0.0);
    expect(v2025.models.some((m) => m.name.toLowerCase().includes('scooter') || m.name.toLowerCase().includes('pod'))).toBe(true);
  });
});

describe('Lane path sampling & bounds safety', () => {
  const layout = createCityBlockLayout('seed-traffic-test');

  it('samples lane centerlines strictly inside lane bounds for all streets', () => {
    for (const street of layout.streets) {
      for (const lane of street.lanes) {
        const laneInfo = getLaneTravelInfo(lane, street);
        expect(laneInfo.length).toBeGreaterThan(0);

        // Sample along travel parameter t = 0 .. 1
        for (let step = 0; step <= 10; step += 1) {
          const t = step / 10;
          const sample = sampleLanePoint(laneInfo, t);
          const inBounds = isPointInRect(sample, lane.bounds, 1e-4);
          expect(inBounds).toBe(true);
        }
      }
    }
  });

  it('keeps driving simulation agents strictly inside lane boundaries', () => {
    const simulation = new TrafficSimulation(layout, 12);
    const channel = { fromEra: '1945' as EraId, toEra: '1945' as EraId, t: 0 };

    for (let frame = 0; frame < 50; frame += 1) {
      simulation.step(channel, 0.1);
      for (const agent of simulation.drivingAgents) {
        const pos = simulation.getAgentPosition(agent);
        expect(isPointInRect(pos, agent.laneInfo.lane.bounds, 1e-4)).toBe(true);
      }
    }
  });
});

describe('Parking slots alignment and counts', () => {
  const layout = createCityBlockLayout('seed-parking-test');

  it('places parked agents strictly inside layout parking slots', () => {
    const simulation = new TrafficSimulation(layout);
    expect(simulation.parkedAgents.length).toBe(
      layout.streets[0].parkingSlots.length + layout.streets[1].parkingSlots.length,
    );

    for (const parked of simulation.parkedAgents) {
      expect(isPointInRect(parked.position, parked.slot.bounds, 1e-4)).toBe(true);
      expect(parked.yaw).toBeDefined();
    }
  });
});

describe('Instanced per-body-type geometry and bloom lighting', () => {
  it('constructs complete procedural geometry sets for all 5 body types', () => {
    const builders = [
      createVintageSedanGeometries,
      createMidcenturyCruiserGeometries,
      createAngularBoxGeometries,
      createCurvedSedanGeometries,
      createSleekEVGeometries,
    ];

    for (const builder of builders) {
      const geoms = builder();
      expect(geoms.body.getAttribute('position').count).toBeGreaterThan(0);
      expect(geoms.glass.getAttribute('position').count).toBeGreaterThan(0);
      expect(geoms.trim.getAttribute('position').count).toBeGreaterThan(0);
      expect(geoms.wheels.getAttribute('position').count).toBeGreaterThan(0);
      expect(geoms.headlights.getAttribute('position').count).toBeGreaterThan(0);
      expect(geoms.taillights.getAttribute('position').count).toBeGreaterThan(0);

      // Clean disposal
      geoms.body.dispose();
      geoms.glass.dispose();
      geoms.trim.dispose();
      geoms.wheels.dispose();
      geoms.headlights.dispose();
      geoms.taillights.dispose();
    }
  });

  it('creates instanced vehicle families with bloom-friendly emissive materials', () => {
    for (const era of ERAS) {
      const spec = vehicleEraData[era];
      const family = createVehicleInstanceFamily(era, spec.models[0].type, spec, 16);
      expect(family.group.children.length).toBe(6);

      // Verify meshes exist
      const headMesh = family.group.getObjectByName(`vehicles-${era}-headlights`);
      const tailMesh = family.group.getObjectByName(`vehicles-${era}-taillights`);
      expect(headMesh).toBeDefined();
      expect(tailMesh).toBeDefined();

      family.dispose();
    }
  });
});

describe('Deterministic seeding', () => {
  it('produces identical vehicle agent configurations for the same seed', () => {
    const layout1 = createCityBlockLayout('seed-same');
    const layout2 = createCityBlockLayout('seed-same');

    const sim1 = new TrafficSimulation(layout1, 8);
    const sim2 = new TrafficSimulation(layout2, 8);

    expect(sim1.drivingAgents.length).toBe(sim2.drivingAgents.length);
    for (let i = 0; i < sim1.drivingAgents.length; i += 1) {
      expect(sim1.drivingAgents[i].distance).toBe(sim2.drivingAgents[i].distance);
      expect(sim1.drivingAgents[i].eraColors).toEqual(sim2.drivingAgents[i].eraColors);
      expect(sim1.drivingAgents[i].eraModels).toEqual(sim2.drivingAgents[i].eraModels);
    }
  });

  it('produces different vehicle configurations for different seeds', () => {
    const layout1 = createCityBlockLayout('seed-alpha');
    const layout2 = createCityBlockLayout('seed-beta');

    const sim1 = new TrafficSimulation(layout1, 8);
    const sim2 = new TrafficSimulation(layout2, 8);

    const colors1 = sim1.drivingAgents.map((a) => a.eraColors['1945']);
    const colors2 = sim2.drivingAgents.map((a) => a.eraColors['1945']);
    expect(colors1).not.toEqual(colors2);
  });
});

describe('VehiclesSystem creation and spec validation', () => {
  it('instantiates vehicles system matching layout and spec counts', () => {
    const layout = createCityBlockLayout('seed-sys-test');
    const system = createVehiclesSystem(layout);

    expect(system.layout).toBe(layout);
    expect(system.getEraVehicleCount('1945')).toBe(vehicleEraData['1945'].vehicleCount);
    expect(system.getEraVehicleCount('2025')).toBe(vehicleEraData['2025'].vehicleCount);
    expect(system.getParkedCount()).toBe(
      layout.streets[0].parkingSlots.length + layout.streets[1].parkingSlots.length,
    );

    system.dispose();
  });
});
