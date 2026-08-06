/**
 * Era-specific vehicle content for the City Time Period Timelapse.
 *
 * This module owns everything vehicle-related for all five canonical eras:
 *
 *   - It registers a fully-typed {@link VehicleConfig} for every era year
 *     (1945, 1965, 1985, 2005, 2025) into the shared foundation era registry,
 *     merging only the `vehicles` field so it composes with the other content
 *     modules (buildings, storefronts, pedestrians, ...).
 *   - It builds every vehicle from procedural Three.js geometry — no external
 *     asset files — with era-correct silhouettes and paint palettes.
 *   - It provides {@link createVehicleTraffic}, a self-contained traffic
 *     system that spawns era-appropriate vehicles and animates them driving
 *     around a simple street loop path.
 *
 * Wire the traffic system into the scene (for example from main.ts) with:
 *
 *   const traffic = createVehicleTraffic(scene);
 *   // in the animation loop:
 *   traffic.update(delta);
 *   // on era switch (keyboard hotkeys 1-5):
 *   traffic.setEra(year);
 *   // on teardown:
 *   traffic.dispose();
 */
import * as THREE from 'three';
import { eraRegistry } from '../eras';
import type { EraConfig, EraYear, VehicleConfig, VehicleType } from '../eras';
import { seededFromString } from '../core/prng';

/* ------------------------------------------------------------------ *
 * Shared material / part helpers
 * ------------------------------------------------------------------ */

const GLASS_COLOR = 0x1c2430;
const TIRE_COLOR = 0x14171c;
const CHROME_COLOR = 0xd5dade;

interface PartMaterialOptions {
  color?: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
}

/** Build a standard material from a small options object. */
function mat(options: PartMaterialOptions): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 0.6,
    metalness: options.metalness ?? 0.1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function glassMaterial(): THREE.MeshStandardMaterial {
  return mat({
    color: GLASS_COLOR,
    roughness: 0.15,
    metalness: 0.5,
    opacity: 0.92,
    transparent: true,
  });
}

function headlightMaterial(): THREE.MeshStandardMaterial {
  return mat({ color: 0xf5e9c8, emissive: 0xf5e9c8, emissiveIntensity: 0.5, roughness: 0.3 });
}

function tailLightMaterial(): THREE.MeshStandardMaterial {
  return mat({ color: 0xc81e2e, emissive: 0xc81e2e, emissiveIntensity: 0.4, roughness: 0.3 });
}

