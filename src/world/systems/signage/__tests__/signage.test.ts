/**
 * Unit tests for the storefront / signage content and geometry system.
 *
 * Covers the plan's signage assertions:
 * - per-era sign data completeness for all five eras,
 * - deterministic procedural texture generation (seeded PRNG, canvas specs),
 * - emissive bloom flags on neon/digital/media materials,
 * - frontage-plane anchoring (position + facing + height band) with no
 *   import of the buildings system.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EraId } from '../../../../era/years';
import type { FrontagePlane } from '../../../layout/types';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import { SIGNAGE_ERAS, signageEraData } from '../signageEraData';
import { createSeededRng, createSignTexture, type SignPaintSpec } from '../signTextures';
import { BLOOM_FLAG, createSign, yawForFacing } from '../signFactory';
import { createSignageSystem, bandPlacement } from '../signageSystem';
import type { SignageItemSpec } from '../signageEraData';

/* ------------------------------------------------------------------ */
/* jsdom canvas 2D stub (jsdom lacks a real 2D context)                */
/* ------------------------------------------------------------------ */

let stubSpy: ReturnType<typeof vi.spyOn> | undefined;

const STUB_2D = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'center',
  textBaseline: 'middle',
  fillRect: () => {},
  clearRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  fillText: () => {},
  strokeText: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
} as unknown as CanvasRenderingContext2D;

beforeAll(() => {
  stubSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function getContext(this: HTMLCanvasElement, contextId: string) {
      if (contextId === '2d') return STUB_2D;
      return null;
    });
});

afterAll(() => {
  stubSpy?.mockRestore();
});

/* ------------------------------------------------------------------ */
/* Era data completeness                                               */
/* ------------------------------------------------------------------ */

const KNOWN_TECH = [
  'painted_wood_metal',
  'neon_incandescent_bulbs',
  'backlit_acrylic_lightboxes',
  'digital_led_billboards',
  'holographic_oled_screens',
] as const;

const KNOWN_CATEGORIES = ['storefront', 'billboard', 'blade', 'rooftop'] as const;

