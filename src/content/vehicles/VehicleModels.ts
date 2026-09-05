/**
 * src/content/vehicles/VehicleModels.ts — procedural vehicle geometry.
 *
 * Every era's vehicles are built here from primitive BufferGeometry parts
 * (boxes/cylinders), translated into final body coordinates and merged per
 * material channel (paint, accent, glass, wheels, chrome trim, headlights,
 * taillights). Zero external assets; a whole car is a handful of small meshes
 * so the full-era population stays far within a 60fps frame budget.
 *
 * Each builder draws only period-correct cues for its model family:
 *  1945 — tall rounded black sedans with exposed fenders + trolley
 *  1965 — long low chrome-heavy sedans/wagons with tailfins and two-tone roofs
 *  1985 — boxy sedans/hatchbacks and a panel van
 *  2005 — crossover SUVs and rounded hatchbacks
 *  2025 — sleek EVs and a robo-shuttle pod
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import type { VehicleModelId } from '../../eras';

/** Paint/two-tone/trim colours for a vehicle, taken from its declarative spec. */
export interface VehiclePalette {
  color: string;
  accentColor: string;
  trimColor: string;
}

/** Merged geometry channels for one vehicle rig. */
export interface VehicleGeometrySet {
  body: THREE.BufferGeometry;
  accent: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  wheels: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  lights: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  /** Overall length in metres (for the rig's heading bookkeeping). */
  length: number;
}

type GeomList = THREE.BufferGeometry[];

/** Translate a geometry by (x, y, z) after optional rotations around X/Y. */
function at(
  geo: THREE.BufferGeometry,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
): THREE.BufferGeometry {
  if (rx !== 0) {
    geo.rotateX(rx);
  }
  if (ry !== 0) {
    geo.rotateY(ry);
  }
  geo.translate(x, y, z);
  return geo;
}

/** Box part; front of a car is +Z, right side +X. */
function bx(
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
): THREE.BufferGeometry {
  return at(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry);
}

/** Tire with axis along X (the car's width axis), resting on y=0. */
function tire(r: number, w: number, x: number, z: number): THREE.BufferGeometry {
  return at(
    new THREE.CylinderGeometry(r, r, w, 10, 1),
    x,
    r,
    z,
    Math.PI / 2,
    0,
  );
}

/** Thin light disc facing +Z (headlight) or −Z (tail light). */
function lightDisc(r: number, x: number, y: number, z: number, backward = false): THREE.BufferGeometry {
  return at(
    new THREE.CylinderGeometry(r, r, 0.05, 8, 1),
    x,
    y,
    z,
    0,
    backward ? -Math.PI / 2 : Math.PI / 2,
  );
}

