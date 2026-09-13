/**
 * buildStorefronts — the shared storefront-builder entry point.
 *
 * Signature: `buildStorefronts(eraId, layout, options?) -> THREE.Group`
 *
 * For every `BlockLayout` lot the builder assembles the ground-floor
 * storefront band at the street-facing edge: bulkhead, door, window bays
 * with era prop silhouettes and emissive interior glow, a canvas-textured
 * era sign (painted / neon / backlit / LED), an era awning, and the era's
 * advertisement set (posters, painted-wall corner ads, street billboards).
 * Everything is seeded (`options.seed` or a layout/era-derived default) and
 * theme-driven: `options.theme` re-resolves the `EraStorefronts`/`EraAds`
 * slices so content edits change output.
 *
 * The returned group carries a machine-readable `userData` scene manifest
 * (`StorefrontSceneInfo`) used by scene-integration and the headless tests
 * to verify per-era signage kinds, business names, emissive night variants,
 * lot containment, theme sensitivity and determinism.
 */
import { Group, Mesh } from 'three';
import type { EraId, EraPalette } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';
import { createSeededRng, type Rng } from '../../lib/rng';
import { clamp } from '../../lib/math';
import type {
  BlockLayout,
  BuildingLot,
  FurnitureAnchorKind,
  Point3D,
  Rect2D,
} from '../layout';
import {
  GeometryCache,
  MaterialCache,
} from './materials';
import {
  resolveStorefrontData,
  type StorefrontThemeOverrides,
} from './eraStorefrontData';
import { buildStorefrontSign, facadeFrameFor, facadeRect, pointOn, type SignMeta, type SignContext } from './signage';
import { buildWindowDisplay, type AwningMeta, type WindowContext, type WindowMeta } from './windowDisplays';
import { buildBillboard, buildLotAdvertisements, preferredBillboardKind, type AdContext, type AdMeta } from './advertisements';

// ============================================================================
// Options & metadata
// ============================================================================

/**
 * Builder options. `theme` supplies partial `EraStorefronts`/`EraAds`
 * slices (or palette tokens) that re-resolve generation — theme edits
 * change output without touching shared contracts.
 */
export interface StorefrontBuildOptions {
  /** Determinism seed; defaults to a layout+era derived seed. */
  seed?: number;
  theme?: StorefrontThemeOverrides;
}

export interface StorefrontMeta {
  lotId: string;
  business: string;
  category: string;
  sign: SignMeta;
  window: WindowMeta;
  awning: AwningMeta | null;
  band: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  };
}

export interface StorefrontSceneInfo {
  era: EraId;
  seed: number;
  storefronts: StorefrontMeta[];
  ads: AdMeta[];
  summary: {
    signageKinds: string[];
    adKinds: string[];
    businessCategories: string[];
    windowProps: string[];
    billboardCount: number;
    meshCount: number;
    emissiveMaterials: number;
    maxEmissiveIntensity: number;
    thresholdAwningCount: number;
  };
}

// ============================================================================
// Furniture-anchor clearance (shared with tests and ad placement)
// ============================================================================

/** Horizontal exclusion radius (meters) used when checking clearances. */
export function anchorExclusionRadius(kind: FurnitureAnchorKind): number {
  switch (kind) {
    case 'tree':
      return 1.2;
    case 'booth':
      return 1.1;
    case 'bench':
      return 1.0;
    case 'traffic_light':
      return 0.9;
    case 'lamp_post':
      return 0.7;
    case 'fire_hydrant':
      return 0.6;
    case 'trash_bin':
      return 0.6;
    case 'mailbox':
      return 0.6;
    default:
      return 0.8;
  }
}

function circleIntersectsRect(cx: number, cz: number, r: number, rect: Rect2D): boolean {
  const nx = clamp(cx, rect.minX, rect.maxX);
  const nz = clamp(cz, rect.minZ, rect.maxZ);
  const dx = cx - nx;
  const dz = cz - nz;
  return dx * dx + dz * dz <= r * r;
}

/**
 * True when no furniture anchor's exclusion circle intersects `rect`
 * (optionally inflated by `margin`). Storefront protrusions must respect it.
 */
