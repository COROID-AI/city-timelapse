import { describe, it, expect } from 'vitest';
import { getEra, getAllEras, lerpEra } from './config';
import { ERA_ORDER } from './types';

describe('era config', () => {
  it('has exactly 6 ordered eras', () => {
    expect(ERA_ORDER).toHaveLength(6);
    expect(ERA_ORDER[0]).toBe('1945');
    expect(ERA_ORDER[5]).toBe('2055');
  });

  it('getAllEras returns all 6 eras', () => {
    const all = getAllEras();
    expect(all).toHaveLength(6);
  });

  it('each era has non-empty vehicle outfit and ad sets', () => {
    const all = getAllEras();
    for (const era of all) {
      expect(era.vehicleStyle).toBeTruthy();
      expect(era.adTheme).toBeTruthy();
      expect(era.billboardContent).toBeTruthy();
      expect(era.pedestrianOutfit).toBeTruthy();
    }
  });

  it('each era has unique palettes', () => {
    const all = getAllEras();
    const skySets = all.map(e => e.skyTop + '-' + e.skyBottom);
    for (let i = 0; i < skySets.length; i++) {
      for (let j = i + 1; j < skySets.length; j++) {
        expect(skySets[i]).not.toBe(skySets[j]);
      }
    }
  });

  it('lerpEra interpolates fog density correctly', () => {
    const from = getEra('1945'); // fogDensity: 0.012
    const to = getEra('2055');   // fogDensity: 0.004
    const result = lerpEra(from, to, 0.5);
    // 2055 has lower fog density than 1945
    expect(result.fogDensity).toBeLessThan(from.fogDensity);
    expect(result.fogDensity).toBeGreaterThan(to.fogDensity);
  });

  it('lerpEra interpolates sun intensity correctly', () => {
    const from = getEra('1945'); // sunIntensity: 0.8
    const to = getEra('2055');   // sunIntensity: 0.3
    const result = lerpEra(from, to, 0.5);
    expect(result.sunIntensity).toBeLessThan(from.sunIntensity);
    expect(result.sunIntensity).toBeGreaterThan(to.sunIntensity);
  });
});
