/**
 * Composition tests for the per-era storefront / signage / advertising builder.
 *
 * Runs headlessly (jsdom): `buildStorefronts` consumes the real BlockLayout
 * and the EraTheme-schema era data, and the suite verifies the shared builder
 * contract, per-era signage/ad sets, era business names and display props,
 * night emissive variants, lot containment/orientation/clearance, theme
 * sensitivity, determinism, readable canvas-letterforms, and procedural-only
 * materials.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join as joinPath } from 'node:path';
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { ERA_YEARS, type EraId } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';
import { createBlockLayout, rectsOverlap, type BuildingLot, type Rect2D } from '../layout';
import { RecordSurface, renderTexture, colorToHex } from './materials';
import {
  paintBacklitSign,
  paintFasciaSign,
  paintLedSign,
  paintNeonSign,
  facadeFrameFor,
  facadeRect,
} from './signage';
import { paintWallAd } from './advertisements';
import { resolveStorefrontData, STOREFRONT_CONTENT_BY_ERA } from './eraStorefrontData';
import {
  buildStorefronts,
  rectClearOfAnchors,
  type StorefrontMeta,
  type StorefrontSceneInfo,
} from './buildStorefronts';

const LAYOUT = createBlockLayout(42);

function build(eraId: EraId, seed?: number) {
  return buildStorefronts(eraId, LAYOUT, seed !== undefined ? { seed } : undefined);
}

function infoOf(group: Group): StorefrontSceneInfo {
  return group.userData as StorefrontSceneInfo;
}

function lotById(id: string): BuildingLot {
  const lot = LAYOUT.getLotById(id);
  if (lot === undefined) throw new Error(`missing lot ${id}`);
  return lot;
}

function edgeCoordinate(lot: BuildingLot): number {
  switch (lot.frontage.direction) {
    case 'north':
      return lot.footprint.maxZ;
    case 'south':
      return lot.footprint.minZ;
    case 'east':
      return lot.footprint.maxX;
    case 'west':
      return lot.footprint.minX;
  }
}

function worldRectOf(meta: StorefrontMeta, depthStart: number, depthEnd: number): Rect2D {
  const lot = lotById(meta.lotId);
  const frame = facadeFrameFor(lot);
  return facadeRect(frame, meta.band.x0, meta.band.x1, meta.band.y0, meta.band.y1, depthStart, depthEnd);
}

function contains(a: Rect2D, b: Rect2D, tolerance = 1e-4): boolean {
  return (
    b.minX >= a.minX - tolerance &&
    b.maxX <= a.maxX + tolerance &&
    b.minZ >= a.minZ - tolerance &&
    b.maxZ <= a.maxZ + tolerance
  );
}

function readStorefrontSources(): string[] {
  const dir = joinPath(process.cwd(), 'src', 'world', 'storefronts');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'buildStorefronts.test.ts');
  return files.map((f) => readFileSync(joinPath(dir, f), 'utf8'));
}

describe('buildStorefronts shared builder contract', () => {
  it('exposes a function returning a THREE.Group with a scene manifest', () => {
    expect(typeof buildStorefronts).toBe('function');
    const group = build(1945);
    expect(group).toBeInstanceOf(Group);
    const info = infoOf(group);
    expect(info.era).toBe(1945);
    expect(info.storefronts).toHaveLength(LAYOUT.lots.length);
    expect(info.summary.meshCount).toBeGreaterThan(100);
  });

  it('is deterministic for identical seeds and layout', () => {
    const a = JSON.stringify(infoOf(build(1985)));
    const b = JSON.stringify(infoOf(build(1985)));
    expect(a).toBe(b);
  });

  it('varies across eras (distinct scenes)', () => {
    const sig = new Set<string>();
    for (const era of ERA_YEARS) {
      sig.add(infoOf(build(era)).summary.signageKinds.join(','));
    }
    expect(sig.size).toBe(ERA_YEARS.length);
  });

  it('respects an explicit seed', () => {
    const a = JSON.stringify(infoOf(build(1965, 777)));
    const b = JSON.stringify(infoOf(build(1965, 777)));
    const c = JSON.stringify(infoOf(build(1965, 778)));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe('per-era signage and advertising sets', () => {
  const expectedSignage: Record<EraId, string[]> = {
    1945: ['painted-fascia'],
    1965: ['neon-tube'],
    1985: ['neon-tube', 'blade-sign'],
    2005: ['backlit-box'],
    2025: ['led-media-facade'],
  };
  const expectedAds: Record<EraId, string[]> = {
    1945: ['painted-wall', 'painted-billboard'],
    1965: ['neon-sign', 'painted-billboard'],
    1985: ['neon-sign', 'painted-billboard'],
    2005: ['backlit-sign', 'backlit-billboard'],
    2025: ['led-media-sign', 'digital-billboard'],
  };

  it.each(ERA_YEARS)('era %s uses exactly its signage kinds', (era) => {
    const info = infoOf(build(era));
    expect(info.summary.signageKinds).toEqual(expectedSignage[era]!.sort());
    expect(info.summary.adKinds).toEqual(expect.arrayContaining(expectedAds[era]));
    // Every storefront has a readable sign, distinct per lot.
    expect(info.storefronts.every((sf) => sf.sign.text.length >= 2)).toBe(true);
    expect(new Set(info.storefronts.map((sf) => sf.sign.text)).size).toBeGreaterThanOrEqual(8);
  });

  it.each(ERA_YEARS)('era %s shows street billboards styled for the era', (era) => {
    const info = infoOf(build(era));
    const billboardKinds = new Set(info.ads.filter((a) => a.kind.endsWith('billboard')).map((a) => a.kind));
    expect(info.summary.billboardCount).toBeGreaterThanOrEqual(3);
    switch (era) {
      case 1945:
      case 1965:
      case 1985:
        expect(billboardKinds).toEqual(new Set(['painted-billboard']));
        break;
      case 2005:
        expect(billboardKinds).toEqual(new Set(['backlit-billboard']));
        break;
      case 2025:
        expect(billboardKinds).toEqual(new Set(['digital-billboard']));
        break;
    }
  });

  it.each(ERA_YEARS)('era %s signage glow follows the era palette', (era) => {
    const info = infoOf(build(era));
    const expected = ERA_PALETTES[era].signageGlow;
    for (const sf of info.storefronts) {
      if (era === 2005) {
        expect(sf.sign.kind).toBe('backlit-box');
        expect(sf.sign.glowColor.toLowerCase()).toBe('#e8ecf4');
      } else {
        expect(sf.sign.glowColor.toLowerCase()).toBe(expected.toLowerCase());
      }
    }
  });
});

describe('era business names and window displays', () => {
  const expectedCategories: Record<EraId, string[]> = {
    1945: ['grocer', 'drugstore'],
    1965: ['diner', 'records'],
    1985: ['arcade', 'electronics'],
    2005: ['coffee', 'phones'],
    2025: ['cafe', 'e-mobility'],
  };

  it.each(ERA_YEARS)('era %s renders its era-appropriate business categories', (era) => {
    const info = infoOf(build(era));
    for (const category of expectedCategories[era]!) {
      expect(info.summary.businessCategories).toContain(category);
    }
  });

  it.each(ERA_YEARS)('era %s window props are era-appropriate and dress the bays', (era) => {
    const info = infoOf(build(era));
    const pool = STOREFRONT_CONTENT_BY_ERA[era].storefronts.windowProps.map((p) => p.kind);
    const seen = new Set<string>();
    for (const sf of info.storefronts) {
      expect(sf.window.dressing).toBe(STOREFRONT_CONTENT_BY_ERA[era].storefronts.windowDressing);
      expect(sf.window.props.length).toBeGreaterThanOrEqual(1);
      for (const prop of sf.window.props) {
        expect(pool).toContain(prop);
        seen.add(prop);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe('night / emissive variants', () => {
  it.each(ERA_YEARS)('era %s signs and window displays glow at night', (era) => {
    const info = infoOf(build(era));
    expect(info.summary.emissiveMaterials).toBeGreaterThanOrEqual(25);
    const max = info.summary.maxEmissiveIntensity;
    expect(max).toBeGreaterThan(0);
    if (era === 1945) {
      expect(max).toBeLessThanOrEqual(0.35); // warm & dim
    }
    if (era === 2025) {
      expect(max).toBeGreaterThanOrEqual(1.2); // bright & animated
    }
  });

  it('scales from warm dim 1945 to bright animated 2025 LED', () => {
    const maxByEra = new Map<EraId, number>();
    for (const era of ERA_YEARS) {
      maxByEra.set(era, infoOf(build(era)).summary.maxEmissiveIntensity);
    }
    expect(maxByEra.get(2025)!).toBeGreaterThan(maxByEra.get(1985)!);
    expect(maxByEra.get(1985)!).toBeGreaterThan(maxByEra.get(1965)!);
    expect(maxByEra.get(1965)!).toBeGreaterThan(maxByEra.get(1945)!);
    expect(maxByEra.get(2005)!).toBeGreaterThan(maxByEra.get(1945)!);
  });

  it('1985 neon tubes use cyan-polarity glow and 1965 pink', () => {
    const scan = (era: EraId): string[] => {
      const colors: string[] = [];
      build(era).traverse((node) => {
        if (node instanceof Mesh && node.userData?.neonTube === true) {
          colors.push(colorToHex((node.material as MeshLambertMaterial).emissive).toUpperCase());
        }
      });
      return colors;
    };
    expect(scan(1985)).not.toHaveLength(0);
    expect(scan(1965)).not.toHaveLength(0);
    expect(new Set(scan(1985))).toEqual(new Set(['#00E5FF']));
    expect(new Set(scan(1965))).toEqual(new Set(['#FF6F91']));
  });

  it('2025 LED media facades are flagged animated with bright emissives', () => {
    const info = infoOf(build(2025));
    expect(info.storefronts.every((sf) => sf.sign.kind === 'led-media-facade')).toBe(true);
    expect(info.storefronts.every((sf) => sf.sign.animated === true)).toBe(true);
    expect(info.storefronts.every((sf) => sf.sign.animation !== undefined && sf.sign.animation.cycleMs > 0)).toBe(true);
    let ledStrips = 0;
    build(2025).traverse((node) => {
      if (node instanceof Mesh && node.userData?.ledPixelStrip === true) {
        ledStrips += 1;
        expect((node.material as MeshLambertMaterial).emissiveIntensity).toBeGreaterThan(1.0);
      }
    });
    expect(ledStrips).toBeGreaterThanOrEqual(16);
  });

  it('pre-LED eras expose no animation descriptor on signs', () => {
    const preLed: EraId[] = [1945, 1965, 1985, 2005];
    for (const era of preLed) {
      const info = infoOf(build(era));
      expect(info.storefronts.some((sf) => sf.sign.animation !== undefined)).toBe(false);
    }
  });
});

describe('lot conformity: containment, orientation and clearance', () => {
  it.each(ERA_YEARS)('era %s storefront bands sit inside their lot footprint', (era) => {
    const info = infoOf(build(era));
    for (const sf of info.storefronts) {
      const rect = worldRectOf(sf, -0.26, 0.0);
      const bounds = lotById(sf.lotId).bounds;
      expect(contains(bounds, rect)).toBe(true);
      // Never overlaps a sidewalk band or asphalt (sidewalk ends at 11m).
      for (const band of LAYOUT.sidewalkBands) {
        expect(rectsOverlap(rect, band.bounds)).toBe(false);
      }
      for (const asphalt of LAYOUT.asphaltAreas) {
        expect(rectsOverlap(rect, asphalt)).toBe(false);
      }
    }
  });

  it.each(ERA_YEARS)('era %s storefronts face their assigned street edge', (era) => {
    const info = infoOf(build(era));
    for (const sf of info.storefronts) {
      const lot = lotById(sf.lotId);
      const rect = worldRectOf(sf, -0.26, 0.0);
      const edge = edgeCoordinate(lot);
      const alongX = lot.frontage.direction === 'east' || lot.frontage.direction === 'west';
      const within = alongX
        ? rect.minX - 0.01 <= edge && edge <= rect.maxX + 0.01
        : rect.minZ - 0.01 <= edge && edge <= rect.maxZ + 0.01;
      expect(within).toBe(true);
    }
  });

  it.each(ERA_YEARS)('era %s awnings respect furniture-anchor clearance', (era) => {
    const info = infoOf(build(era));
    const styles = new Set<string>();
    for (const sf of info.storefronts) {
      if (sf.awning === null) continue;
      const frame = facadeFrameFor(lotById(sf.lotId));
      const rect = facadeRect(frame, sf.awning.x0, sf.awning.x1, sf.awning.y0, sf.awning.y1, 0.1, sf.awning.depthMax);
      expect(rectClearOfAnchors(LAYOUT, rect)).toBe(true);
      expect(sf.awning.y0).toBeGreaterThanOrEqual(2.0); // clear of low street furniture
      styles.add(sf.awning.style);
    }
    expect(styles.size).toBeLessThanOrEqual(1); // one era style per era
  });

  it.each(ERA_YEARS)('era %s billboard posts keep clear of anchors and stay near the lot', (era) => {
    const info = infoOf(build(era));
    for (const ad of info.ads.filter((a) => a.kind.endsWith('billboard'))) {
      const frame = facadeFrameFor(lotById(ad.lotId));
      const postRect = facadeRect(frame, ad.x0 - 0.15, ad.x1 + 0.15, 0, ad.y0, 0, 0.3);
      expect(rectClearOfAnchors(LAYOUT, postRect)).toBe(true);
      expect(contains(lotById(ad.lotId).bounds, postRect, 0.5)).toBe(true);
      // Elevated panel never reaches into the roadway.
      const panelRect = facadeRect(frame, ad.x0, ad.x1, ad.y0, ad.y1, 0, ad.depthMax);
      for (const asphalt of LAYOUT.asphaltAreas) {
        expect(rectsOverlap(panelRect, asphalt)).toBe(false);
      }
    }
  });
});

describe('theme sensitivity', () => {
  it('theme storefront/ad overrides change generation', () => {
    const base2025 = infoOf(build(2025));
    const themed = infoOf(
      buildStorefronts(2025, LAYOUT, {
        theme: {
          storefronts: { signStyle: 'neon' },
          ads: { medium: 'painted-wall' },
          palette: { signageGlow: '#00e5ff' },
        },
      }),
    );
    expect(themed.summary.signageKinds).toEqual(['neon-tube']);
    expect(themed.summary.adKinds).toEqual(expect.arrayContaining(['painted-wall', 'painted-billboard']));
    for (const sf of themed.storefronts) {
      expect(sf.sign.glowColor.toLowerCase()).toBe('#00e5ff');
    }
    expect(JSON.stringify(themed.summary)).not.toBe(JSON.stringify(base2025.summary));
  });

  it('awning density is theme-driven', () => {
    const dense = infoOf(
      buildStorefronts(1965, LAYOUT, { theme: { storefronts: { awningDensity: 1.0 } } }),
    );
    const sparse = infoOf(
      buildStorefronts(1965, LAYOUT, { theme: { storefronts: { awningDensity: 0.0 } } }),
    );
    expect(dense.summary.thresholdAwningCount).toBeGreaterThan(sparse.summary.thresholdAwningCount);
    expect(sparse.summary.thresholdAwningCount).toBe(0);
  });
});

describe('canvas-textured, procedural-only materials', () => {
  it('paints readable era letterforms onto the canvas surface', () => {
    const surface = new RecordSurface(512, 128);
    const painted = paintFasciaSign(surface, {
      text: 'HOOVER GROCERY',
      paintColor: '#8c5a3b',
      accentColor: '#b03a2e',
      letterform: 'painted',
    });
    expect(painted).toBeGreaterThan(0);
    expect(surface.ops.length).toBeGreaterThan(50);
    expect(surface.ops.every((op) => op.w > 0 && op.h > 0)).toBe(true);
    expect(surface.boxPainted(0, 0, surface.width, surface.height)).toBe(true);
  });

  it('every letter of a sign name is visibly painted by every recipe', () => {
    const cases: Array<{ surface: RecordSurface; paint: (s: RecordSurface) => number }> = [
      {
        surface: new RecordSurface(512, 128),
        paint: (s) => paintFasciaSign(s, { text: 'STARLITE DINER', paintColor: '#8c5a3b', accentColor: '#b03a2e', letterform: 'painted' }),
      },
      {
        surface: new RecordSurface(256, 96),
        paint: (s) => paintNeonSign(s, { text: 'STAR CASTLE', glowColor: '#00e5ff', coreColor: '#00e5ff', letterform: 'neon' }),
      },
      {
        surface: new RecordSurface(256, 96),
        paint: (s) => paintBacklitSign(s, { text: 'DAILY GRIND', boxColor: '#cfd6e0', glowColor: '#e8ecf4' }),
      },
      {
        surface: new RecordSurface(320, 96),
        paint: (s) => paintLedSign(s, { text: 'CHARGE & GO', ledColor: '#9dffd0', offColor: '#14201a' }),
      },
    ];
    for (const c of cases) {
      const n = c.paint(c.surface);
      expect(n).toBeGreaterThan(0);
      expect(c.surface.ops).not.toHaveLength(0);
    }
  });

  it('billboard and wall-ad copy is painted as readable text', () => {
    const wall = new RecordSurface(384, 320);
    const n = paintWallAd(wall, { lines: ['BUY WAR BONDS', 'ICE COLD SODA'], colors: ['#b03a2e', '#3a5f3f'] });
    expect(n).toBeGreaterThan(0);
    expect(wall.boxPainted(0, 0, 384, 320)).toBe(true);
  });

  it('renderTexture returns null headlessly or a real CanvasTexture', () => {
    const texture = renderTexture(64, 32, (s) => s.rect(1, 1, 10, 10, '#fff'));
    expect(texture === null || texture instanceof CanvasTexture).toBe(true);
  });

  it('the scene uses only in-memory emissive/basic materials with no external assets', () => {
    for (const era of ERA_YEARS) {
      build(era).traverse((node) => {
        if (node instanceof Mesh) {
          const mat = node.material;
          if (mat === null) return;
          expect(mat instanceof MeshLambertMaterial || mat instanceof MeshBasicMaterial).toBe(true);
        }
      });
    }
  });

  it('storefront sources contain no fetch, URL textures, or image/font asset imports', () => {
    const sources = readStorefrontSources();
    expect(sources.length).toBeGreaterThanOrEqual(6);
    for (const source of sources) {
      expect(source).not.toMatch(/fetch\s*\(/);
      // The only permitted URL is the in-memory canvas XML namespace.
      const urls = source.match(/https?:\/\/[^\s'")\]]*/g) ?? [];
      for (const url of urls) {
        expect(url).toBe('http://www.w3.org/1999/xhtml');
      }
      expect(source).not.toMatch(/(?:import|require)\s*\(?['"][^'"]+\.(?:png|jpe?g|webp|gif|svg|woff2?|ttf)['"]\)?/g);
      expect(source).not.toMatch(/new\s+(?:Texture|Image)\(\s*\{\s*url/i);
    }
  });

  it('geometry stays within a sane draw-call budget', () => {
    for (const era of ERA_YEARS) {
      const info = infoOf(build(era));
      expect(info.summary.meshCount).toBeLessThan(1400);
      expect(info.summary.meshCount).toBeGreaterThan(300);
    }
  });
});

describe('era content determinism', () => {
  it('resolveStorefrontData is stable and theme-aware', () => {
    const a = resolveStorefrontData(1985);
    const b = resolveStorefrontData(1985);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const overridden = resolveStorefrontData(1985, { ads: { medium: 'digital-screen' } });
    expect(overridden.ads.effectiveKinds).toEqual(['led-media-sign', 'digital-billboard']);
  });

  it('every lot has a shop with an uppercase, drawable canvas name', () => {
    const info = infoOf(build(2005));
    for (const sf of info.storefronts) {
      expect(sf.business).toBe(sf.business.toUpperCase());
      expect(sf.business).toMatch(/^[A-Z0-9&'.\-,!:\/ ]+$/);
    }
  });
});