/**
 * Storefront signage: the fascia sign band plus era-specific sign fixtures.
 *
 * Shared facade-frame helpers live here too — `facadeFrameFor`, `pointOn`,
 * `facadeRect` — because every storefront sub-builder (signage, window
 * displays, advertisements) positions itself in the same lot-anchored local
 * frame: `t` runs along the street-facing edge (0..width) and `depth` runs
 * outward toward the street (negative = into the lot).
 *
 * Sign kinds built per era (driven by `EraStorefrontsData.signageKinds`):
 * painted-fascia (1945), neon-tube (1965/1985), blade-sign (1985),
 * backlit-box (2005), led-media-facade (2025). All names are painted onto
 * canvas textures; night looks come from `emissive`/`emissiveIntensity`.
 */
import { Group, Mesh } from 'three';
import type { BuildingLot, BuildingLotFrontage, Point3D, Rect2D, Vector2D } from '../layout';
import type { EraId, EraPalette } from '../../era/types';
import type { Rng } from '../../lib/rng';
import {
  GeometryCache,
  MaterialCache,
  paintRule,
  paintTextBitmap,
  renderTexture,
  shadeColor,
  type EmissiveSpec,
  type PaintSurface,
} from './materials';
import type {
  EraStorefrontsData,
  LetterformStyle,
  SignageKind,
} from './eraStorefrontData';

// ============================================================================
// Facade frame (shared local geometry)
// ============================================================================

export interface FacadeFrame {
  lotId: string;
  streetName: string;
  /** Facade extent along the street edge, meters. */
  width: number;
  /** Unit vector along the facade (increasing t). */
  tangent: Vector2D;
  /** Unit vector pointing outward from the lot toward the street. */
  outward: Vector2D;
  /** World-space anchor = entry point at street edge (y = elevation). */
  origin: Point3D;
}

export function facadeFrameFor(lot: BuildingLot, side: 'primary' | 'secondary' = 'primary'): FacadeFrame {
  const frontage = side === 'primary' ? lot.frontage : lot.secondaryFrontage;
  if (frontage === undefined) {
    throw new Error(`lot ${lot.id} has no ${side} frontage`);
  }
  const tangent = tangentOf(frontage.direction);
  const outward = normalOf(frontage.direction);
  const width =
    side === 'primary'
      ? lot.storefrontZone.facadeWidth
      : tangent.x !== 0 ? lot.footprint.width : lot.footprint.depth;
  return {
    lotId: lot.id,
    streetName: frontage.streetName,
    width,
    tangent,
    outward,
    origin: { ...frontage.entryPoint },
  };
}

function normalOf(direction: BuildingLotFrontage['direction']): Vector2D {
  switch (direction) {
    case 'north':
      return { x: 0, z: 1 };
    case 'south':
      return { x: 0, z: -1 };
    case 'east':
      return { x: 1, z: 0 };
    case 'west':
      return { x: -1, z: 0 };
  }
}

function tangentOf(direction: BuildingLotFrontage['direction']): Vector2D {
  switch (direction) {
    case 'north':
    case 'south':
      return { x: 1, z: 0 };
    case 'east':
    case 'west':
      return { x: 0, z: 1 };
  }
}

/** Point on (or near) the facade: t along the edge, y height, depth outward. */
export function pointOn(frame: FacadeFrame, t: number, y: number, depth: number): Point3D {
  const along = t - frame.width / 2;
  return {
    x: frame.origin.x + frame.tangent.x * along + frame.outward.x * depth,
    y: frame.origin.y + y,
    z: frame.origin.z + frame.tangent.z * along + frame.outward.z * depth,
  };
}

/** XZ rectangle of a facade element spanning [t0,t1] at heights y0..y1 and depths d0..d1. */
export function facadeRect(
  frame: FacadeFrame,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  d0: number,
  d1: number,
): Rect2D {
  const p0 = pointOn(frame, t0, y0, Math.min(d0, d1));
  const p1 = pointOn(frame, t1, y1, Math.max(d0, d1));
  return {
    minX: Math.min(p0.x, p1.x),
    maxX: Math.max(p0.x, p1.x),
    minZ: Math.min(p0.z, p1.z),
    maxZ: Math.max(p0.z, p1.z),
  };
}

// ============================================================================
// Sign metadata
// ============================================================================