/** Add a box mesh to a group and return it. */
function box(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/** Add a cylinder mesh to a group, optionally re-aimed along x or z. */
function cylinder(
  group: THREE.Group,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  axis: 'x' | 'y' | 'z' = 'y',
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
  if (axis === 'x') geometry.rotateZ(Math.PI / 2);
  else if (axis === 'z') geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/** Add a (possibly non-uniformly scaled) sphere mesh to a group. */
function sphere(
  group: THREE.Group,
  radius: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/** Add a wheel (tire + hub) at the given x/z offset. */
function wheel(group: THREE.Group, x: number, z: number, radius = 0.34, width = 0.24): void {
  const tire = mat({ color: TIRE_COLOR, roughness: 0.9 });
  const hub = mat({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 });
  cylinder(group, radius, radius, width, 18, x, radius, z, tire, 'x');
  cylinder(group, radius * 0.5, radius * 0.5, width + 0.02, 12, x, radius, z, hub, 'x');
}

/* ------------------------------------------------------------------ *
 * Vehicle body styles
 * ------------------------------------------------------------------ */

/**
 * The procedural body silhouettes available across the eras. Each maps onto
 * the era-appropriate vehicle families described in the requirements.
 */
export type VehicleBodyStyle =
  | 'classic-sedan'
  | 'classic-coupe'
  | 'muscle'
  | 'chrome-sedan'
  | 'boxy-sedan'
  | 'hatchback'
  | 'minivan'
  | 'suv'
  | 'hybrid'
  | 'rounded-sedan'
  | 'ev'
  | 'ev-ride-share';

/** 1945: rounded-fender sedans and coupes in muted tones. */
function buildClassicSedan(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.4, metalness: 0.2 });
  const trim = mat({ color: accent, roughness: 0.45, metalness: 0.3 });
  const glass = glassMaterial();
  const chrome = mat({ color: CHROME_COLOR, roughness: 0.2, metalness: 0.9 });

  box(group, 1.8, 0.5, 4.0, 0, 0.6, 0, body);
  // Rounded fenders bulging over each wheel.
  sphere(group, 0.42, -0.92, 0.46, -1.35, body, 1, 0.8, 1.05);
  sphere(group, 0.42, 0.92, 0.46, -1.35, body, 1, 0.8, 1.05);
  sphere(group, 0.42, -0.92, 0.46, 1.35, body, 1, 0.8, 1.05);
  sphere(group, 0.42, 0.92, 0.46, 1.35, body, 1, 0.8, 1.05);
  // Hood and cabin.
  box(group, 1.7, 0.18, 1.5, 0, 0.94, 1.25, body);
  box(group, 1.62, 0.5, 2.0, 0, 1.05, -0.2, glass);
  box(group, 1.6, 0.1, 1.8, 0, 1.33, -0.2, body);
  // Chrome bumpers.
  box(group, 1.85, 0.16, 0.14, 0, 0.5, 2.02, chrome);
  box(group, 1.85, 0.16, 0.14, 0, 0.5, -2.02, chrome);
  // Headlights.
  sphere(group, 0.09, -0.55, 0.72, 2.0, headlightMaterial());
  sphere(group, 0.09, 0.55, 0.72, 2.0, headlightMaterial());
  // Muted side trim.
  box(group, 0.04, 0.14, 3.6, -0.82, 0.72, 0, trim);
  box(group, 0.04, 0.14, 3.6, 0.82, 0.72, 0, trim);
  wheel(group, -0.85, -1.35);
  wheel(group, 0.85, -1.35);
  wheel(group, -0.85, 1.35);
  wheel(group, 0.85, 1.35);
}

/** 1945: a lower, shorter-cabin coupe with a fastback rear deck. */
function buildClassicCoupe(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.4, metalness: 0.2 });
  const trim = mat({ color: accent, roughness: 0.45, metalness: 0.3 });
  const glass = glassMaterial();
  const chrome = mat({ color: CHROME_COLOR, roughness: 0.2, metalness: 0.9 });

  box(group, 1.8, 0.5, 4.2, 0, 0.58, 0, body);
  // Rounded fenders.
  sphere(group, 0.42, -0.92, 0.44, -1.4, body, 1, 0.8, 1.05);
  sphere(group, 0.42, 0.92, 0.44, -1.4, body, 1, 0.8, 1.05);
  sphere(group, 0.42, -0.92, 0.44, 1.4, body, 1, 0.8, 1.05);
  sphere(group, 0.42, 0.92, 0.44, 1.4, body, 1, 0.8, 1.05);
  // Long hood, short cabin, fastback rear.
  box(group, 1.7, 0.16, 1.7, 0, 0.9, 1.3, body);
  box(group, 1.55, 0.42, 1.3, 0, 1.0, -0.5, glass);
  const rear = box(group, 1.5, 0.34, 1.5, 0, 0.95, -1.6, body);
  rear.rotation.x = -0.35;
  box(group, 1.5, 0.1, 1.2, 0, 1.24, -0.5, body);
  box(group, 1.85, 0.16, 0.14, 0, 0.48, 2.12, chrome);
  box(group, 1.85, 0.16, 0.14, 0, 0.48, -2.12, chrome);
  sphere(group, 0.09, -0.55, 0.7, 2.1, headlightMaterial());
  sphere(group, 0.09, 0.55, 0.7, 2.1, headlightMaterial());
  box(group, 0.04, 0.12, 3.8, -0.82, 0.7, 0, trim);
  box(group, 0.04, 0.12, 3.8, 0.82, 0.7, 0, trim);
  wheel(group, -0.85, -1.4);
  wheel(group, 0.85, -1.4);
  wheel(group, -0.85, 1.4);
  wheel(group, 0.85, 1.4);
}

