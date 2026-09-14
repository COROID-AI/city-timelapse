/**
 * Street advertisements: posters, painted-wall ghost ads, era-styled
 * billboards, and smaller sign-fixture ads.
 *
 * Ad kinds are era-driven (`EraAdsData.effectiveKinds`):
 *   - 1945: painted-wall corner ads + painted billboards + posters
 *   - 1965/1985: neon ad fixtures + painted billboards (+ posters)
 *   - 2005: backlit fixtures + backlit billboards
 *   - 2025: LED media fixtures + digital billboards
 * Billboards stand at the street-facing lot edge (posts inside the lot,
 * panel elevated above the storefront band), always respecting the
 * furniture-anchor clearance predicate supplied by the assembler.
 */
import { Group, Mesh } from 'three';
import type { Rect2D } from '../layout';
import type { EraId, EraPalette } from '../../era/types';
import type { Rng } from '../../lib/rng';
import {
  GeometryCache,
  MaterialCache,
  paintRule,
  paintTextBitmap,
  renderTexture,
  shadeColor,
  type LetterformMode,
  type PaintSurface,
} from './materials';
import type { AdKind, EraAdsData } from './eraStorefrontData';
import { facadeRect, pointOn, type FacadeFrame } from './signage';

// ============================================================================
// Metadata
// ============================================================================

export interface AdMeta {
  kind: AdKind;
  copy: string;
  lotId: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Outward depth bounds of the fixture (for clearance/containment). */
  depthMin: number;
  depthMax: number;
  emissive: boolean;
  intensity: number;
  animated?: boolean;
  /** Animation descriptor for digital/LED ad media (cycled in-scene). */
  animation?: { cycleMs: number; sequence: string };
}

export interface AdBuildResult {
  group: Group;
  meta: AdMeta;
}

export interface AdContext {
  rng: Rng;
  geoms: GeometryCache;
  mats: MaterialCache;
  palette: EraPalette;
  era: EraId;
  /** Furniture-anchor clearance predicate from the assembler. */
  isClear: (rect: Rect2D, margin?: number) => boolean;
}

// ============================================================================
// Canvas recipes
// ============================================================================

export interface BillboardRecipeOptions {
  headline: string;
  subline: string;
  borderColor: string;
  textColor: string;
  /** 1985 neon-rimmed billboards use a glow treatment. */
  neonRim: boolean;
}

/** Classic painted/backlit billboard recipe with a frame and two text lines. */
export function paintBillboardPanel(surface: PaintSurface, options: BillboardRecipeOptions): number {
  const { headline, subline, borderColor, textColor, neonRim } = options;
  const w = surface.width;
  const h = surface.height;
  surface.rect(0, 0, w, h, shadeColor(textColor, 0.55));
  const frameW = Math.max(2, Math.floor(h * 0.07));
  surface.rect(0, 0, w, frameW, borderColor);
  surface.rect(0, h - frameW, w, frameW, borderColor);
  surface.rect(0, 0, frameW, h, borderColor);
  surface.rect(w - frameW, 0, frameW, h, borderColor);
  paintRule(surface, frameW + 2, w - frameW - 2, Math.floor(h * 0.62), Math.max(1, Math.floor(h * 0.04)), borderColor);
  const cellHead = Math.max(1, Math.floor((h * 0.28) / 7));
  const report = paintTextBitmap(surface, {
    text: headline.toUpperCase(),
    x: Math.max(frameW + 2, Math.floor((w - (headline.length * 6 - 1) * cellHead) / 2)),
    y: Math.floor(h * 0.14),
    cell: cellHead,
    color: textColor,
    mode: neonRim ? 'glow' : 'shadow',
    glowColor: borderColor,
    shadowColor: shadeColor(textColor, 0.5),
  });
  const cellSub = Math.max(1, Math.floor((h * 0.13) / 7));
  paintTextBitmap(surface, {
    text: subline.toUpperCase(),
    x: Math.max(frameW + 2, Math.floor((w - (subline.length * 6 - 1) * cellSub) / 2)),
    y: Math.floor(h * 0.7),
    cell: cellSub,
    color: shadeColor(textColor, 0.85),
    mode: 'plain',
  });
  return report.paintedCells;
}

export interface WallAdRecipeOptions {
  lines: readonly string[];
  colors: readonly string[];
}