export interface SignMeta {
  kind: SignageKind;
  text: string;
  /** Tangent span of the sign (t0..t1). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Farthest outward depth reached by the sign fixtures, meters. */
  depthMax: number;
  glowColor: string;
  intensity: number;
  animated?: boolean;
  /** Animation descriptor for era sign styles that cycle in-scene. */
  animation?: {
    /** Frame-cycle duration in ms (drives the scene's emissive pulse). */
    cycleMs: number;
    /** Sequence keyword for the polish/QA animation pass. */
    sequence: string;
  };
}

export interface SignContext {
  rng: Rng;
  geoms: GeometryCache;
  mats: MaterialCache;
  palette: EraPalette;
  era: EraId;
}

export interface SignBuildResult {
  group: Group;
  meta: SignMeta;
}

// ============================================================================
// Canvas recipes (also exercised headlessly by tests via RecordSurface)
// ============================================================================

export interface FasciaRecipeOptions {
  text: string;
  paintColor: string;
  accentColor: string;
  letterform: LetterformStyle;
  subtext?: string;
}

/** Painted fascia recipe: rules + lettering with a painted double-strike. */
export function paintFasciaSign(surface: PaintSurface, options: FasciaRecipeOptions): number {
  const { text, paintColor, accentColor, letterform, subtext } = options;
  const w = surface.width;
  const h = surface.height;
  const mode =
    letterform === 'painted' ? 'shadow'
    : letterform === 'neon' ? 'glow'
    : letterform === 'backlit' ? 'outline'
    : 'led';
  const cell = Math.max(1, Math.floor((h * 0.42) / 7));
  const textW = (text.length * 6 - 1) * cell;
  const x = Math.max(1, Math.floor((w - textW) / 2));
  const y = Math.floor(h * 0.28);
  paintRule(surface, 1, w - 1, Math.floor(h * 0.18), Math.max(1, Math.floor(cell * 0.45)), accentColor);
  const report = paintTextBitmap(surface, {
    text,
    x,
    y,
    cell,
    color: paintColor,
    mode,
    glowColor: accentColor,
    shadowColor: shadeColor(paintColor, 0.5),
  });
  paintRule(surface, 1, w - 1, Math.floor(h * 0.82), Math.max(1, Math.floor(cell * 0.45)), accentColor);
  if (subtext !== undefined && subtext.length > 0) {
    const cell2 = Math.max(1, Math.floor((h * 0.16) / 7));
    paintTextBitmap(surface, {
      text: subtext,
      x: Math.max(1, Math.floor((w - (subtext.length * 6 - 1) * cell2) / 2)),
      y: Math.floor(h * 0.78),
      cell: cell2,
      color: shadeColor(paintColor, 0.8),
      mode: 'plain',
    });
  }
  return report.paintedCells;
}

export interface NeonRecipeOptions {
  text: string;
  glowColor: string;
  coreColor: string;
  /** Kept for API symmetry; neon always uses the 'glow' treatment. */
  letterform: LetterformStyle;
}

/** Neon recipe: glowing bloomed letterforms on a dark glass face. */
export function paintNeonSign(surface: PaintSurface, options: NeonRecipeOptions): number {
  const { text, glowColor, coreColor } = options;
  const w = surface.width;
  const h = surface.height;
  const cell = Math.max(1, Math.floor((h * 0.6) / 7));
  const textW = (text.length * 6 - 1) * cell;
  const x = Math.max(1, Math.floor((w - textW) / 2));
  const y = Math.floor(h * 0.2);
  const report = paintTextBitmap(surface, {
    text,
    x,
    y,
    cell,
    color: coreColor,
    mode: 'glow',
    glowColor,
    shadowColor: shadeColor(glowColor, 0.35),
  });
  return report.paintedCells;
}

export interface BacklitRecipeOptions {
  text: string;
  boxColor: string;
  glowColor: string;
}

/** Backlit box recipe: bright translucent face with punched lettering. */
export function paintBacklitSign(surface: PaintSurface, options: BacklitRecipeOptions): number {
  const { text, boxColor, glowColor } = options;
  const w = surface.width;
  const h = surface.height;
  const cell = Math.max(1, Math.floor((h * 0.55) / 7));
  const textW = (text.length * 6 - 1) * cell;
  const x = Math.max(1, Math.floor((w - textW) / 2));
  const y = Math.floor(h * 0.22);
  const report = paintTextBitmap(surface, {
    text,
    x,
    y,
    cell,
    color: glowColor,
    mode: 'outline',
    glowColor: boxColor,
  });
  return report.paintedCells;
}

export interface LedRecipeOptions {
  text: string;
  ledColor: string;
  offColor: string;
}

