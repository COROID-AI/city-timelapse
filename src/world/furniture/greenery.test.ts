import { describe, expect, it } from 'vitest';
import { createBlockLayout } from '../layout';
import { ERA_YEARS, type EraId } from '../../era/types';
import { buildTrees } from './greenery';

const SEED = 31337;

describe('Trees & greenery (src/world/furniture/greenery.ts)', () => {
  it('places one tree on every tree anchor for every era', () => {
    for (const era of ERA_YEARS) {
      const layout = createBlockLayout(SEED);
      const trees = buildTrees(layout, era, SEED);
      expect(trees).toHaveLength(layout.getAnchorsByKind('tree').length);
      for (const tree of trees) {
        expect(tree.anchorId).toMatch(/^anchor-tree/);
        expect(tree.position.y).toBe(layout.dimensions.curbHeight);
      }
    }
  });

  it('grows the tree stock across 80 years: taller trunks, wider canopies', () => {
    const trunkRadii: number[] = [];
    const trunkHeights: number[] = [];
    const canopyRadii: number[] = [];
    for (const era of ERA_YEARS) {
      const trees = buildTrees(createBlockLayout(SEED), era, SEED);
      trunkRadii.push(trees[0]!.trunk.radiusBottom);
      trunkHeights.push(trees[0]!.trunk.height);
      canopyRadii.push(trees[0]!.canopy.radius);
    }
    for (let i = 1; i < trunkRadii.length; i += 1) {
      expect(trunkRadii[i]!).toBeGreaterThan(trunkRadii[i - 1]!);
      expect(trunkHeights[i]!).toBeGreaterThan(trunkHeights[i - 1]!);
      expect(canopyRadii[i]!).toBeGreaterThan(canopyRadii[i - 1]!);
    }
  });

  it('stresses the 1985 smog-era stock and recovers to peak health in 2025', () => {
    const healths: Partial<Record<EraId, number>> = {};
    const densities: Partial<Record<EraId, number>> = {};
    for (const era of ERA_YEARS) {
      const trees = buildTrees(createBlockLayout(SEED), era, SEED);
      healths[era] = trees[0]!.canopy.health;
      densities[era] = trees[0]!.canopy.leafDensity;
    }
    expect(healths[1985]!).toBeLessThan(healths[1965]!);
    expect(healths[2005]!).toBeGreaterThan(healths[1985]!);
    expect(healths[2025]!).toBeGreaterThan(healths[2005]!);
    expect(healths[2025]!).toBeGreaterThan(healths[1945]!);
    expect(densities[1985]!).toBeLessThan(densities[1965]!);
    expect(densities[2025]!).toBeGreaterThan(densities[2005]!);
  });

  it('carries parametric branch and leaf-clump variation as set dressing', () => {
    const branchCounts: Partial<Record<EraId, number>> = {};
    for (const era of ERA_YEARS) {
      const trees = buildTrees(createBlockLayout(SEED), era, SEED);
      branchCounts[era] = trees[0]!.branches.length;
      expect(trees[0]!.branches.length).toBeGreaterThan(0);
      expect(trees[0]!.canopy.clumps.length).toBeGreaterThan(0);
      for (const branch of trees[0]!.branches) {
        expect(branch.length).toBeGreaterThan(0);
        expect(branch.radius).toBeGreaterThan(0);
        // Branch endpoints rise outward from the trunk (detail geometry).
        expect(branch.end.y).toBeGreaterThan(branch.start.y);
      }
      for (const clump of trees[0]!.canopy.clumps) {
        expect(clump.radius).toBeGreaterThan(0);
        expect(clump.color).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(branchCounts[2025]!).toBeGreaterThan(branchCounts[1945]!);
    expect(branchCounts[1985]!).toBeGreaterThan(branchCounts[1965]!);
  });

  it('evolves planters and adds blooming green stock in the final era', () => {
    for (const era of [1945, 1965] as const) {
      const trees = buildTrees(createBlockLayout(SEED), era, SEED);
      expect(trees[0]!.planter.style).toBe('soil_pit');
      expect(trees[0]!.bloom).toBe(false);
    }
    const modern = buildTrees(createBlockLayout(SEED), 2005, SEED);
    expect(modern[0]!.planter.style).toBe('raised_grate');
    const final = buildTrees(createBlockLayout(SEED), 2025, SEED);
    expect(final[0]!.planter.style).toBe('sustainable');
    expect(final[0]!.bloom).toBe(true);
    expect(final[0]!.bloomColor).not.toBeNull();
    // Mature trees shed a visible leaf litter ring at the base.
    for (const era of ERA_YEARS) {
      const trees = buildTrees(createBlockLayout(SEED), era, SEED);
      expect(trees[0]!.fallenLeaves).toBeGreaterThan(0);
    }
  });

  it('is deterministic per seed and species varies across anchors', () => {
    const a = buildTrees(createBlockLayout(SEED), 2025, SEED);
    const b = buildTrees(createBlockLayout(SEED), 2025, SEED);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const species = new Set(a.map((t) => t.species));
    expect(species.size).toBeGreaterThan(1);
  });
});