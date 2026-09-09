/**
 * Quality-tier unit tests.
 *
 * Verifies the deterministic tier table, the Low/Medium/High settings
 * (pixel ratio, shadow-map size, bloom), FPS-based automatic selection with
 * hysteresis, and the tuning helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  clampShadowMapSize,
  getQualitySettings,
  HIGH_FPS_THRESHOLD,
  HYSTERESIS_FRAMES,
  LOW_FPS_THRESHOLD,
  QUALITY_TIERS,
  scaleSetting,
  selectTierForFps,
  TIER_ORDER,
  normalizeTier,
} from '../qualityTiers';

describe('quality tiers', () => {
  it('defines Low/Medium/High with increasing render cost and bloom enabled only from Medium up', () => {
    expect(TIER_ORDER).toEqual(['low', 'medium', 'high']);

    const low = QUALITY_TIERS.low;
    const medium = QUALITY_TIERS.medium;
    const high = QUALITY_TIERS.high;

    expect(low.pixelRatio).toBe(1);
    expect(medium.pixelRatio).toBeGreaterThan(low.pixelRatio);
    expect(high.pixelRatio).toBeGreaterThan(medium.pixelRatio);

    expect(low.shadowMapSize).toBeLessThan(medium.shadowMapSize);
    expect(medium.shadowMapSize).toBeLessThan(high.shadowMapSize);

    // Bloom disabled at Low, enabled at Medium/High, strongest at High.
    expect(low.bloom).toBe(0);
    expect(medium.bloom).toBeGreaterThan(0);
    expect(high.bloom).toBeGreaterThan(medium.bloom);

    // Shadow-map sizes are powers of two (renderer requirement).
    for (const tier of ['low', 'medium', 'high'] as const) {
      const size = QUALITY_TIERS[tier].shadowMapSize;
      expect(size).toBeGreaterThan(0);
      expect(size & (size - 1)).toBe(0);
    }
  });

  it('resolves settings and normalizes the legacy ultra alias onto high', () => {
    expect(getQualitySettings('low')).toBe(QUALITY_TIERS.low);
    expect(getQualitySettings('high')).toBe(QUALITY_TIERS.high);
    expect(normalizeTier('ultra')).toBe('high');
    expect(getQualitySettings('ultra')).toBe(QUALITY_TIERS.high);
  });

  it('selects the next tier for FPS under the hysteresis thresholds', () => {
    // At or below the low threshold → drop one tier (floored at low).
    expect(selectTierForFps('high', LOW_FPS_THRESHOLD)).toBe('medium');
    expect(selectTierForFps('medium', LOW_FPS_THRESHOLD)).toBe('low');
    expect(selectTierForFps('low', LOW_FPS_THRESHOLD)).toBe('low');

    // At or above the high threshold → rise one tier (capped at high).
    expect(selectTierForFps('low', HIGH_FPS_THRESHOLD)).toBe('medium');
    expect(selectTierForFps('medium', HIGH_FPS_THRESHOLD)).toBe('high');
    expect(selectTierForFps('high', HIGH_FPS_THRESHOLD)).toBe('high');

    // Between thresholds → stay.
    const mid = (LOW_FPS_THRESHOLD + HIGH_FPS_THRESHOLD) / 2;
    expect(selectTierForFps('high', mid)).toBe('high');

    // Non-finite input keeps the current tier (no data yet).
    expect(selectTierForFps('high', Number.NaN)).toBe('high');
    expect(selectTierForFps('medium', Number.POSITIVE_INFINITY)).toBe('medium');
    expect(selectTierForFps('low', Number.NEGATIVE_INFINITY)).toBe('low');
  });

  it('clamps shadow-map sizes to powers of two within engine bounds', () => {
    expect(clampShadowMapSize(256)).toBe(256);
    expect(clampShadowMapSize(300)).toBe(512);
    expect(clampShadowMapSize(1)).toBe(1);
    expect(clampShadowMapSize(0)).toBe(1);
    expect(clampShadowMapSize(8192)).toBe(4096);
  });

  it('scales settings within the tuning bounds', () => {
    expect(scaleSetting(1, 1, 0.5, 2)).toBe(1);
    expect(scaleSetting(1, 0.2, 0.5, 2)).toBe(0.5);
    expect(scaleSetting(1, 5, 0.5, 2)).toBe(2);
  });

  it('exposes a sane hysteresis duration', () => {
    expect(HYSTERESIS_FRAMES).toBeGreaterThan(0);
  });
});