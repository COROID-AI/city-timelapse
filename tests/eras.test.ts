import {
  ERA_YEARS,
  EraData,
  getEra,
  getEraYears,
  getInterpolatedEra,
  interpolateEra,
} from '../src/scenes/eras';

/** All 10 unordered era transitions among the five canonical years. */
const TRANSITIONS: ReadonlyArray<readonly [number, number]> = [
  [1945, 1965],
  [1945, 1985],
  [1945, 2005],
  [1945, 2025],
  [1965, 1985],
  [1965, 2005],
  [1965, 2025],
  [1985, 2005],
  [1985, 2025],
  [2005, 2025],
];

describe('era registry', () => {
  it('exports exactly the five canonical years', () => {
    expect(ERA_YEARS).toEqual([1945, 1965, 1985, 2005, 2025]);
    expect(getEraYears()).toEqual([1945, 1965, 1985, 2005, 2025]);
    expect(new Set(getEraYears()).size).toBe(5);
  });

  it('getEra returns a typed EraData for every registered year', () => {
    for (const year of ERA_YEARS) {
      const era: EraData = getEra(year);
      expect(era.year).toBe(year);
      // Every transformed aspect is present and non-placeholder.
      expect(era.architecture.styleId).toBeTruthy();
      expect(era.architecture.facadePalette.length).toBeGreaterThan(0);
      expect(era.architecture.maxHeightM).toBeGreaterThan(
        era.architecture.minHeightM,
      );
      expect(era.vehicles.fleet.length).toBeGreaterThan(0);
      expect(era.storefronts.styleId).toBeTruthy();
      expect(era.advertisements.count).toBeGreaterThan(0);
      expect(era.advertisements.medium).toBeTruthy();
      expect(era.pedestrians.styleId).toBeTruthy();
      expect(era.pedestrians.palette.length).toBeGreaterThan(0);
      expect(era.atmosphere.profileId).toBeTruthy();
      expect(era.sfx.id).toBeTruthy();
      expect(era.sfx.ambient).toBeTruthy();
    }
  });

  it('every era carries distinct authentic values across all aspects', () => {
    const eras = ERA_YEARS.map(getEra);
    const styleIds = new Set(eras.map((e) => e.architecture.styleId));
    const vehicleFleets = new Set(
      eras.map((e) => e.vehicles.fleet.map((v) => v.id).join('|')),
    );
    const outfitIds = new Set(eras.map((e) => e.pedestrians.styleId));
    const sfxIds = new Set(eras.map((e) => e.sfx.id));
    // No shared placeholder values.
    expect(styleIds.size).toBe(5);
    expect(vehicleFleets.size).toBe(5);
    expect(outfitIds.size).toBe(5);
    expect(sfxIds.size).toBe(5);
    // Numeric aspects genuinely differ between consecutive eras.
    for (let i = 1; i < eras.length; i++) {
      expect(eras[i].atmosphere.saturation).not.toBe(eras[i - 1].atmosphere.saturation);
      expect(eras[i].architecture.maxHeightM).not.toBe(eras[i - 1].architecture.maxHeightM);
    }
  });

  it('rejects unknown years', () => {
    expect(() => getEra(1999)).toThrow(/Unknown era year/);
  });
});

describe('interpolateEra', () => {
  it('returns exact endpoints at t=0 and t=1 for every transition', () => {
    for (const [a, b] of TRANSITIONS) {
      const from = getEra(a);
      const to = getEra(b);
      expect(interpolateEra(from, to, 0)).toEqual(from);
      expect(interpolateEra(from, to, 1)).toEqual(to);
    }
  });

  it('interpolates numeric aspects deterministically at t=0.5', () => {
    for (const [a, b] of TRANSITIONS) {
      const from = getEra(a);
      const to = getEra(b);
      const mid = interpolateEra(from, to, 0.5);
      const expected = (from.atmosphere.sunGlow + to.atmosphere.sunGlow) / 2;
      expect(mid.atmosphere.sunGlow).toBeCloseTo(expected, 5);
      const expectedHeight =
        (from.architecture.maxHeightM + to.architecture.maxHeightM) / 2;
      expect(mid.architecture.maxHeightM).toBeCloseTo(expectedHeight, 5);
      // Deterministic: same inputs produce identical output.
      expect(interpolateEra(from, to, 0.5)).toEqual(mid);
    }
  });

  it('clamps t outside [0,1]', () => {
    const from = getEra(1945);
    const to = getEra(2025);
    expect(interpolateEra(from, to, -1)).toEqual(from);
    expect(interpolateEra(from, to, 2)).toEqual(to);
  });

  it('returns a fully typed EraData across all ten transitions', () => {
    for (const [a, b] of TRANSITIONS) {
      const out: EraData = interpolateEra(getEra(a), getEra(b), 0.35);
      expect(out.architecture.styleId).toBeTruthy();
      expect(out.vehicles.fleet.length).toBeGreaterThan(0);
      expect(out.storefronts.styleId).toBeTruthy();
      expect(out.advertisements.panelPalette.length).toBeGreaterThan(0);
      expect(out.pedestrians.palette.length).toBeGreaterThan(0);
      expect(out.atmosphere.skyTint.r).toBeGreaterThanOrEqual(0);
      expect(out.atmosphere.skyTint.r).toBeLessThanOrEqual(255);
      expect(out.sfx.ambient).toBeTruthy();
    }
  });
});

describe('getInterpolatedEra contract', () => {
  it('returns a typed EraData for a registered year', () => {
    const era: EraData = getInterpolatedEra(1945, 0.5);
    // Between 1945 and 1965 at t=0.5, the blended year is 1955.
    expect(era.year).toBe(1955);
    expect(era.atmosphere.dust).toBeGreaterThanOrEqual(0);
    expect(era.atmosphere.dust).toBeLessThanOrEqual(1);
  });

  it('holds steady at the final era', () => {
    expect(getInterpolatedEra(2025, 0.5).year).toBe(2025);
  });

  it('rejects unknown years', () => {
    expect(() => getInterpolatedEra(2055, 0.5)).toThrow(/Unknown era year/);
  });
});