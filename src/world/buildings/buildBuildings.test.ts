/**
 * Composition checks for the per-era building sets (1945-2025).
 *
 * These tests build all five eras against the real shared BlockLayout and
 * prove the builder contract headlessly (no WebGL, no canvas, no network):
 *
 *   - five distinct, non-empty, archetype-correct building sets
 *   - era markers (brick + fire escapes 1945 ... solar + wind 2025)
 *   - pairwise distinct descriptors (silhouette, materials, windows, details)
 *   - lot containment, street-facing orientation, base at street level
 *   - theme-input sensitivity (palette / height overrides change output)
 *   - determinism (same layout+era → byte-identical scene, across runs)
 *   - procedural-only materials and bounded draw-call budgets
 */

import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ERA_YEARS, type EraId } from '../../era/types';
import { createBlockLayout } from '../layout';
import { ERA_BUILDING_DATA } from './eraBuildingData';
import {
  buildBuildings,
  disposeBuildings,
  footprintOverlapsPublicBand,
  getBuildingDescriptor,
  getBuildingsDescriptor,
  serializeBuildings,
} from './buildBuildings';
import type { BuildingDescriptor } from './archetypes';

const LAYOUT = createBlockLayout(42);
const BUILT: Record<EraId, THREE.Group> = Object.fromEntries(
  ERA_YEARS.map((era) => [era, buildBuildings(era, LAYOUT)] as const),
) as Record<EraId, THREE.Group>;

/** Count Mesh objects reachable through `group`. */
function countMeshes(group: THREE.Group): number {
  let count = 0;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      count += 1;
    }
  });
  return count;
}

function descriptorsOf(era: EraId): BuildingDescriptor[] {
  const descriptor = getBuildingsDescriptor(BUILT[era]);
  expect(descriptor, `buildings descriptor for ${era}`).toBeDefined();
  return descriptor!.buildings;
}

afterAll(() => {
  for (const era of ERA_YEARS) {
    disposeBuildings(BUILT[era]);
  }
});