/** 1945 painted-wall ghost ad: stacked hand-lettered lines. */
export function paintWallAd(surface: PaintSurface, options: WallAdRecipeOptions): number {
  const { lines, colors } = options;
  const w = surface.width;
  const h = surface.height;
  const linesToDraw = lines.slice(0, 4);
  const cell = Math.max(1, Math.floor((h * 0.72) / 7 / linesToDraw.length));
  let total = 0;
  for (let i = 0; i < linesToDraw.length; i += 1) {
    const line = linesToDraw[i]!.toUpperCase();
    const textW = (line.length * 6 - 1) * cell;
    const x = Math.max(1, Math.floor((w - textW) / 2 + (i % 2 === 0 ? 0 : cell * 2)));
    const y = Math.floor(h * (0.22 + i * 0.19));
    const color = colors[i % colors.length]!;
    const report = paintTextBitmap(surface, {
      text: line,
      x,
      y,
      cell,
      color,
      mode: 'shadow',
      shadowColor: shadeColor(color, 0.4),
    });
    total += report.paintedCells;
  }
  return total;
}

// ============================================================================
// Billboard / ad builders
// ============================================================================

export interface AdInput {
  frame: FacadeFrame;
  data: EraAdsData;
  palette: EraPalette;
  ctx: AdContext;
  /** Whether this lot is a corner lot with a secondary facade. */
  isCorner: boolean;
  secondaryFrame?: FacadeFrame;
  /** True when the assembler has already placed a billboard here. */
  hasBillboard: boolean;
}

/** All advertisements attached to one lot's storefront. */
export function buildLotAdvertisements(input: AdInput): AdBuildResult[] {
  const { data, ctx } = input;
  const results: AdBuildResult[] = [];

  if (data.effectiveKinds.includes('painted-wall') && input.secondaryFrame !== undefined) {
    const wall = buildPaintedWallAd(input, input.secondaryFrame);
    if (wall !== null) results.push(wall);
  }

  if (data.effectiveKinds.includes('poster')) {
    const posters = buildPosters(input);
    results.push(...posters);
  }

  if (!input.hasBillboard) {
    const fixture = buildSignFixtureAd(input);
    if (fixture !== null) results.push(fixture);
  }
  void ctx;
  return results;
}

/** Standalone street billboard placed by the assembler on selected lots. */
export function buildBillboard(input: AdInput, kind: AdKind): AdBuildResult | null {
  const { frame, data, palette, ctx } = input;
  if (kind !== 'painted-billboard' && kind !== 'backlit-billboard' && kind !== 'digital-billboard') {
    return null;
  }
  const rng = ctx.rng;
  const span = rng.pick([6.5, 7.5, 8.5] as const);
  const t0 = Math.max(1.5, (frame.width - span) / 2 + rng.range(-3, 3));
  const t1 = Math.min(frame.width - 1.5, t0 + span);
  if (t1 - t0 < 5) return null;

  const y0 = 4.7;
  const y1 = 6.9;
  const panelDepth = kind === 'digital-billboard' ? 0.8 : 0.55;
  const postDepth = 0.3;

  // Ground posts must stay clear of sidewalk furniture.
  const postRect = facadeRect(frame, t0 - 0.15, t1 + 0.15, 0, y0, 0, postDepth);
  if (!ctx.isClear(postRect, 0.0)) return null;

  const headline = pickCopy(data, rng);
  const subline = pickSubline(data, rng, headline);
  const group = new Group();
  group.name = `${frame.lotId}-billboard-${kind}`;

  const neonRim = kind === 'painted-billboard' && ctx.era === 1985;
  const texture = renderTexture(480, 320, (surface) => {
    paintBillboardPanel(surface, {
      headline,
      subline,
      borderColor: data.colors[0] ?? '#444444',
      textColor: data.colors[1] ?? '#dddddd',
      neonRim,
    });
  });

  let panelMat: ReturnType<MaterialCache['lambert']>;
  let emissiveIntensity = 0;
  if (kind === 'painted-billboard') {
    emissiveIntensity = ctx.era === 1945 ? 0.1 : 0.18;
    panelMat = ctx.mats.lambert('#8a8578', { color: palette.signageGlow, intensity: emissiveIntensity }, texture);
  } else if (kind === 'backlit-billboard') {
    emissiveIntensity = 0.85;
    panelMat = ctx.mats.lambert('#d4dae2', { color: '#e8ecf4', intensity: emissiveIntensity }, texture);
  } else {
    emissiveIntensity = 1.3;
    panelMat = ctx.mats.lambert('#101820', { color: palette.signageGlow, intensity: emissiveIntensity }, texture);
  }

  const panel = new Mesh(ctx.geoms.box(t1 - t0, y1 - y0, 0.12), panelMat);
  const pc = pointOn(frame, (t0 + t1) / 2, (y0 + y1) / 2, panelDepth);
  panel.position.set(pc.x, pc.y, pc.z);
  panel.userData = { billboard: kind, animated: kind === 'digital-billboard' };
  group.add(panel);

  const postMat = ctx.mats.lambert(ctx.era === 2025 ? '#2c3138' : '#6a6154');
  for (const t of [t0 + 0.45, t1 - 0.45]) {
    const mesh = new Mesh(ctx.geoms.box(0.28, y0, 0.28), postMat);
    const c = pointOn(frame, t, y0 / 2, postDepth - 0.05);
    mesh.position.set(c.x, c.y, c.z);
    group.add(mesh);
    const crossbar = new Mesh(ctx.geoms.box(t1 - t0 - 0.9, 0.14, 0.14), postMat);
    const cc = pointOn(frame, (t0 + t1) / 2, y0 - 0.1, postDepth);
    crossbar.position.set(cc.x, cc.y, cc.z);
    group.add(crossbar);
  }

  return {
    group,
    meta: {
      kind,
      copy: headline,
      lotId: frame.lotId,
      x0: t0,
      x1: t1,
      y0,
      y1,
      depthMin: 0,
      depthMax: panelDepth,
      emissive: true,
      intensity: emissiveIntensity,
      animated: kind === 'digital-billboard',
      animation: kind === 'digital-billboard' ? { cycleMs: 900, sequence: 'ad-rotate' } : undefined,
    },
  };
}