/** 1965: low, wide muscle car with a long hood and two-tone stripes. */
function buildMuscle(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.3, metalness: 0.35 });
  const stripe = mat({ color: accent, metalness: 0.5, roughness: 0.3 });
  const glass = glassMaterial();
  const chrome = mat({ color: CHROME_COLOR, roughness: 0.2, metalness: 0.9 });

  box(group, 1.95, 0.5, 4.4, 0, 0.58, 0, body);
  box(group, 1.8, 0.16, 1.9, 0, 0.9, 1.25, body);
  box(group, 1.85, 0.16, 1.3, 0, 0.9, -1.5, body);
  box(group, 1.6, 0.42, 1.5, 0, 1.0, -0.15, glass);
  // Two-tone racing stripes.
  box(group, 0.06, 0.1, 3.8, -0.98, 0.66, 0, stripe);
  box(group, 0.06, 0.1, 3.8, 0.98, 0.66, 0, stripe);
  // Chrome bumpers.
  box(group, 2.0, 0.18, 0.16, 0, 0.45, 2.22, chrome);
  box(group, 2.0, 0.18, 0.16, 0, 0.45, -2.22, chrome);
  sphere(group, 0.1, -0.6, 0.68, 2.2, headlightMaterial());
  sphere(group, 0.1, 0.6, 0.68, 2.2, headlightMaterial());
  box(group, 0.12, 0.1, 0.06, -0.6, 0.68, -2.2, tailLightMaterial());
  box(group, 0.12, 0.1, 0.06, 0.6, 0.68, -2.2, tailLightMaterial());
  wheel(group, -0.88, -1.4, 0.38, 0.26);
  wheel(group, 0.88, -1.4, 0.38, 0.26);
  wheel(group, -0.88, 1.4, 0.38, 0.26);
  wheel(group, 0.88, 1.4, 0.38, 0.26);
}

/** 1965: full-size chrome-bumper sedan with a two-tone roof. */
function buildChromeSedan(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.35, metalness: 0.3 });
  const roof = mat({ color: accent, roughness: 0.3, metalness: 0.35 });
  const glass = glassMaterial();
  const chrome = mat({ color: CHROME_COLOR, roughness: 0.2, metalness: 0.9 });

  box(group, 1.9, 0.55, 4.6, 0, 0.62, 0, body);
  box(group, 1.7, 0.52, 2.3, 0, 1.08, -0.2, glass);
  box(group, 1.68, 0.12, 2.1, 0, 1.35, -0.2, roof);
  box(group, 1.95, 0.2, 0.16, 0, 0.5, 2.32, chrome);
  box(group, 1.95, 0.2, 0.16, 0, 0.5, -2.32, chrome);
  box(group, 1.5, 0.22, 0.08, 0, 0.62, 2.3, chrome);
  sphere(group, 0.1, -0.6, 0.74, 2.3, headlightMaterial());
  sphere(group, 0.1, 0.6, 0.74, 2.3, headlightMaterial());
  box(group, 0.04, 0.08, 4.0, -0.95, 0.72, 0, chrome);
  box(group, 0.04, 0.08, 4.0, 0.95, 0.72, 0, chrome);
  wheel(group, -0.88, -1.45);
  wheel(group, 0.88, -1.45);
  wheel(group, -0.88, 1.45);
  wheel(group, 0.88, 1.45);
}

