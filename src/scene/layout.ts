/**
 * Deterministic city-block layout.
 *
 * A fixed grid of building plots, road lanes, sidewalks, lamp/tree/bench
 * positions, and pedestrian/vehicle paths. Everything is seeded so the scene
 * is stable across renders and so instanced meshes can be built once.
 */

import { mulberry32 } from "../utils/interp";

export const BLOCK = 120; // overall city extent (half-extent * 2)
export const HALF = BLOCK / 2;

export interface Plot {
  /** center x */
  x: number;
  /** center z */
  z: number;
  /** footprint width */
  w: number;
  /** footprint depth */
  d: number;
  /** max possible height (units) */
  maxHeight: number;
  /** per-plot height bias 0..1 */
  heightBias: number;
  /** rotation y */
  rot: number;
  /** stable seed */
  seed: number;
}

const GRID = 4; // 4x4 plots per quadrant block

export function buildPlots(): Plot[] {
  const plots: Plot[] = [];
  const rnd = mulberry32(1337);
  const spacing = BLOCK / GRID;
  const start = -HALF + spacing / 2;
  let id = 0;
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      // carve cross-shaped roads by skipping the middle row/col lanes
      const cx = start + gx * spacing;
      const cz = start + gz * spacing;
      const w = spacing * (0.55 + rnd() * 0.2);
      const d = spacing * (0.55 + rnd() * 0.2);
      const maxHeight = 26 + rnd() * 78;
      plots.push({
        x: cx,
        z: cz,
        w,
        d,
        maxHeight,
        heightBias: 0.4 + rnd() * 0.6,
        rot: 0,
        seed: id++ * 9.31 + 1.1,
      });
    }
  }
  return plots;
}

export const PLOTS = buildPlots();

/** Road centerlines that vehicles drive along (two perpendicular avenues). */
export interface RoadLane {
  axis: "x" | "z";
  /** position on the perpendicular axis */
  offset: number;
  /** direction of travel sign */
  dir: number;
  /** the lane y */
  y: number;
}

export const ROAD_LANES: RoadLane[] = [
  { axis: "x", offset: -7, dir: 1, y: 0 },
  { axis: "x", offset: 7, dir: -1, y: 0 },
  { axis: "z", offset: -7, dir: 1, y: 0 },
  { axis: "z", offset: 7, dir: -1, y: 0 },
];

/** Sidewalk loop points where pedestrians wander. */
export function buildPedestrianSpots(count: number): { x: number; z: number; phase: number }[] {
  const rnd = mulberry32(424242);
  const spots: { x: number; z: number; phase: number }[] = [];
  for (let i = 0; i < count; i++) {
    // ring around the central plaza + along avenue edges
    const ring = rnd() > 0.5;
    if (ring) {
      const a = rnd() * Math.PI * 2;
      const r = 20 + rnd() * 30;
      spots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, phase: rnd() * Math.PI * 2 });
    } else {
      const onAve = rnd() > 0.5;
      const u = (rnd() - 0.5) * (BLOCK - 20);
      spots.push(
        onAve
          ? { x: u, z: 13 + rnd() * 6, phase: rnd() * Math.PI * 2 }
          : { x: 13 + rnd() * 6, z: u, phase: rnd() * Math.PI * 2 }
      );
    }
  }
  return spots;
}

/** Lamp / tree / bench positions lining the avenues. */
export function buildFurniture(): {
  lamps: { x: number; z: number }[];
  trees: { x: number; z: number; s: number }[];
  benches: { x: number; z: number; rot: number }[];
} {
  const rnd = mulberry32(777);
  const lamps: { x: number; z: number }[] = [];
  const trees: { x: number; z: number; s: number }[] = [];
  const benches: { x: number; z: number; rot: number }[] = [];
  const step = 16;
  for (let u = -HALF + 8; u <= HALF - 8; u += step) {
    lamps.push({ x: u, z: 13 });
    lamps.push({ x: u, z: -13 });
    lamps.push({ x: 13, z: u });
    lamps.push({ x: -13, z: u });
    if (rnd() > 0.35) trees.push({ x: u + 3, z: 15, s: 0.8 + rnd() * 0.6 });
    if (rnd() > 0.35) trees.push({ x: u - 3, z: -15, s: 0.8 + rnd() * 0.6 });
    if (rnd() > 0.6) benches.push({ x: u, z: 15.5, rot: 0 });
    if (rnd() > 0.6) benches.push({ x: 15.5, z: u, rot: Math.PI / 2 });
  }
  return { lamps, trees, benches };
}

/** Billboard positions on select buildings. */
export function buildBillboardSpots(): { x: number; y: number; z: number; w: number; h: number }[] {
  const rnd = mulberry32(2024);
  const spots: { x: number; y: number; z: number; w: number; h: number }[] = [];
  // pick the tallest plots
  const sorted = [...PLOTS].sort((a, b) => b.maxHeight - a.maxHeight).slice(0, 6);
  for (const p of sorted) {
    const h = p.maxHeight * (0.6 + rnd() * 0.25);
    spots.push({
      x: p.x + p.w / 2 + 0.4,
      y: h,
      z: p.z,
      w: 8 + rnd() * 4,
      h: 4 + rnd() * 2,
    });
  }
  return spots;
}

export const FURNITURE = buildFurniture();
export const BILLBOARD_SPOTS = buildBillboardSpots();
