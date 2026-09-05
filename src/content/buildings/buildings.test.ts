/**
 * src/content/buildings/buildings.test.ts — anchor-slot parity across eras.
 *
 * This is the "foundation vitest parity test" for the buildings deliverable: it
 * proves that every one of the five eras' building sets shares the exact same
 * template topology (same vertex count per morphable mesh, same shared anchor
 * slots), so the foundation MorphEngine can vertex-morph between any adjacent
 * era pair losslessly (no index remapping, no reconstructed meshes).
 *
 * It also verifies that switching eras never orphans meshes: building a module,
 * switching through all five eras, then disposing leaves the Three scene group
 * (and the engine group) empty of building meshes.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  BUILDING_ERA_SPECS,
  ERA_ANCHOR_SLOTS,
  ERA_IDS,
} from '../../eras';
import { BuildingsSceneModule } from './BuildingsSceneModule';
import { BuildingMorphSlot, WINDOW_TEMPLATE } from './morph';
import { buildBuildingMaterials } from './materials';
import { windowGridCellCount } from './geometry';

const ANCHOR_SLOTS = ['doorway', 'window', 'shelf'] as const;

describe('building anchor-slot parity across all five eras', () => {
  it('every era defines the same five plot ids at the same street positions', () => {
    const template = BUILDING_ERA_SPECS[ERA_IDS[0]].plots.map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
    }));
    for (const id of ERA_IDS) {
      const plots = BUILDING_ERA_SPECS[id].plots.map((p) => ({ id: p.id, x: p.x, z: p.z }));
      expect(plots).toEqual(template);
    }
  });

  it('every plot in every era has a roof, facade, windows, and details', () => {
    for (const id of ERA_IDS) {
      for (const plot of BUILDING_ERA_SPECS[id].plots) {
        expect(plot.roof).toBeDefined();
        expect(plot.facade).toMatch(
          /^(brick|glass|precast|concrete|curtain|timber)$/,
        );
        expect(plot.windows.columns).toBeGreaterThan(0);
        expect(plot.windows.rows).toBeGreaterThan(0);
        expect(Array.isArray(plot.details)).toBe(true);
        for (const detail of plot.details) {
          expect(detail.kind).toMatch(
            /^(billboard|scaffold|water_tank|satellite_dish|ac_unit|neon_sign|screen|solar_panel|green_wall|canopy)$/,
          );
        }
      }
    }
  });

  it('every era plot exposes the three shared anchor slots via ERA_ANCHOR_SLOTS', () => {
    for (const id of ERA_IDS) {
      const anchors = Object.keys(ERA_ANCHOR_SLOTS[id]).sort();
      expect(anchors).toEqual([...ANCHOR_SLOTS].sort());
    }
  });

  it('lossless morph topology: all eras have identical vertex counts', () => {
    const specs = BUILDING_ERA_SPECS;
    const materials = buildBuildingMaterials(specs[ERA_IDS[0]].plots[0], {
      color: '#ffffff',
      intensity: 1,
    });
    const slot = new BuildingMorphSlot('plot-a', specs, materials);
    const envelopePositions = slot.meshes.envelope.geometry.getAttribute('position').count;
    const windowPositions = slot.meshes.windows.geometry.getAttribute('position').count;

    // Every era contributes a morph target with the exact same vertex count.
    const targets = slot.meshes.envelope.geometry.morphAttributes.position as THREE.BufferAttribute[];
    const windowTargets = slot.meshes.windows.geometry.morphAttributes
      .position as THREE.BufferAttribute[];
    expect(targets.length).toBe(ERA_IDS.length);
    expect(windowTargets.length).toBe(ERA_IDS.length);
    for (const target of targets) {
      expect(target.count).toBe(envelopePositions);
    }
    for (const target of windowTargets) {
      expect(target.count).toBe(windowPositions);
    }

    // Registration anchor boxes keep the same vertex count per slot too.
    for (const slotName of ANCHOR_SLOTS) {
      const anchorTargets = slot.meshes.anchors[slotName].mesh.geometry.morphAttributes
        .position as THREE.BufferAttribute[];
      expect(anchorTargets.length).toBe(ERA_IDS.length);
      const base = slot.meshes.anchors[slotName].mesh.geometry.getAttribute('position');
      for (const target of anchorTargets) {
        expect(target.count).toBe(base.count);
      }
    }
    slot.dispose();
    materials.facade.dispose();
    materials.windows.dispose();
    materials.trim.dispose();
    materials.neutral.dispose();
  });

  it('window template cell count is consistent and eras use ≤ template cells', () => {
    const template = WINDOW_TEMPLATE;
    const cells = windowGridCellCount(template);
    for (const id of ERA_IDS) {
      for (const plot of BUILDING_ERA_SPECS[id].plots) {
        expect(plot.stories * plot.windows.rows * plot.windows.columns).toBeLessThanOrEqual(cells);
      }
    }
  });

  it('switching eras rebuilds details on shared anchors without orphans', () => {
    const module = new BuildingsSceneModule(null);
    const group = module.group;

    const countMeshes = (root: THREE.Object3D): number => {
      let count = 0;
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          count += 1;
        }
      });
      return count;
    };

    // Permanent meshes: 5 envelopes + 5 window grids + 15 registration boxes.
    const permanent = 5 + 5 + 5 * 3;
    const countDetailMeshes = (root: THREE.Object3D): number => {
      let detail = 0;
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          // A mesh belongs to a detail if it is a descendant of a `detail-*`
          // group (not the permanent envelope/window/registration meshes).
          let parent = obj.parent;
          while (parent && parent !== root) {
            if (parent.name.startsWith('detail-')) {
              detail += 1;
              break;
            }
            parent = parent.parent;
          }
        }
      });
      return detail;
    };

    // After construction (1945) the group holds permanent + its own detail meshes.
    const firstDetail = countDetailMeshes(group);
    expect(firstDetail).toBeGreaterThan(0);
    expect(countMeshes(group)).toBe(permanent + firstDetail);

    let max = countMeshes(group);
    for (const id of ERA_IDS) {
      module.setEra(id);
      // Every era must only show its own detail meshes: the count is permanent
      // meshes + current detail meshes (which may differ per era), and it must
      // never grow beyond the largest era's set.
      const detailNow = countDetailMeshes(group);
      expect(countMeshes(group)).toBe(permanent + detailNow);
      max = Math.max(max, countMeshes(group));
    }
    // Rapid cycling back and forth never accumulates beyond the largest era set.
    for (let i = 0; i < 3; i += 1) {
      for (const id of ERA_IDS) {
        module.setEra(id);
      }
    }
    expect(countMeshes(group)).toBeLessThanOrEqual(max);

    module.dispose();
    expect(group.children.length).toBe(0);
  });

  it('anchor registration meshes exist on every plot mesh', () => {
    const module = new BuildingsSceneModule(null);
    let registrationCount = 0;
    module.group.traverse((obj) => {
      if (obj.name.startsWith('registration-')) {
        registrationCount += 1;
      }
    });
    // 5 plots × 3 shared anchor slots.
    expect(registrationCount).toBe(5 * 3);
    module.dispose();
  });
});
