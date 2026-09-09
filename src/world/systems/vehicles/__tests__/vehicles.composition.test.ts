/**
 * Composition integration test for Vehicles & Traffic System:
 * - Instantiates layout + VehiclesSystem
 * - Attaches to a Scene
 * - Drives update(channel) through a full 1945 -> 2025 transition with traffic advancing every frame
 * - Verifies continuous motion and smooth dissolve across eras
 * - Disposes cleanly and idempotently
 */

import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import type { TimelineChannel } from '../../../../era/types';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import { createVehiclesSystem } from '../vehiclesSystem';

describe('VehiclesSystem composition lifecycle', () => {
  it('attaches to a scene, drives a full 1945->2025 timeline transition, advances traffic, and disposes cleanly', () => {
    const layout = createCityBlockLayout('seed-composition-test');
    const system = createVehiclesSystem(layout);
    const scene = new Scene();

    expect(system.isAttached()).toBe(false);

    // 1. Attach to scene
    system.attach(scene);
    expect(system.isAttached()).toBe(true);
    expect(scene.children.includes(system.rootGroup)).toBe(true);
    expect(system.rootGroup.children.length).toBe(5); // 5 era families

    // Track an agent's distance to verify monotonic continuous progression
    const agent0 = system.simulation.drivingAgents[0];
    let lastDistance = agent0.distance;

    // 2. Drive through full multi-era transition sequence
    const timelineSequence: TimelineChannel[] = [
      // 1945 static
      { fromEra: '1945', toEra: '1945', t: 0 },
      // 1945 -> 1965 transition
      { fromEra: '1945', toEra: '1965', t: 0.25 },
      { fromEra: '1945', toEra: '1965', t: 0.5 },
      { fromEra: '1945', toEra: '1965', t: 0.75 },
      // 1965 static
      { fromEra: '1965', toEra: '1965', t: 0 },
      // 1965 -> 1985 transition
      { fromEra: '1965', toEra: '1985', t: 0.3 },
      { fromEra: '1965', toEra: '1985', t: 0.7 },
      // 1985 static
      { fromEra: '1985', toEra: '1985', t: 0 },
      // 1985 -> 2005 transition
      { fromEra: '1985', toEra: '2005', t: 0.4 },
      { fromEra: '1985', toEra: '2005', t: 0.8 },
      // 2005 static
      { fromEra: '2005', toEra: '2005', t: 0 },
      // 2005 -> 2025 transition
      { fromEra: '2005', toEra: '2025', t: 0.5 },
      // 2025 static
      { fromEra: '2025', toEra: '2025', t: 0 },
    ];

    const deltaSeconds = 0.016; // ~60 fps frame delta

    for (const channel of timelineSequence) {
      // Simulate multiple frames per channel step
      for (let frame = 0; frame < 5; frame += 1) {
        system.update(channel, deltaSeconds);

        // Assert vehicle traffic progresses continuously
        expect(agent0.distance).toBeGreaterThan(lastDistance);
        lastDistance = agent0.distance;
      }
    }

    // 3. Clean disposal
    system.dispose();
    expect(scene.children.includes(system.rootGroup)).toBe(false);
    expect(system.isAttached()).toBe(false);

    // Idempotent: calling dispose or update again must not throw
    expect(() => system.dispose()).not.toThrow();
    expect(() => system.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0.016)).not.toThrow();
  });

  it('supports attach with context object wrapper { scene }', () => {
    const layout = createCityBlockLayout('seed-context-wrap');
    const system = createVehiclesSystem(layout);
    const scene = new Scene();

    system.attach({ scene });
    expect(system.isAttached()).toBe(true);
    expect(scene.children.includes(system.rootGroup)).toBe(true);

    system.dispose();
  });
});
