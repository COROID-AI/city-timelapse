/**
 * Integrated Composition Test for the Pedestrians System.
 *
 * Verifies:
 * - Instantiation of BlockLayout + PedestriansSystem
 * - Attachment of system to a THREE.Scene / Group
 * - Driving update(channel) through an era transition (1945 -> 1985 -> 2025)
 * - Verifying that 3D rigs are created, positions advance along sidewalks, and rigs transform era outfits
 * - Clean disposal releasing geometries, materials, and scene nodes without leaks
 */

import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import type { TimelineChannel } from '../../../../era/types';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import { createPedestriansSystem } from '../pedestrianSystem';

describe('PedestriansSystem Composition and Lifecycle', () => {
  it('instantiates, attaches to a scene, drives update(channel) through era transition, and disposes cleanly', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout('seed-composition-1');

    const pedestriansSystem = createPedestriansSystem(layout);
    expect(pedestriansSystem).toBeDefined();
    expect(pedestriansSystem.group).toBeDefined();

    // 1. Attach
    pedestriansSystem.attach(scene);
    expect(scene.children).toContain(pedestriansSystem.group);

    // 2. Initial state (1945 static)
    const initialChannel: TimelineChannel = {
      fromEra: '1945',
      toEra: '1945',
      t: 0,
    };

    pedestriansSystem.update(initialChannel, 0.016);

    // Check active rig count in 1945 (density is 6)
    expect(pedestriansSystem.getActiveRigCount()).toBe(6);

    // Check that 3D rigs are positioned on the ground plane (Y=0)
    for (const rig of pedestriansSystem.rigs.values()) {
      if (rig.root.visible) {
        expect(rig.currentEra).toBe('1945');
        expect(Number.isFinite(rig.root.position.x)).toBe(true);
        expect(Number.isFinite(rig.root.position.z)).toBe(true);
        expect(rig.root.position.y).toBe(0);
      }
    }

    // 3. Drive update across transition to 1985
    const simSteps = 60; // 60 frames (~1 sec of simulation)
    const prevPositions = Array.from(pedestriansSystem.rigs.values())
      .filter((r) => r.root.visible)
      .map((r) => ({ x: r.root.position.x, z: r.root.position.z }));

    for (let frame = 1; frame <= simSteps; frame += 1) {
      const t = frame / simSteps;
      const transitionChannel: TimelineChannel = {
        fromEra: '1945',
        toEra: '1985',
        t,
      };
      pedestriansSystem.update(transitionChannel, 0.016);
    }

    // After transitioning to 1985 (t=1.0), density should increase to 10
    expect(pedestriansSystem.getActiveRigCount()).toBe(10);

    // Outfits should now be reclothed to 1985
    for (const rig of pedestriansSystem.rigs.values()) {
      if (rig.root.visible) {
        expect(rig.currentEra).toBe('1985');
      }
    }

    // Agents should have moved along the sidewalk
    const currPositions = Array.from(pedestriansSystem.rigs.values())
      .filter((r) => r.root.visible)
      .map((r) => ({ x: r.root.position.x, z: r.root.position.z }));

    let movedCount = 0;
    for (let i = 0; i < Math.min(prevPositions.length, currPositions.length); i += 1) {
      const dist = Math.hypot(
        currPositions[i].x - prevPositions[i].x,
        currPositions[i].z - prevPositions[i].z,
      );
      if (dist > 0.01) {
        movedCount += 1;
      }
    }
    expect(movedCount).toBeGreaterThan(0);

    // 4. Drive further transition to 2025
    for (let frame = 1; frame <= simSteps; frame += 1) {
      const t = frame / simSteps;
      const transitionChannel: TimelineChannel = {
        fromEra: '1985',
        toEra: '2025',
        t,
      };
      pedestriansSystem.update(transitionChannel, 0.016);
    }

    // 2025 density is 12
    expect(pedestriansSystem.getActiveRigCount()).toBe(12);
    for (const rig of pedestriansSystem.rigs.values()) {
      if (rig.root.visible) {
        expect(rig.currentEra).toBe('2025');
      }
    }

    // 5. Clean teardown and dispose
    pedestriansSystem.dispose();

    expect(scene.children).not.toContain(pedestriansSystem.group);
    expect(pedestriansSystem.rigs.size).toBe(0);
    expect(pedestriansSystem.getActiveRigCount()).toBe(0);

    // Idempotent dispose check
    expect(() => pedestriansSystem.dispose()).not.toThrow();
  });
});