/** 1985: angular, flat-roofed boxy sedan. */
function buildBoxySedan(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.5, metalness: 0.15 });
  const trim = mat({ color: accent, roughness: 0.55, metalness: 0.2 });
  const glass = glassMaterial();

  box(group, 1.85, 0.55, 4.3, 0, 0.62, 0, body);
  box(group, 1.7, 0.55, 2.4, 0, 1.12, -0.15, glass);
  box(group, 1.68, 0.1, 2.3, 0, 1.4, -0.15, trim);
  box(group, 1.8, 0.5, 0.1, 0, 0.62, 2.15, body);
  box(group, 0.28, 0.16, 0.06, -0.6, 0.72, 2.18, headlightMaterial());
  box(group, 0.28, 0.16, 0.06, 0.6, 0.72, 2.18, headlightMaterial());
  box(group, 0.12, 0.12, 0.06, -0.6, 0.72, -2.18, tailLightMaterial());
  box(group, 0.12, 0.12, 0.06, 0.6, 0.72, -2.18, tailLightMaterial());
  wheel(group, -0.85, -1.4);
  wheel(group, 0.85, -1.4);
  wheel(group, -0.85, 1.4);
  wheel(group, 0.85, 1.4);
}

/** 1985: angular hatchback with a sloped rear hatch. */
function buildHatchback(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.5, metalness: 0.15 });
  const trim = mat({ color: accent, roughness: 0.55, metalness: 0.2 });
  const glass = glassMaterial();

  box(group, 1.8, 0.5, 4.0, 0, 0.62, 0, body);
  box(group, 1.65, 0.5, 1.9, 0, 1.05, -0.3, glass);
  const hatch = box(group, 1.6, 0.3, 1.2, 0, 0.95, -1.55, glass);
  hatch.rotation.x = 0.5;
  box(group, 1.6, 0.1, 1.7, 0, 1.32, -0.3, body);
  box(group, 1.75, 0.18, 0.6, 0, 0.85, 1.85, body);
  box(group, 0.26, 0.14, 0.06, -0.6, 0.72, 2.0, headlightMaterial());
  box(group, 0.26, 0.14, 0.06, 0.6, 0.72, 2.0, headlightMaterial());
  box(group, 0.1, 0.12, 0.06, -0.6, 0.72, -2.0, trim);
  box(group, 0.1, 0.12, 0.06, 0.6, 0.72, -2.0, trim);
  wheel(group, -0.85, -1.35);
  wheel(group, 0.85, -1.35);
  wheel(group, -0.85, 1.35);
  wheel(group, 0.85, 1.35);
}

/** 1985: tall, boxy early minivan. */
function buildMinivan(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.5, metalness: 0.15 });
  const trim = mat({ color: accent, roughness: 0.55, metalness: 0.2 });
  const glass = glassMaterial();

  box(group, 1.95, 0.7, 4.4, 0, 0.75, 0, body);
  box(group, 1.85, 0.9, 3.4, 0, 1.55, -0.1, glass);
  box(group, 1.8, 0.12, 3.3, 0, 2.02, -0.1, body);
  box(group, 1.9, 0.6, 0.12, 0, 0.75, 2.2, body);
  box(group, 0.3, 0.16, 0.06, -0.65, 0.8, 2.24, headlightMaterial());
  box(group, 0.3, 0.16, 0.06, 0.65, 0.8, 2.24, headlightMaterial());
  box(group, 0.03, 0.9, 0.02, 0.98, 1.55, -0.1, trim);
  wheel(group, -0.9, -1.5, 0.4, 0.28);
  wheel(group, 0.9, -1.5, 0.4, 0.28);
  wheel(group, -0.9, 1.5, 0.4, 0.28);
  wheel(group, 0.9, 1.5, 0.4, 0.28);
}

