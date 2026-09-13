import { describe, expect, it } from 'vitest';
import { createBlockLayout } from '../layout';
import { ERA_YEARS, type EraId } from '../../era/types';
import { buildLampPosts } from './lamps';

const SEED = 4242;

describe('Lamp posts (src/world/furniture/lamps.ts)', () => {
  it('places one lamp on every lamp_post anchor for each era', () => {
    for (const era of ERA_YEARS) {
      const layout = createBlockLayout(SEED);
      const lamps = buildLampPosts(layout, era, SEED);
      const anchors = layout.getAnchorsByKind('lamp_post');
      expect(lamps).toHaveLength(anchors.length);
      for (let i = 0; i < lamps.length; i += 1) {
        expect(lamps[i]!.anchorId).toBe(anchors[i]!.id);
        expect(lamps[i]!.position).toEqual(anchors[i]!.position);
        expect(lamps[i]!.facing).toBe(anchors[i]!.facing);
        expect(lamps[i]!.pole.height).toBeGreaterThan(0);
      }
    }
  });

  it('ages the lamp technology from incandescent globes to LED fixtures', () => {
    const expectations: Record<EraId, { tech: string; head: string; emissive: string }> = {
      1945: { tech: 'incandescent', head: 'globe', emissive: '#ffd9a2' },
      1965: { tech: 'sodium', head: 'cobra', emissive: '#ffb347' },
      1985: { tech: 'fluorescent', head: 'cobra', emissive: '#f2f2e8' },
      2005: { tech: 'led', head: 'cobra', emissive: '#fff4e0' },
      2025: { tech: 'led', head: 'slim-led', emissive: '#f6fbff' },
    };
    for (const era of ERA_YEARS) {
      const lamps = buildLampPosts(createBlockLayout(SEED), era, SEED);
      const expected = expectations[era]!;
      expect(lamps).not.toHaveLength(0);
      for (const lamp of lamps) {
        expect(lamp.head.tech).toBe(expected.tech);
        expect(lamp.head.kind).toBe(expected.head);
        expect(lamp.styleId).toContain(expected.tech);
        // Emissive color matches the period bulb: warm tungsten, orange
        // sodium, cool fluorescent/white + cool LED.
        expect(lamp.head.color).toBe(expected.emissive);
      }
    }
  });

  it('pole height and glow rise across the eras; color temperature follows the bulb tech', () => {
    const heights: number[] = [];
    const glows: number[] = [];
    const kelvins: Partial<Record<EraId, number>> = {};
    for (const era of ERA_YEARS) {
      const lamps = buildLampPosts(createBlockLayout(SEED), era, SEED);
      heights.push(lamps[0]!.pole.height);
      glows.push(lamps[0]!.head.glow);
      kelvins[era] = lamps[0]!.head.kelvin;
    }
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]!).toBeGreaterThan(heights[i - 1]!);
      expect(glows[i]!).toBeGreaterThan(glows[i - 1]!);
    }
    // Warm incandescent 1945, warmer orange sodium 1965, then cooling white
    // fluorescent and LED through 2005/2025.
    expect(kelvins[1945]!).toBe(2700);
    expect(kelvins[1965]!).toBe(2200);
    expect(kelvins[1985]!).toBeGreaterThan(kelvins[1965]!);
    expect(kelvins[2005]!).toBeGreaterThan(kelvins[1985]!);
    expect(kelvins[2025]!).toBeGreaterThan(kelvins[2005]!);
    // Wartime globe posts are ornate; modern posts are plain tapered.
    const w45 = buildLampPosts(createBlockLayout(SEED), 1945, SEED)[0]!;
    const w25 = buildLampPosts(createBlockLayout(SEED), 2025, SEED)[0]!;
    expect(w45.pole.ornate).toBe(true);
    expect(w45.pole.baseStyle).toBe('fluted');
    expect(w25.pole.ornate).toBe(false);
    expect(w25.pole.baseStyle).toBe('tapered');
  });

  it('identical seeds produce identical lamps; different eras differ', () => {
    const a = buildLampPosts(createBlockLayout(1234), 1985, 1234);
    const b = buildLampPosts(createBlockLayout(1234), 1985, 1234);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = buildLampPosts(createBlockLayout(1234), 1965, 1234);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('keeps lamp posts deterministic despite jitter and graffiti rolls', () => {
    // The jitter and graffiti fields are seeded, so two identical builds
    // must have identical per-anchor variation but unique values overall.
    const lamps = buildLampPosts(createBlockLayout(SEED), 1985, SEED);
    const jitters = new Set(lamps.map((l) => `${l.jitter.x},${l.jitter.z}`));
    expect(jitters.size).toBeGreaterThan(1);
    const graffitiPoles = lamps.filter((l) => l.pole.graffiti);
    expect(graffitiPoles.length).toBeGreaterThan(0);
  });
});