/** LED media facade recipe: luminous pixel lettering with dark sockets. */
export function paintLedSign(surface: PaintSurface, options: LedRecipeOptions): number {
  const { text, ledColor, offColor } = options;
  const w = surface.width;
  const h = surface.height;
  const cell = Math.max(1, Math.floor((h * 0.5) / 7));
  const textW = (text.length * 6 - 1) * cell;
  const x = Math.max(1, Math.floor((w - textW) / 2));
  const y = Math.floor(h * 0.25);
  const report = paintTextBitmap(surface, {
    text,
    x,
    y,
    cell,
    color: ledColor,
    mode: 'led',
    glowColor: ledColor,
    shadowColor: offColor,
  });
  return report.paintedCells;
}

// ============================================================================
// Geometry helpers
// ============================================================================

/** Add a thin box whose front face rests at facade depth `depth`. */
function addBox(
  group: Group,
  geoms: GeometryCache,
  frame: FacadeFrame,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  depth: number,
  thickness: number,
  name: string,
  material: ReturnType<MaterialCache['lambert']>,
): Mesh {
  const w = t1 - t0;
  const h = y1 - y0;
  const mesh = new Mesh(geoms.box(w, h, thickness), material);
  mesh.name = name;
  const c = pointOn(frame, (t0 + t1) / 2, (y0 + y1) / 2, depth);
  mesh.position.set(c.x, c.y, c.z);
  group.add(mesh);
  return mesh;
}

function addTube(
  group: Group,
  geoms: GeometryCache,
  mat: ReturnType<MaterialCache['lambert']>,
  a: Point3D,
  b: Point3D,
  radius: number,
  name: string,
  emissive: EmissiveSpec,
): void {
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const mesh = new Mesh(geoms.cylinder(radius, Math.max(0.02, length), 8), mat);
  mesh.name = name;
  mesh.userData = { neonTube: true, glowColor: emissive.color, intensity: emissive.intensity };
  mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  if (Math.abs(b.x - a.x) > 0.001) {
    mesh.rotation.set(0, 0, Math.PI / 2, 'XYZ');
  } else if (Math.abs(b.z - a.z) > 0.001) {
    mesh.rotation.set(Math.PI / 2, 0, 0, 'XYZ');
  }
  group.add(mesh);
}

function addJoint(
  group: Group,
  geoms: GeometryCache,
  mat: ReturnType<MaterialCache['lambert']>,
  p: Point3D,
  r: number,
  name: string,
): void {
  const mesh = new Mesh(geoms.sphere(r, 8, 6), mat);
  mesh.name = name;
  mesh.position.set(p.x, p.y, p.z);
  group.add(mesh);
}

// ============================================================================
// Per-kind sign builders
// ============================================================================

export interface StorefrontSignInput {
  frame: FacadeFrame;
  data: EraStorefrontsData;
  palette: EraPalette;
  businessName: string;
  ctx: SignContext;
}

/** Primary storefront sign for one lot. */
export function buildStorefrontSign(input: StorefrontSignInput): SignBuildResult {
  const { data, ctx } = input;
  const kinds = data.signageKinds;
  let kind = kinds[0];
  if (kinds.length > 1 && ctx.rng.chance(0.4)) {
    kind = kinds[1];
  }
  switch (kind) {
    case 'painted-fascia':
      return buildPaintedFascia(input);
    case 'neon-tube':
      return buildNeonTube(input, false);
    case 'blade-sign':
      return buildNeonTube(input, true);
    case 'backlit-box':
      return buildBacklitBox(input);
    case 'led-media-facade':
      return buildLedMediaFacade(input);
  }
  // Unreachable: SignageKind is a closed union covered above.
  return buildPaintedFascia(input);
}

function buildPaintedFascia(input: StorefrontSignInput): SignBuildResult {
  const { frame, data, palette, businessName, ctx } = input;
  const group = new Group();
  group.name = `${frame.lotId}-sign`;
  const x0 = 0.05 * frame.width;
  const x1 = 0.95 * frame.width;
  const y0 = 3.2;
  const y1 = 4.4;

  const paintColor = palette.facadeMaterials[0] ?? '#a88660';
  const accent = palette.accent;
  const texture = renderTexture(512, 128, (surface) => {
    paintFasciaSign(surface, {
      text: businessName,
      paintColor,
      accentColor: accent,
      letterform: data.fasciaLetterform,
      subtext: data.windowDressing.replace('-', ' ').toUpperCase(),
    });
  });

  const mat = ctx.mats.lambert(shadeColor(paintColor, 0.85), { color: palette.signageGlow, intensity: 0.12 }, texture);
  addBox(group, ctx.geoms, frame, x0, x1, y0, y1, -0.06, 0.12, `${frame.lotId}-fascia`, mat);

  return {
    group,
    meta: {
      kind: 'painted-fascia',
      text: businessName,
      x0,
      x1,
      y0,
      y1,
      depthMax: 0.12,
      glowColor: palette.signageGlow,
      intensity: 0.12,
    },
  };
}

