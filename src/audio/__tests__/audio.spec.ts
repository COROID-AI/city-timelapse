import { describe, expect, it } from 'vitest';

import { buildBed, ERA_BED_PROFILES } from '../ambience';
import { CROSSFADE_SECONDS } from '../constants';
import { MockAudioContext } from './mockAudio';

/**
 * Unit tests for ambience bed construction and the bed profile contract.
 * The real synthesis code runs against a minimal Web Audio stub.
 */

describe('ambience beds', () => {
  it('defines a procedural bed profile for all five eras', () => {
    const eras = ['1945', '1965', '1985', '2005', '2025'] as const;
    for (const era of eras) {
      const profile = ERA_BED_PROFILES[era];
      expect(profile).toBeDefined();
      expect(profile.layers.length).toBeGreaterThan(0);
      // No binary assets: every layer is procedural (noise/tone/event).
      for (const layer of profile.layers) {
        expect(['noise', 'tone', 'event']).toContain(layer.kind);
      }
    }
  });

  it('builds a bed that starts silent with a master gain', () => {
    const ctx = new MockAudioContext();
    const bed = buildBed(ctx as unknown as BaseAudioContext, '1945');

    expect(bed.gain).toBeDefined();
    expect(bed.gain.gain?.value).toBe(0);
    expect(typeof bed.update).toBe('function');
    expect(typeof bed.dispose).toBe('function');

    bed.dispose();
  });

  it('starts loop sources and schedules oscillator tones', () => {
    const ctx = new MockAudioContext();
    const bed = buildBed(ctx as unknown as BaseAudioContext, '2025');

    const sources = ctx.nodes.filter((n) => 'started' in n && (n as { started: boolean }).started);
    expect(sources.length).toBeGreaterThan(0);

    bed.dispose();
  });

  it('crossfade constant stays within the 2–4s window', () => {
    expect(CROSSFADE_SECONDS).toBeGreaterThanOrEqual(2);
    expect(CROSSFADE_SECONDS).toBeLessThanOrEqual(4);
  });
});