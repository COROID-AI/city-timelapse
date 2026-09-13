/**
 * Era greenery: one tree per `tree` anchor, whose stock grows larger,
 * healthier and richer in the later eras — while the smoggiest era (1985)
 * visibly stresses the canopy. Every tree carries parametric branch and
 * leaf-clump geometry so foliage reads as detailed set dressing, plus a
 * planter that also evolves with the street.
 *
 * Pure parametric data (meters + hex colors), deterministic per seed.
 */

import type { BlockLayout, Point3D } from '../layout';
import type { ColorHex, EraId } from '../../era/types';
import { deriveSeedRng } from './street';

export interface BranchSpec {
  index: number;
  yaw: number;
  elevation: number;
  length: number;
  radius: number;
  start: Point3D;
  end: Point3D;
}

export interface LeafClump {
  index: number;
  offset: Point3D;
  radius: number;
  color: ColorHex;
  density: number;
}

export interface PlanterSpec {
  style: 'soil_pit' | 'concrete_ring' | 'raised_grate' | 'sustainable';
  color: ColorHex;
  width: number;
  depth: number;
  height: number;
}

export interface TreeResult {
  anchorId: string;
  position: Point3D;
  species: string;
  age: number;
  trunk: {
    radiusBottom: number;
    radiusTop: number;
    height: number;
    lean: { x: number; z: number };
  };
  branches: BranchSpec[];
  canopy: {
    radius: number;
    height: number;
    leafDensity: number;
    health: number;
    clumps: LeafClump[];
  };
  leafColor: ColorHex;
  bloom: boolean;
  bloomColor: ColorHex | null;
  planter: PlanterSpec;
  fallenLeaves: number;
}

interface EraTreeSpec {
  species: readonly string[];
  age: number;
  trunkRadiusBottom: number;
  trunkHeight: number;
  canopyRadius: number;
  canopyHeight: number;
  leafDensity: number;
  health: number;
  branchesBase: number;
  branchesJitter: number;
  clumpsBase: number;
  leafColors: readonly ColorHex[];
  bloom: boolean;
  bloomColor: ColorHex | null;
  planter: { style: PlanterSpec['style']; color: ColorHex; width: number };
  fallenLeafMin: number;
  fallenLeafMax: number;
}

/** Tree stock across the timeline: young wartime trees → mature green 2025. */
const ERA_TREE_SPECS: Record<EraId, EraTreeSpec> = {
  1945: {
    species: ['american-elm', 'sugar-maple'],
    age: 10,
    trunkRadiusBottom: 0.24,
    trunkHeight: 5.2,
    canopyRadius: 2.0,
    canopyHeight: 3.6,
    leafDensity: 0.5,
    health: 0.55,
    branchesBase: 5,
    branchesJitter: 1,
    clumpsBase: 6,
    leafColors: ['#7d9a4a', '#5f7d46'],
    bloom: false,
    bloomColor: null,
    planter: { style: 'soil_pit', color: '#8a7a6a', width: 1.0 },
    fallenLeafMin: 4,
    fallenLeafMax: 8,
  },
  1965: {
    species: ['sugar-maple', 'red-oak'],
    age: 22,
    trunkRadiusBottom: 0.34,
    trunkHeight: 7.2,
    canopyRadius: 2.7,
    canopyHeight: 4.6,
    leafDensity: 0.68,
    health: 0.75,
    branchesBase: 8,
    branchesJitter: 2,
    clumpsBase: 9,
    leafColors: ['#6f9c4e', '#8fae56'],
    bloom: false,
    bloomColor: null,
    planter: { style: 'soil_pit', color: '#9b8a76', width: 1.0 },
    fallenLeafMin: 5,
    fallenLeafMax: 10,
  },
  1985: {
    species: ['pin-oak', 'callery-pear'],
    age: 40,
    trunkRadiusBottom: 0.46,
    trunkHeight: 9.6,
    canopyRadius: 3.3,
    canopyHeight: 5.0,
    leafDensity: 0.42,
    health: 0.48,
    branchesBase: 12,
    branchesJitter: 3,
    clumpsBase: 10,
    leafColors: ['#7a8450', '#8a8a5a'],
    bloom: false,
    bloomColor: null,
    planter: { style: 'concrete_ring', color: '#a8a29a', width: 1.1 },
    fallenLeafMin: 8,
    fallenLeafMax: 16,
  },
  2005: {
    species: ['london-plane', 'red-oak'],
    age: 55,
    trunkRadiusBottom: 0.54,
    trunkHeight: 11.2,
    canopyRadius: 3.9,
    canopyHeight: 5.8,
    leafDensity: 0.8,
    health: 0.86,
    branchesBase: 15,
    branchesJitter: 3,
    clumpsBase: 14,
    leafColors: ['#5f9c4e', '#7fae5e'],
    bloom: false,
    bloomColor: null,
    planter: { style: 'raised_grate', color: '#9aa0a6', width: 1.2 },
    fallenLeafMin: 6,
    fallenLeafMax: 12,
  },
  2025: {
    species: ['london-plane', 'ginkgo', 'red-maple'],
    age: 75,
    trunkRadiusBottom: 0.62,
    trunkHeight: 12.6,
    canopyRadius: 4.5,
    canopyHeight: 6.4,
    leafDensity: 0.92,
    health: 0.96,
    branchesBase: 19,
    branchesJitter: 3,
    clumpsBase: 18,
    leafColors: ['#4f9c4a', '#8fc76a', '#d9a32e'],
    bloom: true,
    bloomColor: '#c96f2f',
    planter: { style: 'sustainable', color: '#6fae8f', width: 1.3 },
    fallenLeafMin: 6,
    fallenLeafMax: 10,
  },
};

