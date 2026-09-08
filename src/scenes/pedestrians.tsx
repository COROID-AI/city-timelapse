import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { WALKWAY, pathLength } from './layout/index.js';
import type { Point2 } from './layout/types.js';
import type { EraData } from './eras/types.js';

/**
 * Era-authentic pedestrian crowds & outfit variants (1945-2025).
 *
 * Single owner of the pedestrian population for the city block. Consumes the
 * era registry and the block layout read-only:
 *
 *  - **Outfits** derive from `EraData.pedestrians` (palette, hatLevel,
 *    formality, materialShine, colorfulness) so each era renders an authentic
 *    wardrobe: 1945 hats & overcoats, 1965 suits & mod skirts, 1985 denim/
 *    neon/leather/aerobics, 2005 casual/tech, 2025 athleisure and diverse
 *    styles.
 *  - **Density & speed** scale with the era's pedestrian profile so crowds get
 *    busier and faster across the timeline.
 *  - **Walkways** come from the shared `layout` anchors so pedestrians walk
 *    the same paths used by vehicles and the camera.
 *
 * The reviewed regression (fd2f3e0c) is preserved: `walkSpeed` and
 * `walkOffset` are computed inside a `useMemo([index])` (their deterministic,
 * per-index base) so no `Math.random` ever runs in the render body. Era-typed
 * speed scaling is pure arithmetic on top of that seeded base.
 */

/** Base crowd before era-scaling. */
const BASE_CROWD = 24;

/** Deterministic PRNG (mulberry32) keyed by an integer seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 0..1 value for a given integer seed (never `Math.random`). */
function seededRandom(index: number): number {
  return mulberry32((index * 2654435761) >>> 0)();
}

/** Walking speed (scene units/sec) for an era, derived from its profile. */
export function eraSpeed(era: EraData): number {
  // Brisk, formal postwar walkers (1945) through relaxed athleisure (2025).
  return 1.6 + era.pedestrians.formality * 1.6;
}

/** Crowd size (density) for an era; grows with pedestrian variety. */
export function eraCrowdCount(era: EraData): number {
  return Math.min(
    64,
    Math.max(1, Math.round(BASE_CROWD * era.pedestrians.variety * 2.2)),
  );
}

/** A resolved, era-authentic outfit variant for one pedestrian. */
export interface PedestrianOutfitVariant {
  styleId: string;
  color: string;
  hat: boolean;
  formal: boolean;
  colorfulness: number;
  materialShine: number;
}

/** Resolve one outfit variant from an era's pedestrian profile. */
export function resolveOutfitVariant(
  era: EraData,
  index: number,
): PedestrianOutfitVariant {
  const ped = era.pedestrians;
  const prand = seededRandom(index * 11 + 5);
  const palette = ped.palette;
  const color =
    palette.length > 0
      ? palette[Math.floor(prand * palette.length)]!
      : '#888888';
  return {
    styleId: ped.styleId,
    color,
    hat: prand < ped.hatLevel,
    formal: prand < ped.formality,
    colorfulness: ped.colorfulness,
    materialShine: ped.materialShine,
  };
}

/** A single, deterministic pedestrian configuration. */
export interface PedestrianEntry {
  index: number;
  /** Phase (0..1) along the shared walkway. */
  walkOffset: number;
  /** Travel factor (relative walk pace, era-scaled). */
  walkSpeed: number;
  outfit: PedestrianOutfitVariant;
}

/**
 * The complete deterministic crowd for an era profile (possibly interpolated).
 * Exported so headless/lifecycle consumers and tests can assert per-era
 * outfit & density without a DOM.
 */
export function computeCrowd(era: EraData): PedestrianEntry[] {
  const count = eraCrowdCount(era);
  const speedScale = eraSpeed(era) / 2.4;
  const entries: PedestrianEntry[] = [];
  for (let i = 0; i < count; i++) {
    const base = determinBase(i); // same deterministic base the component uses
    entries.push({
      index: i,
      walkOffset: base.walkOffset,
      walkSpeed: base.walkSpeed * speedScale,
      outfit: resolveOutfitVariant(era, i),
    });
  }
  return entries;
}

