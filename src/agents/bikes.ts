/**
 * Parametric, era-correct two-wheeler geometries (1945 → 2055).
 *
 * Each builder returns an array of {@link ColoredPart} primitives that the
 * {@link CyclistSystem} merges into a single vertex-colored geometry and drives
 * with an InstancedMesh — the lightest representation for a capped population.
 * All conveyances share a local frame: **forward = +X, up = +Y**, with wheels
 * as toruses lying in the XY plane (axle along Z) so they read as rolling.
 *
 * Era progression of the silhouette:
 *   1945 / 1965 — classic roadster (big wheels, upright rider, fenders)
 *   1985        — 10-speed (thin wheels, drop bars, leaning rider)
 *   2005        — mountain / hybrid (fat knobby tires, flat bars, shock fork)
 *   2025        — e-bike (battery + motor hub) and e-scooter (deck + stem)
 *   2055        — hover-board (glowing slab, no wheels) and sleek e-bike
 *
 * Dogs (era-neutral) live in `dogs.ts`; this module only builds two-wheelers.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  type BufferGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { EraKey } from '../eras/eraConfig.js';
import { mergeColored, type ColoredPart } from './agentGeometry.js';

// ---------------------------------------------------------------------------
// Geometry plumbing
// ---------------------------------------------------------------------------

/** Hex color → number helper, keeps palette tokens readable as CSS hex. */
function hex(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}

/** Wheel radius / tube for an era's tires. */
interface WheelSpec {
  radius: number;
  tube: number;
}

/** Build a torus wheel centered at (x, y) in the local XY plane (axle on Z). */
function wheel(x: number, y: number, spec: WheelSpec, color: number): ColoredPart {
  const geo = new TorusGeometry(spec.radius, spec.tube, 8, 18);
  geo.translate(x, y, 0);
  return { geometry: geo, color };
}

/** Fender: a thin half-torus arc sitting just outside the tire. */
function fender(x: number, y: number, spec: WheelSpec, color: number): ColoredPart {
  const geo = new TorusGeometry(spec.radius + spec.tube + 0.04, 0.03, 6, 18, Math.PI);
  geo.rotateZ(Math.PI); // arc over the top of the wheel
  geo.translate(x, y, 0);
  return { geometry: geo, color };
}

/**
 * A cylinder "tube" joining two local points. CylinderGeometry defaults to the
 * Y axis; we rotate it onto the point-to-point direction and center it.
 */
function tube(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
  color: number,
): ColoredPart {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  const geo = new CylinderGeometry(radius, radius, length, 6);
  geo.translate(0, length / 2, 0);
  // Rotate so +Y maps onto the (dx, dy) direction within the XY plane.
  geo.rotateZ(Math.atan2(dx, dy));
  geo.translate(ax, ay, 0);
  return { geometry: geo, color };
}

/** Small box part positioned/rotated in the local XY plane. */
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotZ: number,
  color: number,
): ColoredPart {
  const geo = new BoxGeometry(w, h, d);
  geo.rotateZ(rotZ);
  geo.translate(x, y, z);
  return { geometry: geo, color };
}

/** Sphere part (head, hub) at a local point. */
function sphere(r: number, x: number, y: number, z: number, color: number): ColoredPart {
  const geo = new SphereGeometry(r, 8, 8);
  geo.translate(x, y, z);
  return { geometry: geo, color };
}

/**
 * A simple era-neutral rider: torso, head, arm reach to the bars. The lean
 * angle and colors vary by era so roadsters sit upright and 10-speeds hunch.
 * `barX` is where the handlebars sit (controls arm reach / lean).
 */
function rider(
  hipX: number,
  hipY: number,
  barX: number,
  barY: number,
  lean: number,
  shirt: number,
  skin: number,
): ColoredPart[] {
  const parts: ColoredPart[] = [];
  // Torso: a box leaning `lean` radians, from hip toward shoulders over the bar.
  const torsoLen = 0.5;
  const cx = hipX + Math.sin(lean) * torsoLen / 2;
  const cy = hipY + Math.cos(lean) * torsoLen / 2;
  parts.push(box(0.22, torsoLen, 0.26, cx, cy, 0, lean, shirt));
  // Head above the shoulders.
  const shX = hipX + Math.sin(lean) * torsoLen;
  const shY = hipY + Math.cos(lean) * torsoLen;
  parts.push(sphere(0.12, shX, shY + 0.06, 0, skin));
  // One arm reaching from shoulder to handlebar (cylinder).
  parts.push(tube(shX, shY, barX, barY, 0.045, shirt));
  return parts;
}