/** Merge a per-material channel; empty channels become empty geometries. */
function mergeChannel(parts: GeomList): THREE.BufferGeometry {
  if (parts.length === 0) {
    return new THREE.BufferGeometry();
  }
  const merged = mergeGeometries(parts);
  if (!merged) {
    return new THREE.BufferGeometry();
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Common building blocks
// ---------------------------------------------------------------------------

function standardWheels(parts: GeomList, r = 0.34, zFront = 1.42, zRear = -1.42): void {
  for (const [x, z] of [
    [0.85, zFront],
    [-0.85, zFront],
    [0.85, zRear],
    [-0.85, zRear],
  ] as const) {
    parts.push(tire(r, 0.2, x, z));
  }
}

function bumpers(parts: GeomList, lengthZ: number, y = 0.42, h = 0.16): void {
  const half = lengthZ / 2;
  parts.push(bx(1.95, h, 0.16, 0, y, half, 0, 0));
  parts.push(bx(1.95, h, 0.16, 0, y, -half, 0, 0));
}

function lights(parts: GeomList, y = 0.62, xGap = 0.62): void {
  parts.push(lightDisc(0.12, xGap, y, -0.02, false));
  parts.push(lightDisc(0.12, -xGap, y, -0.02, false));
}

function tails(parts: GeomList, y = 0.62, xGap = 0.6): void {
  parts.push(lightDisc(0.09, xGap, y, 0.02, true));
  parts.push(lightDisc(0.09, -xGap, y, 0.02, true));
}

// ---------------------------------------------------------------------------
// Per-era builders
// ---------------------------------------------------------------------------

function buildSedan1945(list: GeomList, _a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, tl: GeomList): void {
  // Tall pre-war body an inch off the ground: exposed fenders over the tires.
  list.push(bx(1.85, 0.32, 4.6, 0, 0.42, 0));
  list.push(bx(2.0, 0.42, 1.35, 0, 0.5, 1.42)); // rear fenders
  list.push(bx(2.0, 0.42, 1.35, 0, 0.5, -1.42)); // front fenders
  list.push(bx(1.42, 0.28, 1.35, 0, 0.78, -1.42)); // high hood
  list.push(bx(1.62, 0.3, 1.05, 0, 0.8, 1.52)); // raised trunk
  list.push(bx(1.52, 0.6, 2.0, 0, 1.0, -0.05)); // tall greenhouse
  list.push(bx(1.66, 0.14, 2.1, 0, 1.36, -0.05)); // roof
  // Running boards between the fenders.
  list.push(bx(1.98, 0.08, 1.7, 0, 0.24, 0));
  // Radiator shell.
  t.push(bx(1.5, 0.4, 0.12, 0, 0.72, -2.28, 0, 0));
  // Big round headlights bolted to the fenders.
  l.push(lightDisc(0.16, 0.72, 0.72, -2.26));
  l.push(lightDisc(0.16, -0.72, 0.72, -2.26));
  tl.push(lightDisc(0.08, 0.68, 0.82, 2.06, true));
  tl.push(lightDisc(0.08, -0.68, 0.82, 2.06, true));
  // Side windows.
  for (const s of [-1, 1]) {
    g.push(bx(0.04, 0.42, 0.62, s * 0.77, 1.14, -0.62));
    g.push(bx(0.04, 0.42, 0.56, s * 0.77, 1.16, 0.45));
  }
  standardWheels(w, 0.36, 1.35, -1.35);
  bumpers(t, 4.6, 0.34, 0.14);
}

function buildTrolley1945(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, _l: GeomList, _tl: GeomList): void {
  // Long streetcar with a cream band over a dark red body.
  list.push(bx(2.05, 0.62, 8.6, 0, 1.05, 0));
  list.push(bx(2.16, 0.3, 8.6, 0, 1.52, 0)); // roof crown
  list.push(bx(2.0, 0.24, 8.4, 0, 1.72, 0)); // clerestory roof
  list.push(bx(1.9, 0.3, 1.1, 0, 0.28, 0)); // underpinnings
  // Cream band at beltline.
  a.push(bx(2.1, 0.26, 8.5, 0, 1.18, 0));
  // Route destination sign box.
  a.push(bx(1.5, 0.3, 0.16, 0, 1.9, -4.25));
  // Trolley pole rising from the roof.
  t.push(at(new THREE.BoxGeometry(0.06, 1.5, 0.06), 0.8, 2.1, 3.4, 0.35, 0));
  // Window band both sides.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      g.push(bx(0.05, 0.5, 1.1, s * 1.0, 1.34, -3.2 + i * 1.6));
    }
  }
  // Front/rear windows.
  g.push(bx(1.5, 0.55, 0.05, 0, 1.34, -4.28));
  g.push(bx(1.5, 0.55, 0.05, 0, 1.34, 4.28));
  // Headlight + rear marker.
  t.push(lightDisc(0.12, 0, 0.95, -4.29));
  t.push(lightDisc(0.12, 0, 0.95, 4.29, true));
  // Small truck wheels under the body.
  for (const z of [2.7, -2.7]) {
    w.push(tire(0.26, 0.24, 0.7, z));
    w.push(tire(0.26, 0.24, -0.7, z));
  }
}

