/**
 * pedestrianLayer.test.ts — per-era outfit sets, walk patterns and
 * sidewalk/crosswalk route derivation tests for the pedestrian layer.
 *
 * Everything here runs headless in the default Node environment: routes and
 * outfit data are pure geometry/data work that needs no DOM and no WebGL.
 */
import { describe, expect, it } from 'vitest';

import { CROSSWALK, ROAD, SIDEWALK, type Rect } from '../core/blockLayout';
import { ERA_IDS, getEraDefinition, type EraId } from '../eras/eraSystem';
import {
  CROSSING_PATTERNS,
  OUTFIT_PRESETS,
  WALK_PATTERNS,
  buildOutfit,
  deriveCrosswalkLegs,
  deriveSidewalkRoutes,
  generateWalkRoute,
  getCrossingPattern,
  getWalkPattern,
  mulberry32,
  walkPatternFingerprint,
  type Vec2,
} from './pedestrianLayer';

const SIDEWALK_RECTS: readonly Rect[] = [
  SIDEWALK.north,
  SIDEWALK.east,
  SIDEWALK.south,
  SIDEWALK.west,
];

function onSidewalk(point: Vec2): boolean {
  return SIDEWALK_RECTS.some(
    (band) =>
      point.x >= band.minX - 1e-6 &&
      point.x <= band.maxX + 1e-6 &&
      point.z >= band.minZ - 1e-6 &&
      point.z <= band.maxZ + 1e-6,
  );
}

function inRect(point: Vec2, rect: Rect): boolean {
  return (
    point.x >= rect.minX - 1e-6 &&
    point.x <= rect.maxX + 1e-6 &&
    point.z >= rect.minZ - 1e-6 &&
    point.z <= rect.maxZ + 1e-6
  );
}

describe('per-era pedestrian outfit sets', () => {
  it('defines five thematic outfit sets covering every era registry style', () => {
    expect(Object.keys(OUTFIT_PRESETS)).toHaveLength(5);
    for (const eraId of ERA_IDS) {
      const presets = OUTFIT_PRESETS[eraId];
      expect(presets.length).toBeGreaterThanOrEqual(4);
      const registryStyles = getEraDefinition(eraId).outfits.styles;
      for (const preset of presets) {
        // Every garment style is read from the frozen era registry contract.
        expect(registryStyles).toContain(preset.style);
        expect(preset.top.length).toBeGreaterThan(0);
        expect(preset.bottom.length).toBeGreaterThan(0);
        expect(preset.footwear.length).toBeGreaterThan(0);
      }
    }
  });

  it('matches the requested era silhouettes from the user brief', () => {
    // 1945 austerity: fedoras and overcoats.
    expect(
      OUTFIT_PRESETS[1945].some((p) => p.headwear === 'fedora' && p.top === 'overcoat'),
    ).toBe(true);
    // 1965 formal: suits and dresses.
    expect(OUTFIT_PRESETS[1965].some((p) => p.style === 'tailored-suit')).toBe(true);
    expect(OUTFIT_PRESETS[1965].some((p) => p.style === 'pencil-dress')).toBe(true);
    // 1985 casual: windbreakers and workout gear.
    expect(OUTFIT_PRESETS[1985].some((p) => p.style === 'windbreaker')).toBe(true);
    expect(OUTFIT_PRESETS[1985].some((p) => p.style === 'workout-gear')).toBe(true);
    // 2005 streetwear: cargo pants and flip phones.
    expect(OUTFIT_PRESETS[2005].some((p) => p.bottom === 'cargo-pants')).toBe(true);
    expect(
      OUTFIT_PRESETS[2005].some((p) => p.accessory === 'flip-phone' || p.handheld === 'flip-phone'),
    ).toBe(true);
    // 2025 athleisure: athleisure and headphones (wireless earbuds).
    expect(OUTFIT_PRESETS[2025].some((p) => p.style === 'athleisure')).toBe(true);
    expect(
      OUTFIT_PRESETS[2025].some(
        (p) => p.accessory === 'wireless-earbuds' || p.handheld === 'headphones',
      ),
    ).toBe(true);
  });

  it('builds deterministic outfits colored from the era palette', () => {
    for (const eraId of ERA_IDS) {
      const first = buildOutfit(eraId, mulberry32(1234 + eraId));
      // Same seed -> identical outfit; the registry palette is the color source.
      expect(buildOutfit(eraId, mulberry32(1234 + eraId))).toEqual(first);
      expect(first.era).toBe(eraId);
      const palette = getEraDefinition(eraId).outfits.palette;
      for (const color of Object.values(first.colors)) {
        expect(palette).toContain(color);
      }
      expect(OUTFIT_PRESETS[eraId]).toContain(first.preset);
    }
  });
});

