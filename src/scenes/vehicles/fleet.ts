import { CITY_BLOCK_LAYOUT, distance } from '../layout/layout.js';
import type { CityBlockLayout, Point2 } from '../layout/types.js';
import type { EraData } from '../eras/types.js';
import type {
  BodySpec,
  VehicleBodyType,
  VehicleInstance,
} from './types.js';

/**
 * Era-authentic body + paint mapping and vehicle spawner.
 *
 * Every fleet kind id from the shared era registry is mapped to a concrete
 * `BodySpec` here. The paint palette and material/gloss values come from the
 * era profile (which interpolates during a transition), so a vehicle's body
 * silhouette and finish track the timeline. Vehicles are spawned deterministically
 * from a seed and circulate the shared traffic loops.
 */

/** A mutable RGB helper for interpolating hex colours. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const rgbToHex = (c: Rgb): string =>
  '#' +
  [c.r, c.g, c.b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');

/** Linear interpolation between two hex colours. */
export function lerpHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const tC = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * tC,
    g: ca.g + (cb.g - ca.g) * tC,
    b: ca.b + (cb.b - ca.b) * tC,
  });
}

/** Deterministic PRNG (mulberry32) so spawns are reproducible per seed. */
export function mulberry32(seed: number): () => number {
  let a = seed & 0xffffffff;
  return () => {
    a = (a + 0x6d2b79f5) & 0xffffffff;
    let t = a;
    t = ((t ^ (t >> 15)) * (t | 1)) & 0xffffffff;
    t ^= t + ((t ^ (t >> 7)) * (t | 61)) & 0xffffffff;
    return ((t ^ (t >> 14)) & 0xffffffff) / 4294967296;
  };
}

/** Map a fleet kind id onto a concrete body silhouette. */
function bodyForKind(
  kindId: string,
  era: EraData,
  palette: string[],
): BodySpec {
  const v = era.vehicles;
  switch (kindId) {
    case 'wartime-sedan':
      return boxyBody({ paint: pick(palette, 0), chromeTrim: v.chrome, gloss: v.bodyGloss, electric: false });
    case 'flatbed-truck':
      return truckBody(era);
    case 'trolley-bus':
      return busBody(era);
    case 'tailfin-cruiser':
      return tailfinBody(era, palette);
    case 'woodie-wagon':
      return wagonBody(era);
    case 'scooter':
      return scooterBody(era);
    case 'cable-bus':
      return busBody(era);
    case 'sedan-1985':
    case 'city-car':
      return angularBody(era, palette);
    case 'taxi':
      return taxiBody(era);
    case 'delivery-van':
      return vanBody(era);
    case 'suv':
      return suvBody(era);
    case 'hybrid':
      return hatchBody(era);
    case 'sedan-2005':
      return sedanBody(era);
    case 'bus':
      return busBody(era);
    case 'courier-truck':
      return truckBody(era);
    case 'ev-sedan':
      return evBody(era);
    case 'ev-suv':
      return evSuvBody(era);
    case 'e-bike':
      return ebikeBody(era);
    case 'autonomous-shuttle':
      return shuttleBody(era);
    default:
      // Unknown kinds degrade to a neutral boxy sedan rather than crashing.
      return boxyBody({ paint: pick(palette, 0), chromeTrim: v.chrome, gloss: v.bodyGloss, electric: false });
  }
}

const pick = (arr: readonly string[], i: number): string =>
  arr.length === 0 ? '#888888' : arr[i % arr.length]!;

function boxyBody(b: { paint: string; chromeTrim: number; gloss: number; electric: boolean }): BodySpec {
  return {
    bodyType: 'boxy',
    lengthM: 4.6,
    widthM: 1.9,
    heightM: 1.9,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: b.chromeTrim,
    headlightCount: 2,
    paint: b.paint,
    gloss: b.gloss,
    electric: b.electric,
  };
}

function tailfinBody(era: EraData, palette: string[]): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'tailfin',
    lengthM: 5.4,
    widthM: 1.95,
    heightM: 1.45,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: pick(palette, 1),
    gloss: v.bodyGloss,
    electric: false,
  };
}

function wagonBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'wagon',
    lengthM: 5.2,
    widthM: 1.9,
    heightM: 1.6,
    wheelCount: 4,
    roofRack: true,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#7c5f3a',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function angularBody(era: EraData, palette: string[]): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'angular',
    lengthM: 4.7,
    widthM: 1.85,
    heightM: 1.4,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: pick(palette, 2),
    gloss: v.bodyGloss,
    electric: false,
  };
}

function taxiBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'angular',
    lengthM: 4.8,
    widthM: 1.85,
    heightM: 1.4,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#e8c53a',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function truckBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'truck',
    lengthM: 6.8,
    widthM: 2.3,
    heightM: 2.6,
    wheelCount: 6,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#5a5f66',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function vanBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'van',
    lengthM: 5.6,
    widthM: 2.1,
    heightM: 2.3,
    wheelCount: 4,
    roofRack: true,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#3a6ea5',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function busBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'bus',
    lengthM: 11,
    widthM: 2.5,
    heightM: 3.1,
    wheelCount: 6,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#b03a2e',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function scooterBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'scooter',
    lengthM: 1.8,
    widthM: 0.7,
    heightM: 1.1,
    wheelCount: 2,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 1,
    paint: '#d9e0c0',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function suvBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'suv',
    lengthM: 4.9,
    widthM: 1.95,
    heightM: 1.75,
    wheelCount: 4,
    roofRack: true,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#b7d0e0',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function hatchBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'hatchback',
    lengthM: 4.2,
    widthM: 1.8,
    heightM: 1.5,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#8fa9bd',
    gloss: v.bodyGloss,
    electric: true,
  };
}

function sedanBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'angular',
    lengthM: 4.8,
    widthM: 1.85,
    heightM: 1.45,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#5b6c5e',
    gloss: v.bodyGloss,
    electric: false,
  };
}

function evBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'ev',
    lengthM: 4.7,
    widthM: 1.9,
    heightM: 1.45,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#e0e6ea',
    gloss: v.bodyGloss,
    electric: true,
  };
}

function evSuvBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'ev-suv',
    lengthM: 4.9,
    widthM: 1.95,
    heightM: 1.7,
    wheelCount: 4,
    roofRack: true,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#9cc0a8',
    gloss: v.bodyGloss,
    electric: true,
  };
}

function ebikeBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'e-bike',
    lengthM: 2.0,
    widthM: 0.8,
    heightM: 1.3,
    wheelCount: 3,
    roofRack: true,
    chromeTrim: v.chrome,
    headlightCount: 1,
    paint: '#00ffad',
    gloss: v.bodyGloss,
    electric: true,
  };
}

function shuttleBody(era: EraData): BodySpec {
  const v = era.vehicles;
  return {
    bodyType: 'shuttle',
    lengthM: 5.2,
    widthM: 2.1,
    heightM: 2.2,
    wheelCount: 4,
    roofRack: false,
    chromeTrim: v.chrome,
    headlightCount: 2,
    paint: '#d0e2c4',
    gloss: v.bodyGloss,
    electric: true,
  };
}

/**
 * The shared era paint palette for a fleet (falling back to the era's
 * storefront facade palette so colours stay period-authentic).
 */
export function eraPaintPalette(era: EraData): string[] {
  const fromFleet = era.vehicles.fleet
    .map((k) => k.id)
    .filter((id) => id !== 'taxi' && id !== 'delivery-van' && id !== 'bus');
  if (fromFleet.length >= 2) {
    return era.architecture.facadePalette.slice();
  }
  return era.architecture.facadePalette.slice();
}

/** Total length of a polyline of points. */
export function pathLen(pts: readonly Point2[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += distance(pts[i - 1]!, pts[i]!);
  }
  return total;
}

/**
 * Spawn the era-authentic fleet onto the shared traffic loops.
 * Uses the loop with the most waypoints (the ring circulation) as the primary
 * drive loop; the main-street loop shares the load. Deterministic per seed.
 */
export function spawnFleet(
  era: EraData,
  layout: CityBlockLayout,
  seed: number,
): VehicleInstance[] {
  const rng = mulberry32(seed);
  const loops = layout.trafficLoops;
  if (loops.length === 0) {
    return [];
  }
  const primary = loops[0]!;
  const secondary = loops.length > 1 ? loops[1]! : primary;
  const palette = eraPaintPalette(era);

  const fleet = era.vehicles.fleet;
  const instances: VehicleInstance[] = [];
  for (let i = 0; i < fleet.length; i++) {
    const kind = fleet[i]!;
    const body = bodyForKind(kind.id, era, palette);
    const loop = i % 2 === 0 ? primary : secondary;
    const loopLen = pathLen(loop.waypoints);
    for (let j = 0; j < 2; j++) {
      const progress = (rng() + i * 0.13 + j * 0.37) % 1;
      const pos = pointAtProgress(loop.waypoints, loopLen, progress);
      instances.push({
        id: `vehicle-${kind.id}-${i}-${j}`,
        seq: i * 2 + j,
        kindId: kind.id,
        kindLabel: kind.label,
        body,
        state: 'driving',
        position: pos,
        heading: 0,
        speed: baseSpeed(era),
        loopId: loop.id,
        loopProgress: progress,
        idleRemaining: 0,
      });
    }
  }
  return instances;
}

/** Position along a closed polyline at normalized progress in [0,1). */
export function pointAtProgress(
  pts: readonly Point2[],
  total: number,
  progress: number,
): Point2 {
  if (pts.length === 0) {
    return { x: 0, z: 0 };
  }
  if (pts.length === 1) {
    return pts[0]!;
  }
  const target = ((progress % 1) + 1) % 1 * total;
  let acc = 0;
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i % pts.length]!;
    const segLen = distance(a, b);
    if (segLen === 0) {
      continue;
    }
    if (acc + segLen >= target) {
      const t = (target - acc) / segLen;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    acc += segLen;
  }
  return pts[0]!;
}

/** Base cruise speed for the era (slower in early eras). */
export function baseSpeed(era: EraData): number {
  return 4 + era.vehicles.trafficDensity * 6;
}

/**
 * Whether a kind is a "small" vehicle that can idle at an intersection.
 * Buses and trucks idle too but with a longer dwell.
 */
export function idleDwell(era: EraData, kindId: string): number {
  if (kindId === 'bus' || kindId === 'cable-bus' || kindId === 'trolley-bus') {
    return 2.5;
  }
  if (kindId === 'autonomous-shuttle') {
    return 1.2;
  }
  return 0.8 + era.vehicles.trafficDensity * 1.5;
}

/** Convenience: the primary traffic loop id. */
export function primaryLoopId(layout: CityBlockLayout): string {
  return layout.trafficLoops.length > 0 ? layout.trafficLoops[0]!.id : '';
}

/** Convenience alias kept for external consumers. */
export const LAYOUT = CITY_BLOCK_LAYOUT;