/** 2005: tall SUV with larger wheels and roof rails. */
function buildSuv(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.4, metalness: 0.25 });
  const rail = mat({ color: accent, metalness: 0.6, roughness: 0.4 });
  const glass = glassMaterial();

  box(group, 1.95, 0.75, 4.4, 0, 0.8, 0, body);
  box(group, 1.8, 0.6, 2.8, 0, 1.45, -0.1, glass);
  box(group, 1.78, 0.12, 2.7, 0, 1.75, -0.1, body);
  box(group, 0.06, 0.06, 2.6, -0.85, 1.84, -0.1, rail);
  box(group, 0.06, 0.06, 2.6, 0.85, 1.84, -0.1, rail);
  box(group, 1.9, 0.5, 0.5, 0, 0.8, 2.1, body);
  box(group, 0.3, 0.12, 0.08, -0.65, 0.85, 2.25, headlightMaterial());
  box(group, 0.3, 0.12, 0.08, 0.65, 0.85, 2.25, headlightMaterial());
  box(group, 0.3, 0.14, 0.06, -0.65, 0.9, -2.25, tailLightMaterial());
  box(group, 0.3, 0.14, 0.06, 0.65, 0.9, -2.25, tailLightMaterial());
  wheel(group, -0.9, -1.5, 0.44, 0.28);
  wheel(group, 0.9, -1.5, 0.44, 0.28);
  wheel(group, -0.9, 1.5, 0.44, 0.28);
  wheel(group, 0.9, 1.5, 0.44, 0.28);
}

/** 2005: smooth, rounded hybrid sedan. */
function buildHybrid(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.3, metalness: 0.3 });
  const glass = glassMaterial();
  void accent;

  box(group, 1.85, 0.5, 4.2, 0, 0.6, 0, body);
  sphere(group, 1.05, 0, 1.05, -0.2, glass, 0.9, 0.5, 1.1);
  box(group, 1.7, 0.14, 1.6, 0, 0.87, 1.3, body);
  box(group, 0.3, 0.1, 0.08, -0.6, 0.68, 2.1, headlightMaterial());
  box(group, 0.3, 0.1, 0.08, 0.6, 0.68, 2.1, headlightMaterial());
  box(group, 0.12, 0.1, 0.06, -0.6, 0.7, -2.1, tailLightMaterial());
  box(group, 0.12, 0.1, 0.06, 0.6, 0.7, -2.1, tailLightMaterial());
  wheel(group, -0.85, -1.4);
  wheel(group, 0.85, -1.4);
  wheel(group, -0.85, 1.4);
  wheel(group, 0.85, 1.4);
}

/** 2005: rounded, aerodynamic sedan with a smooth cabin. */
function buildRoundedSedan(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.3, metalness: 0.3 });
  const glass = glassMaterial();
  void accent;

  box(group, 1.9, 0.5, 4.4, 0, 0.6, 0, body);
  sphere(group, 1.1, 0, 1.08, -0.2, glass, 0.88, 0.52, 1.15);
  box(group, 1.75, 0.16, 1.7, 0, 0.9, 1.35, body);
  box(group, 0.32, 0.1, 0.08, -0.6, 0.7, 2.2, headlightMaterial());
  box(group, 0.32, 0.1, 0.08, 0.6, 0.7, 2.2, headlightMaterial());
  box(group, 0.12, 0.1, 0.06, -0.6, 0.7, -2.2, tailLightMaterial());
  box(group, 0.12, 0.1, 0.06, 0.6, 0.7, -2.2, tailLightMaterial());
  wheel(group, -0.88, -1.45);
  wheel(group, 0.88, -1.45);
  wheel(group, -0.88, 1.45);
  wheel(group, 0.88, 1.45);
}

/** 2025: smooth aerodynamic electric vehicle with LED light bars. */
function buildEv(group: THREE.Group, paint: number, accent: number): void {
  const body = mat({ color: paint, roughness: 0.25, metalness: 0.35 });
  const glass = glassMaterial();
  const led = mat({ color: accent, emissive: accent, emissiveIntensity: 1.6, roughness: 0.3 });
  const ledWhite = mat({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.3 });

  box(group, 1.9, 0.45, 4.4, 0, 0.55, 0, body);
  sphere(group, 1.12, 0, 1.0, -0.2, glass, 0.85, 0.5, 1.2);
  box(group, 1.8, 0.14, 1.8, 0, 0.8, 1.3, body);
  // Full-width LED light bars front and rear.
  box(group, 1.5, 0.06, 0.05, 0, 0.62, 2.2, led);
  box(group, 1.5, 0.06, 0.05, 0, 0.62, -2.2, ledWhite);
  box(group, 0.5, 0.05, 0.06, -0.55, 0.62, 2.2, led);
  box(group, 0.5, 0.05, 0.06, 0.55, 0.62, 2.2, led);
  wheel(group, -0.85, -1.35, 0.34, 0.26);
  wheel(group, 0.85, -1.35, 0.34, 0.26);
  wheel(group, -0.85, 1.35, 0.34, 0.26);
  wheel(group, 0.85, 1.35, 0.34, 0.26);
}

