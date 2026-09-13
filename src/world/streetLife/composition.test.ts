/**
 * Composition test for Era Street Life integrating real BlockLayout and real EraThemes
 */

import { describe, expect, it } from 'vitest';
import { ERA_YEARS, type EraTheme } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';
import { createBlockLayout, isPointInAsphalt, isPointInSidewalk } from '../layout';
import { buildStreetLife, createDefaultEraTheme, DEFAULT_ERA_THEMES } from './buildStreetLife';

describe('Era Street Life Composition (src/world/streetLife/composition.test.ts)', () => {
  it('integrates real BlockLayout and real EraTheme for all five ERA_YEARS', () => {
    // Generate real layout using phase-2 createBlockLayout
    const layout = createBlockLayout(42);

    expect(layout.lanes).toHaveLength(4);
    expect(layout.pedestrianNetwork.segments.length).toBeGreaterThanOrEqual(12);

    for (const era of ERA_YEARS) {
      const theme: EraTheme = DEFAULT_ERA_THEMES[era] ?? createDefaultEraTheme(era);

      // Verify theme schema completeness before building
      expect(theme.id).toBe(era);
      expect(theme.palette).toEqual(ERA_PALETTES[era]);
      expect(theme.vehicles.colors.length).toBeGreaterThan(0);
      expect(theme.pedestrians.outfitColors.length).toBeGreaterThan(0);

      // Build integrated street life
      const streetLife = buildStreetLife(era, layout, theme);

      expect(streetLife.group).toBeDefined();
      expect(streetLife.era).toBe(era);
      expect(streetLife.layout).toBe(layout);
      expect(streetLife.theme).toBe(theme);

      // 1. Vehicles occupy layout lanes
      expect(streetLife.vehicles.length).toBeGreaterThanOrEqual(4);
      for (const vehicle of streetLife.vehicles) {
        expect(vehicle.lane).toBeDefined();
        expect(vehicle.path).toBeDefined();
        expect(layout.lanes).toContain(vehicle.lane);

        // Initial vehicle position must be in asphalt
        const pos = vehicle.mesh.position;
        expect(isPointInAsphalt(layout, { x: pos.x, z: pos.z })).toBe(true);
      }

      // 2. Pedestrians occupy layout walkways
      expect(streetLife.pedestrians.length).toBeGreaterThanOrEqual(8);
      for (const pedestrian of streetLife.pedestrians) {
        expect(pedestrian.segmentId).toBeDefined();
        const segment = layout.pedestrianNetwork.segments.find((s) => s.id === pedestrian.segmentId);
        expect(segment).toBeDefined();

        // Pedestrian position must be on sidewalk or crosswalk
        const pos = pedestrian.mesh.position;
        const onSidewalk = isPointInSidewalk(layout, { x: pos.x, z: pos.z });
        const onAsphalt = isPointInAsphalt(layout, { x: pos.x, z: pos.z });
        expect(onSidewalk || onAsphalt).toBe(true);
      }

      // Clean up
      streetLife.dispose();
      expect(streetLife.isDisposed).toBe(true);
    }
  });

  it('proves era-driven vehicle and pedestrian outfits vary with custom themes', () => {
    const layout = createBlockLayout(100);

    const customTheme1985: EraTheme = {
      ...createDefaultEraTheme(1985),
      vehicles: {
        bodyStyle: 'boxy-sedan',
        colors: ['#ff0055', '#00ffcc'],
        lengthRange: [4.5, 5.0],
        speedRange: [10, 15],
        lightGlow: 0.8,
      },
      pedestrians: {
        outfitStyle: 'neon-80s',
        outfitColors: ['#ff0055', '#00ffcc'],
        walkSpeedRange: [1.3, 1.8],
        density: 0.8,
        accessoryKeywords: ['neon-glasses', 'walkman'],
      },
    };

    const streetLife = buildStreetLife(1985, layout, customTheme1985);

    // Fleet uses custom colors
    const colors = streetLife.vehicles.map((v) => v.primaryColor);
    expect(colors).toContain('#ff0055');

    // Speeds respect custom speed range
    for (const v of streetLife.vehicles) {
      expect(v.baseSpeed).toBeGreaterThanOrEqual(10);
      expect(v.baseSpeed).toBeLessThanOrEqual(15);
    }

    streetLife.dispose();
  });

  it('updates animation across multiple simulation ticks on real layout geometry without errors', () => {
    const layout = createBlockLayout(42);

    for (const era of ERA_YEARS) {
      const streetLife = buildStreetLife(era, layout);

      // Advance 10 seconds of simulated time in 0.2s increments
      for (let t = 0; t < 50; t += 1) {
        streetLife.update(0.2);
      }

      for (const vehicle of streetLife.vehicles) {
        const pos = vehicle.mesh.position;
        expect(isPointInAsphalt(layout, { x: pos.x, z: pos.z })).toBe(true);
      }

      for (const ped of streetLife.pedestrians) {
        const pos = ped.mesh.position;
        const onSidewalk = isPointInSidewalk(layout, { x: pos.x, z: pos.z });
        const onAsphalt = isPointInAsphalt(layout, { x: pos.x, z: pos.z });
        expect(onSidewalk || onAsphalt).toBe(true);
      }

      streetLife.dispose();
    }
  });
});