export function rectClearOfAnchors(layout: BlockLayout, rect: Rect2D, margin = 0): boolean {
  for (const anchor of layout.furnitureAnchors) {
    const r = anchorExclusionRadius(anchor.kind) + margin;
    if (circleIntersectsRect(anchor.position.x, anchor.position.z, r, rect)) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Assembler
// ============================================================================

const BAND_Y0 = 0;
const BAND_Y1 = 4.6;

/**
 * Build the complete per-era storefront/signage/advertisement scene.
 * Returns a THREE.Group positioned in world coordinates, conforming to the
 * shared storefront-builder contract.
 */
export function buildStorefronts(
  eraId: EraId,
  layout: BlockLayout,
  options: StorefrontBuildOptions = {},
): Group {
  const resolved = resolveStorefrontData(eraId, options.theme);
  const palette: EraPalette = { ...ERA_PALETTES[eraId], ...(options.theme?.palette ?? {}) };
  const seed = options.seed ?? deriveSeed(layout.seed, eraId);
  const rng = createSeededRng(seed);
  const geoms = new GeometryCache();
  const mats = new MaterialCache();

  const root = new Group();
  root.name = `storefronts-${eraId}`;

  const storefronts: StorefrontMeta[] = [];
  const ads: AdMeta[] = [];
  const isClear = (rect: Rect2D, margin = 0): boolean => rectClearOfAnchors(layout, rect, margin);

  const signCtx: SignContext = { rng, geoms, mats, palette, era: eraId };
  const windowCtx: WindowContext = { rng, geoms, mats, palette, isClear };
  const adCtx: AdContext = { rng, geoms, mats, palette, era: eraId, isClear };

  const billboardKind = preferredBillboardKind(resolved.ads);
  const billboardLots = selectBillboardLots(layout, resolved.ads.density, rng, billboardKind !== null);

  for (const lot of layout.lots) {
    const meta = assembleStorefront(root, lot, palette, resolved.storefronts, signCtx, windowCtx, rng);
    storefronts.push(meta);

    const secondaryFrame = lot.secondaryFrontage !== undefined ? facadeFrameFor(lot, 'secondary') : undefined;
    const hasBillboard = billboardKind !== null && billboardLots.includes(lot.id);
    const results = buildLotAdvertisements({
      frame: facadeFrameFor(lot),
      secondaryFrame,
      isCorner: secondaryFrame !== undefined,
      data: resolved.ads,
      palette,
      ctx: adCtx,
      hasBillboard,
    });
    for (const result of results) {
      root.add(result.group);
      ads.push(result.meta);
    }

    if (hasBillboard && billboardKind !== null) {
      const billboard = buildBillboard(
        {
          frame: facadeFrameFor(lot),
          data: resolved.ads,
          palette,
          ctx: adCtx,
          isCorner: secondaryFrame !== undefined,
          hasBillboard: true,
        },
        billboardKind,
      );
      if (billboard !== null) {
        root.add(billboard.group);
        ads.push(billboard.meta);
      }
    }
  }

  const summary = computeSummary(storefronts, ads, root);
  root.userData = {
    era: eraId,
    seed,
    storefronts,
    ads,
    summary,
  } satisfies StorefrontSceneInfo;

  return root;
}

function assembleStorefront(
  root: Group,
  lot: BuildingLot,
  palette: EraPalette,
  data: ReturnType<typeof resolveStorefrontData>['storefronts'],
  signCtx: SignContext,
  windowCtx: WindowContext,
  rng: Rng,
): StorefrontMeta {
  const frame = facadeFrameFor(lot);
  const business = pickBusiness(data, rng, lotIndex(lot.id));

  const signResult = buildStorefrontSign({
    frame,
    data,
    palette,
    businessName: business.name,
    ctx: signCtx,
  });
  root.add(signResult.group);

  const windowResult = buildWindowDisplay({
    frame,
    data,
    palette,
    ctx: windowCtx,
  });
  root.add(windowResult.group);

  return {
    lotId: lot.id,
    business: business.name,
    category: business.category,
    sign: signResult.meta,
    window: windowResult.window,
    awning: windowResult.awning,
    band: {
      x0: 0.05 * frame.width,
      x1: 0.95 * frame.width,
      y0: BAND_Y0,
      y1: BAND_Y1,
    },
  };
}

function pickBusiness(
  data: ReturnType<typeof resolveStorefrontData>['storefronts'],
  rng: Rng,
  index: number,
): { name: string; category: string } {
  const pool = data.businessPool;
  if (pool.length === 0) {
    return { name: 'MAIN STREET TRADERS', category: 'general' };
  }
  // Round-robin category so the full era pool is always represented on the
  // block; the specific shop name stays seeded/random.
  const business = pool[index % pool.length]!;
  const names = business.names;
  const name = names.length === 0 ? 'MAIN STREET TRADERS' : names[rng.int(0, names.length - 1)]!;
  return { name, category: business.category };
}

function lotIndex(lotId: string): number {
  // Lots are ordered NE-01..SW-04; derive a stable 0..N index from the id.
  const tokens = lotId.split('-');
  const quad = tokens[1] ?? 'ne';
  const num = Number(tokens[2] ?? '1');
  const quadIndex = quad === 'nw' ? 4 : quad === 'se' ? 8 : quad === 'sw' ? 12 : 0;
  return quadIndex + Math.max(0, (num ?? 1) - 1);
}

function selectBillboardLots(
  layout: BlockLayout,
  density: number,
  rng: Rng,
  enabled: boolean,
): string[] {
  if (!enabled) return [];
  const target = Math.min(10, Math.max(4, Math.round(layout.lots.length * density)));
  const corners = layout.lots.filter((l) => l.secondaryFrontage !== undefined);
  const others = layout.lots.filter((l) => l.secondaryFrontage === undefined);
  const selected: string[] = [];
  const addIfMissing = (lot: BuildingLot, probability: number): void => {
    if (selected.length >= target) return;
    if (rng.chance(probability) && !selected.includes(lot.id)) {
      selected.push(lot.id);
    }
  };
  // Corners first for symmetry, then every other lot, then force-fill.
  for (const lot of corners) addIfMissing(lot, Math.min(1, density * 1.7));
  for (const lot of others) addIfMissing(lot, density);
  for (const lot of [...corners, ...others]) {
    if (selected.length >= target) break;
    if (!selected.includes(lot.id)) selected.push(lot.id);
  }
  return selected;
}

function deriveSeed(layoutSeed: number, eraId: EraId): number {
  return (layoutSeed * 131 + eraId) & 0x7fffffff;
}

function computeSummary(
  storefronts: StorefrontMeta[],
  ads: AdMeta[],
  root: Group,
): StorefrontSceneInfo['summary'] {
  const signageKinds = new Set<string>();
  const businessCategories = new Set<string>();
  const windowProps = new Set<string>();
  let thresholdAwningCount = 0;

  for (const sf of storefronts) {
    signageKinds.add(sf.sign.kind);
    businessCategories.add(sf.category);
    for (const prop of sf.window.props) windowProps.add(prop);
    if (sf.awning !== null) thresholdAwningCount += 1;
  }

  const adKinds = new Set<string>(ads.map((a) => a.kind));
  let meshCount = 0;
  let emissiveMaterials = 0;
  let maxEmissiveIntensity = 0;
  root.traverse((node) => {
    if (node instanceof Mesh) {
      meshCount += 1;
      const mat = node.material;
      if (mat !== null && typeof mat.emissiveIntensity === 'number' && mat.emissiveIntensity > 0) {
        // Skip materials whose emissive is effectively black (the default
        // intensity is 1.0 even with a zero emissive color).
        const emiss = mat.emissive;
        const luminance =
          emiss === null ? 0 : 0.2126 * emiss.r + 0.7152 * emiss.g + 0.0722 * emiss.b;
        if (luminance > 0.001) {
          emissiveMaterials += 1;
          maxEmissiveIntensity = Math.max(maxEmissiveIntensity, mat.emissiveIntensity);
        }
      }
    }
  });
  return {
    signageKinds: [...signageKinds].filter((k) => k !== '').sort(),
    adKinds: [...adKinds].filter((k) => k !== '').sort(),
    businessCategories: [...businessCategories].sort(),
    windowProps: [...windowProps].sort(),
    billboardCount: ads.filter((a) => a.kind.endsWith('billboard')).length,
    meshCount,
    emissiveMaterials,
    maxEmissiveIntensity,
    thresholdAwningCount,
  };
}

export { facadeFrameFor, facadeRect, pointOn };

export type { Point3D };