/** 2025: electric ride-share vehicle with a glowing roof badge. */
function buildEvRideShare(group: THREE.Group, paint: number, accent: number): void {
  buildEv(group, paint, accent);
  const sign = mat({ color: 0xffffff, emissive: 0x66e0ff, emissiveIntensity: 0.8, roughness: 0.4 });
  const post = mat({ color: 0x22262b, roughness: 0.6 });
  box(group, 0.7, 0.14, 0.3, 0, 1.78, -0.2, sign);
  box(group, 0.05, 0.26, 0.05, -0.26, 1.63, -0.2, post);
  box(group, 0.05, 0.26, 0.05, 0.26, 1.63, -0.2, post);
}

/** Build a complete procedural vehicle for the given body style. */
export function buildVehicle(style: VehicleBodyStyle, paint: number, accent: number): THREE.Group {
  const group = new THREE.Group();
  switch (style) {
    case 'classic-sedan':
      buildClassicSedan(group, paint, accent);
      break;
    case 'classic-coupe':
      buildClassicCoupe(group, paint, accent);
      break;
    case 'muscle':
      buildMuscle(group, paint, accent);
      break;
    case 'chrome-sedan':
      buildChromeSedan(group, paint, accent);
      break;
    case 'boxy-sedan':
      buildBoxySedan(group, paint, accent);
      break;
    case 'hatchback':
      buildHatchback(group, paint, accent);
      break;
    case 'minivan':
      buildMinivan(group, paint, accent);
      break;
    case 'suv':
      buildSuv(group, paint, accent);
      break;
    case 'hybrid':
      buildHybrid(group, paint, accent);
      break;
    case 'rounded-sedan':
      buildRoundedSedan(group, paint, accent);
      break;
    case 'ev':
      buildEv(group, paint, accent);
      break;
    case 'ev-ride-share':
      buildEvRideShare(group, paint, accent);
      break;
  }
  return group;
}

/* ------------------------------------------------------------------ *
 * Era profiles + registry registration
 * ------------------------------------------------------------------ */

interface EraVehicleProfile {
  year: EraYear;
  /** Traffic density 0..1. */
  density: number;
  /** Cruising speed range in world units/second. */
  speedRange: [number, number];
  /** Muted / thematic paint palette for this era. */
  palette: number[];
  /** Accent palette (two-tone, chrome, LED). */
  accent: number[];
  /** Procedural body styles that appear this era. */
  styles: VehicleBodyStyle[];
  /** Foundation vehicle types registered for this era. */
  registryTypes: VehicleType[];
}

/**
 * Per-era vehicle profiles. Each captures the era-appropriate silhouettes and
 * color language described in the requirements.
 */