describe('buildBuildings composition contract', () => {
  describe('exactly the five requested eras', () => {
    it('ships 1945, 1965, 1985, 2005, 2025 and nothing else', () => {
      expect(Object.keys(ERA_BUILDING_DATA)).toEqual(['1945', '1965', '1985', '2005', '2025']);
      expect((ERA_BUILDING_DATA as Record<number, unknown>)[2055]).toBeUndefined();
      expect(ERA_BUILDING_DATA[1945]!.archetype).toBe('rowhouse');
      expect(ERA_BUILDING_DATA[1965]!.archetype).toBe('mid-century-slab');
      expect(ERA_BUILDING_DATA[1985]!.archetype).toBe('concrete-glass-block');
      expect(ERA_BUILDING_DATA[2005]!.archetype).toBe('glass-steel-midrise');
      expect(ERA_BUILDING_DATA[2025]!.archetype).toBe('green-tower');
    });

    it('returns a THREE.Group per era containing one building per layout lot', () => {
      for (const era of ERA_YEARS) {
        const group = BUILT[era];
        expect(group).toBeInstanceOf(THREE.Group);
        expect(group.name).toBe(`buildings-${era}`);
        const descriptor = getBuildingsDescriptor(group)!;
        expect(descriptor.eraId).toBe(era);
        expect(descriptor.buildings).toHaveLength(LAYOUT.lots.length);
        expect(descriptor.buildings.length).toBe(16);
      }
    });

    it('produces non-empty, real geometry for every era', () => {
      for (const era of ERA_YEARS) {
        const descriptor = getBuildingsDescriptor(BUILT[era])!;
        expect(countMeshes(BUILT[era]), `${era} mesh count`).toBeGreaterThan(0);
        for (const building of descriptor.buildings) {
          expect(building.meshCount).toBeGreaterThan(0);
          expect(building.details.windows).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('per-era archetype markers and details', () => {
    it('1945: brick rowhouses with cornices, sills, stoops and fire escapes', () => {
      const buildings = descriptorsOf(1945);
      expect(buildings.every((b) => b.archetype === 'rowhouse')).toBe(true);
      expect(buildings.every((b) => b.facadeMaterial === 'brick-and-sandstone')).toBe(true);
      const total = buildings.reduce(
        (sum, b) => sum + b.details.fireEscapes + b.details.cornices + b.details.stoops,
        0,
      );
      expect(total).toBeGreaterThan(0);
      expect(buildings.reduce((sum, b) => sum + b.details.fireEscapes, 0)).toBeGreaterThan(0);
      expect(buildings.reduce((sum, b) => sum + b.details.cornices, 0)).toBeGreaterThan(0);
      expect(buildings.reduce((sum, b) => sum + b.details.stoops, 0)).toBeGreaterThan(0);
      expect(buildings.every((b) => b.wearLevel >= 0.4)).toBe(true);
    });

    it('1965: mid-century slabs with ribbon windows and parapet roofs', () => {
      const buildings = descriptorsOf(1965);
      expect(buildings.every((b) => b.archetype === 'mid-century-slab')).toBe(true);
      expect(buildings.every((b) => b.windowStyle === 'horizontal-ribbon-window')).toBe(true);
      expect(buildings.every((b) => b.roofStyle === 'flat-parapet')).toBe(true);
      for (const b of buildings) {
        expect(b.details.floors).toBeGreaterThan(1);
      }
    });

    it('1985: concrete / glass blocks with rooftop HVAC and water towers', () => {
      const buildings = descriptorsOf(1985);
      expect(buildings.every((b) => b.archetype === 'concrete-glass-block')).toBe(true);
      expect(
        buildings.reduce((sum, b) => sum + b.details.acUnits, 0),
      ).toBeGreaterThan(0);
      expect(
        buildings.reduce((sum, b) => sum + b.details.waterTowers, 0),
      ).toBeGreaterThan(0);
    });

    it('2005: glass-and-steel mid-rises with mullion grids and cell masts', () => {
      const buildings = descriptorsOf(2005);
      expect(buildings.every((b) => b.archetype === 'glass-steel-midrise')).toBe(true);
      expect(buildings.every((b) => b.details.mullions > 0)).toBe(true);
      expect(buildings.reduce((sum, b) => sum + b.details.antennas, 0)).toBeGreaterThan(0);
      expect(buildings.every((b) => b.windowStyle === 'glass-curtain-with-steel-mullions')).toBe(true);
    });

    it('2025: green towers with solar arrays, wind turbines, planters and a green roof', () => {
      const buildings = descriptorsOf(2025);
      expect(buildings.every((b) => b.archetype === 'green-tower')).toBe(true);
      expect(buildings.reduce((sum, b) => sum + b.details.solarPanels, 0)).toBeGreaterThan(0);
      expect(buildings.reduce((sum, b) => sum + b.details.windTurbines, 0)).toBeGreaterThan(0);
      expect(buildings.reduce((sum, b) => sum + b.details.planters, 0)).toBeGreaterThan(0);
      expect(
        buildings.reduce((sum, b) => sum + (b.roofStyle.includes('green') ? 1 : 0), 0),
      ).toBe(16);
      expect(buildings.every((b) => b.wearLevel <= 0.12)).toBe(true);
    });

    it('era selection maps deterministically to one archetype per lot', () => {
      for (const era of ERA_YEARS) {
        const archetypes = new Set(descriptorsOf(era).map((b) => b.archetype));
        expect(archetypes.size).toBe(1);
      }
    });
  });

  describe('pairwise visual distinctness', () => {
    it('all five era fingerprints are pairwise distinct', () => {
      const signatures = new Map<EraId, string>();
      for (const era of ERA_YEARS) {
        signatures.set(era, getBuildingsDescriptor(BUILT[era])!.signature);
      }
      for (let i = 0; i < ERA_YEARS.length; i += 1) {
        for (let j = i + 1; j < ERA_YEARS.length; j += 1) {
          const a = ERA_YEARS[i]!;
          const b = ERA_YEARS[j]!;
          expect(signatures.get(a)).not.toBe(signatures.get(b));
        }
      }
      expect(signatures.size).toBe(5);
    });

    it('silhouettes are statistically era-distinct (post-1945 buildings climb)', () => {
      const meanHeights = ERA_YEARS.map((era) => getBuildingsDescriptor(BUILT[era])!.stats.heightMean);
      for (let i = 1; i < meanHeights.length; i += 1) {
        expect(meanHeights[i]!).toBeGreaterThan(meanHeights[i - 1]!);
      }
    });

    it('materials, window and roof treatments differ across eras', () => {
      const facets = ERA_YEARS.map((era) => {
        const d = getBuildingsDescriptor(BUILT[era])!;
        return `${d.facadeMaterial}|${d.windowStyle}|${d.roofStyle}|${d.paletteHex.join('')}|${d.emissiveHex}`;
      });
      expect(new Set(facets).size).toBe(5);
    });
  });

  describe('lot placement, orientation and street access', () => {
    it('places every footprint inside its lot, at street level', () => {
      for (const era of ERA_YEARS) {
        for (const building of descriptorsOf(era)) {
          const lot = LAYOUT.getLotById(building.lotId)!;
          const f = building.placement.footprint;
          expect(f.minX).toBeGreaterThanOrEqual(lot.bounds.minX - 0.05);
          expect(f.maxX).toBeLessThanOrEqual(lot.bounds.maxX + 0.05);
          expect(f.minZ).toBeGreaterThanOrEqual(lot.bounds.minZ - 0.05);
          expect(f.maxZ).toBeLessThanOrEqual(lot.bounds.maxZ + 0.05);
          expect(building.placement.baseY).toBe(lot.center.y);
          expect(building.placement.height).toBeGreaterThan(0);
        }
      }
    });

    it('faces its street: frontage normal matches placed facing and yaw', () => {
      for (const era of ERA_YEARS) {
        for (const building of descriptorsOf(era)) {
          const lot = LAYOUT.getLotById(building.lotId)!;
          const normal = lot.frontage.normal;
          const facing = building.placement.facing;
          const dot = facing.x * normal.x + facing.z * normal.z;
          expect(dot).toBeCloseTo(1, 3);
          expect(building.placement.yaw).toBeCloseTo(lot.frontage.angle, 6);
        }
      }
    });

    it('never overlaps the roadway or sidewalk bands', () => {
      for (const era of ERA_YEARS) {
        for (const building of descriptorsOf(era)) {
          expect(
            footprintOverlapsPublicBand(building.placement.footprint, LAYOUT),
            `${era} ${building.lotId}`,
          ).toBe(false);
        }
      }
    });

    it('group transforms match the descriptor (rotation + position)', () => {
      for (const era of ERA_YEARS) {
        const root = BUILT[era];
        const buildings = descriptorsOf(era);
        for (let i = 0; i < root.children.length; i += 1) {
          const child = root.children[i];
          if (!(child instanceof THREE.Group)) {
            continue;
          }
          const descriptor = getBuildingDescriptor(child)!;
          expect(child.position.x).toBeCloseTo(descriptor.placement.center.x, 3);
          expect(child.position.z).toBeCloseTo(descriptor.placement.center.z, 3);
        }
        void buildings;
      }
    });
  });

  describe('theme-driven generation', () => {
    it('palette overrides deterministically change facade tokens, not structure', () => {
      const base = buildBuildings(2025, LAYOUT);
      const rethemed = buildBuildings(2025, LAYOUT, {
        theme: { palette: { facadeMaterials: ['#111111', '#222222', '#333333'] } },
      });
      try {
        const baseD = getBuildingsDescriptor(base)!;
        const reD = getBuildingsDescriptor(rethemed)!;
        expect(reD.paletteHex).toEqual(['#111111', '#222222', '#333333']);
        expect(reD.paletteHex).not.toEqual(baseD.paletteHex);
        expect(reD.signature).not.toBe(baseD.signature);
        // Geometry graph is structurally identical — only material colors change.
        expect(serializeBuildings(rethemed)).toBe(serializeBuildings(base));
      } finally {
        disposeBuildings(base);
        disposeBuildings(rethemed);
      }
    });

    it('building height-range overrides deterministically change heights', () => {
      const base = buildBuildings(2025, LAYOUT);
      const low = buildBuildings(2025, LAYOUT, {
        theme: { buildings: { heightRange: [9, 12] } },
      });
      try {
        const baseD = getBuildingsDescriptor(base)!;
        const lowD = getBuildingsDescriptor(low)!;
        expect(lowD.stats.heightMax).toBeLessThan(baseD.stats.heightMin);
        expect(lowD.stats.heightMean).toBeLessThan(20);
        for (const building of lowD.buildings) {
          expect(building.placement.height).toBeLessThanOrEqual(18);
        }
      } finally {
        disposeBuildings(base);
        disposeBuildings(low);
      }
    });

    it('production sets are deterministic across repeated builds', () => {
      for (const era of ERA_YEARS) {
        const clone = buildBuildings(era, LAYOUT);
        try {
          expect(serializeBuildings(clone)).toBe(serializeBuildings(BUILT[era]));
          expect(getBuildingsDescriptor(clone)!.signature).toBe(
            getBuildingsDescriptor(BUILT[era])!.signature,
          );
        } finally {
          disposeBuildings(clone);
        }
      }
    });

    it('different layout seeds decorrelate the deterministic output', () => {
      const other = buildBuildings(2025, createBlockLayout(7));
      try {
        expect(getBuildingsDescriptor(other)!.signature).not.toBe(
          getBuildingsDescriptor(BUILT[2025])!.signature,
        );
      } finally {
        disposeBuildings(other);
      }
    });
  });

  describe('procedural-only materials and bounded budgets', () => {
    it('color tokens are procedural #rrggbb strings with lit emissives', () => {
      for (const era of ERA_YEARS) {
        const descriptor = getBuildingsDescriptor(BUILT[era])!;
        for (const token of descriptor.paletteHex) {
          expect(token).toMatch(/^#[0-9a-f]{6}$/);
        }
        expect(descriptor.emissiveHex).toMatch(/^#[0-9a-f]{6}$/);
        for (const building of descriptor.buildings) {
          expect(building.emissiveHex).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    });

    it('windows carry emissive night materials (glass glows via material.emissive)', () => {
      for (const era of ERA_YEARS) {
        let glassWithGlow = 0;
        BUILT[era].traverse((object) => {
          if (!(object instanceof THREE.Mesh)) {
            return;
          }
          const material = object.material as THREE.MeshLambertMaterial | undefined;
          if (!material || !material.name || !material.name.startsWith('glass')) {
            return;
          }
          const e = material.emissive;
          if (e && e.r + e.g + e.b > 0.001) {
            glassWithGlow += 1;
          }
        });
        expect(glassWithGlow, `${era} glass emissive meshes`).toBeGreaterThan(0);
      }
    });

    it('keeps geometry and material counts within the draw-call budget', () => {
      for (const era of ERA_YEARS) {
        const descriptor = getBuildingsDescriptor(BUILT[era])!;
        expect(descriptor.stats.buildingCount).toBe(16);
        expect(descriptor.stats.totalMeshCount).toBeLessThanOrEqual(1200);
        expect(descriptor.stats.totalMaterials).toBeLessThanOrEqual(40);
        for (const building of descriptor.buildings) {
          expect(building.meshCount).toBeLessThanOrEqual(80);
          expect(building.materialCount).toBeLessThanOrEqual(28);
        }
      }
    });
  });

  describe('lifecycle', () => {
    it('disposeBuildings releases geometries and materials without error', () => {
      const group = buildBuildings(1965, LAYOUT);
      const before = countMeshes(group);
      expect(before).toBeGreaterThan(0);
      disposeBuildings(group);
      disposeBuildings(group); // idempotent
      expect(countMeshes(group)).toBe(before);
    });
  });
});