function buildNeonTube(input: StorefrontSignInput, blade: boolean): SignBuildResult {
  const { frame, data, palette, businessName, ctx } = input;
  const group = new Group();
  group.name = `${frame.lotId}-sign`;
  const glowColor = palette.signageGlow;
  const glow = polarityGlow(ctx.era);
  const panelW = Math.min(0.82, Math.max(0.5, (businessName.length * 0.32) / 10)) * frame.width;
  const x0 = (frame.width - panelW) / 2;
  const x1 = x0 + panelW;
  const y0 = 3.35;
  const y1 = 4.25;
  const texture = renderTexture(256, 96, (surface) => {
    paintNeonSign(surface, {
      text: businessName,
      glowColor,
      coreColor: glow.color,
      letterform: data.fasciaLetterform,
    });
  });

  const panelMat = ctx.mats.lambert('#1a1822', undefined, texture);
  const panel = new Mesh(ctx.geoms.box(panelW, y1 - y0, 0.08), panelMat);
  panel.name = `${frame.lotId}-neon-panel`;
  const c = pointOn(frame, (x0 + x1) / 2, (y0 + y1) / 2, 0.1);
  panel.position.set(c.x, c.y, c.z);
  panel.userData = { neonPanel: true };
  group.add(panel);

  const tubeMat = ctx.mats.lambert('#111111', glow);
  const r = 0.045;
  const tubeDepth = 0.16;
  const top0 = pointOn(frame, x0 + 0.12, y0 + 0.14, tubeDepth);
  const top1 = pointOn(frame, x1 - 0.12, y0 + 0.14, tubeDepth);
  const bot0 = pointOn(frame, x0 + 0.12, y1 - 0.14, tubeDepth);
  const bot1 = pointOn(frame, x1 - 0.12, y1 - 0.14, tubeDepth);
  addTube(group, ctx.geoms, tubeMat, top0, top1, r, `${frame.lotId}-tube-top`, glow);
  addTube(group, ctx.geoms, tubeMat, bot0, bot1, r, `${frame.lotId}-tube-bottom`, glow);
  addTube(group, ctx.geoms, tubeMat, top0, bot0, r, `${frame.lotId}-tube-left`, glow);
  addTube(group, ctx.geoms, tubeMat, top1, bot1, r, `${frame.lotId}-tube-right`, glow);
  for (const [p, name] of [
    [top0, `${frame.lotId}-joint-tl`],
    [top1, `${frame.lotId}-joint-tr`],
    [bot0, `${frame.lotId}-joint-bl`],
    [bot1, `${frame.lotId}-joint-br`],
  ] as Array<[Point3D, string]>) {
    addJoint(group, ctx.geoms, tubeMat, p, r * 1.15, name);
  }

  if (blade) {
    buildBladeSign(group, frame, ctx, businessName, glowColor, glow);
  }

  return {
    group,
    meta: {
      kind: blade ? 'blade-sign' : 'neon-tube',
      text: businessName,
      x0,
      x1,
      y0,
      y1,
      depthMax: blade ? 1.4 : tubeDepth,
      glowColor,
      intensity: glow.intensity,
    },
  };
}

function buildBladeSign(
  group: Group,
  frame: FacadeFrame,
  ctx: SignContext,
  text: string,
  glowColor: string,
  glow: EmissiveSpec,
): void {
  const bladeW = 1.15;
  const bladeH = 0.6;
  const x0 = frame.width * 0.12;
  const x1 = x0 + bladeW;
  const y0 = 3.6;
  const y1 = y0 + bladeH;
  const texture = renderTexture(160, 96, (surface) => {
    paintNeonSign(surface, { text: text.slice(0, 6), glowColor, coreColor: glow.color, letterform: 'neon' });
  });
  const panelMat = ctx.mats.lambert('#141420', { color: glowColor, intensity: glow.intensity }, texture);
  const panel = new Mesh(ctx.geoms.box(bladeW, bladeH, 0.08), panelMat);
  const c = pointOn(frame, (x0 + x1) / 2, (y0 + y1) / 2, 0.7);
  panel.position.set(c.x, c.y, c.z);
  group.add(panel);
  const arm = new Mesh(ctx.geoms.box(0.06, 0.5, 0.5), ctx.mats.lambert('#333333'));
  const ac = pointOn(frame, (x0 + x1) / 2, (y0 + y1) / 2, 0.52);
  arm.position.set(ac.x, ac.y, ac.z);
  group.add(arm);
}

