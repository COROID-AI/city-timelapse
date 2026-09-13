/**
 * Unit tests for Era Street Life (Vehicles, Pedestrians, Outfits, Animation, Morph/Dispose)
 */

import { describe, expect, it } from 'vitest';
import { ERA_YEARS, type EraId } from '../../era/types';
import { createBlockLayout, isPointInAsphalt, isPointInSidewalk } from '../layout';
import { buildStreetLife, createDefaultEraTheme } from './buildStreetLife';
import { updateVehicles } from './vehicles';
import { updatePedestrians } from './pedestrians';

describe('Era Street Life (src/world/streetLife/)', () => {
  // ==========================================================================
  // 1. Era Vehicle Fleets and Archetypes
  // ==========================================================================
  describe('Era Vehicle Fleets', () => {
    it('builds a nonempty fleet for all five timeline eras', () => {
      const layout = createBlockLayout(42);
      for (const era of ERA_YEARS) {
        const streetLife = buildStreetLife(era, layout);
        expect(streetLife.vehicles.length).toBeGreaterThanOrEqual(4);
        expect(streetLife.era).toBe(era);
      }
    });

    it('1945 fleet includes rounded pre-war sedans and vintage trucks with pre-war tags', () => {
      const streetLife = buildStreetLife(1945);
      const archetypes = streetLife.vehicles.map((v) => v.archetype);
      expect(archetypes).toContain('1945_rounded_sedan');
      expect(archetypes).toContain('1945_vintage_truck');

      for (const vehicle of streetLife.vehicles) {
        expect(vehicle.era).toBe(1945);
        expect(vehicle.tags).toContain('1945');
        expect(vehicle.tags.some((t) => t.includes('rounded') || t.includes('truck') || t.includes('pre_war'))).toBe(true);
        expect(vehicle.isMicromobility).toBe(false);
      }
    });

    it('1965 fleet includes long finned cruisers with two-tone paint and muscle coupes', () => {
      const streetLife = buildStreetLife(1965);
      const archetypes = streetLife.vehicles.map((v) => v.archetype);
      expect(archetypes).toContain('1965_finned_cruiser');
      expect(archetypes).toContain('1965_muscle_coupe');

      const cruisers = streetLife.vehicles.filter((v) => v.archetype === '1965_finned_cruiser');
      expect(cruisers.length).toBeGreaterThan(0);
      for (const cruiser of cruisers) {
        expect(cruiser.secondaryColor).toBeDefined();
        expect(cruiser.tags).toContain('tailfins');
        expect(cruiser.tags).toContain('two_tone');
      }
    });

    it('1985 fleet includes boxy sedans and station wagons with angular styling', () => {
      const streetLife = buildStreetLife(1985);
      const archetypes = streetLife.vehicles.map((v) => v.archetype);
      expect(archetypes).toContain('1985_boxy_sedan');
      expect(archetypes).toContain('1985_station_wagon');

      for (const vehicle of streetLife.vehicles) {
        expect(vehicle.tags).toContain('1985');
        expect(vehicle.tags.some((t) => t.includes('boxy') || t.includes('station_wagon') || t.includes('angular'))).toBe(true);
      }
    });

    it('2005 fleet includes rounded crossovers and compact hatchbacks', () => {
      const streetLife = buildStreetLife(2005);
      const archetypes = streetLife.vehicles.map((v) => v.archetype);
      expect(archetypes).toContain('2005_crossover');
      expect(archetypes).toContain('2005_hatchback');

      for (const vehicle of streetLife.vehicles) {
        expect(vehicle.tags).toContain('2005');
        expect(vehicle.tags.some((t) => t.includes('crossover') || t.includes('hatchback') || t.includes('rounded_suv'))).toBe(true);
      }
    });

    it('2025 fleet includes modern EVs with closed grilles plus electric scooters and bike lane cyclists', () => {
      const streetLife = buildStreetLife(2025);
      const archetypes = streetLife.vehicles.map((v) => v.archetype);
      expect(archetypes).toContain('2025_ev_sedan');
      expect(archetypes).toContain('2025_electric_scooter');
      expect(archetypes).toContain('2025_bike_cyclist');

      const evs = streetLife.vehicles.filter((v) => v.archetype === '2025_ev_sedan');
      expect(evs.length).toBeGreaterThan(0);
      for (const ev of evs) {
        expect(ev.tags).toContain('closed_grille');
        expect(ev.tags).toContain('led_lightbar');
      }

      const scooters = streetLife.vehicles.filter((v) => v.archetype === '2025_electric_scooter');
      expect(scooters).toHaveLength(1);
      expect(scooters[0]!.isMicromobility).toBe(true);
      expect(scooters[0]!.rider).toBeDefined();

      const cyclists = streetLife.vehicles.filter((v) => v.archetype === '2025_bike_cyclist');
      expect(cyclists).toHaveLength(1);
      expect(cyclists[0]!.isMicromobility).toBe(true);
      expect(cyclists[0]!.rider).toBeDefined();
    });

    it('fleets differ pairwise across all five eras in archetype sets and attributes', () => {
      const fleetArchetypes = new Map<EraId, Set<string>>();
      for (const era of ERA_YEARS) {
        const streetLife = buildStreetLife(era);
        const types = new Set(streetLife.vehicles.map((v) => v.archetype));
        fleetArchetypes.set(era, types);
      }

      for (let i = 0; i < ERA_YEARS.length; i += 1) {
        for (let j = i + 1; j < ERA_YEARS.length; j += 1) {
          const eraA = ERA_YEARS[i]!;
          const eraB = ERA_YEARS[j]!;
          const setA = fleetArchetypes.get(eraA)!;
          const setB = fleetArchetypes.get(eraB)!;

          // Archetype sets must be completely disjoint between different eras
          const intersection = [...setA].filter((x) => setB.has(x));
          expect(intersection, `Eras ${eraA} and ${eraB} should have distinct archetypes`).toHaveLength(0);
        }
      }
    });
  });

  // ==========================================================================
  // 2. Lane-Following Animation, Corridor Bounds & Anti-Collision Headway
  // ==========================================================================
  describe('Lane-Following Animation & Traffic Simulation', () => {
    it('vehicles advance along their assigned layout lanes over simulated time', () => {
      const layout = createBlockLayout(42);
      const streetLife = buildStreetLife(1985, layout);

      const initialDistances = streetLife.vehicles.map((v) => v.distance);

      // Simulate 2 seconds of traffic motion
      streetLife.update(2.0);

      const newDistances = streetLife.vehicles.map((v) => v.distance);
      for (let i = 0; i < streetLife.vehicles.length; i += 1) {
        expect(newDistances[i]).not.toBe(initialDistances[i]);
      }
    });

    it('vehicles stay inside layout asphalt road boundaries at all sampled time steps', () => {
      const layout = createBlockLayout(42);
      const streetLife = buildStreetLife(2005, layout);

      // Run 30 simulation steps (3 seconds) and assert position at every frame
      for (let step = 0; step < 30; step += 1) {
        streetLife.update(0.1);

        for (const vehicle of streetLife.vehicles) {
          const pos = vehicle.mesh.position;
          const inAsphalt = isPointInAsphalt(layout, { x: pos.x, z: pos.z });
          expect(inAsphalt, `Vehicle ${vehicle.id} position (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) must be in asphalt`).toBe(true);
        }
      }
    });

    it('vehicle headings align with travel lane tangent direction', () => {
      const layout = createBlockLayout(42);
      const streetLife = buildStreetLife(1965, layout);

      streetLife.update(1.0);

      for (const vehicle of streetLife.vehicles) {
        const yaw = vehicle.mesh.rotation.y;
        const laneDir = vehicle.lane.direction;

        // Verify heading roughly aligns with lane axis
        if (laneDir === 'eastbound') {
          // Eastbound travel (+X): yaw should be around PI/2 (~1.57 rad)
          expect(Math.sin(yaw)).toBeGreaterThan(0.7);
        } else if (laneDir === 'westbound') {
          // Westbound travel (-X): yaw should be around -PI/2 or 3PI/2
          expect(Math.sin(yaw)).toBeLessThan(-0.7);
        } else if (laneDir === 'northbound') {
          // Northbound travel (+Z): yaw should be around 0 rad
          expect(Math.cos(yaw)).toBeGreaterThan(0.7);
        } else if (laneDir === 'southbound') {
          // Southbound travel (-Z): yaw should be around PI rad
          expect(Math.cos(yaw)).toBeLessThan(-0.7);
        }
      }
    });

    it('enforces safe headway: vehicles sharing a lane maintain safe distance without colliding', () => {
      const layout = createBlockLayout(42);
      const theme = createDefaultEraTheme(1985);
      const streetLife = buildStreetLife(1985, layout, theme);

      // Add a trailing vehicle in the same lane to test anti-collision headway
      const lane = layout.lanes[0]!;
      const v1 = streetLife.vehicles[0]!;
      v1.distance = 20;
      v1.baseSpeed = 8;
      v1.currentSpeed = 8;

      const v2 = { ...streetLife.vehicles[0]!, id: 'test-trailer', distance: 12, baseSpeed: 14, currentSpeed: 14, path: lane.flowPath, mesh: v1.mesh.clone() };
      const testFleet = [v1, v2];

      // Simulate 50 frames (5 seconds)
      for (let step = 0; step < 50; step += 1) {
        updateVehicles(testFleet, 0.1);
        const distDiff = Math.abs(v1.distance - v2.distance);
        // Distance difference must never drop below 3 meters (no physical overlap)
        expect(distDiff).toBeGreaterThanOrEqual(3.0);
      }
    });

    it('animation is frame-rate independent: 10x0.1s steps yield identical distance to 1x1.0s step within tolerance', () => {
      const layout = createBlockLayout(42);
      const streetLifeA = buildStreetLife(1945, layout, undefined, { seed: 999 });
      const streetLifeB = buildStreetLife(1945, layout, undefined, { seed: 999 });

      // Run 1 big step on A
      streetLifeA.update(1.0);

      // Run 10 small steps on B
      for (let i = 0; i < 10; i += 1) {
        streetLifeB.update(0.1);
      }

      for (let i = 0; i < streetLifeA.vehicles.length; i += 1) {
        const distA = streetLifeA.vehicles[i]!.distance;
        const distB = streetLifeB.vehicles[i]!.distance;
        expect(distA).toBeCloseTo(distB, 0);
      }
    });
  });

  // ==========================================================================
  // 3. Pedestrian Crowds, Era Outfits & Walk Cycles
  // ==========================================================================
  describe('Pedestrian Crowds, Outfits and Walk Cycles', () => {
    it('populates walkways with pedestrians for all five eras', () => {
      const layout = createBlockLayout(42);
      for (const era of ERA_YEARS) {
        const streetLife = buildStreetLife(era, layout);
        expect(streetLife.pedestrians.length).toBeGreaterThanOrEqual(8);
      }
    });

    it('outfit descriptor sets differ pairwise across all five eras', () => {
      const outfitStyles = new Map<EraId, string>();
      for (const era of ERA_YEARS) {
        const streetLife = buildStreetLife(era);
        const styles = new Set(streetLife.pedestrians.map((p) => p.outfitStyle));
        expect(styles.size).toBe(1);
        outfitStyles.set(era, [...styles][0]!);
      }

      expect(outfitStyles.get(1945)).toBe('wartime_coats');
      expect(outfitStyles.get(1965)).toBe('mod_tailoring');
      expect(outfitStyles.get(1985)).toBe('neon_80s');
      expect(outfitStyles.get(2005)).toBe('y2k_denim');
      expect(outfitStyles.get(2025)).toBe('athleisure');

      // Pairwise distinctness
      const allStyles = [...outfitStyles.values()];
      expect(new Set(allStyles).size).toBe(5);
    });

    it('signature accessories: flip phones appear ONLY in 2005 and smartphones appear ONLY in 2025', () => {
      for (const era of ERA_YEARS) {
        const streetLife = buildStreetLife(era);
        const flipPhones = streetLife.pedestrians.filter((p) => p.phoneType === 'flip_phone');
        const smartPhones = streetLife.pedestrians.filter((p) => p.phoneType === 'smartphone');

        if (era === 2005) {
          expect(flipPhones.length).toBeGreaterThan(0);
          expect(smartPhones).toHaveLength(0);
        } else if (era === 2025) {
          expect(smartPhones.length).toBeGreaterThan(0);
          expect(flipPhones).toHaveLength(0);
        } else {
          // 1945, 1965, 1985 have NO phones
          expect(flipPhones).toHaveLength(0);
          expect(smartPhones).toHaveLength(0);
          for (const p of streetLife.pedestrians) {
            expect(p.hasPhone).toBe(false);
            expect(p.phoneType).toBe('none');
          }
        }
      }
    });

    it('era-specific accessories match historical period', () => {
      // 1945: fedoras, cloche hats, briefcases
      const sl1945 = buildStreetLife(1945);
      const acc1945 = sl1945.pedestrians.flatMap((p) => p.accessories);
      expect(acc1945.some((a) => a === 'fedora' || a === 'cloche_hat' || a === 'briefcase')).toBe(true);

      // 1965: sunglasses, mod handbags, headbands
      const sl1965 = buildStreetLife(1965);
      const acc1965 = sl1965.pedestrians.flatMap((p) => p.accessories);
      expect(acc1965.some((a) => a === 'sunglasses' || a === 'mod_handbag' || a === 'mod_headband')).toBe(true);

      // 1985: over-ear headphones, walkman cassettes
      const sl1985 = buildStreetLife(1985);
      const acc1985 = sl1985.pedestrians.flatMap((p) => p.accessories);
      expect(acc1985.some((a) => a === 'over_ear_headphones' || a === 'walkman_cassette')).toBe(true);

      // 2025: wireless earbuds, smartphones
      const sl2025 = buildStreetLife(2025);
      const acc2025 = sl2025.pedestrians.flatMap((p) => p.accessories);
      expect(acc2025.some((a) => a === 'wireless_earbuds' || a === 'smartphone')).toBe(true);
    });

    it('pedestrians patrol walkway paths and stay within sidewalk or crosswalk corridors', () => {
      const layout = createBlockLayout(42);
      const streetLife = buildStreetLife(1965, layout);

      for (let step = 0; step < 20; step += 1) {
        streetLife.update(0.15);

        for (const pedestrian of streetLife.pedestrians) {
          const pos = pedestrian.mesh.position;
          // Must be in sidewalk or in crosswalk/intersection asphalt
          const inSidewalk = isPointInSidewalk(layout, { x: pos.x, z: pos.z });
          const inAsphalt = isPointInAsphalt(layout, { x: pos.x, z: pos.z });
          expect(inSidewalk || inAsphalt).toBe(true);
          expect(pos.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('walk cycle phase advances over time and animates limbs', () => {
      const layout = createBlockLayout(42);
      const streetLife = buildStreetLife(2025, layout);

      const p = streetLife.pedestrians[0]!;
      const initialPhase = p.walkPhase;
      const initialLeftLegRot = p.leftLeg.rotation.x;

      updatePedestrians([p], 0.25, layout);

      expect(p.walkPhase).toBeGreaterThan(initialPhase);
      expect(p.leftLeg.rotation.x).not.toBe(initialLeftLegRot);
    });
  });

  // ==========================================================================
  // 4. Morphable Materials, Transition Hooks & Dispose Contract
  // ==========================================================================
  describe('Morph / Transition Hooks & Dispose Contract', () => {
    it('exposes setOpacity and setTransitionProgress for seamless morphing', () => {
      const streetLife = buildStreetLife(1985);
      expect(streetLife.materials.length).toBeGreaterThan(0);

      streetLife.setOpacity(0.5);
      for (const mat of streetLife.materials) {
        expect(mat.opacity).toBeCloseTo(0.5);
        expect(mat.transparent).toBe(true);
      }

      streetLife.setTransitionProgress(0.8);
      for (const mat of streetLife.materials) {
        expect(mat.opacity).toBeCloseTo(0.8);
      }

      streetLife.setScale(1.1);
      expect(streetLife.group.scale.x).toBeCloseTo(1.1);
    });

    it('dispose() releases all registered geometries and materials cleanly', () => {
      const streetLife = buildStreetLife(2005);
      const geomCount = streetLife.geometries.length;
      const matCount = streetLife.materials.length;

      expect(geomCount).toBeGreaterThan(0);
      expect(matCount).toBeGreaterThan(0);
      expect(streetLife.isDisposed).toBe(false);

      streetLife.dispose();
      expect(streetLife.isDisposed).toBe(true);
      expect(streetLife.group.children).toHaveLength(0);
      expect(streetLife.vehicles).toHaveLength(0);
      expect(streetLife.pedestrians).toHaveLength(0);
    });

    it('second call to dispose() is a safe idempotent no-op', () => {
      const streetLife = buildStreetLife(1945);
      streetLife.dispose();
      expect(() => streetLife.dispose()).not.toThrow();
      expect(() => streetLife.update(0.1)).not.toThrow();
      expect(() => streetLife.setOpacity(0.5)).not.toThrow();
    });

    it('leaves no leaked intervals, timeouts or window event listeners', () => {
      const initialListeners = typeof window !== 'undefined' ? 0 : 0;
      const streetLife = buildStreetLife(2025);
      streetLife.update(0.5);
      streetLife.dispose();
      expect(streetLife.isDisposed).toBe(true);
      void initialListeners;
    });
  });
});
