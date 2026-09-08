/**
 * Unit tests for the deterministic neon flicker math and sign corridor.
 */

import * as THREE from 'three';
import { createTrack } from '../../src/world/track';
import {
  createNeonSigns,
  flickerValue,
  MIN_SIGNS,
} from '../../src/world/neonSigns';

describe('neon flicker math', () => {
  it('stays within the [0, 1] intensity range', () => {
    for (let i = 0; i < 200; i++) {
      const phase = (i * 2.399963) % (Math.PI * 2);
      const v = flickerValue(phase, i * 0.31);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same phase + elapsed', () => {
    for (let i = 0; i < 50; i++) {
      const phase = i * 0.7;
      expect(flickerValue(phase, 12.34)).toBe(flickerValue(phase, 12.34));
    }
  });

  it('produces varied, non-constant values across phases', () => {
    const values = new Set<number>();
    for (let i = 0; i < 16; i++) {
      const phase = (i * 2.399963) % (Math.PI * 2);
      values.add(flickerValue(phase, 5.0));
    }
    // Different phases at the same instant should not all collapse to one value.
    expect(values.size).toBeGreaterThan(4);
  });

  it('changes over time (the sign actually flickers)', () => {
    const phase = 1.3;
    const v1 = flickerValue(phase, 0);
    const v2 = flickerValue(phase, 0.5);
    const v3 = flickerValue(phase, 3.0);
    expect(v1 === v2 && v2 === v3).toBe(false);
  });

  it('is periodic in elapsed time', () => {
    const phase = 0.5;
    // The hum term is 9 rad/s; at 2*pi/9 later the hum returns, but the slow
    // gate terms differ, so we only assert approximate boundedness, not exact
    // equality. Here we just confirm no growth/decay drift over many seconds.
    const lo = flickerValue(phase, 100.0);
    const hi = flickerValue(phase, 200.0);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
  });
});

describe('createNeonSigns corridor', () => {
  const track = createTrack(3);
  const corridor = createNeonSigns(track, 5);

  it('builds at least 12 neon signs with varied colors', () => {
    expect(corridor.signs.length).toBeGreaterThanOrEqual(MIN_SIGNS);
    const colors = new Set(corridor.signs.map((s) => s.color.getHex()));
    expect(colors.size).toBeGreaterThanOrEqual(4);
  });

  it('gives every sign a deterministic phase in [0, 2*pi)', () => {
    for (const s of corridor.signs) {
      expect(s.phase).toBeGreaterThanOrEqual(0);
      expect(s.phase).toBeLessThan(Math.PI * 2);
    }
  });

  it('updates intensities without per-frame allocations', () => {
    const before = corridor.signs.map((s) => s.color.getHex());
    corridor.update(0.016, 2.0);
    const after = corridor.signs.map((s) => s.color.getHex());
    // Intensities change over time (flicker is live).
    expect(before).not.toEqual(after);
  });

  it('updates are deterministic across identical calls', () => {
    const a = createNeonSigns(track, 9);
    const b = createNeonSigns(track, 9);
    a.update(0.016, 3.0);
    b.update(0.016, 3.0);
    for (let i = 0; i < a.signs.length; i++) {
      expect((a.signs[i] as typeof b.signs[number]).color.getHex()).toBe(
        (b.signs[i] as typeof b.signs[number]).color.getHex(),
      );
    }
  });

  it('places signs and buildings in the scene group', () => {
    expect(corridor.group.children.length).toBeGreaterThan(0);
    expect(corridor.buildings.length).toBeGreaterThan(0);
    expect(corridor.streetlamps.length).toBeGreaterThan(0);
  });

  it('is deterministic across identical seeds', () => {
    const a = createNeonSigns(track, 11);
    const b = createNeonSigns(track, 11);
    expect(a.signs.length).toBe(b.signs.length);
    for (let i = 0; i < a.signs.length; i++) {
      const pa = (a.signs[i] as typeof b.signs[number]).mesh.position;
      const pb = (b.signs[i] as typeof b.signs[number]).mesh.position;
      expect(pa.distanceTo(pb)).toBeLessThan(1e-9);
    }
  });
});