function buildPaintedWallAd(input: AdInput, secondary: FacadeFrame): AdBuildResult | null {
  const { data, palette, ctx } = input;
  const kind: AdKind = 'painted-wall';
  const t0 = 0.04 * secondary.width;
  const t1 = 0.96 * secondary.width;
  const y0 = 0.8;
  const y1 = 4.3;
  const copy = data.copyPool.slice(0, 3);

  const texture = renderTexture(384, 320, (surface) => {
    paintWallAd(surface, { lines: copy, colors: data.colors });
  });
  const mat = ctx.mats.lambert(palette.facadeMaterials[2] ?? '#b0a493', { color: palette.signageGlow, intensity: 0.1 }, texture);
  const panel = new Mesh(ctx.geoms.box(t1 - t0, y1 - y0, 0.1), mat);
  const c = pointOn(secondary, (t0 + t1) / 2, (y0 + y1) / 2, 0.05);
  panel.position.set(c.x, c.y, c.z);
  panel.userData = { paintedWallAd: true };
  const group = new Group();
  group.name = `${input.frame.lotId}-painted-wall`;
  group.add(panel);
  return {
    group,
    meta: {
      kind,
      copy: copy[0] ?? '',
      lotId: input.frame.lotId,
      x0: t0,
      x1: t1,
      y0,
      y1,
      depthMin: 0,
      depthMax: 0.1,
      emissive: false,
      intensity: 0.1,
    },
  };
}

function buildPosters(input: AdInput): AdBuildResult[] {
  const { frame, data, palette, ctx } = input;
  const results: AdBuildResult[] = [];
  const rng = ctx.rng;
  const count = rng.chance(0.6) ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const t0 = rng.chance(0.5) ? frame.width * 0.09 : frame.width * 0.86;
    const t1 = t0 + 1.0;
    const y0 = 3.15 + i * 0.02;
    const y1 = y0 + 1.0;
    const copy = pickCopy(data, rng);
    const texture = renderTexture(96, 96, (surface) => {
      paintTextBitmap(surface, {
        text: copy.slice(0, 8),
        x: 8,
        y: 12,
        cell: 6,
        color: data.colors[i % data.colors.length]!,
        mode: 'plain',
      });
      surface.rect(0, 0, 96, 10, shadeColor(data.colors[0] ?? '#555555', 0.8));
      surface.rect(0, 86, 96, 10, shadeColor(data.colors[0] ?? '#555555', 0.8));
    });
    const mat = ctx.mats.lambert('#c9c2b4', { color: palette.signageGlow, intensity: 0.25 }, texture);
    const panel = new Mesh(ctx.geoms.box(t1 - t0, y1 - y0, 0.06), mat);
    const c = pointOn(frame, (t0 + t1) / 2, (y0 + y1) / 2, 0.06);
    panel.position.set(c.x, c.y, c.z);
    panel.userData = { poster: true };
    const group = new Group();
    group.name = `${frame.lotId}-poster-${i}`;
    group.add(panel);
    results.push({
      group,
      meta: {
        kind: 'poster',
        copy,
        lotId: frame.lotId,
        x0: t0,
        x1: t1,
        y0,
        y1,
        depthMin: 0,
        depthMax: 0.12,
        emissive: false,
        intensity: 0.25,
      },
    });
  }
  return results;
}

