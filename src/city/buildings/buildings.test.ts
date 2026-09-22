/**
 * Buildings module tests: era variants, registration, storefront alignment,
 * instancing, and full composition with the real era-transform contract and
 * the real procedural gfx material library.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import { createEraMorphSystem, stageOffset } from '../../era/contracts';
import type { EraMorphDriver } from '../../era/contracts';
import {
  BLOCK_ALIGNMENT,
  BUILDING_LOTS,
  FRONTAGE_LINE,
  createBuildingsModule,
  type Building,
  type BuildingEraBlend,
  type BuildingEraYear,
  type BuildingsGfxLibrary,
  type BuildingsModule,
} from './index';
import { BUILDING_ERAS, ERA_TREATMENTS, windowRowsFor } from './variants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REST_YEAR: BuildingEraYear = 1945;

function restBlend(year: BuildingEraYear): BuildingEraBlend {
  return { from: year, to: year, fraction: 0 };
}

function findByNamePrefix(root: THREE.Object3D, prefix: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object.name.startsWith(prefix)) found.push(object);
  });
  return found;
}

/** Visible only when neither the object nor any ancestor is hidden. */
function effectivelyVisible(object: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

function materialsUnder(root: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material;
    if (Array.isArray(mat)) materials.push(...mat);
    else if (mat) materials.push(mat);
  });
  return materials;
}

function visiblePrefixes(building: Building, prefix: string): THREE.Object3D[] {
  return findByNamePrefix(building.group, prefix).filter(effectivelyVisible);
}

function expectedWindowCount(building: Building, year: BuildingEraYear): number {
  const treatment = ERA_TREATMENTS[year];
  const cols = building.lot.fronts.reduce((sum, front) => sum + front.bays, 0);
  const rows = windowRowsFor(building.lot.massing[year], treatment.window.height / 2);
  return cols * rows;
}

function isAdjacentPair(eras: readonly BuildingEraYear[]): boolean {
  if (eras.length <= 1) return true;
  if (eras.length > 2) return false;
  const a = BUILDING_ERAS.indexOf(eras[0]);
  const b = BUILDING_ERAS.indexOf(eras[1]);
  return Math.abs(a - b) === 1;
}

interface MorphFrameProbe {
  adjacentOnly: boolean;
  sawCrossfade: boolean;
}