// ---------------------------------------------------------------------------
// Era palettes
// ---------------------------------------------------------------------------

interface BikePalette {
  frame: number;
  accent: number;
  saddle: number;
  tire: number;
  rim: number;
  shirt: number;
  skin: number;
}

const PALETTES: Record<string, BikePalette> = {
  roadster45: { frame: hex('#23231f'), accent: hex('#caa24a'), saddle: hex('#5a3f24'), tire: hex('#16140f'), rim: hex('#b7a06a'), shirt: hex('#3a4a6a'), skin: hex('#caa07a') },
  roadster65: { frame: hex('#1f4f6a'), accent: hex('#d6d2c4'), saddle: hex('#3a2a1a'), tire: hex('#14130f'), rim: hex('#d8d8d2'), shirt: hex('#8a2f3a'), skin: hex('#caa07a') },
  tenspeed: { frame: hex('#c8202a'), accent: hex('#d8d8d2'), saddle: hex('#1a1a1a'), tire: hex('#0e0e0c'), rim: hex('#cfcfcf'), shirt: hex('#2a6a4a'), skin: hex('#caa07a') },
  mountain: { frame: hex('#2e7d32'), accent: hex('#1a1a1a'), saddle: hex('#1a1a1a'), tire: hex('#101010'), rim: hex('#9a9a9a'), shirt: hex('#2a2a8a'), skin: hex('#caa07a') },
  ebike: { frame: hex('#33373d'), accent: hex('#00d8e6'), saddle: hex('#161616'), tire: hex('#101012'), rim: hex('#6a6a72'), shirt: hex('#26607a'), skin: hex('#caa07a') },
  escooter: { frame: hex('#c9ccd1'), accent: hex('#00d8e6'), saddle: hex('#15151a'), tire: hex('#101012'), rim: hex('#9aa0aa'), shirt: hex('#26607a'), skin: hex('#caa07a') },
  hover: { frame: hex('#e9eef5'), accent: hex('#39e6ff'), saddle: hex('#202830'), tire: hex('#1a2230'), rim: hex('#9fdfff'), shirt: hex('#2a2a55'), skin: hex('#caa07a') },
  sleek: { frame: hex('#f3f4f8'), accent: hex('#ff3ea5'), saddle: hex('#202024'), tire: hex('#15151a'), rim: hex('#bdbdc4'), shirt: hex('#5a2a55'), skin: hex('#caa07a') },
};

// ---------------------------------------------------------------------------
// Builders — one merged geometry per variant
// ---------------------------------------------------------------------------

/**
 * Classic roadster (1945 / 1965): large wheels, full frame loop, fenders,
 * upright rider. `p` selects the era palette.
 */
export function buildRoadster(p: BikePalette): BufferGeometry {
  const parts: ColoredPart[] = [];
  const w: WheelSpec = { radius: 0.36, tube: 0.035 };
  const hx = 0.55; // half wheelbase
  const hubY = w.radius;
  // Wheels + fenders.
  parts.push(wheel(-hx, hubY, w, p.tire), wheel(hx, hubY, w, p.tire));
  parts.push(fender(-hx, hubY, w, p.frame), fender(hx, hubY, w, p.frame));
  parts.push(sphere(0.05, -hx, hubY, 0, p.rim), sphere(0.05, hx, hubY, 0, p.rim));
  // Frame loop: bottom, seat, head, down tubes.
  const bb = { x: 0, y: 0.22 }; // bottom bracket
  const seat = { x: -0.18, y: 0.7 };
  const head = { x: 0.42, y: 0.62 };
  parts.push(tube(bb.x, bb.y, seat.x, seat.y, 0.04, p.frame)); // seat tube
  parts.push(tube(seat.x, seat.y, head.x, head.y, 0.035, p.frame)); // top tube
  parts.push(tube(bb.x, bb.y, head.x, head.y, 0.035, p.frame)); // down tube
  parts.push(tube(-hx, hubY, bb.x, bb.y, 0.03, p.frame)); // chainstay
  parts.push(tube(-hx, hubY, seat.x, seat.y, 0.025, p.frame)); // seatstay
  // Fork + steerer to bars.
  parts.push(tube(hx, hubY, head.x, head.y, 0.03, p.frame));
  const barX = 0.5;
  const barY = 0.92;
  parts.push(tube(head.x, head.y, barX, barY, 0.025, p.accent)); // stem
  parts.push(box(0.34, 0.03, 0.05, barX, barY, 0, 0, p.accent)); // bars
  // Saddle.
  parts.push(box(0.22, 0.05, 0.12, seat.x - 0.02, seat.y + 0.05, 0, 0, p.saddle));
  // Pedals.
  parts.push(box(0.18, 0.03, 0.04, 0, bb.y - 0.02, 0.12, 0, p.accent));
  // Rider upright.
  parts.push(...rider(seat.x - 0.02, seat.y + 0.12, barX, barY - 0.04, 0.12, p.shirt, p.skin));
  return mergeColored(parts);
}