function buildSignFixtureAd(input: AdInput): AdBuildResult | null {
  const { frame, data, palette, ctx } = input;
  const kinds = data.effectiveKinds;
  const kind: AdKind | undefined =
    kinds.includes('neon-sign') ? 'neon-sign'
    : kinds.includes('backlit-sign') ? 'backlit-sign'
    : kinds.includes('led-media-sign') ? 'led-media-sign'
    : undefined;
  if (kind === undefined) return null;

  const t0 = frame.width * 0.14;
  const t1 = t0 + 2.6;
  const y0 = 2.95;
  const y1 = 3.55;
  const copy = pickCopy(data, ctx.rng);
  let emissiveSpec: { color: string; intensity: number };
  let panelColor = '#141420';
  let matKind: LetterformMode = 'glow';
  if (kind === 'neon-sign') {
    emissiveSpec = { color: palette.signageGlow, intensity: ctx.era === 1985 ? 1.0 : 0.7 };
  } else if (kind === 'backlit-sign') {
    emissiveSpec = { color: '#e8ecf4', intensity: 0.75 };
    panelColor = '#cfd6e0';
    matKind = 'outline';
  } else {
    emissiveSpec = { color: palette.signageGlow, intensity: 1.2 };
    panelColor = '#101820';
    matKind = 'led';
  }

  const texture = renderTexture(256, 64, (surface) => {
    paintTextBitmap(surface, {
      text: copy.slice(0, 14),
      x: 8,
      y: 8,
      cell: 6,
      color: emissiveSpec.color,
      mode: matKind,
      glowColor: emissiveSpec.color,
      shadowColor: shadeColor(emissiveSpec.color, 0.3),
    });
  });
  const mat = ctx.mats.lambert(panelColor, emissiveSpec, texture);
  const panel = new Mesh(ctx.geoms.box(t1 - t0, y1 - y0, 0.09), mat);
  const c = pointOn(frame, (t0 + t1) / 2, (y0 + y1) / 2, 0.1);
  panel.position.set(c.x, c.y, c.z);
  panel.userData = { signFixtureAd: kind };
  const group = new Group();
  group.name = `${frame.lotId}-ad-${kind}`;
  group.add(panel);
  return {
    group,
    meta: {
      kind,
      copy,
      lotId: frame.lotId,
      x0: t0,
      x1: t1,
      y0,
      y1,
      depthMin: 0,
      depthMax: 0.15,
      emissive: true,
      intensity: emissiveSpec.intensity,
      animated: kind === 'led-media-sign',
      animation: kind === 'led-media-sign' ? { cycleMs: 1100, sequence: 'pulse-scan' } : undefined,
    },
  };
}

// ============================================================================
// Copy helpers
// ============================================================================

function pickCopy(data: EraAdsData, rng: Rng): string {
  if (data.copyPool.length === 0) return 'GRAND OPENING';
  return data.copyPool[rng.int(0, data.copyPool.length - 1)]!;
}

function pickSubline(data: EraAdsData, rng: Rng, headline: string): string {
  const pool = data.copyPool.filter((c) => c !== headline);
  if (pool.length === 0) return 'EST. ' + String(data.medium);
  return pool[rng.int(0, pool.length - 1)]!;
}

/** Billboard kind preference per ads profile, used by the assembler. */
export function preferredBillboardKind(data: EraAdsData): AdKind | null {
  if (data.effectiveKinds.includes('digital-billboard')) return 'digital-billboard';
  if (data.effectiveKinds.includes('backlit-billboard')) return 'backlit-billboard';
  if (data.effectiveKinds.includes('painted-billboard')) return 'painted-billboard';
  return null;
}