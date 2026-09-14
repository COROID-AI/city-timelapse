import { describe, expect, it } from 'vitest';
import { ERA_PALETTES } from './palette';
import { ERA_THEME_ASPECTS, ERA_YEARS, type EraId, type EraTheme } from './types';

/**
 * Test-only fixture: a complete, valid `EraTheme` for `id`. Fixtures prove
 * the schema is instantiable for all five eras without shipping per-era
 * content stubs (real content is authored by phase-3 builder tasks). The
 * strict `EraTheme` return type makes any omitted section a compile error.
 */
function buildThemeFixture(id: EraId): EraTheme {
  return {
    id,
    label: `Era ${id}`,
    description: 'Schema-completeness fixture.',
    palette: ERA_PALETTES[id],
    buildings: {
      heightRange: [12, 30],
      windowStyle: 'small-paned',
      roofStyle: 'cornice',
      facadeMaterial: 'brick',
      storefrontFrontage: 0.6,
    },
    vehicles: {
      bodyStyle: 'sedan',
      colors: ['#26262a', '#3e3e44'],
      lengthRange: [4.2, 5.0],
      speedRange: [4, 10],
      lightGlow: 0.4,
    },
    storefronts: {
      signStyle: 'painted',
      awningStyle: 'striped',
      windowDressing: 'paper-displays',
      awningDensity: 0.8,
    },
    ads: {
      medium: 'billboard',
      brightness: 0.5,
      colors: ['#141414', '#2e2e34'],
      density: 0.4,
    },
    pedestrians: {
      outfitStyle: 'wartime-coats',
      outfitColors: ['#5c5138', '#7a6443'],
      walkSpeedRange: [1.0, 1.4],
      density: 0.3,
      accessoryKeywords: ['hat'],
    },
    atmosphere: {
      airQuality: 'clear',
      haze: 0.2,
      precipitation: 'none',
      daylightMood: 'soft-warm',
    },
    ambience: {
      streetNoise: 0.4,
      soundscape: 'big-band',
      streetActivity: 0.5,
    },
  };
}

describe('EraTheme schema', () => {
  it('exposes each era-affected aspect exactly once', () => {
    expect(ERA_THEME_ASPECTS).toEqual([
      'palette',
      'buildings',
      'vehicles',
      'storefronts',
      'ads',
      'pedestrians',
      'atmosphere',
      'ambience',
    ]);
  });

  for (const id of ERA_YEARS) {
    it(`instantiates a complete EraTheme for ${id}`, () => {
      const theme = buildThemeFixture(id);
      expect(theme.id).toBe(id);
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);

      // Fail loudly if any requested aspect section is missing or empty so
      // later builders cannot silently omit one.
      for (const aspect of ERA_THEME_ASPECTS) {
        const section = theme[aspect];
        expect(section, `${aspect} section missing for ${id}`).toBeDefined();
        expect(
          Object.keys(section as object).length,
          `${aspect} section must not be empty for ${id}`,
        ).toBeGreaterThan(0);
      }
    });
  }

  it('must not compile when an aspect section is omitted', () => {
    // @ts-expect-error a theme without `ambience` is not a complete EraTheme.
    const incomplete: EraTheme = { ...buildThemeFixture(1945), ambience: undefined };
    void incomplete;
  });
});