/** Drive a full transition and assert every dispatched frame stays sane. */
function probeTransition(
  driver: EraMorphDriver,
  module: BuildingsModule,
  year: number,
  allowed: readonly BuildingEraYear[],
  allowedMax = 2,
): MorphFrameProbe {
  const probe: MorphFrameProbe = { adjacentOnly: true, sawCrossfade: false };

  const checkFrame = (): void => {
    for (const building of module.buildings) {
      const visible = building.visibleEras();
      if (visible.length > allowedMax) probe.adjacentOnly = false;
      if (!isAdjacentPair(visible)) probe.adjacentOnly = false;
      if (visible.some((era) => !allowed.includes(era))) probe.adjacentOnly = false;
      if (visible.length === 2) probe.sawCrossfade = true;
      expect(Number.isFinite(building.topHeight)).toBe(true);
      expect(building.topHeight).toBeGreaterThan(0);
      const facadeGroups = findByNamePrefix(building.group, 'facade:');
      for (const group of facadeGroups) {
        for (const material of materialsUnder(group)) {
          expect(material.opacity).toBeGreaterThanOrEqual(0);
          expect(material.opacity).toBeLessThanOrEqual(1 + 1e-6);
        }
      }
    }
  };

  driver.transitionTo(year, 1);
  checkFrame();
  let guard = 0;
  while (driver.isTransitioning && guard < 500) {
    driver.advance(1 / 60);
    checkFrame();
    guard += 1;
  }
  expect(guard).toBeLessThan(500);
  checkFrame();
  return probe;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('corner lots and era-varying massing', () => {
  it('builds six to eight non-overlapping corner lots with distinct massing per era', () => {
    expect(BUILDING_LOTS.length).toBeGreaterThanOrEqual(6);
    expect(BUILDING_LOTS.length).toBeLessThanOrEqual(8);

    const module = createBuildingsModule();
    try {
      expect(module.buildings).toHaveLength(BUILDING_LOTS.length);
      expect(module.root.name).toBe('buildings');
      expect(module.buildings.length).toBeGreaterThanOrEqual(6);

      for (const building of module.buildings) {
        const heights = BUILDING_ERAS.map((era) => building.lot.massing[era]);
        expect(new Set(heights).size).toBeGreaterThanOrEqual(3);
        for (const h of heights) expect(h).toBeGreaterThanOrEqual(10);

        // No lot may reach into either 12-unit street band.
        const lot = building.lot;
        const hitsEastWestStreet = lot.z0 < 6 && lot.z1 > -6;
        const hitsNorthSouthStreet = lot.x0 < 6 && lot.x1 > -6;
        expect(hitsEastWestStreet).toBe(false);
        expect(hitsNorthSouthStreet).toBe(false);

        // Resting top height equals the era massing exactly.
        for (const era of BUILDING_ERAS) {
          building.applyEraBlend(restBlend(era), 0, 1);
          expect(building.topHeight).toBeCloseTo(lot.massing[era], 6);
        }
      }

      // Footprints may touch (party walls) but never overlap.
      for (let i = 0; i < module.buildings.length; i++) {
        for (let j = i + 1; j < module.buildings.length; j++) {
          const a = module.buildings[i].lot;
          const b = module.buildings[j].lot;
          const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
          expect(overlapX <= 0 || overlapZ <= 0).toBe(true);
        }
      }

      // Default state: synced to the first timeline stop before any dispatch.
      for (const building of module.buildings) {
        building.applyEraBlend(restBlend(REST_YEAR), 0, 1);
        expect(building.visibleEras()).toEqual([REST_YEAR]);
      }
    } finally {
      module.dispose();
    }
  });
});

describe('EraTransformable registration', () => {
  it('registers every building on the facade-first choreography stage', () => {
    const module = createBuildingsModule();
    const system = createEraMorphSystem();
    try {
      const unregister = module.registerInto(system.registry);
      expect(system.registry.size).toBe(module.buildings.length);
      for (const building of module.buildings) {
        expect(system.registry.has(building)).toBe(true);
        expect(building.stage).toBe('facade');
        // Facades lead the staged transition (stage offset 0 of the contract).
        expect(stageOffset(building.stage)).toBe(0);
      }

      const dispatched = system.registry.dispatch(restBlend(1965), 1);
      expect(dispatched).toBe(module.buildings.length);
      for (const building of module.buildings) {
        expect(building.visibleEras()).toEqual([1965]);
      }

      unregister();
      expect(system.registry.size).toBe(0);
    } finally {
      module.dispose();
    }
  });
});

describe('storefront bay slots', () => {
  it('exposes bays pinned to the canonical block alignment', () => {
    const module = createBuildingsModule();
    try {
      const expectedBays = BUILDING_LOTS.reduce(
        (sum, lot) => sum + lot.fronts.reduce((s, front) => s + front.bays, 0),
        0,
      );
      expect(module.storefrontBays).toHaveLength(expectedBays);
      expect(expectedBays).toBeGreaterThanOrEqual(20);

      module.root.updateMatrixWorld(true);
      const world = new THREE.Vector3();
      for (const bay of module.storefrontBays) {
        expect(bay.width).toBe(BLOCK_ALIGNMENT.bayClearWidth);
        expect(bay.width).toBe(5);
        expect(bay.slotPitch).toBe(BLOCK_ALIGNMENT.baySlotPitch);
        expect(bay.slotPitch).toBe(6);
        expect(bay.baseY).toBe(BLOCK_ALIGNMENT.bayBaseY);
        expect(bay.baseY).toBe(0.15);
        expect(bay.position.y).toBeCloseTo(0.15, 6);

        // Axis-aligned unit facing.
        const comps = [bay.facing.x, bay.facing.y, bay.facing.z];
        expect(comps.filter((c) => Math.abs(c) === 1)).toHaveLength(1);
        expect(comps.filter((c) => c === 0)).toHaveLength(2);

        // Frontage sits on the sidewalk edge, never over road or sidewalk.
        const axisX = bay.facing.y === 0 && bay.facing.x === 0; // N/S facing
        const alongWorld = axisX ? bay.position.z : bay.position.x;
        expect(Math.abs(alongWorld)).toBeGreaterThanOrEqual(FRONTAGE_LINE);

        // Bay centers sit on the 6-unit slot grid.
        const along = axisX ? bay.position.x : bay.position.z;
        expect(((along % 6) + 6) % 6).toBe(0);

        // Stable era-independent anchor lands exactly on the descriptor.
        bay.anchor.getWorldPosition(world);
        expect(world.x).toBeCloseTo(bay.position.x, 6);
        expect(world.y).toBeCloseTo(bay.position.y, 6);
        expect(world.z).toBeCloseTo(bay.position.z, 6);
        expect(module.root.getObjectByName(`bay:${bay.bayId}`)).toBe(bay.anchor);
      }
    } finally {
      module.dispose();
    }
  });
});

describe('era variants across the five years', () => {
  it('gives every building distinct per-era facades, glazing, details, and massing', () => {
    const module = createBuildingsModule();
    try {
      const [first] = module.buildings;

      for (const year of BUILDING_ERAS) {
        const treatment = ERA_TREATMENTS[year];
        for (const building of module.buildings) {
          building.applyEraBlend(restBlend(year), 0, 1);

          // Exactly one era layer is active: no popping, no ghost layers.
          expect(building.visibleEras()).toEqual([year]);

          // Instanced window grid with the era row/column count.
          const windows = findByNamePrefix(building.group, `windows:${year}`);
          expect(windows).toHaveLength(1);
          const windowMesh = windows[0] as THREE.InstancedMesh;
          expect(windowMesh.isInstancedMesh).toBe(true);
          expect(windowMesh.count).toBe(expectedWindowCount(building, year));
          expect(windowMesh.count).toBeGreaterThan(0);
          expect(effectivelyVisible(windowMesh)).toBe(true);

          // Glazing pane exists for the era.
          const glass = findByNamePrefix(building.group, `window-glass:${year}`);
          expect(glass).toHaveLength(1);
          expect((glass[0] as THREE.InstancedMesh).count).toBe(windowMesh.count);

          // Fire escapes present through 1965, phased out afterwards.
          const fireEscapes = visiblePrefixes(building, 'fire-escape:');
          if (treatment.fireEscape) {
            expect(fireEscapes.length).toBeGreaterThan(0);
            for (const escape of fireEscapes) {
              expect((escape as THREE.InstancedMesh).isInstancedMesh).toBe(true);
              expect(escape.name).toBe(`fire-escape:${year}`);
            }
          } else {
            expect(fireEscapes).toHaveLength(0);
          }

          // Window ACs appear mid-century and vanish with central HVAC.
          const acUnits = visiblePrefixes(building, 'window-ac:');
          if (treatment.windowAc !== 'none') {
            expect(acUnits).toHaveLength(1);
            expect((acUnits[0] as THREE.InstancedMesh).count).toBeGreaterThan(0);
          } else {
            expect(acUnits).toHaveLength(0);
          }

          // Decorative lintels only on early masonry eras.
          const lintels = visiblePrefixes(building, 'lintels:');
          if (treatment.windowLintels) {
            expect(lintels).toHaveLength(1);
            expect((lintels[0] as THREE.InstancedMesh).count).toBe(windowMesh.count);
          } else {
            expect(lintels).toHaveLength(0);
          }

          // Roofline, entrance, awning, and storefront frames exist per era.
          expect(visiblePrefixes(building, `parapet:${year}`)).toHaveLength(1);
          expect(visiblePrefixes(building, `cornice:${year}:`)).toHaveLength(
            building.lot.fronts.length,
          );
          expect(visiblePrefixes(building, `door:${year}`)).toHaveLength(1);
          expect(visiblePrefixes(building, `awning:${year}`)).toHaveLength(1);
          expect(visiblePrefixes(building, `storefront:${year}:`)).toHaveLength(
            building.lot.fronts.length,
          );
          expect(visiblePrefixes(building, `base-skin:${year}`)).toHaveLength(1);

          // 1945 ghost-sign remnants only where declared and only in 1945.
          const ghostSigns = visiblePrefixes(building, 'ghost-sign:');
          if (year === 1945 && building.lot.ghostSign) {
            expect(ghostSigns).toHaveLength(1);
          } else {
            expect(ghostSigns).toHaveLength(0);
          }
        }
      }

      // Glazing style (opening width) genuinely differs across all five eras.
      const widths = new Set<number>();
      for (const year of BUILDING_ERAS) {
        const windows = findByNamePrefix(first.group, `windows:${year}`)[0] as THREE.Mesh;
        windows.geometry.computeBoundingBox();
        const box = windows.geometry.boundingBox as THREE.Box3;
        widths.add(Math.round((box.max.x - box.min.x) * 100) / 100);
      }
      expect(widths.size).toBe(5);
    } finally {
      module.dispose();
    }
  });

  it('evolves rooftop worlds from water tanks to HVAC and billboards to solar green roofs', () => {
    const module = createBuildingsModule();
    try {
      const expectations: Array<{
        year: BuildingEraYear;
        present: string[];
        absent: string[];
      }> = [
        {
          year: 1945,
          present: ['roof-water-tank:', 'roof-chimney:', 'roof-vent:', 'roof-antenna:'],
          absent: ['roof-hvac:', 'roof-billboard', 'roof-dish:', 'roof-solar:', 'roof-green-deck:'],
        },
        {
          year: 1965,
          present: ['roof-water-tank:', 'roof-hvac:', 'roof-vent:'],
          absent: ['roof-billboard', 'roof-dish:', 'roof-solar:', 'roof-green-deck:', 'roof-cell-gear:'],
        },
        {
          year: 1985,
          present: ['roof-hvac:', 'roof-dish:', 'roof-billboard', 'roof-vent:'],
          absent: ['roof-water-tank:', 'roof-solar:', 'roof-green-deck:', 'roof-cell-gear:'],
        },
        {
          year: 2005,
          present: ['roof-hvac:', 'roof-cell-gear:', 'roof-antenna:', 'roof-billboard'],
          absent: ['roof-water-tank:', 'roof-solar:', 'roof-green-deck:'],
        },
        {
          year: 2025,
          present: ['roof-solar:', 'roof-green-deck:', 'roof-planters:', 'roof-shrubs:', 'roof-hvac:'],
          absent: ['roof-water-tank:', 'roof-billboard', 'roof-dish:', 'roof-cell-gear:'],
        },
      ];

      for (const { year, present, absent } of expectations) {
        for (const building of module.buildings) {
          building.applyEraBlend(restBlend(year), 0, 1);
          for (const prefix of present) {
            expect(
              visiblePrefixes(building, prefix).length,
              `${building.id} ${year} should show ${prefix}`,
            ).toBeGreaterThan(0);
          }
          for (const prefix of absent) {
            expect(
              visiblePrefixes(building, prefix).length,
              `${building.id} ${year} should hide ${prefix}`,
            ).toBe(0);
          }
        }
      }

      // Solar arrays are instanced repetitions.
      const any = module.buildings[0];
      any.applyEraBlend(restBlend(2025), 0, 1);
      const solar = visiblePrefixes(any, 'roof-solar:')[0] as THREE.InstancedMesh;
      expect(solar.isInstancedMesh).toBe(true);
      expect(solar.count).toBeGreaterThanOrEqual(2);
    } finally {
      module.dispose();
    }
  });
});

describe('composition with the era contract and gfx library', () => {
  it('morphs smoothly across adjacent and distant years without popping or z-fighting', () => {
    const module = createBuildingsModule();
    const system = createEraMorphSystem();
    const unregister = module.registerInto(system.registry);
    try {
      // Drive 1945 -> 1965 (adjacent): frames stay on an adjacent pair,
      // opacities stay in range, and a genuine crossfade frame occurs.
      const adjacent = probeTransition(
        system.driver,
        module,
        1965,
        [1945, 1965],
      );
      expect(adjacent.adjacentOnly).toBe(true);
      expect(adjacent.sawCrossfade).toBe(true);
      for (const building of module.buildings) {
        expect(building.visibleEras()).toEqual([1965]);
        expect(building.topHeight).toBeCloseTo(building.lot.massing[1965], 6);
        expect(visiblePrefixes(building, 'fire-escape:').length).toBeGreaterThan(0);
      }

      // Drive 1965 -> 2025 (distant): passes through intermediate adjacent
      // pairs, never showing non-adjacent eras together.
      const distant = probeTransition(
        system.driver,
        module,
        2025,
        [1965, 1985, 2005, 2025],
      );
      expect(distant.adjacentOnly).toBe(true);
      expect(distant.sawCrossfade).toBe(true);
      for (const building of module.buildings) {
        expect(building.visibleEras()).toEqual([2025]);
        expect(building.topHeight).toBeCloseTo(building.lot.massing[2025], 6);
        expect(visiblePrefixes(building, 'fire-escape:')).toHaveLength(0);
        expect(visiblePrefixes(building, 'window-ac:')).toHaveLength(0);
        expect(visiblePrefixes(building, 'roof-solar:').length).toBeGreaterThan(0);
      }
    } finally {
      unregister();
      module.dispose();
    }
  });

  it('composes with the real gfx material library and ships no missing materials', () => {
    const library: BuildingsGfxLibrary = {
      ...ProceduralGfxLibrary,
      createEraMaterial: vi.fn(ProceduralGfxLibrary.createEraMaterial),
      createWindowGridGeometry: vi.fn(ProceduralGfxLibrary.createWindowGridGeometry),
      createInstancedMesh: vi.fn(ProceduralGfxLibrary.createInstancedMesh),
    };

    const module = createBuildingsModule({ library });
    try {
      // Real library functions were composed for materials, windows, meshes.
      expect(library.createEraMaterial).toHaveBeenCalled();
      expect(library.createWindowGridGeometry).toHaveBeenCalled();
      expect(library.createInstancedMesh).toHaveBeenCalled();

      // Real material swatches flow through: 1945 masonry matches the palette.
      const building = module.buildings[0];
      building.applyEraBlend(restBlend(1945), 0, 1);
      const baseSkins = findByNamePrefix(building.group, 'base-skin:1945');
      expect(baseSkins).toHaveLength(1);
      const skin = baseSkins[0] as THREE.Mesh;
      const skinMaterial = skin.material as THREE.MeshStandardMaterial;
      const swatch = ProceduralGfxLibrary.getMaterialSwatch(1945, 'masonryConcrete');
      expect(skinMaterial.color.getHexString()).toBe(swatch.color.slice(1).toLowerCase());

      // Every mesh in the module carries real materials (no placeholders) and
      // era polygon offsets so crossfading layers never z-fight.
      let meshCount = 0;
      module.root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        meshCount += 1;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of mats) {
          expect(material).toBeTruthy();
          expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
          expect(material.transparent).toBe(true);
          expect(material.polygonOffset).toBe(true);
          expect(Number.isFinite(material.opacity)).toBe(true);
        }
      });
      expect(meshCount).toBeGreaterThan(100);
    } finally {
      module.dispose();
    }
  });

  it('keeps heavy repetition instanced for near-60fps', () => {
    const module = createBuildingsModule();
    try {
      const instanced: THREE.InstancedMesh[] = [];
      module.root.traverse((object) => {
        const mesh = object as THREE.InstancedMesh;
        if (mesh.isInstancedMesh) instanced.push(mesh);
      });

      // Windows + glass frames alone: one pair per era per building.
      expect(instanced.length).toBeGreaterThanOrEqual(module.buildings.length * BUILDING_ERAS.length * 2);

      // Real, derived window instance totals at the 1965 rest stop.
      const expectedTotal = BUILDING_LOTS.reduce((sum, lot) => {
        const cols = lot.fronts.reduce((s, front) => s + front.bays, 0);
        const rows = windowRowsFor(lot.massing[1965], ERA_TREATMENTS[1965].window.height / 2);
        return sum + cols * rows;
      }, 0);
      let windowInstances = 0;
      for (const building of module.buildings) {
        building.applyEraBlend(restBlend(1965), 0, 1);
        const windows = findByNamePrefix(building.group, 'windows:1965')[0] as THREE.InstancedMesh;
        expect(windows.count).toBe(expectedWindowCount(building, 1965));
        windowInstances += windows.count;
        const escapes = visiblePrefixes(building, 'fire-escape:');
        expect(escapes.length).toBeGreaterThan(0);
        expect((escapes[0] as THREE.InstancedMesh).isInstancedMesh).toBe(true);
      }
      expect(windowInstances).toBe(expectedTotal);
    } finally {
      module.dispose();
    }
  });
});

describe('module lifecycle', () => {
  it('dispose detaches the scene graph and releases procedural resources', () => {
    const module = createBuildingsModule();
    expect(module.root.children.length).toBe(module.buildings.length);
    module.dispose();
    expect(module.root.children).toHaveLength(0);

    // A fresh module still builds correctly afterwards.
    const second = createBuildingsModule();
    try {
      expect(second.buildings.length).toBe(module.buildings.length);
      expect(second.buildings[0].visibleEras()).toEqual([REST_YEAR]);
    } finally {
      second.dispose();
    }
  });
});