function buildBacklitBox(input: StorefrontSignInput): SignBuildResult {
  const { frame, businessName, ctx } = input;
  const group = new Group();
  group.name = `${frame.lotId}-sign`;
  const boxW = Math.min(0.6, 0.3 + businessName.length * 0.045) * frame.width;
  const x0 = (frame.width - boxW) / 2;
  const x1 = x0 + boxW;
  const y0 = 3.55;
  const y1 = 4.3;
  const texture = renderTexture(256, 96, (surface) => {
    paintBacklitSign(surface, { text: businessName, boxColor: shadeColor('#e6eef2', 0.75), glowColor: '#e8ecf4' });
  });
  const mat = ctx.mats.lambert('#cfd6e0', { color: '#e8ecf4', intensity: 0.7 }, texture);
  const box = new Mesh(ctx.geoms.box(boxW, y1 - y0, 0.24), mat);
  const c = pointOn(frame, (x0 + x1) / 2, (y0 + y1) / 2, 0.2);
  box.position.set(c.x, c.y, c.z);
  box.userData = { backlitBox: true };
  group.add(box);
  const bracket = new Mesh(ctx.geoms.box(0.08, 0.5, 0.5), ctx.mats.lambert('#9aa4b0'));
  const bc = pointOn(frame, (x0 + x1) / 2, (y0 + y1) / 2, 0.05);
  bracket.position.set(bc.x, bc.y, bc.z);
  group.add(bracket);
  return {
    group,
    meta: {
      kind: 'backlit-box',
      text: businessName,
      x0,
      x1,
      y0,
      y1,
      depthMax: 0.32,
      glowColor: '#e8ecf4',
      intensity: 0.7,
      animated: false,
    },
  };
}

function buildLedMediaFacade(input: StorefrontSignInput): SignBuildResult {
  const { frame, palette, businessName, ctx } = input;
  const group = new Group();
  group.name = `${frame.lotId}-sign`;
  const x0 = 0.05 * frame.width;
  const x1 = 0.95 * frame.width;
  const y0 = 3.2;
  const y1 = 4.4;
  const texture = renderTexture(640, 160, (surface) => {
    paintLedSign(surface, {
      text: businessName,
      ledColor: palette.signageGlow,
      offColor: shadeColor(palette.signageGlow, 0.12),
    });
  });
  const panelMat = ctx.mats.lambert('#101820', { color: palette.signageGlow, intensity: 1.25 }, texture);
  const panel = new Mesh(ctx.geoms.box(x1 - x0, y1 - y0, 0.1), panelMat);
  const c = pointOn(frame, (x0 + x1) / 2, (y0 + y1) / 2, 0.05);
  panel.position.set(c.x, c.y, c.z);
  panel.userData = { ledMedia: true, animated: true };
  group.add(panel);

  // Animated emissive pixel strips whose brightness is cycled in-scene.
  const stripColors = [palette.signageGlow, palette.accent, '#ffffff'];
  const stripH = 0.16;
  for (let i = 0; i < stripColors.length; i += 1) {
    const sy0 = y0 + 0.08 + i * 0.42;
    const stripMat = ctx.mats.lambert('#0a0f14', { color: stripColors[i]!, intensity: 1.2 + i * 0.2 });
    const strip = new Mesh(ctx.geoms.box(x1 - x0, stripH, 0.12), stripMat);
    const sc = pointOn(frame, (x0 + x1) / 2, sy0, 0.07);
    strip.position.set(sc.x, sc.y, sc.z);
    strip.userData = { ledPixelStrip: true, layer: i };
    group.add(strip);
  }
  return {
    group,
    meta: {
      kind: 'led-media-facade',
      text: businessName,
      x0,
      x1,
      y0,
      y1,
      depthMax: 0.13,
      glowColor: palette.signageGlow,
      intensity: 1.25,
      animated: true,
      animation: { cycleMs: 1200, sequence: 'pulse-scan' },
    },
  };
}

/** 1965/1985 neon glow polarity (pairwise-distinct from the era accent). */
function polarityGlow(era: EraId): EmissiveSpec {
  if (era === 1985) {
    return { color: '#00e5ff', intensity: 1.1 };
  }
  return { color: '#ff6f91', intensity: 0.85 };
}