import { describe, expect, it } from 'vitest';
import {
  ERA_IDS,
  ERA_REGISTRY,
  SFX_ERA_DATA,
  getEraSpec,
  isEraId,
} from '../src/eras';
import type { EraId } from '../src/eras';

const EXPECTED_ORDER = ['1945', '1965', '1985', '2005', '2025'] as const;

describe('era registry integrity', () => {
  it('exposes exactly the five mandated eras in chronological order', () => {
    expect(ERA_IDS.length).toBe(5);
    expect([...ERA_IDS]).toEqual([...EXPECTED_ORDER]);
  });

  it('has unique era ids', () => {
    expect(new Set(ERA_IDS).size).toBe(ERA_IDS.length);
    expect(new Set(ERA_REGISTRY.map((era) => era.id)).size).toBe(ERA_REGISTRY.length);
  });

  it('registry specs agree with their ids and carry label + description', () => {
    expect(ERA_REGISTRY.map((era) => era.id)).toEqual(ERA_IDS);
    for (const spec of ERA_REGISTRY) {
      expect(spec.year).toBe(Number(spec.id));
      expect(spec.label.trim().length).toBeGreaterThan(0);
      expect(spec.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('getEraSpec returns the matching spec for every id and throws otherwise', () => {
    for (const spec of ERA_REGISTRY) {
      expect(getEraSpec(spec.id)).toBe(spec);
    }
    expect(() => getEraSpec('1999' as EraId)).toThrow(/Unknown era/i);
  });

  it('isEraId narrows valid ids only', () => {
    for (const id of ERA_IDS) {
      expect(isEraId(id)).toBe(true);
    }
    expect(isEraId('2055')).toBe(false);
    expect(isEraId('')).toBe(false);
  });
});

describe('SFX_ERA_DATA shape', () => {
  it('is keyed by every EraId with a consistent inner id', () => {
    expect(Object.keys(SFX_ERA_DATA).sort()).toEqual([...EXPECTED_ORDER].sort());
    for (const id of ERA_IDS) {
      expect(SFX_ERA_DATA[id].id).toBe(id);
    }
  });

  it('carries numerically valid parameters for every era', () => {
    for (const id of ERA_IDS) {
      const data = SFX_ERA_DATA[id];
      expect(data.ambient.droneFrequencies.length).toBeGreaterThan(0);
      for (const freq of data.ambient.droneFrequencies) {
        expect(freq).toBeGreaterThan(0);
        expect(Number.isFinite(freq)).toBe(true);
      }
      expect(data.ambient.droneLevel).toBeGreaterThan(0);
      expect(data.ambient.droneLevel).toBeLessThanOrEqual(1);
      expect(data.ambient.noiseLevel).toBeGreaterThan(0);
      expect(data.ambient.noiseCutoffHz).toBeGreaterThan(20);

      expect(data.traffic.density).toBeGreaterThanOrEqual(0);
      expect(data.traffic.density).toBeLessThanOrEqual(1);
      expect(data.traffic.pace).toBeGreaterThan(0);
      expect(data.traffic.level).toBeGreaterThan(0);

      expect(data.events.kinds.length).toBeGreaterThan(0);
      expect(data.events.intervalSeconds).toBeGreaterThan(0);
      expect(data.events.level).toBeGreaterThan(0);

      expect(data.music.tempoBpm).toBeGreaterThanOrEqual(60);
      expect(data.music.tempoBpm).toBeLessThanOrEqual(200);
      expect(data.music.rootFrequency).toBeGreaterThan(0);
      expect(data.music.level).toBeGreaterThan(0);
      expect(data.music.level).toBeLessThanOrEqual(1);
    }
  });

  it('gives every era a fully distinct parameter set', () => {
    const signatures = ERA_IDS.map((id) => JSON.stringify(SFX_ERA_DATA[id]));
    expect(new Set(signatures).size).toBe(5);

    const styles = ERA_IDS.map((id) => SFX_ERA_DATA[id].music.style);
    expect(new Set(styles).size).toBe(5);

    const drones = ERA_IDS.map((id) => SFX_ERA_DATA[id].ambient.droneFrequencies.join(','));
    expect(new Set(drones).size).toBe(5);
  });

  it('encodes period-appropriate profiles', () => {
    // 1945: sparse combustion traffic, bells, swing.
    const w45 = SFX_ERA_DATA['1945'];
    expect(w45.traffic.profile).toBe('sparse');
    expect(w45.traffic.electric).toBe(false);
    expect(w45.events.kinds).toContain('bell');
    expect(w45.music.style).toBe('bigbandSwing');

    // Combustion-dominated middle eras.
    expect(SFX_ERA_DATA['1965'].events.kinds).toContain('horn');
    expect(SFX_ERA_DATA['1985'].events.kinds).toContain('siren');
    expect(SFX_ERA_DATA['1985'].music.style).toBe('synthwave');
    expect(SFX_ERA_DATA['2005'].traffic.profile).toBe('heavy');
    expect(SFX_ERA_DATA['2005'].events.kinds).toContain('digitalChime');

    // 2025: EV hum and digital chimes.
    const w25 = SFX_ERA_DATA['2025'];
    expect(w25.traffic.profile).toBe('electric');
    expect(w25.traffic.electric).toBe(true);
    expect(w25.events.kinds).toContain('evChime');
    expect(w25.music.style).toBe('electronicAmbient');

    for (const id of ['1945', '1965', '1985', '2005'] as const) {
      expect(SFX_ERA_DATA[id].traffic.electric).toBe(false);
    }

    // Traffic density grows over time before the EV-era calm-down.
    expect(Number(w45.traffic.density)).toBeLessThan(Number(SFX_ERA_DATA['2005'].traffic.density));
  });
});