/** 10-speed (1985): thin high-pressure tires, drop bars, hunched rider. */
export function buildTenSpeed(p: BikePalette): BufferGeometry {
  const parts: ColoredPart[] = [];
  const w: WheelSpec = { radius: 0.34, tube: 0.022 };
  const hx = 0.58;
  const hubY = w.radius;
  parts.push(wheel(-hx, hubY, w, p.tire), wheel(hx, hubY, w, p.tire));
  parts.push(sphere(0.04, -hx, hubY, 0, p.rim), sphere(0.04, hx, hubY, 0, p.rim));
  const bb = { x: 0.02, y: 0.24 };
  const seat = { x: -0.24, y: 0.72 };
  const head = { x: 0.46, y: 0.6 };
  parts.push(tube(bb.x, bb.y, seat.x, seat.y, 0.03, p.frame));
  parts.push(tube(seat.x, seat.y, head.x, head.y, 0.028, p.frame));
  parts.push(tube(bb.x, bb.y, head.x, head.y, 0.028, p.frame));
  parts.push(tube(-hx, hubY, bb.x, bb.y, 0.022, p.frame));
  parts.push(tube(-hx, hubY, seat.x, seat.y, 0.02, p.frame));
  parts.push(tube(hx, hubY, head.x, head.y, 0.024, p.frame));
  // Drop bars (curved via a small box + angled ends).
  const barX = 0.54;
  const barY = 0.9;
  parts.push(tube(head.x, head.y, barX, barY, 0.022, p.accent));
  parts.push(box(0.24, 0.03, 0.05, barX, barY, 0, 0, p.accent));
  parts.push(box(0.2, 0.04, 0.05, barX, barY - 0.08, 0, 0, p.accent)); // drops
  parts.push(box(0.2, 0.04, 0.05, seat.x, seat.y + 0.04, 0, 0, p.saddle));
  parts.push(box(0.18, 0.025, 0.04, 0, bb.y - 0.02, 0.12, 0, p.accent));
  // Rider hunched forward.
  parts.push(...rider(seat.x, seat.y + 0.1, barX + 0.02, barY - 0.02, 0.62, p.shirt, p.skin));
  return mergeColored(parts);
}

/** Mountain / hybrid (2005): fat knobby tires, flat bars, shock fork. */
export function buildMountain(p: BikePalette): BufferGeometry {
  const parts: ColoredPart[] = [];
  const w: WheelSpec = { radius: 0.35, tube: 0.06 };
  const hx = 0.56;
  const hubY = w.radius;
  parts.push(wheel(-hx, hubY, w, p.tire), wheel(hx, hubY, w, p.tire));
  parts.push(sphere(0.05, -hx, hubY, 0, p.rim), sphere(0.05, hx, hubY, 0, p.rim));
  const bb = { x: 0, y: 0.24 };
  const seat = { x: -0.2, y: 0.74 };
  const head = { x: 0.42, y: 0.62 };
  parts.push(tube(bb.x, bb.y, seat.x, seat.y, 0.042, p.frame));
  parts.push(tube(seat.x, seat.y, head.x, head.y, 0.038, p.frame));
  parts.push(tube(bb.x, bb.y, head.x, head.y, 0.038, p.frame));
  parts.push(tube(-hx, hubY, bb.x, bb.y, 0.03, p.frame));
  parts.push(tube(-hx, hubY, seat.x, seat.y, 0.026, p.frame));
  // Suspension fork (accent) — thicker, angled.
  parts.push(tube(hx, hubY, head.x, head.y, 0.04, p.accent));
  const barX = 0.52;
  const barY = 0.96;
  parts.push(tube(head.x, head.y, barX, barY, 0.03, p.frame));
  parts.push(box(0.5, 0.04, 0.05, barX, barY, 0, 0, p.accent)); // flat bar
  parts.push(box(0.24, 0.06, 0.14, seat.x, seat.y + 0.05, 0, 0, p.saddle));
  parts.push(box(0.18, 0.04, 0.05, 0, bb.y - 0.02, 0.12, 0, p.accent));
  parts.push(...rider(seat.x - 0.02, seat.y + 0.12, barX, barY - 0.04, 0.34, p.shirt, p.skin));
  return mergeColored(parts);
}