/**
 * Build one tree for every `tree` anchor. Deterministic: same seed yields
 * identical species, branch skeletons, clumps and planter for every anchor.
 */
export function buildTrees(layout: BlockLayout, era: EraId, seed: number): TreeResult[] {
  const spec = ERA_TREE_SPECS[era];
  const anchors = layout.getAnchorsByKind('tree');
  const results: TreeResult[] = [];

  for (const anchor of anchors) {
    const rng = deriveSeedRng(seed, `tree:${anchor.id}`);
    const species = rng.pick(spec.species);
    const branchCount = Math.max(2, spec.branchesBase + rng.int(-spec.branchesJitter, spec.branchesJitter));
    const trunkHeight = spec.trunkHeight + rng.range(-0.25, 0.25);
    const canopyRadius = spec.canopyRadius + rng.range(-0.12, 0.12);

    // Parametric branch skeleton radiating from the upper trunk.
    const branches: BranchSpec[] = [];
    for (let i = 0; i < branchCount; i += 1) {
      const yaw = rng.range(0, Math.PI * 2);
      const elevation = rng.range(0.25, 1.05);
      const length = rng.range(0.6, 1.2) * canopyRadius * 0.55;
      const start = { x: anchor.position.x, y: anchor.position.y + trunkHeight * 0.55 + rng.range(-0.2, 0.4), z: anchor.position.z };
      branches.push({
        index: i,
        yaw,
        elevation,
        length,
        radius: rng.range(0.06, 0.18) * spec.trunkRadiusBottom,
        start,
        end: {
          x: start.x + Math.cos(yaw) * Math.cos(elevation) * length,
          y: start.y + Math.sin(elevation) * length,
          z: start.z + Math.sin(yaw) * Math.cos(elevation) * length,
        },
      });
    }

    // Loose foliage clumps scattered through the canopy sphere.
    const clumps: LeafClump[] = [];
    const clumpCount = Math.max(3, spec.clumpsBase + rng.int(-2, 2));
    for (let i = 0; i < clumpCount; i += 1) {
      clumps.push({
        index: i,
        offset: {
          x: rng.range(-0.65, 0.65) * canopyRadius,
          y: rng.range(0, 0.75) * spec.canopyHeight,
          z: rng.range(-0.65, 0.65) * canopyRadius,
        },
        radius: rng.range(0.35, 0.85) * 0.5 * canopyRadius / 1.6,
        color: rng.pick(spec.leafColors),
        density: Math.max(0.25, spec.leafDensity + rng.range(-0.12, 0.12)),
      });
    }

    results.push({
      anchorId: anchor.id,
      position: anchor.position,
      species,
      age: spec.age + rng.int(-2, 2),
      trunk: {
        radiusBottom: spec.trunkRadiusBottom * rng.range(0.95, 1.05),
        radiusTop: spec.trunkRadiusBottom * 0.42,
        height: trunkHeight,
        lean: { x: rng.range(-0.06, 0.06), z: rng.range(-0.06, 0.06) },
      },
      branches,
      canopy: {
        radius: canopyRadius,
        height: spec.canopyHeight,
        leafDensity: spec.leafDensity,
        health: spec.health,
        clumps,
      },
      leafColor: rng.pick(spec.leafColors),
      bloom: spec.bloom,
      bloomColor: spec.bloomColor,
      planter: {
        style: spec.planter.style,
        color: spec.planter.color,
        width: spec.planter.width,
        depth: spec.planter.width * 0.85,
        height: spec.planter.style === 'soil_pit' ? 0.12 : 0.35,
      },
      fallenLeaves: rng.int(spec.fallenLeafMin, spec.fallenLeafMax),
    });
  }
  return results;
}