function buildSedan1965(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, tl: GeomList): void {
  // Long, low, wide; chrome everywhere and a two-tone roof.
  list.push(bx(1.86, 0.3, 4.9, 0, 0.36, 0));
  list.push(bx(1.7, 0.2, 1.35, 0, 0.6, -1.62)); // hood
  list.push(bx(1.6, 0.2, 1.25, 0, 0.58, 1.55)); // trunk
  // Tail fins.
  list.push(bx(0.12, 0.5, 1.0, 0.82, 0.52, 1.7, 0, -0.12));
  list.push(bx(0.12, 0.5, 1.0, -0.82, 0.52, 1.7, 0, 0.12));
  // Slim fastback cabin.
  list.push(bx(1.58, 0.46, 1.7, 0, 0.88, -0.15));
  a.push(bx(1.52, 0.12, 1.82, 0, 1.2, -0.15)); // white roof
  // Side chrome spear + rocker chrome.
  t.push(bx(0.03, 0.045, 2.7, 0.94, 0.56, 0));
  t.push(bx(0.03, 0.045, 2.7, -0.94, 0.56, 0));
  t.push(bx(1.88, 0.06, 4.8, 0, 0.22, 0));
  // Wrap-around windshield/backlight glass.
  for (const s of [-1, 1]) {
    g.push(at(bx(1.55, 0.4, 0.05, s * 0.78, 0.92, -1.05), 0, 0, 0, 0, s * -0.1));
    g.push(bx(0.04, 0.36, 1.2, s * 0.8, 0.95, 0.1));
    g.push(bx(0.04, 0.36, 0.5, s * 0.76, 0.92, 1.1));
  }
  standardWheels(w, 0.33, 1.5, -1.5);
  bumpers(t, 4.9, 0.32, 0.14);
  lights(l, 0.62, 0.6);
  tails(tl, 0.66, 0.55);
}

function buildWagon1965(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, tl: GeomList): void {
  // Station wagon: stretched roof to the tail, wood-tone side panels.
  list.push(bx(1.86, 0.3, 5.1, 0, 0.36, 0));
  list.push(bx(1.7, 0.62, 2.3, 0, 0.86, 1.0)); // rear box
  list.push(bx(1.7, 0.22, 1.3, 0, 0.6, -1.7)); // hood
  list.push(bx(1.6, 0.1, 4.7, 0, 1.28, 0)); // long roof
  a.push(bx(1.64, 0.5, 2.1, 0, 0.84, 1.0)); // two-tone rear quarter
  a.push(bx(0.04, 0.5, 1.9, 0.88, 0.78, 1.05)); // wood panel left
  a.push(bx(0.04, 0.5, 1.9, -0.88, 0.78, 1.05)); // wood panel right
  // Cabin glass: windshield + three side windows.
  for (const s of [-1, 1]) {
    g.push(at(bx(1.55, 0.42, 0.05, s * 0.8, 0.92, -1.15), 0, 0, 0, 0, s * -0.08));
    g.push(bx(0.04, 0.44, 0.8, s * 0.83, 0.94, -0.35));
    g.push(bx(0.04, 0.46, 1.1, s * 0.83, 0.96, 0.65));
    g.push(bx(0.04, 0.46, 0.9, s * 0.83, 0.96, 1.85));
  }
  g.push(at(bx(1.6, 0.5, 0.05, 0, 0.95, 2.15), 0, 0, 0, 0.15, 0)); // rear glass
  standardWheels(w, 0.33, 1.55, -1.55);
  bumpers(t, 5.1, 0.32, 0.14);
  lights(l, 0.64, 0.6);
  tails(tl, 0.68, 0.5);
}

