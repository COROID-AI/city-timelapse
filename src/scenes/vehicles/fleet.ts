/**
 * Per-era vehicle fleet & traffic: era-derived computation.
 *
 * Places one deterministic vehicle per layout lane from the shared era
 * registry and layout anchors, then merges every instanced vehicle into
 * renderer-friendly buffers. Numeric traffic behaviour (density, electric
 * ratio, body gloss, chrome, headlight colour, engine noise) interpolates
 * continuously during era transitions via the shared `interpolateEra` engine;
 * discrete fleet kinds follow the era registry.
 *
 * This module owns no era data and no lane geometry — both are consumed
 * read-only from `src/scenes/eras/` and `src/scenes/layout/`.
 */

import { getEra, getEraYears, interpolateEra } from '../eras/index.js';
import type { EraData } from '../eras/index.js';
import { CITY_BLOCK_LAYOUT } from '../layout/index.js';
import type { Lane } from '../layout/index.js';
import type { VehicleBuffers, VehicleInstance } from './types.js';

/** Deterministic pseudo-random number in [0,1) from a string seed. */
function seeded(seed: string, salt: number): number {
  let h = 2166136261;
  const s = `${seed}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h *= 16777619;
  }
  return ((h >>> 16) & 0xffff) / 65536;
}

/** Pick a fleet kind deterministically for a lane. */
function pickKind(era: EraData, lane: Lane): { id: string; label: string } {
  const fleet = era.vehicles.fleet;
  const arr = fleet.length > 0 ? fleet : [{ id: 'generic-car', label: 'Car' }];
  const idx = Math.floor(seeded(lane.id, 3) * arr.length) % arr.length;
  return arr[idx]!;
}

/** A deterministic paintwork colour from the era fleet chrome/gloss feel. */
function paintColor(era: EraData, lane: Lane): string {
  const warm = ['#8a6b3f', '#a0522d', '#b87333', '#6b5a3a'];
  const cool = ['#5c7a99', '#3f5f8a', '#708090', '#2f4f6f'];
  const vivid = ['#c0392b', '#1e8449', '#2e4053', '#a93226'];
  const pool =
    era.vehicles.electricRatio > 0.5
      ? cool
      : era.vehicles.bodyGloss > 0.7
        ? vivid
        : warm;
  return pool[Math.floor(seeded(lane.id, 4) * pool.length) % pool.length]!;
}

/** Resolve the era-interpolated data for a given year (blend when needed). */
export function eraDataForYear(year: number): EraData {
  const years = getEraYears();
  const exact = years.indexOf(year);
  if (exact !== -1) {
    return getEra(year);
  }
  let lower = years[0]!;
  let upper = years[years.length - 1]!;
  for (let i = 0; i < years.length - 1; i++) {
    const a = years[i]!;
    const b = years[i + 1]!;
    if (year >= a && year <= b) {
      lower = a;
      upper = b;
      break;
    }
  }
  if (year <= lower) {
    return getEra(lower);
  }
  if (year >= upper) {
    return getEra(upper);
  }
  const t = (year - lower) / (upper - lower);
  return interpolateEra(getEra(lower), getEra(upper), t);
}

/** Place one vehicle per layout lane for the given era. */
export function buildFleet(year: number): VehicleBuffers {
  const era = eraDataForYear(year);
  const lanes = CITY_BLOCK_LAYOUT.lanes;
  const vehicles: VehicleInstance[] = [];

  for (const lane of lanes) {
    const kind = pickKind(era, lane);
    const waypoints = lane.waypoints;
    if (waypoints.length === 0) {
      continue;
    }
    // Deterministic position along the lane, offset from the first waypoint.
    const start = waypoints[0]!;
    const end = waypoints[Math.min(1, waypoints.length - 1)]!;
    const heading = Math.atan2(end.z - start.z, end.x - start.x);
    const along = 0.5 + seeded(lane.id, 5) * 0.4;
    const position = {
      x: start.x + (end.x - start.x) * along,
      z: start.z + (end.z - start.z) * along,
    };
    vehicles.push({
      id: `vehicle-${lane.id}`,
      kindId: kind.id,
      label: kind.label,
      laneId: lane.id,
      position,
      heading,
      color: paintColor(era, lane),
      length: 4.5,
      width: 1.9,
      electric: era.vehicles.electricRatio > 0.5,
      bodyGloss: era.vehicles.bodyGloss,
      chrome: era.vehicles.chrome,
      headlightCool: era.vehicles.headlightCool,
      engineNoise: era.vehicles.engineNoise,
    });
  }

  return {
    vehicles,
    instanceCount: vehicles.length,
    trafficDensity: era.vehicles.trafficDensity,
    electricRatio: era.vehicles.electricRatio,
    engineNoise: era.vehicles.engineNoise,
    headlightCool: era.vehicles.headlightCool,
    bodyGloss: era.vehicles.bodyGloss,
    chrome: era.vehicles.chrome,
  };
}

/** Convenience: the number of traffic lanes / vehicle instances in the block. */
export function vehicleInstanceCount(): number {
  return CITY_BLOCK_LAYOUT.lanes.length;
}