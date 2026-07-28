/**
 * Tests for audio mixing logic — SfxMixer and procedural audio generation.
 */
import { describe, it, expect } from 'vitest';
import { SFX_ERA_DATA, type EraId } from '../src/eras';
import type { SfxEraData } from '../src/eras';

describe('SFX Era Data', () => {
  describe('SFX_ERA_DATA structure', () => {
    it('has data for all eras', () => {
      const eras: EraId[] = ['1945', '1965', '1985', '2005', '2025', '2055'];
      for (const era of eras) {
        expect(SFX_ERA_DATA[era]).toBeDefined();
      }
    });

    it('each era has all required fields', () => {
      const eras: EraId[] = ['1945', '1965', '1985', '2005', '2025', '2055'];
      for (const era of eras) {
        const data = SFX_ERA_DATA[era];
        expect(typeof data.ambientFreq).toBe('number');
        expect(typeof data.ambientDetune).toBe('number');
        expect(typeof data.trafficFreq).toBe('number');
        expect(typeof data.trafficRate).toBe('number');
        expect(Array.isArray(data.events)).toBe(true);
        expect(typeof data.musicFreq).toBe('number');
        expect(typeof data.ambientVolume).toBe('number');
        expect(typeof data.trafficVolume).toBe('number');
      }
    });

    it('volume values are in valid range 0..1', () => {
      const eras: EraId[] = ['1945', '1965', '1985', '2005', '2025', '2055'];
      for (const era of eras) {
        const data = SFX_ERA_DATA[era];
        expect(data.ambientVolume).toBeGreaterThanOrEqual(0);
        expect(data.ambientVolume).toBeLessThanOrEqual(1);
        expect(data.trafficVolume).toBeGreaterThanOrEqual(0);
        expect(data.trafficVolume).toBeLessThanOrEqual(1);
      }
    });

    it('traffic rate increases over time', () => {
      expect(SFX_ERA_DATA['1945'].trafficRate).toBeLessThan(SFX_ERA_DATA['2055'].trafficRate);
    });

    it('ambient frequency increases over time', () => {
      expect(SFX_ERA_DATA['1945'].ambientFreq).toBeLessThan(SFX_ERA_DATA['2055'].ambientFreq);
    });

    it('event lists are era-appropriate', () => {
      // 1945 should have period-appropriate events
      expect(SFX_ERA_DATA['1945'].events).toContain('church_bell');
      expect(SFX_ERA_DATA['1945'].events).toContain('steam_whistle');

      // 2055 should have futuristic events
      expect(SFX_ERA_DATA['2055'].events).toContain('ufo_landing');
      expect(SFX_ERA_DATA['2055'].events).toContain('holo_beep');
      expect(SFX_ERA_DATA['2055'].events).toContain('drone');
    });
  });

  describe('SfxEraData interface validation', () => {
    it('defines correct types for all fields', () => {
      const data: SfxEraData = SFX_ERA_DATA['2025'];
      
      // Type checks (these would fail at compile time if interface was wrong)
      const ambientFreq: number = data.ambientFreq;
      const trafficRate: number = data.trafficRate;
      const events: readonly string[] = data.events;
      
      expect(typeof ambientFreq).toBe('number');
      expect(typeof trafficRate).toBe('number');
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Audio parameter progression', () => {
    it('ambient volume follows era progression', () => {
      // 1945: lower, 2055: higher
      expect(SFX_ERA_DATA['1945'].ambientVolume).toBeLessThan(SFX_ERA_DATA['2055'].ambientVolume);
    });

    it('traffic volume progression is reasonable', () => {
      // Traffic volume should be positive for all eras
      for (const era of ['1945', '1965', '1985', '2005', '2025', '2055'] as EraId[]) {
        expect(SFX_ERA_DATA[era].trafficVolume).toBeGreaterThan(0);
      }
    });

    it('event count varies by era', () => {
      // All eras should have at least one event
      for (const era of ['1945', '1965', '1985', '2005', '2025', '2055'] as EraId[]) {
        expect(SFX_ERA_DATA[era].events.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

describe('Audio generation parameters', () => {
  it('sample rate constants are valid', () => {
    // Verify the era data is consistent
    expect(SFX_ERA_DATA['1945'].ambientFreq).toBeCloseTo(110, 0);
    expect(SFX_ERA_DATA['1965'].ambientFreq).toBeCloseTo(220, 0);
    expect(SFX_ERA_DATA['1985'].ambientFreq).toBeCloseTo(330, 0);
    expect(SFX_ERA_DATA['2005'].ambientFreq).toBeCloseTo(440, 0);
    expect(SFX_ERA_DATA['2025'].ambientFreq).toBeCloseTo(523, 0);
    expect(SFX_ERA_DATA['2055'].ambientFreq).toBeCloseTo(660, 0);
  });

  it('traffic frequencies are in audible range', () => {
    for (const era of ['1945', '1965', '1985', '2005', '2025', '2055'] as EraId[]) {
      expect(SFX_ERA_DATA[era].trafficFreq).toBeGreaterThan(20);
      expect(SFX_ERA_DATA[era].trafficFreq).toBeLessThan(2000);
    }
  });

  it('music frequencies correspond to musical notes', () => {
    // These should be notes in different octaves
    const expectedNotes = {
      '1945': 220,   // A3
      '1965': 330,   // E4
      '1985': 440,   // A4
      '2005': 523,   // C5
      '2025': 659,   // E5
      '2055': 784,   // G5
    };

    for (const era of ['1945', '1965', '1985', '2005', '2025', '2055'] as EraId[]) {
      expect(SFX_ERA_DATA[era].musicFreq).toBeCloseTo(expectedNotes[era], 0);
    }
  });
});