describe('per-era walk patterns and crossing behavior', () => {
  it('pins 1945 zebra, 1985 signal and 2025 smart-signal crossings', () => {
    expect(getCrossingPattern(1945).id).toBe('zebra');
    expect(getCrossingPattern(1985).id).toBe('signal');
    expect(getCrossingPattern(1985).pushButton).toBe(true);
    expect(getCrossingPattern(2025).id).toBe('smart-signal');
  });

  it('keeps the crossing pattern registry frozen', () => {
    expect(Object.isFrozen(CROSSING_PATTERNS)).toBe(true);
    expect(Object.isFrozen(CROSSING_PATTERNS[1945])).toBe(true);
    expect(Object.isFrozen(WALK_PATTERNS[1985])).toBe(true);
  });

  it('gives every era a distinct walk-behavior fingerprint', () => {
    const fingerprints = ERA_IDS.map((era) => walkPatternFingerprint(getWalkPattern(era)));
    expect(new Set(fingerprints).size).toBe(ERA_IDS.length);
    for (const eraId of ERA_IDS) {
      const pattern = getWalkPattern(eraId);
      expect(pattern.era).toBe(eraId);
      expect(pattern.speed).toBeGreaterThan(0);
      expect(pattern.stepFrequency).toBeGreaterThan(0);
      expect(pattern.crossingChance).toBeGreaterThanOrEqual(0);
      expect(pattern.crossingChance).toBeLessThanOrEqual(1);
      expect(pattern.crossing.crossSpeed).toBeGreaterThan(0);
      expect(pattern.crossing.waitSeconds).toBeGreaterThan(0);
    }
  });

  it('rejects unknown eras when looking up patterns', () => {
    expect(() => getCrossingPattern(2055 as unknown as EraId)).toThrow(/unknown era/i);
    expect(() => getWalkPattern(2055 as unknown as EraId)).toThrow(/unknown era/i);
  });
});

describe('sidewalk routes and crosswalk crossings', () => {
  it('derives closed sidewalk routes from the shared sidewalk ring', () => {
    const routes = deriveSidewalkRoutes();
    expect(routes).toHaveLength(4);
    for (const route of routes) {
      expect(route.segments).toHaveLength(4);
      for (const segment of route.segments) {
        expect(segment.kind).toBe('sidewalk');
        expect(onSidewalk(segment.from)).toBe(true);
        expect(onSidewalk(segment.to)).toBe(true);
      }
      const first = route.segments[0].from;
      const last = route.segments[route.segments.length - 1].to;
      expect(last.x).toBeCloseTo(first.x, 6);
      expect(last.z).toBeCloseTo(first.z, 6);
    }
  });

  it('derives eight crosswalk legs from the shared crosswalk strips', () => {
    const legs = deriveCrosswalkLegs();
    expect(legs).toHaveLength(8);
    const stripRects: readonly Rect[] = [
      CROSSWALK.northWest,
      CROSSWALK.northEast,
      CROSSWALK.eastNorth,
      CROSSWALK.eastSouth,
      CROSSWALK.southEast,
      CROSSWALK.southWest,
      CROSSWALK.westSouth,
      CROSSWALK.westNorth,
    ];
    for (const leg of legs) {
      expect(stripRects).toContain(leg.strip);
      // Entry and exit stay inside the strip, which spans the full road band.
      expect(inRect(leg.entry, leg.strip)).toBe(true);
      expect(inRect(leg.exit, leg.strip)).toBe(true);
      const travel = leg.axis === 'z' ? leg.exit.z - leg.entry.z : leg.exit.x - leg.entry.x;
      expect(Math.abs(travel)).toBeGreaterThan(ROAD.width - 1.1);
    }
    // Sample pinning: the NW strip crosses the north road northwards at x=-65.
    const northWest = legs.find((leg) => leg.id === 'northWest');
    expect(northWest).toBeDefined();
    expect(northWest!.axis).toBe('z');
    expect(northWest!.direction).toBe(1);
    expect(northWest!.entry.x).toBe(-65);
    expect(northWest!.entry.z).toBe(53);
    expect(northWest!.exit.z).toBeCloseTo(66.5, 6);
  });

  it('generates ring and crossing walk routes that respect the layout', () => {
    const ring = generateWalkRoute(mulberry32(99), 1985, { forceCrossing: false });
    expect(ring.segments.every((s) => s.kind === 'sidewalk')).toBe(true);
    expect(ring.segments.every((s) => onSidewalk(s.from) && onSidewalk(s.to))).toBe(true);

    const legs = deriveCrosswalkLegs();
    for (const eraId of ERA_IDS) {
      const crossing = generateWalkRoute(mulberry32(7 + eraId), eraId, { forceCrossing: true });
      expect(crossing.segments.some((s) => s.kind === 'crossing')).toBe(true);
      for (const segment of crossing.segments) {
        if (segment.kind === 'sidewalk') {
          expect(onSidewalk(segment.from)).toBe(true);
          expect(onSidewalk(segment.to)).toBe(true);
        } else {
          expect(segment.crossingLegId).toBeDefined();
          const leg = legs.find((l) => l.id === segment.crossingLegId);
          expect(leg).toBeDefined();
          expect(segment.from).toEqual(leg!.entry);
          expect(segment.to).toEqual(leg!.exit);
        }
      }
    }
  });
});