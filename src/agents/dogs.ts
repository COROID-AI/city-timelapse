/**
 * Parametric, era-neutral dog (quadruped) geometries with a simple gait.
 *
 * Dogs stay breed/era-neutral across all six eras (the streetscapes change; the
 * dogs do not), so this module builds a small set of quadruped silhouettes that
 * the {@link DogSystem} merges into single vertex-colored geometries and drives
 * with InstancedMeshes. The leg animation is baked as a handful of **gait
 * phases**: each phase is a merged geometry with the four legs swung to a
 * different diagonal-trot position, and the DogSystem advances each dog through
 * the phases as it walks — genuine per-leg motion under instancing, cheaply.
 *
 * Local frame: **forward = +X, up = +Y**. Legs hang downward (−Y); the head is
 * toward +X. Built small (dogs are read at city scale) and grounded so y=0 is
 * the paw line.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  type BufferGeometry,
  SphereGeometry,
} from 'three';
import { mergeColored, type ColoredPart } from './agentGeometry.js';

/** Number of distinct gait phases in the trot cycle (diagonal pairs alternate). */
export const DOG_GAIT_PHASES = 4;

// ---------------------------------------------------------------------------
// Palette helpers
// ---------------------------------------------------------------------------

function hex(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}

/** Era-neutral breed palettes (coat color only — silhouette is shared). */
const BREED_PALETTES = [
  { coat: hex('#6b4a2a'), belly: hex('#8a6a42'), snout: hex('#4a3018'), collar: hex('#c0392b') }, // brown
  { coat: hex('#2e2a26'), belly: hex('#4a4640'), snout: hex('#1a1612'), collar: hex('#27ae60') }, // black
  { coat: hex('#d8c8a8'), belly: hex('#efe6cf'), snout: hex('#b8a880'), collar: hex('#2980b9') }, // golden
  { coat: hex('#9a8a7a'), belly: hex('#b8aa98'), snout: hex('#6a5a4a'), collar: hex('#8e44ad') }, // grey
];

export interface DogPalette {
  coat: number;
  belly: number;
  snout: number;
  collar: number;
}

/** Return the era-neutral breed palettes (coat variants for population variety). */
export function dogPalettes(): DogPalette[] {
  return BREED_PALETTES;
}

// ---------------------------------------------------------------------------
// Primitive helpers (XY-plane local frame)
// ---------------------------------------------------------------------------

interface Part {
  geometry: BufferGeometry;
  color: number;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number): Part {
  const geo = new BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return { geometry: geo, color };
}

function sphere(r: number, x: number, y: number, z: number, color: number): Part {
  const geo = new SphereGeometry(r, 8, 6);
  geo.translate(x, y, z);
  return { geometry: geo, color };
}

/**
 * A leg: a box from the hip (x, y) downward, swung forward/back by `swing`
 * radians about the hip joint. `swing` rotates the lower assembly in the XY
 * plane so the paw moves fore/aft — that is the gait.
 */
function leg(hipX: number, hipY: number, length: number, swing: number, color: number): Part {
  const geo = new BoxGeometry(0.09, length, 0.09);
  // Origin at hip, leg points down (−Y): translate so top is at hip.
  geo.translate(0, -length / 2, 0);
  geo.rotateZ(swing);
  geo.translate(hipX, hipY, 0);
  return { geometry: geo, color };
}

/**
 * Cylinder stretched between two points — used for the tail and (in the dog
 * system) the leash. Radius is constant.
 */
function strut(ax: number, ay: number, bx: number, by: number, r: number, color: number): Part {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  const geo = new CylinderGeometry(r, r, length, 5);
  geo.translate(0, length / 2, 0);
  geo.rotateZ(Math.atan2(dx, dy));
  geo.translate(ax, ay, 0);
  return { geometry: geo, color };
}

// ---------------------------------------------------------------------------
// Dog body
// ---------------------------------------------------------------------------

/**
 * Build the static body (torso, head, neck, ears, tail, collar) of a dog. Legs
 * are added separately per gait phase so the same body is reused across phases.
 * `scale` selects a small / medium / large silhouette for population variety.
 */
