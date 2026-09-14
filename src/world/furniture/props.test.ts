import { describe, expect, it } from 'vitest';
import { createBlockLayout, isPointInSidewalk } from '../layout';
import { ERA_YEARS, type EraId } from '../../era/types';
import { buildFurnitureProps } from './props';

const SEED = 777;

function buildFor(era: EraId) {
  return buildFurnitureProps(createBlockLayout(SEED), era, SEED);
}

describe('Street props (src/world/furniture/props.ts)', () => {
  it('places traffic lights at all four intersection anchors with era styling', () => {
    const styles: Record<EraId, { housingStyle: string; lampTech: string }> = {
      1945: { housingStyle: 'cast_incandescent', lampTech: 'incandescent' },
      1965: { housingStyle: 'round_incandescent', lampTech: 'incandescent' },
      1985: { housingStyle: 'square_incandescent', lampTech: 'incandescent' },
      2005: { housingStyle: 'led_module', lampTech: 'led' },
      2025: { housingStyle: 'modern_led', lampTech: 'led' },
    };
    for (const era of ERA_YEARS) {
      const lights = buildFor(era).trafficLights;
      expect(lights).toHaveLength(4);
      for (const light of lights) {
        expect(light.lensCount).toBe(3);
        expect(light.housingStyle).toBe(styles[era]!.housingStyle);
        expect(light.lampTech).toBe(styles[era]!.lampTech);
      }
    }
  });

  it('evolves hydrants from classic red cast-iron to smart eco fixtures', () => {
    const hydrants = buildFor(1985).hydrants;
    expect(hydrants.length).toBeGreaterThan(0);
    for (const era of ERA_YEARS) {
      const result = buildFor(era);
      for (const hydrant of result.hydrants) {
        expect(hydrant.outletCount).toBe(2);
        expect(hydrant.bodyHeight).toBeGreaterThan(0);
      }
    }
    expect(buildFor(1945).hydrants[0]!.style).toBe('classic');
    expect(buildFor(1945).hydrants[0]!.chain).toBe(true);
    expect(buildFor(2025).hydrants[0]!.style).toBe('eco');
    expect(buildFor(2025).hydrants[0]!.cap).toBe('smart');
  });

  it('gives benches detailed slats and era-specific frames', () => {
    const slatCounts: Record<EraId, number> = { 1945: 5, 1965: 5, 1985: 4, 2005: 4, 2025: 5 };
    for (const era of ERA_YEARS) {
      const benches = buildFor(era).benches;
      expect(benches.length).toBeGreaterThan(0);
      for (const bench of benches) {
        expect(bench.slats).toHaveLength(slatCounts[era]!);
        expect(bench.length).toBeGreaterThan(1.5);
        expect(bench.height).toBeGreaterThan(0.5);
        // Slats spread across the seat with individual y offsets (set dressing).
        const yOffsets = new Set(bench.slats.map((s) => s.offsetY));
        expect(yOffsets.size).toBe(bench.slats.length);
      }
    }
    expect(buildFor(1945).benches[0]!.style).toBe('iron_wood');
    expect(buildFor(2025).benches[0]!.style).toBe('green');
    expect(buildFor(2025).benches[0]!.planter).toBe(true);
  });

  it('keeps phone booths 1945-1985 then replaces them with era-appropriate kiosks', () => {
    for (const era of [1945, 1965, 1985] as const) {
      const booths = buildFor(era).booths;
      expect(booths.length).toBeGreaterThan(0);
      for (const booth of booths) {
        expect(booth.kind).toBe('phone_booth');
        expect(booth.glazing.length).toBeGreaterThanOrEqual(3);
        for (const panel of booth.glazing) {
          expect(panel.width).toBeGreaterThan(0);
          expect(panel.mullions).toBeGreaterThan(0);
        }
      }
    }
    const kiosk2005 = buildFor(2005).booths;
    const kiosk2025 = buildFor(2025).booths;
    for (const booth of kiosk2005) {
      expect(booth.kind).toBe('info_kiosk');
      expect(booth.screen).not.toBeNull();
    }
    for (const booth of kiosk2025) {
      expect(booth.kind).toBe('smart_kiosk');
      expect(booth.solar).toBe(true);
      expect(booth.charging).not.toBeNull();
    }
  });

  it('shifts litter volume and graffiti across the eras (1985 peak)', () => {
    const counts: Record<EraId, number> = { 1945: 10, 1965: 16, 1985: 42, 2005: 26, 2025: 14 };
    const graffitiTargets: Record<EraId, number> = { 1945: 0, 1965: 1, 1985: 8, 2005: 3, 2025: 0 };
    for (const era of ERA_YEARS) {
      const litter = buildFor(era).litter;
      expect(litter.items).toHaveLength(counts[era]!);
      expect(litter.graffiti).toHaveLength(graffitiTargets[era]!);
    }
    // The dirtiest era has the most litter and graffiti; clean eras have none.
    expect(counts[1985]!).toBeGreaterThan(counts[2005]!);
    expect(counts[2005]!).toBeGreaterThan(counts[1965]!);
    expect(graffitiTargets[1985]!).toBeGreaterThan(graffitiTargets[2005]!);
    expect(graffitiTargets[2005]!).toBeGreaterThan(graffitiTargets[1965]!);
    expect(graffitiTargets[1945]!).toBe(0);
    expect(graffitiTargets[2025]!).toBe(0);
  });

  it('scatters litter on sidewalk surfaces (never in lanes or lots)', () => {
    const layout = createBlockLayout(SEED);
    const litter = buildFurnitureProps(layout, 1985, SEED).litter;
    expect(litter.items.length).toBeGreaterThan(0);
    for (const item of litter.items) {
      expect(isPointInSidewalk(layout, item.position)).toBe(true);
      expect(item.scale).toBeGreaterThan(0.5);
      expect(item.rotation).toBeGreaterThanOrEqual(0);
    }
  });

  it('tags the graffiti surfaces and marks the corresponding fixtures', () => {
    for (const era of [1965, 1985, 2005] as const) {
      const props = buildFor(era);
      const fixtures = [
        ...props.trafficLights,
        ...props.hydrants,
        ...props.benches,
        ...props.booths,
        ...props.bins,
        ...props.mailboxes,
      ];
      const tagged = fixtures.filter((f) => f.graffiti);
      expect(tagged.length).toBe(props.litter.graffiti.length);
      for (const mark of props.litter.graffiti) {
        expect(tagged.some((f) => f.anchorId === mark.anchorId)).toBe(true);
      }
    }
  });

  it('produces identical output for identical seeds', () => {
    const a = buildFor(2005);
    const b = buildFor(2005);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = buildFor(1965);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});