const KNOWN_KINDS = [
  'painted',
  'poster',
  'awning',
  'graffiti',
  'neon',
  'backlit',
  'crt',
  'led',
  'media',
] as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe('per-era signage data', () => {
  it('covers all five eras in chronological order', () => {
    expect(SIGNAGE_ERAS).toEqual(['1945', '1965', '1985', '2005', '2025']);
    for (const era of SIGNAGE_ERAS) {
      expect(signageEraData[era], `missing era ${era}`).toBeDefined();
    }
  });

  it('every era spec has a complete field set and at least one sign', () => {
    for (const era of SIGNAGE_ERAS) {
      const spec = signageEraData[era];
      expect(spec.primaryTech.length).toBeGreaterThan(0);
      expect(spec.typographyStyle.length).toBeGreaterThan(0);
      expect(spec.colorPalette.length).toBeGreaterThan(0);
      expect(typeof spec.glowIntensity).toBe('number');
      expect(typeof spec.flickerRate).toBe('number');
      expect(typeof spec.density).toBe('number');
      expect(spec.signs.length).toBeGreaterThan(0);
    }
  });

  it('every sign item is internally consistent', () => {
    for (const era of SIGNAGE_ERAS) {
      for (const sig of signageEraData[era].signs) {
        expect(sig.text.length).toBeGreaterThan(0);
        expect(KNOWN_TECH).toContain(sig.tech);
        expect(KNOWN_CATEGORIES).toContain(sig.category);
        expect(KNOWN_KINDS).toContain(sig.textureKind);
        expect(sig.primaryColor).toMatch(HEX_COLOR);
        expect(sig.accentColor).toMatch(HEX_COLOR);
        expect(sig.baseColor).toMatch(HEX_COLOR);
        expect(sig.band.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers the required era content explicitly', () => {
    const texts = (era: EraId) => signageEraData[era].signs.map((s) => s.text);
    const kinds = (era: EraId) => new Set(signageEraData[era].signs.map((s) => s.textureKind));

    // 1945: hand-painted wood signs + war-bond poster + awning (plus one neon blade café).
    expect(kinds('1945')).toEqual(new Set(['painted', 'poster', 'awning', 'neon']));
    expect(texts('1945').join(' ')).toMatch(/WAR BONDS/i);

    // 1965: googie neon with starburst motel/diner marks.
    expect(kinds('1965')).toContain('neon');
    expect(signageEraData['1965'].signs.some((s) => s.burst)).toBe(true);
    expect(texts('1965').join(' ')).toMatch(/MOTEL/i);

    // 1985: neon storefronts, CRT video board, graffiti.
    expect(kinds('1985')).toContain('neon');
    expect(kinds('1985')).toContain('crt');
    expect(signageEraData['1985'].graffiti?.length).toBeGreaterThan(0);
    expect(texts('1985').join(' ')).toMatch(/VIDEO ARCADE/i);

    // 2005: backlit chain sign + LED board.
    expect(kinds('2005')).toContain('backlit');
    expect(kinds('2005')).toContain('led');

    // 2025: LED media facades + specialty coffee / scooter signage.
    expect(kinds('2025')).toContain('media');
    expect(texts('2025').join(' ')).toMatch(/COFFEE/i);
    expect(texts('2025').join(' ')).toMatch(/E-SCOOTER/i);
  });

  it('does not use modern brand names', () => {
    const banned = ['STARBUCKS', 'MCDONALD', 'TESLA', 'APPLE', 'GOOGLE', 'NYPD'];
    for (const era of SIGNAGE_ERAS) {
      for (const sig of signageEraData[era].signs) {
        for (const b of banned) {
          expect(sig.text.toUpperCase()).not.toContain(b);
        }
      }
    }
  });
});

function makeSpec(over: Partial<SignPaintSpec> = {}): SignPaintSpec {
  return {
    text: 'VICTORY CAFÉ',
    primary: '#b91c1c',
    accent: '#fef3c7',
    base: '#3a2a12',
    kind: 'painted',
    width: 256,
    height: 128,
    seed: 'seed-1:1945:3',
    ...over,
  };
}

describe('procedural sign textures', () => {
  it('PRNG is deterministic per seed and varies across seeds', () => {
    const a = Array.from({ length: 5 }, () => createSeededRng('seed-42')());
    const b = Array.from({ length: 5 }, () => createSeededRng('seed-42')());
    expect(a).toEqual(b);
    expect(a).not.toEqual(Array.from({ length: 5 }, () => createSeededRng('seed-43')()));
  });

  it('creates a CanvasTexture for every kind', () => {
    const kinds: Array<SignPaintSpec['kind']> = [
      'painted',
      'poster',
      'awning',
      'graffiti',
      'neon',
      'backlit',
      'crt',
      'led',
      'media',
    ];
    for (const kind of kinds) {
      const tex = createSignTexture(makeSpec({ kind, width: 200, height: 100, seed: `kind:${kind}` }));
      expect(tex.image.width).toBeGreaterThanOrEqual(2);
      expect(tex.image.height).toBeGreaterThanOrEqual(2);
      const colorSpace = (tex as unknown as { colorSpace?: string }).colorSpace;
      expect(colorSpace).toMatch(/srgb/i);
    }
  });

  it('same seed + same spec -> identical texture dimensions', () => {
    const a = createSignTexture(makeSpec({ seed: 'd1' }));
    const b = createSignTexture(makeSpec({ seed: 'd1' }));
    expect(a.image.width).toBe(b.image.width);
    expect(a.image.height).toBe(b.image.height);
  });
});

/* ------------------------------------------------------------------ */
/* Emissive bloom flag mapping                                         */
/* ------------------------------------------------------------------ */

function fakePlane(): FrontagePlane {
  return { position: { x: 5, z: 0.5 }, width: 8, height: 6, facing: { x: 0, z: -1 } };
}

function bloomOf(kind: SignPaintSpec['kind']): boolean | undefined {
  const item: SignageItemSpec = {
    text: 'TEST',
    category: 'storefront',
    primaryColor: '#ffffff',
    accentColor: '#000000',
    baseColor: '#111111',
    tech: 'painted_wood_metal',
    textureKind: kind,
    band: 'storefront',
  };
  const { resources } = createSign({
    plane: fakePlane(),
    size: { width: 2, height: 1 },
    baseY: 1,
    depth: 0.1,
    item,
    seed: 'flag',
    namePrefix: 't',
  });
  return resources.materials[0]?.userData[BLOOM_FLAG] === true;
}

describe('emissive bloom mapping', () => {
  const ITEMS: ReadonlyArray<readonly [SignPaintSpec['kind'], boolean]> = [
    ['painted', false],
    ['poster', false],
    ['awning', false],
    ['graffiti', false],
    ['neon', true],
    ['backlit', true],
    ['crt', true],
    ['led', true],
    ['media', true],
  ];

  for (const [kind, expectBloom] of ITEMS) {
    it(`${kind} → ${expectBloom ? 'bloom-tagged' : 'not bloom-tagged'}`, () => {
      expect(bloomOf(kind)).toBe(expectBloom);
    });
  }
});

/* ------------------------------------------------------------------ */
/* Frontage-plane anchoring                                            */
/* ------------------------------------------------------------------ */

describe('frontage anchoring (no building imports)', () => {
  it('anchors all era signs to layout frontage plane position/facing', () => {
    const layout = createCityBlockLayout('seed-7');
    const system = createSignageSystem(layout);
    expect(system.eraSets.length).toBe(SIGNAGE_ERAS.length);

    const plotCount = layout.plots.length;
    for (const set of system.eraSets) {
      for (let i = 0; i < set.signs.length; i += 1) {
        const sign = set.signs[i];
        const plane = layout.plots[i % plotCount].frontagePlane;
        const band = bandPlacement(sign.band, plane.width, plane.height);
        const g = sign.group;
        const alongX = band.offsetAlong * Math.cos(yawForFacing(plane.facing));
        const alongZ = band.offsetAlong * Math.sin(yawForFacing(plane.facing));
        expect(g.position.x).toBeCloseTo(plane.position.x + alongX, 4);
        expect(g.position.z).toBeCloseTo(plane.position.z + alongZ, 4);
        expect(g.position.y).toBeCloseTo(band.baseY + band.height / 2, 4);
        const expectedYaw = yawForFacing(plane.facing) + band.yawOffset;
        expect(g.rotation.y).toBeCloseTo(expectedYaw, 4);
      }
    }
  });

  it('sign groups never reference building meshes', () => {
    const layout = createCityBlockLayout('seed-11');
    const system = createSignageSystem(layout);
    expect(system.group.children.every((c) => c.name.startsWith('signage-'))).toBe(true);
    expect(system.layout).toBe(layout);
  });

  it('bandPlacement keeps every sign within the frontage band', () => {
    for (const era of SIGNAGE_ERAS) {
      for (const sig of signageEraData[era].signs) {
        const b = bandPlacement(sig.band, 10, 8);
        expect(b.baseY).toBeGreaterThanOrEqual(0);
        expect(b.baseY + b.height).toBeLessThanOrEqual(9.5);
        expect(b.width).toBeGreaterThan(0);
      }
    }
  });
});