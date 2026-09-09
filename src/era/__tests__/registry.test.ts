import { describe, expect, it } from 'vitest';
import { createEraRegistry, eraRegistry } from '../registry';
import {
  channelToGlobalProgress,
  DEFAULT_ERA,
  ERAS,
  eraToYearNumber,
  getEraByIndex,
  getEraIndex,
  getNextEra,
  getPreviousEra,
  globalProgressToChannel,
  isEraId,
  yearNumberToEra,
} from '../years';

describe('years module and helpers', () => {
  it('defines the five fixed eras in order', () => {
    expect(ERAS).toEqual(['1945', '1965', '1985', '2005', '2025']);
    expect(DEFAULT_ERA).toBe('1945');
  });

  it('validates EraId with isEraId', () => {
    expect(isEraId('1945')).toBe(true);
    expect(isEraId('1965')).toBe(true);
    expect(isEraId('1985')).toBe(true);
    expect(isEraId('2005')).toBe(true);
    expect(isEraId('2025')).toBe(true);
    expect(isEraId('1950')).toBe(false);
    expect(isEraId('2055')).toBe(false);
    expect(isEraId(1945)).toBe(false);
    expect(isEraId(null)).toBe(false);
  });

  it('translates era index correctly', () => {
    expect(getEraIndex('1945')).toBe(0);
    expect(getEraIndex('1985')).toBe(2);
    expect(getEraIndex('2025')).toBe(4);

    expect(getEraByIndex(0)).toBe('1945');
    expect(getEraByIndex(2)).toBe('1985');
    expect(getEraByIndex(4)).toBe('2025');
    expect(getEraByIndex(5)).toBeUndefined();
    expect(getEraByIndex(-1)).toBeUndefined();
  });

  it('navigates next and previous eras with boundary protection', () => {
    expect(getNextEra('1945')).toBe('1965');
    expect(getNextEra('2005')).toBe('2025');
    expect(getNextEra('2025')).toBeUndefined();

    expect(getPreviousEra('2025')).toBe('2005');
    expect(getPreviousEra('1965')).toBe('1945');
    expect(getPreviousEra('1945')).toBeUndefined();
  });

  it('converts between EraId and numeric years', () => {
    expect(eraToYearNumber('1945')).toBe(1945);
    expect(eraToYearNumber('2025')).toBe(2025);

    expect(yearNumberToEra(1945)).toBe('1945');
    expect(yearNumberToEra(1985)).toBe('1985');
    expect(yearNumberToEra(2000)).toBeUndefined();
  });

  it('converts global progress 0..1 to channels', () => {
    expect(globalProgressToChannel(0)).toEqual({ fromEra: '1945', toEra: '1965', t: 0 });
    expect(globalProgressToChannel(0.25)).toEqual({ fromEra: '1965', toEra: '1985', t: 0 });
    expect(globalProgressToChannel(0.5)).toEqual({ fromEra: '1985', toEra: '2005', t: 0 });
    expect(globalProgressToChannel(0.75)).toEqual({ fromEra: '2005', toEra: '2025', t: 0 });
    expect(globalProgressToChannel(1.0)).toEqual({ fromEra: '2025', toEra: '2025', t: 0 });

    // Mid-segment
    const mid1 = globalProgressToChannel(0.125);
    expect(mid1.fromEra).toBe('1945');
    expect(mid1.toEra).toBe('1965');
    expect(mid1.t).toBeCloseTo(0.5, 6);
  });

  it('converts channels back to global progress', () => {
    expect(channelToGlobalProgress({ fromEra: '1945', toEra: '1945', t: 0 })).toBe(0);
    expect(channelToGlobalProgress({ fromEra: '1945', toEra: '1965', t: 0.5 })).toBeCloseTo(0.125, 6);
    expect(channelToGlobalProgress({ fromEra: '1965', toEra: '1985', t: 0 })).toBe(0.25);
    expect(channelToGlobalProgress({ fromEra: '2025', toEra: '2025', t: 0 })).toBe(1.0);
  });
});

