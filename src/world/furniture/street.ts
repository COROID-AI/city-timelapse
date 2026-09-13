/**
 * Street-level ground plane builder: era-correct asphalt, painted lane
 * markings, drains, manholes, reflectors and tar patches, plus sidewalk
 * surface treatments and full curb geometry around every sidewalk band.
 *
 * Pure procedural data (meters + hex colors) with no Three.js, DOM or
 * network dependencies — renderers consume these specs directly. Every
 * procedural jitter is driven through the scaffold's seeded RNG so each era
 * builds deterministically from the same seed.
 */

import type { BlockLayout, Crosswalk, Point3D } from '../layout';
import type { ColorHex, EraId } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';
import type { Rng } from '../../lib/rng';
import { createSeededRng } from '../../lib/rng';

// ---------------------------------------------------------------------------
// Deterministic RNG derivation shared by all furniture submodules
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit string hash — stable integer salt for sub-seed derivation. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return hash;
}

/** Deterministic RNG derived from `seed` and a named salt string. */
export function deriveSeedRng(seed: number, salt: string): Rng {
  return createSeededRng((seed ^ hashString(salt)) & 0xffffffff);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarkingLineKind = 'center_line' | 'edge_line' | 'stop_line' | 'crosswalk' | 'bike_lane';
export type MarkingStyle = 'solid' | 'dashed' | 'double' | 'single' | 'bars';

/** One painted ground rectangle (meters, Y-up plane). */
export interface MarkingSegment {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A complete painted marking family for one lane/crosswalk/edge. */
export interface MarkingLine {
  id: string;
  kind: MarkingLineKind;
  style: MarkingStyle;
  color: ColorHex;
  /** Paint width in meters. */
  width: number;
  /** Retro-reflective glow (0 = flat paint, >0 = thermoplastic studs). */
  glow: number;
  segments: MarkingSegment[];
}

/** Small in-asphalt detail: drain grate, manhole cover, tar patch, stud. */
export interface GroundDetail {
  id: string;
  kind: 'drain' | 'manhole' | 'tar_patch' | 'reflector' | 'bike_pictogram';
  position: Point3D;
  radius: number;
  rotation: number;
  color: ColorHex;
}

/** One run of curb face between expansion joints. */
export interface CurbSegment {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  faceHeight: number;
  topWidth: number;
  faceSlope: number;
}

/** One sidewalk band lifted to a curb with rounded geometry. */
export interface CurbResult {
  id: string;
  bandId: string;
  color: ColorHex;
  height: number;
  topWidth: number;
  wear: number;
  segments: CurbSegment[];
}

export interface AsphaltSurfaceResult {
  roadWidth: number;
  baseColor: ColorHex;
  patchTone: ColorHex;
  /** 0..1 overall pavement wear (cracks, patches, faded paint). */
  wear: number;
  crackDensity: number;
  textureGrain: number;
  markings: MarkingLine[];
  drains: GroundDetail[];
  manholes: GroundDetail[];
  reflectors: GroundDetail[];
  tarPatches: GroundDetail[];
  pictograms: GroundDetail[];
}

export interface SidewalkBandResult {
  id: string;
  material: 'concrete' | 'pavers' | 'tiles';
  baseColor: ColorHex;
  jointColor: ColorHex;
  jointSpacing: number;
  expansionJointSpacing: number;
  wear: number;
  stained: boolean;
}

export interface SidewalkSurfaceResult {
  baseColor: ColorHex;
  bands: SidewalkBandResult[];
}

/** Complete street-level ground for one era. */
export interface StreetSurfaceResult {
  asphalt: AsphaltSurfaceResult;
  sidewalks: SidewalkSurfaceResult;
  curbs: CurbResult[];
}

// ---------------------------------------------------------------------------
// Per-era street character
// ---------------------------------------------------------------------------

interface EraStreetSpec {
  centerLineStyle: 'none' | 'single' | 'double';
  centerLineColor: ColorHex;
  centerLineWidth: number;
  centerLineDashes: number | null;
  edgeLine: 'none' | 'dashed' | 'solid';
  edgeColor: ColorHex;
  crosswalkBars: number;
  crosswalkColor: ColorHex;
  stopLineColor: ColorHex;
  bikeLane: 'none' | 'dashed' | 'green_band';
  bikeStripeColor: ColorHex;
  reflectors: 'none' | 'amber' | 'solar';
  reflectorColor: ColorHex;
  asphaltWear: number;
  crackDensity: number;
  textureGrain: number;
  patchCount: number;
  patchTone: ColorHex;
  drainCountPerSide: number;
  manholeCountPerAxis: number;
  curbColor: ColorHex;
  curbWear: number;
  sidewalkMaterial: 'concrete' | 'pavers' | 'tiles';
  sidewalkJointColor: ColorHex;
  sidewalkJointSpacing: number;
  sidewalkWear: number;
  sidewalkStained: boolean;
}

/** Road markings and ground wear evolved for every timeline stop. */
const ERA_STREET_SPECS: Record<EraId, EraStreetSpec> = {
  // Wartime 1945: white center line, no edge lines, well-used pavement.
  1945: {
    centerLineStyle: 'single',
    centerLineColor: '#e8e4da',
    centerLineWidth: 0.18,
    centerLineDashes: null,
    edgeLine: 'none',
    edgeColor: '#e8e4da',
    crosswalkBars: 5,
    crosswalkColor: '#e6e2d8',
    stopLineColor: '#e6e2d8',
    bikeLane: 'none',
    bikeStripeColor: '#e6e2d8',
    reflectors: 'none',
    reflectorColor: '#b8b4ac',
    asphaltWear: 0.45,
    crackDensity: 0.35,
    textureGrain: 0.8,
    patchCount: 9,
    patchTone: '#3f3a36',
    drainCountPerSide: 6,
    manholeCountPerAxis: 4,
    curbColor: '#9aa0a0',
    curbWear: 0.5,
    sidewalkMaterial: 'concrete',
    sidewalkJointColor: '#b9b0a0',
    sidewalkJointSpacing: 2.2,
    sidewalkWear: 0.4,
    sidewalkStained: true,
  },
  // Mid-century 1965: yellow center line, dashed edge lines, fresh concrete.
  1965: {
    centerLineStyle: 'double',
    centerLineColor: '#f2c531',
    centerLineWidth: 0.12,
    centerLineDashes: null,
    edgeLine: 'dashed',
    edgeColor: '#f2f2f0',
    crosswalkBars: 6,
    crosswalkColor: '#f2f2f0',
    stopLineColor: '#f2f2f0',
    bikeLane: 'none',
    bikeStripeColor: '#f2f2f0',
    reflectors: 'none',
    reflectorColor: '#d8d6d2',
    asphaltWear: 0.3,
    crackDensity: 0.22,
    textureGrain: 0.9,
    patchCount: 6,
    patchTone: '#414147',
    drainCountPerSide: 7,
    manholeCountPerAxis: 4,
    curbColor: '#c9c9c6',
    curbWear: 0.25,
    sidewalkMaterial: 'concrete',
    sidewalkJointColor: '#c9c4b8',
    sidewalkJointSpacing: 2.4,
    sidewalkWear: 0.2,
    sidewalkStained: false,
  },
  // Smoggy neon 1985: faded yellow, cracked asphalt, tar everywhere.
  1985: {
    centerLineStyle: 'double',
    centerLineColor: '#cfae2b',
    centerLineWidth: 0.12,
    centerLineDashes: null,
    edgeLine: 'dashed',
    edgeColor: '#d8d6d2',
    crosswalkBars: 7,
    crosswalkColor: '#d8d6d2',
    stopLineColor: '#d8d6d2',
    bikeLane: 'none',
    bikeStripeColor: '#d8d6d2',
    reflectors: 'amber',
    reflectorColor: '#d05a1f',
    asphaltWear: 0.6,
    crackDensity: 0.5,
    textureGrain: 0.7,
    patchCount: 14,
    patchTone: '#35353a',
    drainCountPerSide: 7,
    manholeCountPerAxis: 4,
    curbColor: '#a8a29a',
    curbWear: 0.55,
    sidewalkMaterial: 'pavers',
    sidewalkJointColor: '#8a8480',
    sidewalkJointSpacing: 1.1,
    sidewalkWear: 0.5,
    sidewalkStained: true,
  },
  // Clean glass 2005: bright markings, bike lanes, reflective crosswalks.
  2005: {
    centerLineStyle: 'double',
    centerLineColor: '#f0c21f',
    centerLineWidth: 0.14,
    centerLineDashes: null,
    edgeLine: 'solid',
    edgeColor: '#f4f4f4',
    crosswalkBars: 8,
    crosswalkColor: '#f4f4f4',
    stopLineColor: '#f4f4f4',
    bikeLane: 'dashed',
    bikeStripeColor: '#f4f4f4',
    reflectors: 'solar',
    reflectorColor: '#dfe8ee',
    asphaltWear: 0.3,
    crackDensity: 0.18,
    textureGrain: 1.0,
    patchCount: 5,
    patchTone: '#33363b',
    drainCountPerSide: 8,
    manholeCountPerAxis: 5,
    curbColor: '#cfd2d6',
    curbWear: 0.15,
    sidewalkMaterial: 'pavers',
    sidewalkJointColor: '#b8bec4',
    sidewalkJointSpacing: 1.0,
    sidewalkWear: 0.12,
    sidewalkStained: false,
  },
  // Green-glass EV era 2025: painted cycle tracks, high-vis crosswalks, new asphalt.
  2025: {
    centerLineStyle: 'double',
    centerLineColor: '#f2c531',
    centerLineWidth: 0.16,
    centerLineDashes: null,
    edgeLine: 'solid',
    edgeColor: '#ffffff',
    crosswalkBars: 8,
    crosswalkColor: '#ffffff',
    stopLineColor: '#ffffff',
    bikeLane: 'green_band',
    bikeStripeColor: '#ffffff',
    reflectors: 'solar',
    reflectorColor: '#f4fbff',
    asphaltWear: 0.15,
    crackDensity: 0.1,
    textureGrain: 1.2,
    patchCount: 3,
    patchTone: '#2e3136',
    drainCountPerSide: 8,
    manholeCountPerAxis: 6,
    curbColor: '#b9cfc4',
    curbWear: 0.05,
    sidewalkMaterial: 'tiles',
    sidewalkJointColor: '#9cc7b0',
    sidewalkJointSpacing: 0.6,
    sidewalkWear: 0.05,
    sidewalkStained: false,
  },
};

// Road geometry derived from BlockLayoutDimensions defaults.
const ROAD_HALF = 7.0;
const CENTER_CLEAR = 9.5;
const EDGE_LINE_OFFSET = 0.55;
const BIKE_INNER_OFFSET = 5.72;
const BIKE_OUTER_OFFSET = 6.82;
const DRAIN_OFFSET = 0.1;
const DRAIN_SPAN = 78.0;
const MANHOLE_BASE_OFFSETS = [-64, -32, 32, 64];
const MANHOLE_EXTRA_OFFSET = 16.0;
const MANHOLE_MIN_CLEAR = 4.0;

interface Span {
  start: number;
  end: number;
}

function splitDashes(start: number, end: number, dash: number, gap: number): Span[] {
  const spans: Span[] = [];
  let s = start;
  while (s < end) {
    const e = Math.min(s + dash, end);
    if (e > s) {
      spans.push({ start: s, end: e });
    }
    s += dash + gap;
  }
  return spans;
}

function lineAlongX(x0: number, x1: number, zCenter: number, halfThickness: number): MarkingSegment {
  return { minX: x0, maxX: x1, minZ: zCenter - halfThickness, maxZ: zCenter + halfThickness };
}

function lineAlongZ(z0: number, z1: number, xCenter: number, halfThickness: number): MarkingSegment {
  return { minX: xCenter - halfThickness, maxX: xCenter + halfThickness, minZ: z0, maxZ: z1 };
}

/** Dash gap matching the dash length for uniform broken lines. */
function dashesFor(style: 'solid' | 'dashed' | 'double' | 'bars'): number | null {
  return style === 'dashed' ? 3 : null;
}

// ---------------------------------------------------------------------------
// Marking & detail builders
// ---------------------------------------------------------------------------

function buildCenterLine(spec: EraStreetSpec, halfWidth: number, halfDepth: number): MarkingLine | null {
  if (spec.centerLineStyle === 'none') {
    return null;
  }
  const dash = spec.centerLineDashes;
  const dashLen = dash ?? 999;
  const ewRanges = splitDashes(-halfWidth + 1, -CENTER_CLEAR, dashLen, dashLen).concat(
    splitDashes(CENTER_CLEAR, halfWidth - 1, dashLen, dashLen),
  );
  const nsRanges = splitDashes(-halfDepth + 1, -CENTER_CLEAR, dashLen, dashLen).concat(
    splitDashes(CENTER_CLEAR, halfDepth - 1, dashLen, dashLen),
  );

  const half = spec.centerLineWidth / 2;
  const segments: MarkingSegment[] = [];
  if (spec.centerLineStyle === 'double') {
    // Two parallel lines: one each side of the carriageway center.
    for (const span of ewRanges) {
      segments.push(lineAlongX(span.start, span.end, -0.12, 0.06));
      segments.push(lineAlongX(span.start, span.end, 0.12, 0.06));
    }
    for (const span of nsRanges) {
      segments.push(lineAlongZ(span.start, span.end, -0.12, 0.06));
      segments.push(lineAlongZ(span.start, span.end, 0.12, 0.06));
    }
  } else {
    for (const span of ewRanges) {
      segments.push(lineAlongX(span.start, span.end, 0, half));
    }
    for (const span of nsRanges) {
      segments.push(lineAlongZ(span.start, span.end, 0, half));
    }
  }
  return {
    id: `marking-center-${spec.centerLineStyle}`,
    kind: 'center_line',
    style: spec.centerLineStyle,
    color: spec.centerLineColor,
    width: spec.centerLineWidth,
    glow: 0,
    segments,
  };
}

function buildEdgeLines(spec: EraStreetSpec, halfWidth: number, halfDepth: number): MarkingLine[] {
  if (spec.edgeLine === 'none') {
    return [];
  }
  const dash = dashesFor(spec.edgeLine === 'dashed' ? 'dashed' : 'solid');
  const dashLen = dash ?? 999;
  const half = 0.1;
  const offset = ROAD_HALF - EDGE_LINE_OFFSET;
  const ewRanges = splitDashes(-halfWidth + 1, -CENTER_CLEAR, dashLen, dashLen).concat(
    splitDashes(CENTER_CLEAR, halfWidth - 1, dashLen, dashLen),
  );
  const nsRanges = splitDashes(-halfDepth + 1, -CENTER_CLEAR, dashLen, dashLen).concat(
    splitDashes(CENTER_CLEAR, halfDepth - 1, dashLen, dashLen),
  );
  const lines: MarkingLine[] = [];
  const configs = [
    { id: 'ew-pos', center: offset, alongX: true },
    { id: 'ew-neg', center: -offset, alongX: true },
    { id: 'ns-pos', center: offset, alongX: false },
    { id: 'ns-neg', center: -offset, alongX: false },
  ];
  for (const cfg of configs) {
    const segments: MarkingSegment[] = [];
    const ranges = cfg.alongX ? ewRanges : nsRanges;
    for (const span of ranges) {
      segments.push(cfg.alongX ? lineAlongX(span.start, span.end, cfg.center, half) : lineAlongZ(span.start, span.end, cfg.center, half));
    }
    lines.push({
      id: `marking-edge-${cfg.id}`,
      kind: 'edge_line',
      style: spec.edgeLine,
      color: spec.edgeColor,
      width: 0.2,
      glow: 0,
      segments,
    });
  }
  return lines;
}

function crosswalkMarking(cw: Crosswalk, bars: number, color: ColorHex, glow: number, index: number): MarkingLine {
  const b = cw.bounds;
  const walkingAlongX = b.maxX - b.minX >= b.maxZ - b.minZ;
  const segments: MarkingSegment[] = [];
  if (walkingAlongX) {
    const step = (b.maxX - b.minX) / bars;
    const barW = step * 0.68;
    for (let i = 0; i < bars; i += 1) {
      const x0 = b.minX + i * step + (step - barW) / 2;
      segments.push({ minX: x0, maxX: x0 + barW, minZ: b.minZ, maxZ: b.maxZ });
    }
  } else {
    const step = (b.maxZ - b.minZ) / bars;
    const barW = step * 0.68;
    for (let i = 0; i < bars; i += 1) {
      const z0 = b.minZ + i * step + (step - barW) / 2;
      segments.push({ minX: b.minX, maxX: b.maxX, minZ: z0, maxZ: z0 + barW });
    }
  }
  return {
    id: `marking-crosswalk-${index}-${cw.id}`,
    kind: 'crosswalk',
    style: 'bars',
    color,
    width: 0.7,
    glow,
    segments,
  };
}

function buildStopLines(spec: EraStreetSpec): MarkingLine {
  // One stop bar per approach, just before its crosswalk, inset from the curb.
  return {
    id: 'marking-stop-lines',
    kind: 'stop_line',
    style: 'solid',
    color: spec.stopLineColor,
    width: 0.3,
    glow: 0,
    segments: [
      // Eastbound (Market St, north half) waiting for Main Ave traffic.
      { minX: -10.9, maxX: -10.6, minZ: 0.4, maxZ: 6.7 },
      // Westbound (Market St, south half).
      { minX: 10.6, maxX: 10.9, minZ: -6.7, maxZ: -0.4 },
      // Northbound (Main Ave, east half).
      { minX: 0.4, maxX: 6.7, minZ: -10.9, maxZ: -10.6 },
      // Southbound (Main Ave, west half).
      { minX: -6.7, maxX: -0.4, minZ: 10.6, maxZ: 10.9 },
    ],
  };
}

interface BikeLaneResult {
  stripe: MarkingLine | null;
  band: MarkingLine | null;
  pictograms: GroundDetail[];
}

function buildBikeLanes(spec: EraStreetSpec, halfWidth: number, halfDepth: number, rng: Rng): BikeLaneResult {
  if (spec.bikeLane === 'none') {
    return { stripe: null, band: null, pictograms: [] };
  }
  const dash = dashesFor(spec.bikeLane === 'dashed' ? 'dashed' : 'solid');
  const dashLen = dash ?? 999;
  const half = 0.08;
  const ewRanges = splitDashes(-halfWidth + 1, -CENTER_CLEAR, dashLen, dashLen).concat(
    splitDashes(CENTER_CLEAR, halfWidth - 1, dashLen, dashLen),
  );
  const nsRanges = splitDashes(-halfDepth + 1, -CENTER_CLEAR, dashLen, dashLen).concat(
    splitDashes(CENTER_CLEAR, halfDepth - 1, dashLen, dashLen),
  );

  const stripeSegments: MarkingSegment[] = [];
  const bandSegments: MarkingSegment[] = [];
  const configs = [
    { id: 'ew-pos', center: BIKE_INNER_OFFSET, alongX: true },
    { id: 'ew-neg', center: -BIKE_INNER_OFFSET, alongX: true },
    { id: 'ns-pos', center: BIKE_INNER_OFFSET, alongX: false },
    { id: 'ns-neg', center: -BIKE_INNER_OFFSET, alongX: false },
  ];
  for (const cfg of configs) {
    const ranges = cfg.alongX ? ewRanges : nsRanges;
    for (const span of ranges) {
      stripeSegments.push(
        cfg.alongX ? lineAlongX(span.start, span.end, cfg.center, half) : lineAlongZ(span.start, span.end, cfg.center, half),
      );
    }
    if (spec.bikeLane === 'green_band') {
      const inner = cfg.center > 0 ? BIKE_INNER_OFFSET : -BIKE_OUTER_OFFSET;
      const outer = cfg.center > 0 ? BIKE_OUTER_OFFSET : -BIKE_INNER_OFFSET;
      for (const span of ranges) {
        if (cfg.alongX) {
          bandSegments.push({ minX: span.start, maxX: span.end, minZ: inner, maxZ: outer });
        } else {
          bandSegments.push({ minX: inner, maxX: outer, minZ: span.start, maxZ: span.end });
        }
      }
    }
  }

  const stripe: MarkingLine = {
    id: 'marking-bike-stripe',
    kind: 'bike_lane',
    style: spec.bikeLane === 'dashed' ? 'dashed' : 'solid',
    color: spec.bikeStripeColor,
    width: 0.16,
    glow: 0,
    segments: stripeSegments,
  };

  const band: MarkingLine | null =
    spec.bikeLane === 'green_band'
      ? {
          id: 'marking-bike-green-band',
          kind: 'bike_lane',
          style: 'solid',
          color: '#4fae6a',
          width: BIKE_OUTER_OFFSET - BIKE_INNER_OFFSET,
          glow: 0,
          segments: bandSegments,
        }
      : null;

  // Painted bike pictograms every ~24m inside the cycle track.
  const pictograms: GroundDetail[] = [];
  let p = 0;
  for (let pos = -72; pos <= 72; pos += 24) {
    const x = pos + rng.range(-1.5, 1.5);
    const z = BIKE_INNER_OFFSET + 0.55 + rng.range(-0.2, 0.2);
    pictograms.push({ id: `bike-pictogram-${p}`, kind: 'bike_pictogram', position: { x, y: 0.01, z }, radius: 0.9, rotation: 0, color: '#ffffff' });
    pictograms.push({ id: `bike-pictogram-${p + 1}`, kind: 'bike_pictogram', position: { x: -x, y: 0.01, z }, radius: 0.9, rotation: Math.PI, color: '#ffffff' });
    p += 2;
  }
  return { stripe, band, pictograms };
}

function buildDrains(spec: EraStreetSpec, rng: Rng): GroundDetail[] {
  const drains: GroundDetail[] = [];
  let n = 0;
  const place = (axis: 'x' | 'z', sign: number) => {
    const count = spec.drainCountPerSide;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const along = -DRAIN_SPAN + 2 * DRAIN_SPAN * t + rng.range(-2, 2);
      if (Math.abs(along) < 9.2) {
        continue;
      }
      const perp = sign * (ROAD_HALF - DRAIN_OFFSET);
      const position = axis === 'x' ? { x: along, y: 0.005, z: perp } : { x: perp, y: 0.005, z: along };
      drains.push({ id: `drain-${n}`, kind: 'drain', position, radius: 0.34, rotation: rng.range(0, Math.PI), color: '#4a4a4e' });
      n += 1;
    }
  };
  place('x', 1);
  place('x', -1);
  place('z', 1);
  place('z', -1);
  return drains;
}

function buildManholes(spec: EraStreetSpec, rng: Rng): GroundDetail[] {
  const offsets = [...MANHOLE_BASE_OFFSETS];
  const extra = spec.manholeCountPerAxis - MANHOLE_BASE_OFFSETS.length;
  for (let i = 0; i < extra; i += 1) {
    offsets.push(i % 2 === 0 ? MANHOLE_EXTRA_OFFSET : -MANHOLE_EXTRA_OFFSET);
  }
  offsets.sort((a, b) => a - b);

  const manholes: GroundDetail[] = [];
  let n = 0;
  for (const o of offsets) {
    if (Math.abs(o) < MANHOLE_MIN_CLEAR) {
      continue;
    }
    manholes.push({
      id: `manhole-ew-${n}`,
      kind: 'manhole',
      position: { x: o + rng.range(-0.6, 0.6), y: 0.005, z: 0 },
      radius: 0.55,
      rotation: rng.range(0, Math.PI / 2),
      color: '#3d3d42',
    });
    manholes.push({
      id: `manhole-ns-${n}`,
      kind: 'manhole',
      position: { x: 0, y: 0.005, z: o + rng.range(-0.6, 0.6) },
      radius: 0.55,
      rotation: rng.range(0, Math.PI / 2),
      color: '#3d3d42',
    });
    n += 1;
  }
  // One catch-basin at the intersection.
  manholes.push({
    id: 'manhole-intersection',
    kind: 'manhole',
    position: { x: 0, y: 0.005, z: 0 },
    radius: 0.6,
    rotation: 0,
    color: '#3d3d42',
  });
  return manholes;
}

function buildReflectors(spec: EraStreetSpec): GroundDetail[] {
  if (spec.reflectors === 'none') {
    return [];
  }
  const reflectors: GroundDetail[] = [];
  let n = 0;
  for (let pos = -80; pos <= 80; pos += 5) {
    if (Math.abs(pos) < CENTER_CLEAR) {
      continue;
    }
    reflectors.push({ id: `reflector-${n}`, kind: 'reflector', position: { x: pos, y: 0.01, z: 0 }, radius: 0.1, rotation: 0, color: spec.reflectorColor });
    reflectors.push({ id: `reflector-${n + 1}`, kind: 'reflector', position: { x: 0, y: 0.01, z: pos }, radius: 0.1, rotation: 0, color: spec.reflectorColor });
    n += 2;
  }
  return reflectors;
}

function buildTarPatches(spec: EraStreetSpec, rng: Rng): GroundDetail[] {
  const patches: GroundDetail[] = [];
  const laneZs = [-5.6, -3.4, 3.4, 5.6];
  for (let i = 0; i < spec.patchCount; i += 1) {
    const x = rng.range(-80, 80);
    if (Math.abs(x) < CENTER_CLEAR) {
      continue;
    }
    const z = laneZs[i % laneZs.length]! + rng.range(-0.8, 0.8);
    patches.push({
      id: `tar-patch-${i}`,
      kind: 'tar_patch',
      position: { x, y: 0.012, z },
      radius: rng.range(0.7, 1.7),
      rotation: rng.range(0, Math.PI),
      color: spec.patchTone,
    });
  }
  return patches;
}

// ---------------------------------------------------------------------------
// Sidewalk & curb builders
// ---------------------------------------------------------------------------

function buildSidewalks(layout: BlockLayout, spec: EraStreetSpec, baseColor: ColorHex): SidewalkSurfaceResult {
  const bands: SidewalkBandResult[] = [];
  for (const band of layout.sidewalkBands) {
    bands.push({
      id: band.id,
      material: spec.sidewalkMaterial,
      baseColor,
      jointColor: spec.sidewalkJointColor,
      jointSpacing: spec.sidewalkJointSpacing,
      expansionJointSpacing: spec.sidewalkMaterial === 'concrete' ? 2.4 : Math.max(1.0, spec.sidewalkJointSpacing * 2),
      wear: spec.sidewalkWear,
      stained: spec.sidewalkStained,
    });
  }
  return { baseColor, bands };
}

function buildCurbs(layout: BlockLayout, spec: EraStreetSpec): CurbResult[] {
  const curbs: CurbResult[] = [];
  const segLen = 8.0;
  for (const band of layout.sidewalkBands) {
    const curb = band.curbBand;
    const b = curb.bounds;
    const alongX = b.maxX - b.minX >= b.maxZ - b.minZ;
    const length = alongX ? b.maxX - b.minX : b.maxZ - b.minZ;
    const count = Math.max(1, Math.round(length / segLen));
    const step = length / count;
    const segments: CurbSegment[] = [];
    for (let i = 0; i < count; i += 1) {
      const start = alongX ? b.minX + i * step : b.minZ + i * step;
      const end = start + step;
      segments.push({
        id: `${curb.id}-seg-${i}`,
        minX: alongX ? start : b.minX,
        maxX: alongX ? end : b.maxX,
        minZ: alongX ? b.minZ : start,
        maxZ: alongX ? b.maxZ : end,
        faceHeight: curb.height,
        topWidth: curb.width,
        faceSlope: 0.09,
      });
    }
    curbs.push({
      id: `curb-${curb.id}`,
      bandId: curb.id,
      color: spec.curbColor,
      height: curb.height,
      topWidth: curb.width,
      wear: spec.curbWear,
      segments,
    });
  }
  return curbs;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build the complete street-level ground for one era: asphalt + markings,
 * drains/manholes/reflectors/patches, sidewalk surfaces and curb geometry.
 * Deterministic for a given seed.
 */
export function buildStreetSurface(layout: BlockLayout, era: EraId, seed: number): StreetSurfaceResult {
  const spec = ERA_STREET_SPECS[era];
  const palette = ERA_PALETTES[era];
  const rng = deriveSeedRng(seed, 'street');
  const d = layout.dimensions;
  const halfWidth = d.totalWidth / 2;
  const halfDepth = d.totalDepth / 2;

  const markings: MarkingLine[] = [];
  const center = buildCenterLine(spec, halfWidth, halfDepth);
  if (center !== null) {
    markings.push(center);
  }
  markings.push(...buildEdgeLines(spec, halfWidth, halfDepth));
  const { stripe, band, pictograms } = buildBikeLanes(spec, halfWidth, halfDepth, rng);
  if (stripe !== null) {
    markings.push(stripe);
  }
  if (band !== null) {
    markings.push(band);
  }
  markings.push(buildStopLines(spec));
  const crosswalks = layout.pedestrianNetwork.crosswalks;
  let cwIndex = 0;
  for (const cw of crosswalks) {
    markings.push(crosswalkMarking(cw, spec.crosswalkBars, spec.crosswalkColor, spec.reflectors === 'none' ? 0 : 0.15, cwIndex));
    cwIndex += 1;
  }

  const asphalt: AsphaltSurfaceResult = {
    roadWidth: d.roadWidth,
    baseColor: palette.asphalt,
    patchTone: spec.patchTone,
    wear: spec.asphaltWear,
    crackDensity: spec.crackDensity,
    textureGrain: spec.textureGrain,
    markings,
    drains: buildDrains(spec, rng),
    manholes: buildManholes(spec, rng),
    reflectors: buildReflectors(spec),
    tarPatches: buildTarPatches(spec, rng),
    pictograms,
  };

  return {
    asphalt,
    sidewalks: buildSidewalks(layout, spec, palette.sidewalk),
    curbs: buildCurbs(layout, spec),
  };
}