const ERA_VEHICLE_PROFILES: Record<EraYear, EraVehicleProfile> = {
  1945: {
    year: 1945,
    density: 0.35,
    speedRange: [3, 6],
    palette: [0x3a3f3a, 0x2f3640, 0x4a3b32, 0x5b5148, 0x3d3d3f],
    accent: [0x6f6a63, 0x7a746b, 0x8a847a],
    styles: ['classic-sedan', 'classic-coupe'],
    registryTypes: ['sedan', 'taxi', 'trolley'],
  },
  1965: {
    year: 1965,
    density: 0.5,
    speedRange: [4, 8],
    palette: [0xb23a2e, 0x1f5aa8, 0x2e7d4f, 0xd8a000, 0x22262b],
    accent: [0xcfd4d8, 0xe8e6df],
    styles: ['muscle', 'chrome-sedan'],
    registryTypes: ['sedan', 'taxi', 'bus'],
  },
  1985: {
    year: 1985,
    density: 0.55,
    speedRange: [4, 8],
    palette: [0x8a6d3b, 0x7a4a2f, 0x5a6b7a, 0x9aa0a6, 0x3f4a5a],
    accent: [0x2a2e33, 0x3a3f45],
    styles: ['boxy-sedan', 'hatchback', 'minivan'],
    registryTypes: ['sedan', 'taxi', 'truck'],
  },
  2005: {
    year: 2005,
    density: 0.6,
    speedRange: [4, 9],
    palette: [0x9aa5b1, 0x3b6ea5, 0x6b7a4f, 0x8a3a3a, 0x22262b],
    accent: [0xc8ccd1],
    styles: ['suv', 'hybrid', 'rounded-sedan'],
    registryTypes: ['sedan', 'taxi', 'truck'],
  },
  2025: {
    year: 2025,
    density: 0.7,
    speedRange: [5, 10],
    palette: [0xd8dde2, 0x2c3e50, 0x3f7d8c, 0x5a5a6e, 0x1f2a38],
    accent: [0x66e0ff, 0xffffff],
    styles: ['ev', 'ev-ride-share'],
    registryTypes: ['sedan', 'taxi', 'bus'],
  },
};

/** Read-only view of the era vehicle profiles for introspection/tests. */
export const VEHICLE_PROFILES: Readonly<Record<EraYear, EraVehicleProfile>> = ERA_VEHICLE_PROFILES;

/** Build the foundation {@link VehicleConfig} for a profile. */
function buildVehicleConfig(profile: EraVehicleProfile): VehicleConfig {
  return {
    types: profile.registryTypes,
    density: profile.density,
    palette: profile.palette,
    speedRange: profile.speedRange,
  };
}

/**
 * Merge a vehicle config into the shared era registry, preserving any other
 * fields (buildings, storefronts, ...) that sibling content modules register.
 */
function registerVehicleConfig(year: EraYear, config: VehicleConfig): void {
  const existing: Partial<EraConfig> = eraRegistry[year] ?? {};
  eraRegistry[year] = { ...existing, vehicles: config } as EraConfig;
}

// Register era-appropriate vehicles for all five canonical years.
registerVehicleConfig(1945, buildVehicleConfig(ERA_VEHICLE_PROFILES[1945]));
registerVehicleConfig(1965, buildVehicleConfig(ERA_VEHICLE_PROFILES[1965]));
registerVehicleConfig(1985, buildVehicleConfig(ERA_VEHICLE_PROFILES[1985]));
registerVehicleConfig(2005, buildVehicleConfig(ERA_VEHICLE_PROFILES[2005]));
registerVehicleConfig(2025, buildVehicleConfig(ERA_VEHICLE_PROFILES[2025]));

/* ------------------------------------------------------------------ *
 * Street loop path + traffic system
 * ------------------------------------------------------------------ */

/**
 * A simple rectangular street loop. Vehicles are driven along the perimeter
 * by an arc-length parameter; `getPointAt` returns the world position plus the
 * unit travel direction so a vehicle can be oriented correctly.
 */
class LoopPath {
  readonly width: number;
  readonly height: number;
  readonly perimeter: number;
  private readonly halfWidth: number;
  private readonly halfHeight: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.perimeter = 2 * (width + height);
    this.halfWidth = width / 2;
    this.halfHeight = height / 2;
  }

  getPointAt(s: number): { x: number; z: number; dx: number; dz: number } {
    const t = ((s % this.perimeter) + this.perimeter) % this.perimeter;
    const { halfWidth: hw, halfHeight: hh, width: w, height: h } = this;
    if (t < w) {
      const f = t / w;
      return { x: -hw + f * w, z: -hh, dx: 1, dz: 0 };
    }
    if (t < w + h) {
      const f = (t - w) / h;
      return { x: hw, z: -hh + f * h, dx: 0, dz: 1 };
    }
    if (t < 2 * w + h) {
      const f = (t - w - h) / w;
      return { x: hw - f * w, z: hh, dx: -1, dz: 0 };
    }
    const f = (t - 2 * w - h) / h;
    return { x: -hw, z: hh - f * h, dx: 0, dz: -1 };
  }
}