describe('era registry completeness and validation', () => {
  it('instantiates and validates all 5 eras', () => {
    const registry = createEraRegistry();
    expect(registry.validate()).toBe(true);
    expect(eraRegistry.validate()).toBe(true);
  });

  it('contains valid data for every era in ERAS', () => {
    const registry = createEraRegistry();
    const allEras = registry.getAllEras();

    expect(allEras).toHaveLength(5);
    expect(allEras.map((e) => e.id)).toEqual(['1945', '1965', '1985', '2005', '2025']);

    for (const era of allEras) {
      // General
      expect(era.label).toBe(era.id);
      expect(era.year).toBe(Number(era.id));
      expect(era.subtitle).toBeTruthy();
      expect(era.summary).toBeTruthy();

      // Buildings
      expect(era.buildings.styleName).toBeTruthy();
      expect(era.buildings.facadePalette.length).toBeGreaterThan(0);
      expect(era.buildings.heightScale).toBeGreaterThan(0);
      expect(era.buildings.frameColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(era.buildings.windowEmissiveColor).toMatch(/^#[0-9a-fA-F]{6}$/);

      // Signage
      expect(era.signage.primaryTech).toBeTruthy();
      expect(era.signage.typographyStyle).toBeTruthy();
      expect(era.signage.colorPalette.length).toBeGreaterThan(0);
      expect(era.signage.signs.length).toBeGreaterThan(0);

      // Vehicles
      expect(era.vehicles.themeName).toBeTruthy();
      expect(era.vehicles.vehicleCount).toBeGreaterThan(0);
      expect(era.vehicles.averageSpeed).toBeGreaterThan(0);
      expect(era.vehicles.models.length).toBeGreaterThan(0);
      for (const model of era.vehicles.models) {
        expect(model.name).toBeTruthy();
        expect(model.length).toBeGreaterThan(0);
        expect(model.width).toBeGreaterThan(0);
        expect(model.height).toBeGreaterThan(0);
      }

      // Pedestrians
      expect(era.pedestrians.fashionStyle).toBeTruthy();
      expect(era.pedestrians.crowdDensity).toBeGreaterThan(0);
      expect(era.pedestrians.walkSpeed).toBeGreaterThan(0);
      expect(era.pedestrians.outfits.length).toBeGreaterThan(0);
      expect(era.pedestrians.typicalProps.length).toBeGreaterThan(0);

      // Atmosphere
      expect(era.atmosphere.skyGradient.zenith).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(era.atmosphere.skyGradient.horizon).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(era.atmosphere.skyGradient.ground).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(era.atmosphere.sunColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(era.atmosphere.sunPosition).toHaveLength(3);
      expect(era.atmosphere.sunIntensity).toBeGreaterThan(0);
      expect(era.atmosphere.streetLampColor).toMatch(/^#[0-9a-fA-F]{6}$/);

      // Audio
      expect(era.audio.themeTitle).toBeTruthy();
      expect(era.audio.genre).toBeTruthy();
      expect(era.audio.bpm).toBeGreaterThan(0);
      expect(era.audio.synthProfile).toBeTruthy();
      expect(era.audio.ambienceProfile).toBeTruthy();
      expect(era.audio.filterProfile).toBeTruthy();
      expect(era.audio.hornType).toBeTruthy();
    }
  });

  it('provides differentiating characteristics across eras', () => {
    const r1945 = eraRegistry.getEra('1945');
    const r1965 = eraRegistry.getEra('1965');
    const r1985 = eraRegistry.getEra('1985');
    const r2005 = eraRegistry.getEra('2005');
    const r2025 = eraRegistry.getEra('2025');

    // Height scale increases chronologically
    expect(r1945.buildings.heightScale).toBeLessThan(r1965.buildings.heightScale);
    expect(r1965.buildings.heightScale).toBeLessThan(r1985.buildings.heightScale);
    expect(r1985.buildings.heightScale).toBeLessThan(r2005.buildings.heightScale);
    expect(r2005.buildings.heightScale).toBeLessThan(r2025.buildings.heightScale);

    // Sign technologies evolve
    expect(r1945.signage.primaryTech).toBe('painted_wood_metal');
    expect(r1965.signage.primaryTech).toBe('neon_incandescent_bulbs');
    expect(r1985.signage.primaryTech).toBe('backlit_acrylic_lightboxes');
    expect(r2005.signage.primaryTech).toBe('digital_led_billboards');
    expect(r2025.signage.primaryTech).toBe('holographic_oled_screens');

    // Vehicle exhaust decreases towards zero
    expect(r1945.vehicles.exhaustEmissionRate).toBeGreaterThan(r1985.vehicles.exhaustEmissionRate);
    expect(r2025.vehicles.exhaustEmissionRate).toBe(0);

    // Street lamp styles differ
    expect(r1945.atmosphere.streetLampStyle).toBe('cast_iron_gas');
    expect(r2025.atmosphere.streetLampStyle).toBe('smart_led_spire');

    // Audio profiles differ
    const synthProfiles = [
      r1945.audio.synthProfile,
      r1965.audio.synthProfile,
      r1985.audio.synthProfile,
      r2005.audio.synthProfile,
      r2025.audio.synthProfile,
    ];
    expect(new Set(synthProfiles).size).toBe(5);
  });

  it('throws on unknown EraId', () => {
    const registry = createEraRegistry();
    // @ts-expect-error testing invalid ID
    expect(() => registry.getEra('1999')).toThrow(/Unknown EraId/);
  });
});
