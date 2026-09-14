/**
 * Storefront window displays and awnings.
 *
 * Each lot's ground-floor band is divided into an entrance door and window
 * bays. Bays carry: transparent glass, mullions, an emissive interior back
 * wall (the night "window glow" whose color/intensity follows the era
 * palette), and era-appropriate prop silhouettes (canned-goods pyramids,
 * record spinners, arcade cabinets, coffee machines, e-scooters, mannequins).
 * Awnings/canopies are style-driven from `EraStorefrontsData.awningStyle`
 * and must respect furniture-anchor clearance (`isClear` callback).
 */
import { Group, Mesh } from 'three';
import type { Rect2D } from '../layout';
import type { EraPalette } from '../../era/types';
import type { Rng } from '../../lib/rng';
import {
  GeometryCache,
  MaterialCache,
  renderTexture,
  shadeColor,
} from './materials';
import type { EraStorefrontsData, WindowPropSpec } from './eraStorefrontData';
import type { FacadeFrame } from './signage';
import { facadeRect, pointOn } from './signage';

// ============================================================================
// Metadata
// ============================================================================

export interface WindowMeta {
  props: string[];
  dressing: string;
  lightColor: string;
  lightIntensity: number;
  bayCount: number;
  doorSide: 'left' | 'right';
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface AwningMeta {
  style: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Outward overhang depth reached by the canopy. */
  depthMax: number;
  colors: string[];
}

export interface WindowBuildResult {
  group: Group;
  window: WindowMeta;
  awning: AwningMeta | null;
}

export interface WindowContext {
  rng: Rng;
  geoms: GeometryCache;
  mats: MaterialCache;
  palette: EraPalette;
  /** Clearance predicate supplied by the assembler (layout anchors). */
  isClear: (rect: Rect2D, margin?: number) => boolean;
}

const DOOR_W = 1.4;
const WINDOW_Y0 = 0.7;
const WINDOW_Y1 = 2.9;

// ============================================================================
// Builder
// ============================================================================

export interface WindowDisplayInput {
  frame: FacadeFrame;
  data: EraStorefrontsData;
  palette: EraPalette;
  ctx: WindowContext;
}

export function buildWindowDisplay(input: WindowDisplayInput): WindowBuildResult {
  const { frame, data, palette, ctx } = input;
  const group = new Group();
  group.name = `${frame.lotId}-windows`;

  const doorSide: 'left' | 'right' = ctx.rng.chance(0.5) ? 'left' : 'right';
  const doorT0 = doorSide === 'left' ? 2.6 : frame.width - 2.6 - DOOR_W;
  const doorT1 = doorT0 + DOOR_W;

  const sections = windowSections(frame.width, doorT0, doorT1);
  const bays: Array<{ x0: number; x1: number }> = [];
  for (const section of sections) {
    const bayCount = Math.min(4, Math.max(1, Math.round((section[1] - section[0]) / 4.2)));
    const bayW = (section[1] - section[0]) / bayCount;
    for (let i = 0; i < bayCount; i += 1) {
      bays.push({ x0: section[0] + i * bayW, x1: section[0] + (i + 1) * bayW });
    }
  }

  // Bulkhead + transom + cornice (the masonry shell of the band).
  addBandShell(group, frame, ctx, palette);

  // Glass + mullions + emissive back walls per bay (merged into 2 glass meshes).
  const glassMat = ctx.mats.basic('#b8c4cc', true, 0.35);
  const mullionMat = ctx.mats.lambert(palette.facadeMaterials[1] ?? '#b0a493');
  const backWallMat = ctx.mats.lambert(
    shadeColor(palette.facadeMaterials[0] ?? '#777777', 0.35),
    { color: data.windowLightColor, intensity: data.windowLightIntensity },
  );
  for (let i = 0; i < bays.length; i += 1) {
    const bay = bays[i]!;
    addGlassPanel(group, ctx, frame, bay.x0, bay.x1, glassMat);
    addMullion(group, ctx, frame, bay.x1, mullionMat, false);
    addBackWall(group, ctx, frame, bay.x0, bay.x1, backWallMat);
  }

  // Era props silhouettes inside the middle bays.
  const props = pickProps(data.windowProps, ctx.rng, 3);
  const propBays = bays.length > 2 ? [bays[Math.floor(bays.length / 2) - 1]!, bays[Math.floor(bays.length / 2)]!] : bays;
  const assigned: Array<{ prop: WindowPropSpec; bay: { x0: number; x1: number } }> = [];
  for (let i = 0; i < props.length && i < propBays.length; i += 1) {
    assigned.push({ prop: props[i]!, bay: propBays[i]! });
  }
  for (const entry of assigned) {
    addProp(group, ctx, frame, entry.bay, entry.prop, data.windowLightIntensity);
  }

  // Entrance door.
  addDoor(group, ctx, frame, doorT0, doorT1, palette);

  // Awning / canopy over the window section, clear of the door.
  const awning = buildAwning(group, frame, data, palette, ctx, doorT0, doorT1);

  return {
    group,
    window: {
      props: assigned.map((a) => a.prop.kind),
      dressing: data.windowDressing,
      lightColor: data.windowLightColor,
      lightIntensity: data.windowLightIntensity,
      bayCount: bays.length,
      doorSide,
      x0: 0.5,
      x1: frame.width - 0.5,
      y0: WINDOW_Y0,
      y1: WINDOW_Y1,
    },
    awning,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function windowSections(width: number, doorT0: number, doorT1: number): Array<[number, number]> {
  const sections: Array<[number, number]> = [];
  const left0 = 0.9;
  const left1 = doorT0 - 0.6;
  const right0 = doorT1 + 0.6;
  const right1 = width - 0.9;
  if (left1 - left0 >= 3) sections.push([left0, left1]);
  if (right1 - right0 >= 3) sections.push([right0, right1]);
  if (sections.length === 0) sections.push([0.9, width - 0.9]);
  return sections;
}

function addBandShell(group: Group, frame: FacadeFrame, ctx: WindowContext, palette: EraPalette): void {
  const w = frame.width;
  const brick = palette.facadeMaterials[0] ?? '#a88660';
  const trim = palette.facadeMaterials[1] ?? '#b0a493';
  // Bulkhead (kick plate): full width, solid, between sidewalk and windows.
  addBoxTo(group, ctx, frame, 0.05, w - 0.05, 0, 0.7, -0.07, 0.14, `${frame.lotId}-bulkhead`, ctx.mats.lambert(brick));
  // Transom strip above windows.
  addBoxTo(group, ctx, frame, 0.05, w - 0.05, 2.9, 3.2, -0.05, 0.1, `${frame.lotId}-transom`, ctx.mats.lambert(trim));
  // Cornice trims the top of the band.
  addBoxTo(group, ctx, frame, 0.05, w - 0.05, 4.4, 4.6, -0.06, 0.12, `${frame.lotId}-cornice`, ctx.mats.lambert(palette.accent));
}

function addBoxTo(
  group: Group,
  ctx: WindowContext,
  frame: FacadeFrame,
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  depth: number,
  thickness: number,
  name: string,
  material: ReturnType<MaterialCache['lambert']> | ReturnType<MaterialCache['basic']>,
): Mesh {
  const mesh = new Mesh(ctx.geoms.box(t1 - t0, y1 - y0, thickness), material);
  mesh.name = name;
  const c = pointOn(frame, (t0 + t1) / 2, (y0 + y1) / 2, depth);
  mesh.position.set(c.x, c.y, c.z);
  group.add(mesh);
  return mesh;
}

function addGlassPanel(
  group: Group,
  ctx: WindowContext,
  frame: FacadeFrame,
  x0: number,
  x1: number,
  glassMat: ReturnType<MaterialCache['basic']>,
): void {
  addBoxTo(group, ctx, frame, x0, x1, WINDOW_Y0, WINDOW_Y1, -0.03, 0.06, `${frame.lotId}-glass`, glassMat);
}

function addMullion(
  group: Group,
  ctx: WindowContext,
  frame: FacadeFrame,
  x: number,
  material: ReturnType<MaterialCache['lambert']>,
  last: boolean,
): void {
  void last;
  addBoxTo(group, ctx, frame, x - 0.09, x + 0.09, WINDOW_Y0, WINDOW_Y1, -0.05, 0.1, `${frame.lotId}-mullion`, material);
}

function addBackWall(
  group: Group,
  ctx: WindowContext,
  frame: FacadeFrame,
  x0: number,
  x1: number,
  material: ReturnType<MaterialCache['lambert']>,
): void {
  // Interior wall behind the glass at 1.5m into the lot; emissive = window glow.
  addBoxTo(group, ctx, frame, x0, x1, WINDOW_Y0 - 0.1, WINDOW_Y1 + 0.1, -1.5, 0.08, `${frame.lotId}-backwall`, material);
}

function pickProps(pool: readonly WindowPropSpec[], rng: Rng, count: number): WindowPropSpec[] {
  const copy = [...pool];
  const picked: WindowPropSpec[] = [];
  for (let i = 0; i < count && copy.length > 0; i += 1) {
    const idx = rng.int(0, copy.length - 1);
    picked.push(copy[idx]!);
    copy.splice(idx, 1);
  }
  return picked;
}

function addProp(
  group: Group,
  ctx: WindowContext,
  frame: FacadeFrame,
  bay: { x0: number; x1: number },
  prop: WindowPropSpec,
  lightIntensity: number,
): void {
  const bayCx = (bay.x0 + bay.x1) / 2;
  const bayW = bay.x1 - bay.x0;
  const scale = Math.min(1, (bayW * 0.82) / Math.max(prop.w, 0.01));
  const w = prop.w * scale;
  const h = Math.min(prop.h * scale, 1.9);
  const d = prop.d * scale;
  const depth = -0.55 - ctx.rng.range(0, 0.55); // well inside the lot
  const color = prop.color;
  const emissive = prop.emissive === true
    ? { color: prop.lightColor ?? color, intensity: lightIntensity }
    : undefined;

  switch (prop.shape) {
    case 'box':
    case 'flat': {
      const mat = ctx.mats.lambert(color, emissive);
      const mesh = new Mesh(ctx.geoms.box(Math.max(w, 0.1), Math.max(h, 0.1), Math.max(d, 0.05)), mat);
      const c = pointOn(frame, bayCx, 0.1 + h / 2, depth);
      mesh.position.set(c.x, c.y, c.z);
      mesh.userData = { windowProp: prop.kind };
      group.add(mesh);
      break;
    }
    case 'cylinder': {
      const mat = ctx.mats.lambert(color, emissive);
      const mesh = new Mesh(ctx.geoms.cylinder(Math.max(w / 2, 0.08), Math.max(h, 0.1), 8), mat);
      const c = pointOn(frame, bayCx, 0.1 + h / 2, depth);
      mesh.position.set(c.x, c.y, c.z);
      mesh.userData = { windowProp: prop.kind };
      group.add(mesh);
      break;
    }
    case 'sphere': {
      const mat = ctx.mats.lambert(color, emissive);
      const mesh = new Mesh(ctx.geoms.sphere(Math.max(w / 2, 0.1), 8, 6), mat);
      const c = pointOn(frame, bayCx, 0.4 + h / 2, depth);
      mesh.position.set(c.x, c.y, c.z);
      mesh.userData = { windowProp: prop.kind };
      group.add(mesh);
      break;
    }
    case 'figure': {
      // Mannequin: base + torso + head silhouette.
      const mat = ctx.mats.lambert(color, emissive);
      const base = new Mesh(ctx.geoms.box(Math.max(w * 1.1, 0.3), 0.12, Math.max(d * 1.2, 0.3)), mat);
      const bc = pointOn(frame, bayCx, 0.06, depth);
      base.position.set(bc.x, bc.y, bc.z);
      base.userData = { windowProp: prop.kind };
      group.add(base);
      const torsoH = h * 0.62;
      const torso = new Mesh(ctx.geoms.box(w * 0.48, torsoH, d * 0.75), mat);
      const tc = pointOn(frame, bayCx, 0.14 + torsoH / 2, depth);
      torso.position.set(tc.x, tc.y, tc.z);
      torso.userData = { windowProp: prop.kind };
      group.add(torso);
      const headR = h * 0.11;
      const head = new Mesh(ctx.geoms.sphere(Math.max(headR, 0.09), 8, 6), mat);
      const hc = pointOn(frame, bayCx, 0.16 + torsoH + headR, depth);
      head.position.set(hc.x, hc.y, hc.z);
      head.userData = { windowProp: prop.kind };
      group.add(head);
      break;
    }
  }
}

function addDoor(
  group: Group,
  ctx: WindowContext,
  frame: FacadeFrame,
  t0: number,
  t1: number,
  palette: EraPalette,
): void {
  const frameMat = ctx.mats.lambert(palette.facadeMaterials[1] ?? '#b0a493');
  const glassMat = ctx.mats.basic('#8fa0ac', true, 0.4);
  const doorH = 2.6;
  // Door leaf recessed slightly inside the plane.
  const leaf = new Mesh(ctx.geoms.box(t1 - t0, doorH, 0.1), glassMat);
  const c = pointOn(frame, (t0 + t1) / 2, doorH / 2, -0.2);
  leaf.position.set(c.x, c.y, c.z);
  leaf.userData = { storefrontDoor: true };
  group.add(leaf);
  // Frame: two jambs + header + step.
  addBoxTo(group, ctx, frame, t0 - 0.1, t0 + 0.05, 0, doorH, -0.05, 0.12, `${frame.lotId}-door-jamb-l`, frameMat);
  addBoxTo(group, ctx, frame, t1 - 0.05, t1 + 0.1, 0, doorH, -0.05, 0.12, `${frame.lotId}-door-jamb-r`, frameMat);
  addBoxTo(group, ctx, frame, t0 - 0.1, t1 + 0.1, doorH, doorH + 0.12, -0.05, 0.12, `${frame.lotId}-door-header`, frameMat);
  addBoxTo(group, ctx, frame, t0 - 0.15, t1 + 0.15, 0, 0.12, -0.1, 0.2, `${frame.lotId}-door-step`, ctx.mats.lambert(palette.sidewalk ?? '#b0a493'));
}

function buildAwning(
  group: Group,
  frame: FacadeFrame,
  data: EraStorefrontsData,
  palette: EraPalette,
  ctx: WindowContext,
  doorT0: number,
  doorT1: number,
): AwningMeta | null {
  if (!ctx.rng.chance(data.awningDensity)) return null;
  const style = data.awningStyle;
  // Canopy spans the window side away from the door (the wider section).
  const leftW = doorT0 - 1.2;
  const rightW = frame.width - doorT1 - 1.2;
  const x0 = rightW > leftW ? doorT1 + 0.5 : 0.7;
  const x1 = rightW > leftW ? frame.width - 0.6 : doorT0 - 0.5;
  if (x1 - x0 < 2) return null;

  const baseDepth = style === 'glass-canopy' ? 1.3 : style === 'metal-blade' ? 0.9 : style === 'recessed-minimal' ? 0.7 : 2.0;
  let depth = baseDepth;
  // Respect furniture-anchor clearance: shrink, then give up.
  const candidateRect = facadeRect(frame, x0, x1, 2.0, 3.1, 0.1, depth);
  if (!ctx.isClear(candidateRect, 0.0)) {
    depth = Math.min(baseDepth, 1.1);
    const shrunkRect = facadeRect(frame, x0, x1, 2.0, 3.1, 0.1, depth);
    if (!ctx.isClear(shrunkRect, 0.0)) return null;
  }

  const awningGroup = new Group();
  awningGroup.name = `${frame.lotId}-awning`;
  const awningY0 = 2.35;
  const awningY1 = 2.75;

  if (style === 'striped' || style === 'flat') {
    // Canvas top + front valance with era stripe colors.
    const texture = renderTexture(512, 64, (surface) => {
      const colors = data.awningColors.length > 0 ? data.awningColors : [palette.accent, '#f5e6c8'];
      const stripes = 8;
      for (let i = 0; i < stripes; i += 1) {
        const cw = surface.width / stripes;
        surface.rect(i * cw, 0, cw + 1, surface.height, colors[i % colors.length]!);
      }
    });
    const top = new Mesh(ctx.geoms.box(x1 - x0, 0.06, depth), ctx.mats.lambert('#888888'));
    const tc = pointOn(frame, (x0 + x1) / 2, awningY1, depth / 2);
    top.position.set(tc.x, tc.y, tc.z);
    top.rotation.set(-0.12, 0, 0, 'XYZ');
    awningGroup.add(top);
    const mat = ctx.mats.lambert(data.awningColors[0] ?? palette.accent, undefined, texture);
    const valance = new Mesh(ctx.geoms.box(x1 - x0, 0.45, 0.05), mat);
    const vc = pointOn(frame, (x0 + x1) / 2, awningY0 + 0.2, depth);
    valance.position.set(vc.x, vc.y, vc.z);
    awningGroup.add(valance);
  } else if (style === 'metal-blade') {
    // Narrow metal canopy with neon trim underneath.
    const top = new Mesh(ctx.geoms.box(x1 - x0, 0.06, depth), ctx.mats.lambert('#8a8f96'));
    const tc = pointOn(frame, (x0 + x1) / 2, awningY1, depth / 2);
    top.position.set(tc.x, tc.y, tc.z);
    awningGroup.add(top);
    const trim = new Mesh(ctx.geoms.box(x1 - x0, 0.06, 0.06), ctx.mats.lambert('#222222', { color: palette.signageGlow, intensity: 0.85 }));
    const uc = pointOn(frame, (x0 + x1) / 2, awningY0 + 0.02, depth);
    trim.position.set(uc.x, uc.y, uc.z);
    trim.userData = { awningNeonTrim: true };
    awningGroup.add(trim);
  } else if (style === 'glass-canopy') {
    // Transparent canopy on a light metal beam.
    const beam = new Mesh(ctx.geoms.box(x1 - x0, 0.09, 0.09), ctx.mats.lambert('#c9cdd4'));
    const bc = pointOn(frame, (x0 + x1) / 2, awningY1 - 0.02, 0.12);
    beam.position.set(bc.x, bc.y, bc.z);
    awningGroup.add(beam);
    const pane = new Mesh(ctx.geoms.box(x1 - x0, 0.05, depth), ctx.mats.basic('#dfe6ee', true, 0.55));
    const pc = pointOn(frame, (x0 + x1) / 2, awningY0 + 0.25, depth / 2);
    pane.position.set(pc.x, pc.y, pc.z);
    awningGroup.add(pane);
  } else {
    // recessed-minimal: slim dark canopy flush with the band.
    const pane = new Mesh(ctx.geoms.box(x1 - x0, 0.08, depth), ctx.mats.lambert('#2c3138'));
    const pc = pointOn(frame, (x0 + x1) / 2, awningY0 + 0.3, depth / 2);
    pane.position.set(pc.x, pc.y, pc.z);
    awningGroup.add(pane);
  }

  group.add(awningGroup);
  return {
    style,
    x0,
    x1,
    y0: awningY0,
    y1: awningY1,
    depthMax: depth,
    colors: [...data.awningColors],
  };
}