function buildSedan1985(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, tl: GeomList): void {
  // Square shoulders, squared-off greenhouse, black rubber bumpers.
  list.push(bx(1.82, 0.4, 4.55, 0, 0.46, 0));
  list.push(bx(1.75, 0.2, 1.4, 0, 0.72, -1.42));
  list.push(bx(1.75, 0.2, 1.35, 0, 0.72, 1.42));
  list.push(bx(1.6, 0.52, 2.15, 0, 1.0, 0));
  list.push(bx(1.7, 0.1, 2.25, 0, 1.32, 0));
  a.push(bx(1.88, 0.16, 4.6, 0, 0.22, 0)); // black rocker trim
  a.push(bx(1.88, 0.14, 0.2, 0, 0.44, 2.26)); // black front bumper
  a.push(bx(1.88, 0.14, 0.2, 0, 0.44, -2.26)); // black rear bumper
  for (const s of [-1, 1]) {
    g.push(at(bx(1.62, 0.42, 0.05, s * 0.8, 0.96, -0.98), 0, 0, 0, 0, s * -0.05));
    g.push(bx(0.04, 0.42, 1.4, s * 0.82, 1.02, 0.15));
    g.push(at(bx(1.62, 0.42, 0.05, s * 0.8, 0.98, 1.28), 0, 0, 0, 0, s * 0.05));
  }
  standardWheels(w, 0.33, 1.45, -1.45);
  t.push(bx(1.7, 0.1, 0.14, 0, 0.62, 2.24)); // chrome grille
  lights(l, 0.66, 0.58);
  tails(tl, 0.7, 0.55);
}

function buildHatchback1985(list: GeomList, a: GeomList, g: GeomList, w: GeomList, _t: GeomList, l: GeomList, tl: GeomList): void {
  // Short package with a steep rear liftgate, black cladding.
  list.push(bx(1.76, 0.44, 3.9, 0, 0.46, 0));
  list.push(bx(1.66, 0.2, 1.05, 0, 0.72, -1.3)); // hood
  list.push(bx(1.6, 0.5, 1.75, 0, 1.0, -0.35)); // compact cabin
  list.push(bx(1.7, 0.1, 2.0, 0, 1.3, -0.35)); // roof
  a.push(bx(1.8, 0.2, 3.95, 0, 0.2, 0)); // cladding band
  a.push(bx(1.8, 0.14, 0.2, 0, 0.45, 1.94));
  a.push(bx(1.8, 0.14, 0.2, 0, 0.45, -1.94));
  for (const s of [-1, 1]) {
    g.push(at(bx(1.58, 0.45, 0.05, s * 0.78, 0.96, -1.02), 0, 0, 0, 0, s * -0.06));
    g.push(bx(0.04, 0.44, 1.25, s * 0.8, 1.0, 0.05));
    g.push(at(bx(1.6, 0.52, 0.05, s * 0.8, 1.02, 1.12), 0, 0, 0, -0.65, 0)); // liftgate glass
  }
  standardWheels(w, 0.32, 1.28, -1.24);
  lights(l, 0.64, 0.56);
  tails(tl, 0.66, 0.5);
}

function buildVan1985(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, _tl: GeomList): void {
  // Tall panel van: near-solid sides, sloping windshield, stripe.
  list.push(bx(1.92, 0.95, 4.7, 0, 0.82, 0));
  list.push(bx(1.98, 0.24, 4.6, 0, 1.4, 0)); // roof
  a.push(bx(0.12, 0.55, 4.2, 0, 0.85, 0.1)); // two-tone band across sides? use full-width stripe
  a.push(bx(1.96, 0.18, 0.2, 0, 0.52, -2.32)); // front valance
  for (const s of [-1, 1]) {
    g.push(at(bx(1.7, 0.5, 0.06, s * 0.9, 1.05, -1.9), 0, 0, 0, 0, s * -0.15)); // windshield
    g.push(bx(0.05, 0.5, 0.9, s * 0.92, 1.1, -0.7));
  }
  t.push(bx(1.86, 0.16, 0.2, 0, 0.5, -2.34)); // chrome front
  t.push(bx(1.86, 0.16, 0.2, 0, 0.5, 2.34));
  standardWheels(w, 0.34, 1.5, -1.5);
  lights(l, 0.78, 0.62);
}

