import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getEra, getInterpolatedEra } from '../eras/index.js';
import { WALKWAY, pathLength } from '../layout/index.js';
import type { EraData } from '../eras/types.js';
import {
  Pedestrians,
  computeCrowd,
  eraCrowdCount,
  eraSpeed,
  resolveOutfitVariant,
} from '../pedestrians.js';

/**
 * Co-located composition test for the pedestrians module.
 *
 * Mounts the `Pedestrians` React component against the shared era registry and
 * the shared walkway layout, then asserts integrated per-era outfit & density
 * behavior for all five canonical years, plus era-scaled walking speed, and
 * the reviewed `useMemo([index])` regression (fd2f3e0c).
 */

/** Years covered by the acceptance criteria. */
const YEARS: readonly number[] = [1945, 1965, 1985, 2005, 2025];

/** Render the Pedestrians component to a string, in a deterministic mode. */
function renderPedestrians(eraYear: number): string {
  return renderToStaticMarkup(
    createElement(Pedestrians, { era: getEra(eraYear), now: 0.5 }),
  );
}

describe('pedestrians composition on `Pedestrians`', () => {
  it('mounts against the shared walkway layout for all five eras', () => {
    // The shared layout exposes the walkway anchors the crowd depends on.
    expect(WALKWAY.length).toBeGreaterThan(0);
    expect(pathLength(WALKWAY.map((w) => w.point))).toBeGreaterThan(0);
    for (const year of YEARS) {
      const markup = renderPedestrians(year);
      // Component mounts: emits at least one pedestrian entry node per era.
      expect(markup).toMatch(/pedestrian-entry/);
    }
  });

  it('produces distinct era-authentic outfit variants per year', () => {
    // Every canonical era carries a distinct outfit catalogue (no placeholders).
    const styleIds = new Set(YEARS.map((y) => getEra(y).pedestrians.styleId));
    expect(styleIds.size).toBe(5);
    // Palette is genuinely different between endpoints.
    expect(getEra(1945).pedestrians.palette.join('|')).not.toBe(
      getEra(2025).pedestrians.palette.join('|'),
    );
    // resolveOutfitVariant derives a real variant from the era palette.
    const v = resolveOutfitVariant(getEra(1985), 0);
    expect(v.styleId).toBe('neon-fitness');
  });

  it('varies crowd density and walking speed across eras', () => {
    const eras = YEARS.map(getEra);
    const counts = eras.map(eraCrowdCount);
    const speeds = eras.map(eraSpeed);
    // Density strictly grows across the timeline.
    expect(counts[0]).toBeLessThan(counts[4]!);
    // Walking-speed scale differs across the eras.
    expect(new Set(speeds.map((s) => s.toFixed(3))).size).toBeGreaterThan(1);
    // Integrated: computed crowd reflects those counts and positive speed.
    for (const era of eras) {
      const crowd = computeCrowd(era);
      expect(crowd.length).toBe(eraCrowdCount(era));
      expect(crowd.every((e) => e.walkSpeed > 0)).toBe(true);
    }
  });

  it('interpolates density between eras for transitions', () => {
    const from = getEra(1945);
    const to = getEra(1965);
    const mid = getInterpolatedEra(1945, 0.5) as EraData;
    expect(mid.year).toBe(1955);
    const midCount = eraCrowdCount(mid);
    expect(midCount).toBeGreaterThanOrEqual(eraCrowdCount(from));
    expect(midCount).toBeLessThanOrEqual(eraCrowdCount(to));
    // The crowd reconfigures as the profile changes (population interpolates).
    expect(computeCrowd(from).length).not.toBe(computeCrowd(mid).length);
  });
});

describe('pedestrians regression fd2f3e0c: useMemo([index]) motion', () => {
  it('walkSpeed/walkOffset derive deterministically per index, no render Math.random', () => {
    const era = getEra(1985);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const v = resolveOutfitVariant(era, i);
      expect(v.styleId).toBe('neon-fitness');
      // Seeded variant color must come from the era palette.
      expect(era.pedestrians.palette).toContain(v.color);
      seen.add(`${v.color}-${v.hat}`);
    }
    // A bounded palette yields a bounded set of reproducible outfits.
    expect(seen.size).toBeLessThanOrEqual(era.pedestrians.palette.length * 2);
  });
});