/** E-bike (2025): battery box on the downtube, motor hub, upright rider. */
export function buildEBike(p: BikePalette): BufferGeometry {
  const parts: ColoredPart[] = [];
  const w: WheelSpec = { radius: 0.36, tube: 0.05 };
  const hx = 0.57;
  const hubY = w.radius;
  parts.push(wheel(-hx, hubY, w, p.tire), wheel(hx, hubY, w, p.tire));
  parts.push(fender(-hx, hubY, w, p.frame), fender(hx, hubY, w, p.frame));
  parts.push(sphere(0.06, hx, hubY, 0, p.accent)); // motor hub (accent glow)
  const bb = { x: 0, y: 0.24 };
  const seat = { x: -0.2, y: 0.74 };
  const head = { x: 0.44, y: 0.64 };
  parts.push(tube(bb.x, bb.y, seat.x, seat.y, 0.045, p.frame));
  parts.push(tube(seat.x, seat.y, head.x, head.y, 0.04, p.frame));
  parts.push(tube(bb.x, bb.y, head.x, head.y, 0.04, p.frame));
  parts.push(tube(-hx, hubY, bb.x, bb.y, 0.03, p.frame));
  parts.push(tube(-hx, hubY, seat.x, seat.y, 0.026, p.frame));
  parts.push(tube(hx, hubY, head.x, head.y, 0.034, p.frame));
  // Battery box on the downtube (accent).
  parts.push(box(0.12, 0.34, 0.1, 0.18, 0.42, 0, 0, p.accent));
  const barX = 0.54;
  const barY = 0.98;
  parts.push(tube(head.x, head.y, barX, barY, 0.03, p.frame));
  parts.push(box(0.4, 0.04, 0.05, barX, barY, 0, 0, p.accent));
  parts.push(box(0.26, 0.08, 0.16, seat.x, seat.y + 0.06, 0, 0, p.saddle));
  parts.push(...rider(seat.x - 0.02, seat.y + 0.14, barX, barY - 0.04, 0.16, p.shirt, p.skin));
  return mergeColored(parts);
}

/** E-scooter (2025): small wheels, deck, vertical stem, standing rider. */
export function buildEScooter(p: BikePalette): BufferGeometry {
  const parts: ColoredPart[] = [];
  const w: WheelSpec = { radius: 0.16, tube: 0.04 };
  const hx = 0.5;
  const hubY = w.radius;
  parts.push(wheel(-hx, hubY, w, p.tire), wheel(hx, hubY, w, p.tire));
  // Deck.
  parts.push(box(0.9, 0.05, 0.26, 0, 0.12, 0, 0, p.frame));
  // Stem to bars.
  parts.push(tube(hx - 0.02, hubY, hx, 0.92, 0.035, p.frame));
  parts.push(box(0.34, 0.04, 0.05, hx, 0.96, 0, 0, p.accent));
  // Accent under-deck glow strip.
  parts.push(box(0.8, 0.02, 0.06, 0, 0.07, 0, 0, p.accent));
  // Standing rider (feet on deck).
  parts.push(...rider(0.1, 0.16, hx, 0.9, 0.05, p.shirt, p.skin));
  return mergeColored(parts);
}

/** Hover-board (2055): glowing slab, no wheels, rider standing on it. */
export function buildHoverBoard(p: BikePalette): BufferGeometry {
  const parts: ColoredPart[] = [];
  // Deck slab.
  parts.push(box(0.95, 0.1, 0.4, 0, 0.22, 0, 0, p.frame));
  // Underside glow pads (accent).
  parts.push(box(0.3, 0.04, 0.34, -0.3, 0.13, 0, 0, p.accent));
  parts.push(box(0.3, 0.04, 0.34, 0.3, 0.13, 0, 0, p.accent));
  // Rider standing upright, slightly forward.
  parts.push(...rider(0.05, 0.3, 0.05, 0.7, 0.05, p.shirt, p.skin));
  return mergeColored(parts);
}