function buildBody(p: DogPalette, scale: number): Part[] {
  const parts: Part[] = [];
  const s = scale;
  // Torso.
  parts.push(box(0.6 * s, 0.26 * s, 0.24 * s, 0, 0.3 * s, 0, p.coat));
  // Belly accent (lighter underside).
  parts.push(box(0.5 * s, 0.1 * s, 0.22 * s, -0.02 * s, 0.2 * s, 0, p.belly));
  // Neck (angled up toward the head).
  const neckX = 0.3 * s;
  const neckY = 0.36 * s;
  parts.push(strut(neckX - 0.05, neckY, neckX + 0.14 * s, neckY + 0.16 * s, 0.07 * s, p.coat));
  // Head.
  const headX = neckX + 0.22 * s;
  const headY = neckY + 0.2 * s;
  parts.push(sphere(0.12 * s, headX, headY, 0, p.coat));
  // Snout.
  parts.push(box(0.16 * s, 0.1 * s, 0.1 * s, headX + 0.12 * s, headY - 0.02 * s, 0, p.snout));
  // Ears (two small triangles as flattened boxes).
  parts.push(box(0.03 * s, 0.08 * s, 0.05 * s, headX - 0.02 * s, headY + 0.12 * s, 0.06 * s, p.snout));
  parts.push(box(0.03 * s, 0.08 * s, 0.05 * s, headX - 0.02 * s, headY + 0.12 * s, -0.06 * s, p.snout));
  // Collar.
  parts.push(strut(neckX - 0.02, neckY + 0.02, neckX + 0.08 * s, neckY + 0.12 * s, 0.03 * s, p.collar));
  // Tail.
  parts.push(strut(-0.3 * s, 0.32 * s, -0.5 * s, 0.42 * s, 0.025 * s, p.coat));
  return parts;
}

/**
 * Trot gait: diagonal leg pairs move together and alternate. Over N phases the
 * four legs are phase-offset so the dog reads as walking/trotting. Returns the
 * swing angle (radians, fore/aft) for each of [front-right, front-left,
 * back-right, back-left] at gait phase `phase` out of `total`.
 */
function legSwings(phase: number, total: number): { fr: number; fl: number; br: number; bl: number } {
  const step = (Math.PI * 2 * phase) / total;
  // Front-right & back-left share a phase; front-left & back-right are offset
  // by half a cycle (true diagonal trot).
  const amp = 0.5; // swing amplitude (radians)
  const fr = Math.sin(step) * amp;
  const bl = fr;
  const fl = Math.sin(step + Math.PI) * amp;
  const br = fl;
  return { fr, fl, br, bl };
}

/**
 * Build a full dog geometry (body + phase-specific legs) for gait `phase`.
 * The result is grounded: its lowest point sits at y = 0 so paws touch ground.
 */
export function buildDogGeometry(palette: DogPalette, scale: number, phase: number): BufferGeometry {
  const total = DOG_GAIT_PHASES;
  const parts: Part[] = [...buildBody(palette, scale)];
  const hipY = 0.2 * scale;
  const legLen = 0.2 * scale;
  const fx = 0.2 * scale; // front hip X
  const bx = -0.22 * scale; // back hip X
  const swings = legSwings(phase, total);
  // Right legs sit at +Z, left legs at −Z.
  parts.push(leg(fx, hipY, legLen, swings.fr, palette.coat));
  parts.push(leg(fx, hipY, legLen, swings.fl, palette.coat));
  parts.push(leg(bx, hipY, legLen, swings.br, palette.coat));
  parts.push(leg(bx, hipY, legLen, swings.bl, palette.coat));
  // Position right/left legs at +/- Z (the box is centered on Z=0; offset it).
  // Rebuild with Z offsets by merging four translated copies would double work;
  // instead translate the last four parts in Z.
  const legStart = parts.length - 4;
  const zOff = 0.08 * scale;
  parts[legStart + 0].geometry.translate(0, 0, zOff); // front-right
  parts[legStart + 1].geometry.translate(0, 0, -zOff); // front-left
  parts[legStart + 2].geometry.translate(0, 0, zOff); // back-right
  parts[legStart + 3].geometry.translate(0, 0, -zOff); // back-left

  const merged = mergeColored(parts as ColoredPart[]);
  // Ground the merged geometry.
  merged.computeBoundingBox();
  const minY = merged.boundingBox?.min.y ?? 0;
  if (minY !== 0) {
    merged.translate(0, -minY, 0);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Owner (era-neutral) + leash — ties a subset of dogs to pedestrian flow
// ---------------------------------------------------------------------------

/** Build a small era-neutral owner figure (torso + head). Cheap, shared mesh. */
export function buildOwnerGeometry(): BufferGeometry {
  const parts: Part[] = [];
  parts.push(box(0.3, 0.5, 0.2, 0, 0.85, 0, hex('#3a4a6a'))); // torso
  parts.push(box(0.3, 0.3, 0.18, 0, 1.15, 0, hex('#5a6a8a'))); // legs region
  parts.push(sphere(0.12, 0, 1.5, 0, hex('#caa07a'))); // head
  const merged = mergeColored(parts as ColoredPart[]);
  return merged;
}

/** Build a unit leash segment (unit-length cylinder along +Y) for instancing. */
export function buildLeashGeometry(): BufferGeometry {
  // Unit cylinder of length 1 along Y, base at origin — the DogSystem scales it
  // between an owner's hand and the dog's collar each frame.
  const geo = new CylinderGeometry(0.015, 0.015, 1, 5);
  geo.translate(0, 0.5, 0);
  return geo;
}
