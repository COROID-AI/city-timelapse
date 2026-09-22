import { describe, expect, it } from 'vitest';
import {
  ERA_YEARS,
  MATERIAL_CATEGORIES,
  getEraPalette,
  getMaterialSwatch,
  isEraYear,
  listEraPalettes,
} from './palettes';

describe('Era Palettes', () => {
  it('defines all five authoritative era years (1945, 1965, 1985, 2005, 2025)', () => {
    expect(ERA_YEARS).toEqual([1945, 1965, 1985, 2005, 2025]);
    for (const year of ERA_YEARS) {
      expect(isEraYear(year)).toBe(true);
    }
    expect(isEraYear(1900)).toBe(false);
    expect(isEraYear('1945')).toBe(false);
  });

  it('provides all 9 required material categories for every era palette', () => {
    for (const year of ERA_YEARS) {
      const palette = getEraPalette(year);
      expect(palette).toBeDefined();
      expect(palette.year).toBe(year);
      expect(typeof palette.name).toBe('string');
      expect(palette.name.length).toBeGreaterThan(0);
      expect(typeof palette.description).toBe('string');
      expect(typeof palette.accent).toBe('string');
      expect(palette.accent).toMatch(/^#[0-9a-fA-F]{6}$/);

      for (const category of MATERIAL_CATEGORIES) {
        const swatch = palette.materials[category];
        expect(swatch, `Missing category ${category} in era ${year}`).toBeDefined();
        expect(swatch.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(swatch.roughness).toBeGreaterThanOrEqual(0);
        expect(swatch.roughness).toBeLessThanOrEqual(1);
        expect(swatch.metalness).toBeGreaterThanOrEqual(0);
        expect(swatch.metalness).toBeLessThanOrEqual(1);
        expect(swatch.grime).toBeGreaterThanOrEqual(0);
        expect(swatch.grime).toBeLessThanOrEqual(1);
        expect(typeof swatch.note).toBe('string');

        const directSwatch = getMaterialSwatch(year, category);
        expect(directSwatch).toEqual(swatch);
      }
    }
  });

  it('reflects era-true distinct character across the timeline', () => {
    // 1945: High grime/soot, hand-painted signage, incandescent glow
    const p1945 = getEraPalette(1945);
    expect(p1945.signageStyle).toBe('hand-painted');
    expect(p1945.emissiveCharacter).toBe('incandescent');
    expect(p1945.materials.masonryConcrete.grime).toBeGreaterThanOrEqual(0.6);
    expect(p1945.materials.masonryConcrete.color.toLowerCase()).toBe('#6e4a38'); // warm red brick

    // 1965: Chrome, pastel plastics, low grime
    const p1965 = getEraPalette(1965);
    expect(p1965.signageStyle).toBe('painted-enamel');
    expect(p1965.materials.metal.metalness).toBeGreaterThanOrEqual(0.9);
    expect(p1965.materials.metal.roughness).toBeLessThan(0.2); // shiny chrome

    // 1985: Raw concrete, hot neon emissives
    const p1985 = getEraPalette(1985);
    expect(p1985.signageStyle).toBe('neon-tube');
    expect(p1985.materials.neonEmissive.emissive).toBeDefined();
    expect(p1985.materials.neonEmissive.emissiveIntensity).toBeGreaterThanOrEqual(2.0);

    // 2005: Blue reflective glass, backlit acrylic
    const p2005 = getEraPalette(2005);
    expect(p2005.signageStyle).toBe('backlit-plastic');
    expect(p2005.materials.glass.color.toLowerCase()).toBe('#5b9bd8'); // blue glass

    // 2025: Clean white rainscreen, low grime, high efficiency LED
    const p2025 = getEraPalette(2025);
    expect(p2025.signageStyle).toBe('led-panel');
    expect(p2025.materials.masonryConcrete.grime).toBeLessThanOrEqual(0.1);
    expect(p2025.emissiveCharacter).toBe('led');
  });

  it('throws on unknown era year lookups', () => {
    expect(() => getEraPalette(1999 as any)).toThrow(/unknown era year 1999/);
  });

  it('lists era palettes in chronological order', () => {
    const list = listEraPalettes();
    expect(list).toHaveLength(5);
    expect(list.map((p) => p.year)).toEqual([1945, 1965, 1985, 2005, 2025]);
  });
});