function buildSuv2005(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, tl: GeomList): void {
  // Crossover: high greenhouse, cladding, roof rails, bigger wheels.
  list.push(bx(1.88, 0.48, 4.5, 0, 0.58, 0));
  list.push(bx(1.8, 0.22, 1.2, 0, 0.82, -1.5)); // hood
  list.push(bx(1.74, 0.6, 2.6, 0, 1.06, 0.1)); // greenhouse
  list.push(bx(1.82, 0.12, 2.7, 0, 1.44, 0.1)); // roof
  a.push(bx(1.92, 0.3, 3.8, 0, 0.36, 0)); // plastic cladding band
  a.push(bx(0.05, 0.12, 1.4, 0.62, 1.52, 0.2)); // roof rail
  a.push(bx(0.05, 0.12, 1.4, -0.62, 1.52, 0.2));
  for (const s of [-1, 1]) {
    g.push(at(bx(1.66, 0.5, 0.06, s * 0.84, 1.08, -1.05), 0, 0, 0, 0, s * -0.1));
    g.push(bx(0.05, 0.5, 1.5, s * 0.88, 1.1, 0.35));
    g.push(at(bx(1.66, 0.5, 0.06, s * 0.84, 1.06, 1.75), 0, 0, 0, 0, s * 0.08));
  }
  standardWheels(w, 0.4, 1.45, -1.45);
  t.push(bx(1.86, 0.16, 0.16, 0, 0.56, -2.24)); // chrome grille bar
  lights(l, 0.78, 0.6);
  tails(tl, 0.82, 0.56);
}

function buildHatchback2005(list: GeomList, a: GeomList, g: GeomList, w: GeomList, _t: GeomList, l: GeomList, tl: GeomList): void {
  // Rounded 5-door with a fast sloped rear glass.
  list.push(bx(1.78, 0.44, 3.85, 0, 0.48, 0));
  list.push(bx(1.7, 0.2, 1.1, 0, 0.74, -1.25)); // hood
  list.push(bx(1.62, 0.52, 1.8, 0, 1.02, -0.25)); // cabin
  list.push(bx(1.7, 0.1, 1.95, 0, 1.35, -0.3)); // roof
  for (const s of [-1, 1]) {
    g.push(at(bx(1.6, 0.46, 0.05, s * 0.8, 0.98, -1.0), 0, 0, 0, 0, s * -0.12));
    g.push(bx(0.04, 0.46, 1.3, s * 0.83, 1.04, 0.1));
    g.push(at(bx(1.62, 0.55, 0.05, s * 0.82, 1.05, 1.18), 0, 0, 0, -0.55, 0));
  }
  standardWheels(w, 0.34, 1.3, -1.26);
  a.push(bx(1.8, 0.12, 0.18, 0, 0.4, 1.92)); // rear bumper accent
  lights(l, 0.68, 0.56);
  tails(tl, 0.66, 0.5);
}

function buildEv2025(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, tl: GeomList): void {
  // Smooth low EV: long wheelbase, full canopy, no grille, aero discs.
  list.push(bx(1.86, 0.32, 4.7, 0, 0.42, 0));
  list.push(at(bx(1.68, 0.42, 2.9, 0, 0.86, 0), 0, 0, 0, 0.12, 0)); // fastback canopy
  list.push(bx(1.7, 0.08, 2.9, 0, 1.06, 0)); // glass roof plane
  a.push(at(bx(1.86, 0.22, 0.7, 0, 0.5, -2.0), 0, 0, 0, 0.18, 0)); // hood slope
  // Light bar across the nose (trim) and thin rocker.
  t.push(bx(1.8, 0.08, 0.08, 0, 0.56, -2.33));
  t.push(bx(0.03, 0.05, 3.4, 0.94, 0.46, 0));
  t.push(bx(0.03, 0.05, 3.4, -0.94, 0.46, 0));
  // Aero wheels: full discs flush with the body.
  for (const z of [1.5, -1.5]) {
    w.push(at(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 10, 1), 0.85, 0.32, z, Math.PI / 2, 0));
    w.push(at(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 10, 1), -0.85, 0.32, z, Math.PI / 2, 0));
  }
  for (const s of [-1, 1]) {
    g.push(at(bx(1.62, 0.4, 0.06, s * 0.8, 0.9, -1.1), 0, 0, 0, 0, s * -0.16));
    g.push(bx(0.04, 0.4, 1.6, s * 0.85, 0.9, 0.3));
  }
  // Blade headlight + LED tails.
  l.push(bx(0.9, 0.06, 0.05, 0, 0.62, -2.35));
  tl.push(bx(1.3, 0.05, 0.05, 0, 0.72, 2.35));
}

