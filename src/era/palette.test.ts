import { describe, expect, it } from 'vitest';
import { ERA_PALETTES } from './palette';
import { ERA_YEARS, type EraPalette } from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Every color token of a palette, flattened in a stable order. */
function collectColors(palette: EraPalette): string[] {
  return [
    palette.sky,
    palette.fog,
    palette.sun.color,
    palette.asphalt,
    palette.sidewalk,
    ...palette.facadeMaterials,
    palette.accent,
    palette.signageGlow,
  ];
}

describe('ERA_PALETTES', () => {
  it('defines a palette for exactly the five EraIds', () => {
    expect(Object.keys(ERA_PALETTES).map(Number).sort((a, b) => a - b)).toEqual([...ERA_YEARS]);
  });

  for (const id of ERA_YEARS) {
    it(`uses valid hex colors and a positive sun intensity for ${id}`, () => {
      for (const color of collectColors(ERA_PALETTES[id])) {
        expect(color, `invalid color token for ${id}`).toMatch(HEX_COLOR);
      }
      expect(Number.isFinite(ERA_PALETTES[id].sun.intensity)).toBe(true);
      expect(ERA_PALETTES[id].sun.intensity).toBeGreaterThan(0);
    });

    it(`has pairwise-distinct tokens within ${id}`, () => {
      const colors = collectColors(ERA_PALETTES[id]);
      expect(new Set(colors).size).toBe(colors.length);
    });
  }

  it('has pairwise-distinct tokens across all eras (no collisions)', () => {
    const all = ERA_YEARS.flatMap((id) => collectColors(ERA_PALETTES[id]));
    expect(new Set(all).size).toBe(all.length);
  });
});