interface TrafficVehicle {
  group: THREE.Group;
  speed: number;
  arc: number;
}

export interface VehicleTrafficOptions {
  /** Street loop width in world units (default 44). */
  loopWidth?: number;
  /** Street loop height in world units (default 44). */
  loopHeight?: number;
  /** Initial era to render (default 2025). */
  era?: EraYear;
  /** Number of vehicles to spawn (default derived from era density). */
  count?: number;
  /** Deterministic seed for reproducible vehicle variety. */
  seed?: string;
}

export interface VehicleTrafficHandle {
  /** Rebuild the traffic for the given era year. */
  setEra(year: EraYear): void;
  /** The era currently rendered. */
  getEra(): EraYear;
  /** Advance vehicles along the street loop. Call every frame. */
  update(delta: number): void;
  /** Remove all traffic and release GPU resources. */
  dispose(): void;
}

/**
 * Create a self-contained traffic system: a road plane plus era-appropriate
 * procedural vehicles that drive around a street loop.
 */
export function createVehicleTraffic(
  scene: THREE.Scene,
  options: VehicleTrafficOptions = {},
): VehicleTrafficHandle {
  const loopWidth = options.loopWidth ?? 44;
  const loopHeight = options.loopHeight ?? 44;
  const loop = new LoopPath(loopWidth, loopHeight);
  const seed = options.seed ?? 'vehicles';

  const container = new THREE.Group();
  container.name = 'vehicle-traffic';
  scene.add(container);

  // Simple road surface under the loop.
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(loopWidth + 3, loopHeight + 3),
    mat({ color: 0x3a4046, roughness: 0.9 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.005;
  road.receiveShadow = true;
  container.add(road);

  let currentYear: EraYear = options.era ?? 2025;
  let vehicles: TrafficVehicle[] = [];

  function buildFor(year: EraYear): void {
    for (const vehicle of vehicles) {
      container.remove(vehicle.group);
    }
    vehicles = [];

    const profile = ERA_VEHICLE_PROFILES[year];
    const count = options.count ?? Math.max(4, Math.round(profile.density * 16));
    const prng = seededFromString(`${seed}:${year}`);

    for (let i = 0; i < count; i++) {
      const style = prng.pick(profile.styles);
      const paint = prng.pick(profile.palette);
      const accent = prng.pick(profile.accent);
      const group = buildVehicle(style, paint, accent);
      const speed = prng.range(profile.speedRange[0], profile.speedRange[1]);
      const arc = prng.range(0, loop.perimeter);
      const point = loop.getPointAt(arc);
      group.position.set(point.x, 0, point.z);
      group.rotation.y = Math.atan2(point.dx, point.dz);
      container.add(group);
      vehicles.push({ group, speed, arc });
    }
  }

  buildFor(currentYear);

  function update(delta: number): void {
    for (const vehicle of vehicles) {
      vehicle.arc = (vehicle.arc + vehicle.speed * delta) % loop.perimeter;
      const point = loop.getPointAt(vehicle.arc);
      vehicle.group.position.set(point.x, 0, point.z);
      vehicle.group.rotation.y = Math.atan2(point.dx, point.dz);
    }
  }

  function dispose(): void {
    container.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else if (material) {
        material.dispose();
      }
    });
    scene.remove(container);
  }

  return {
    setEra(year: EraYear): void {
      currentYear = year;
      buildFor(year);
    },
    getEra: () => currentYear,
    update,
    dispose,
  };
}