/**
 * Deterministic per-index motion base. `walkSpeed` and `walkOffset` here are
 * the values the component memoizes on `[index]` (regression fd2f3e0c) BEFORE
 * era scaling is applied as pure arithmetic in the render body - so the render
 * never calls `Math.random`.
 */
function determinBase(index: number): {
  walkOffset: number;
  walkSpeed: number;
} {
  return {
    walkOffset: seededRandom(index * 13 + 2),
    walkSpeed: 0.045 + seededRandom(index * 7 + 1) * 0.03,
  };
}

/** Position of a walkway `t` (0..1) along the shared polyline. */
export function positionOnWalk(
  t: number,
  waypoints: readonly Point2[] = WALKWAY.map((w) => w.point),
): Point2 {
  if (waypoints.length === 0) {
    return { x: 0, z: 0 };
  }
  if (waypoints.length === 1) {
    return waypoints[0]!;
  }
  const total = pathLength(waypoints);
  if (total <= 0) {
    return waypoints[0]!;
  }
  const target = (((t % 1) + 1) % 1) * total;
  let acc = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (acc + seg >= target) {
      const frac = seg === 0 ? 0 : (target - acc) / seg;
      return {
        x: a.x + (b.x - a.x) * frac,
        z: a.z + (b.z - a.z) * frac,
      };
    }
    acc += seg;
  }
  return waypoints[waypoints.length - 1]!;
}

/**
 * The React component for the pedestrian crowd.
 *
 * `era` is the exact (possibly interpolated) profile for the current timeline
 * step; crowd density & outfit variants recompute whenever it changes, so they
 * interpolate continuously during transitions. Per pedestrian, `walkSpeed` and
 * `walkOffset` come from `useMemo([index])` (regression fd2f3e0c) so the render
 * body never calls `Math.random`; era speed is applied afterwards as pure
 * arithmetic.
 */
export function Pedestrians({
  era,
  now = 0,
}: {
  era: EraData;
  now?: number;
}): ReactNode {
  const entries = useMemo(() => computeCrowd(era), [era]);
  return (
    <group-display>
      {entries.map((entry) => (
        <PedestrianFigure
          key={`ped-${entry.index}`}
          index={entry.index}
          era={era}
          now={now}
        />
      ))}
    </group-display>
  );
}

/** One pedestrian's rendered figure. */
function PedestrianFigure({
  index,
  era,
  now,
}: {
  index: number;
  era: EraData;
  now: number;
}): ReactNode {
  // walkSpeed / walkOffset are the deterministic per-index base, computed in
  // useMemo([index]) so no Math.random runs in the render body (fd2f3e0c).
  const base = useMemo(() => determinBase(index), [index]);
  const outf = useMemo(() => resolveOutfitVariant(era, index), [era, index]);
  // Era-appropriate speed: pure arithmetic scaling over the seeded base.
  const walkSpeed = base.walkSpeed * (eraSpeed(era) / 2.4);
  const pos = positionOnWalk(base.walkOffset + now * walkSpeed);
  return (
    <pedestrian-entry
      index={index}
      x={pos.x}
      z={pos.z}
      styleId={outf.styleId}
      color={outf.color}
      hat={outf.hat ? 'true' : 'false'}
      formal={outf.formal ? 'true' : 'false'}
      materialShine={outf.materialShine}
    />
  );
}

/* Minimal intrinsic element declarations so the module compiles under the
   react-jsx transform regardless of the app's component library. Mounting
   (tests) reads these as data attributes via react-dom/server. */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'group-display': { children?: ReactNode };
      'pedestrian-entry': {
        index?: number;
        x?: number;
        z?: number;
        styleId?: string;
        color?: string;
        hat?: string;
        formal?: string;
        materialShine?: number;
      };
    }
  }
}