/** Sleek e-bike (2055): minimalist white frame, thin glow accents. */
export function buildSleekEBike(p: BikePalette): BufferGeometry {
  const parts: ColoredPart[] = [];
  const w: WheelSpec = { radius: 0.37, tube: 0.03 };
  const hx = 0.58;
  const hubY = w.radius;
  parts.push(wheel(-hx, hubY, w, p.tire), wheel(hx, hubY, w, p.tire));
  parts.push(fender(-hx, hubY, w, p.frame), fender(hx, hubY, w, p.frame));
  parts.push(sphere(0.05, hx, hubY, 0, p.accent));
  const bb = { x: 0, y: 0.26 };
  const seat = { x: -0.22, y: 0.78 };
  const head = { x: 0.46, y: 0.66 };
  parts.push(tube(bb.x, bb.y, seat.x, seat.y, 0.05, p.frame));
  parts.push(tube(seat.x, seat.y, head.x, head.y, 0.04, p.frame));
  parts.push(tube(bb.x, bb.y, head.x, head.y, 0.04, p.frame));
  parts.push(tube(-hx, hubY, bb.x, bb.y, 0.03, p.frame));
  parts.push(tube(-hx, hubY, seat.x, seat.y, 0.026, p.frame));
  parts.push(tube(hx, hubY, head.x, head.y, 0.034, p.frame));
  parts.push(box(0.1, 0.3, 0.08, 0.16, 0.46, 0, 0, p.accent)); // slim battery
  const barX = 0.56;
  const barY = 1.0;
  parts.push(tube(head.x, head.y, barX, barY, 0.03, p.frame));
  parts.push(box(0.42, 0.035, 0.05, barX, barY, 0, 0, p.accent));
  parts.push(box(0.28, 0.07, 0.16, seat.x, seat.y + 0.06, 0, 0, p.saddle));
  parts.push(...rider(seat.x - 0.02, seat.y + 0.14, barX, barY - 0.04, 0.12, p.shirt, p.skin));
  return mergeColored(parts);
}

// ---------------------------------------------------------------------------
// Era → variant set
// ---------------------------------------------------------------------------

/** One conveyance variant: its merged geometry + how many to populate. */
export interface ConveyanceVariant {
  /** Merged vertex-colored geometry for this conveyance. */
  geometry: BufferGeometry;
  /** Fraction of the cyclist population (0..1) that uses this variant. */
  weight: number;
  /** Subtle per-variant vertical bob amplitude for a sense of motion. */
  bob: number;
}

/**
 * Return the era-correct set of conveyance variants. The CyclistSystem
 * allocates one InstancedMesh per variant so e-bike / e-scooter (2025) and
 * hover-board / sleek e-bike (2055) can coexist, all sharing the era material.
 */
export function buildEraConveyances(era: EraKey): ConveyanceVariant[] {
  switch (era) {
    case '1945':
      return [{ geometry: buildRoadster(PALETTES.roadster45), weight: 1, bob: 0.02 }];
    case '1965':
      return [{ geometry: buildRoadster(PALETTES.roadster65), weight: 1, bob: 0.02 }];
    case '1985':
      return [{ geometry: buildTenSpeed(PALETTES.tenspeed), weight: 1, bob: 0.015 }];
    case '2005':
      return [{ geometry: buildMountain(PALETTES.mountain), weight: 1, bob: 0.03 }];
    case '2025':
      return [
        { geometry: buildEBike(PALETTES.ebike), weight: 0.7, bob: 0.02 },
        { geometry: buildEScooter(PALETTES.escooter), weight: 0.3, bob: 0.015 },
      ];
    case '2055':
      return [
        { geometry: buildHoverBoard(PALETTES.hover), weight: 0.6, bob: 0.05 },
        { geometry: buildSleekEBike(PALETTES.sleek), weight: 0.4, bob: 0.015 },
      ];
  }
}

// ---------------------------------------------------------------------------
// Era → variant set
// ---------------------------------------------------------------------------
