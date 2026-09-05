/**
 * src/ui/timeline-slider.test.ts — unit tests for the timeline slider math.
 *
 * The DOM-backed dragging/ARIA behaviour is verified end-to-end in the
 * browser; here we pin down the pure geometry that decides stop positions and
 * snapping: five evenly spaced stops (1945 → 2025) and nearest-stop rounding
 * on drag release / track click.
 */

import { describe, expect, it } from 'vitest';

import { ERA_IDS, getEraSpec } from '../eras';
import { clampPercent, eraToPercent, percentToEraIndex } from './TimelineSlider';

const STOP_COUNT = ERA_IDS.length;

describe('timeline slider stops', () => {
  it('exposes exactly the five plan eras in order', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025']);
    expect(STOP_COUNT).toBe(5);
  });

  it('labels every stop with its era year for the tick text', () => {
    for (const id of ERA_IDS) {
      expect(getEraSpec(id).label).toBe(id);
    }
  });
});

describe('eraToPercent / percentToEraIndex', () => {
  it('places each stop at an even fraction of the track', () => {
    expect(eraToPercent(0, STOP_COUNT)).toBe(0);
    expect(eraToPercent(1, STOP_COUNT)).toBe(0.25);
    expect(eraToPercent(2, STOP_COUNT)).toBe(0.5);
    expect(eraToPercent(3, STOP_COUNT)).toBe(0.75);
    expect(eraToPercent(4, STOP_COUNT)).toBe(1);
  });

  it('round-trips: every stop maps back to its own index', () => {
    for (let index = 0; index < STOP_COUNT; index += 1) {
      expect(percentToEraIndex(eraToPercent(index, STOP_COUNT), STOP_COUNT)).toBe(index);
    }
  });

  it('snaps a release position to the nearest stop', () => {
    // 0.3 * 4 = 1.2 -> 1965 (nearest to 0.25).
    expect(percentToEraIndex(0.3, STOP_COUNT)).toBe(1);
    // 0.4 * 4 = 1.6 -> 1985 (nearest to 0.5).
    expect(percentToEraIndex(0.4, STOP_COUNT)).toBe(2);
    // 0.62 * 4 = 2.48 -> 1985 (just left of the 1985/2005 midpoint).
    expect(percentToEraIndex(0.62, STOP_COUNT)).toBe(2);
    // 0.64 * 4 = 2.56 -> 2005 (just right of the midpoint).
    expect(percentToEraIndex(0.64, STOP_COUNT)).toBe(3);
    // End of the track -> 2025.
    expect(percentToEraIndex(0.99, STOP_COUNT)).toBe(4);
  });

  it('clamps out-of-range fractions', () => {
    expect(clampPercent(-0.4)).toBe(0);
    expect(clampPercent(1.6)).toBe(1);
    expect(percentToEraIndex(-2, STOP_COUNT)).toBe(0);
    expect(percentToEraIndex(3, STOP_COUNT)).toBe(4);
  });
});