function buildShuttle2025(list: GeomList, a: GeomList, g: GeomList, w: GeomList, t: GeomList, l: GeomList, tl: GeomList): void {
  // Autonomous pod: tall rounded body, full glass band, glowing accents.
  list.push(bx(1.92, 1.1, 4.3, 0, 0.8, 0));
  list.push(bx(2.0, 0.22, 4.4, 0, 1.42, 0)); // roof
  a.push(bx(2.04, 0.14, 4.2, 0, 0.22, 0)); // teal light skirt
  a.push(bx(1.0, 0.1, 0.1, 0.62, 1.05, -2.12)); // sensor pod
  a.push(bx(1.0, 0.1, 0.1, -0.62, 1.05, -2.12));
  for (const s of [-1, 1]) {
    g.push(bx(0.06, 0.42, 3.4, s * 0.92, 0.92, 0));
    g.push(at(bx(1.8, 0.5, 0.06, s * 0.96, 0.9, -2.1), 0, 0, 0, 0, s * -0.08));
  }
  g.push(at(bx(1.86, 0.5, 0.06, 0, 0.9, 2.12), 0, 0, 0, -0.12, 0));
  t.push(bx(1.94, 0.08, 0.1, 0, 0.34, -2.12)); // skid plate
  // Fully enclosed wheel skirts show small markers only.
  standardWheels(w, 0.28, 1.4, -1.4);
  l.push(bx(1.7, 0.06, 0.05, 0, 0.62, -2.14));
  tl.push(bx(1.7, 0.06, 0.05, 0, 0.62, 2.14));
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/** Build the full geometry set for one procedural vehicle model. */
export function buildVehicleGeometry(
  model: VehicleModelId,
  palette: VehiclePalette,
): VehicleGeometrySet {
  void palette; // palette drives the rig's materials; geometry is shape-only.
  const body: GeomList = [];
  const accent: GeomList = [];
  const glass: GeomList = [];
  const wheels: GeomList = [];
  const trim: GeomList = [];
  const lights: GeomList = [];
  const tail: GeomList = [];

  switch (model) {
    case 'sedan-1945':
      buildSedan1945(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'trolley-1945':
      buildTrolley1945(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'sedan-1965':
      buildSedan1965(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'wagon-1965':
      buildWagon1965(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'sedan-1985':
      buildSedan1985(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'hatchback-1985':
      buildHatchback1985(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'van-1985':
      buildVan1985(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'suv-2005':
      buildSuv2005(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'hatchback-2005':
      buildHatchback2005(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'ev-2025':
      buildEv2025(body, accent, glass, wheels, trim, lights, tail);
      break;
    case 'shuttle-2025':
      buildShuttle2025(body, accent, glass, wheels, trim, lights, tail);
      break;
  }

  return {
    body: mergeChannel(body),
    accent: mergeChannel(accent),
    glass: mergeChannel(glass),
    wheels: mergeChannel(wheels),
    trim: mergeChannel(trim),
    lights: mergeChannel(lights),
    tail: mergeChannel(tail),
    length: model.startsWith('trolley') ? 8.6 : model.includes('wagon') ? 5.1 : 4.6,
  };
}