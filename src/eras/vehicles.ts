/**
 * Era vehicles: procedural street life per year.
 *
 * Builds and animates era-accurate low-poly vehicles driving a smooth road
 * loop around the city block. Each year (1945/1965/1985/2005/2025) gets its
 * own silhouette, palette and headlight/taillight treatment:
 *
 *   - 1945: rounded sedans + a trolleybus (muted pre-war colours)
 *   - 1965: tailfin cars + a delivery van (bright mid-century colours)
 *   - 1985: boxy sedans / hatchbacks + a transit bus
 *   - 2005: crossovers + a hybrid taxi
 *   - 2025: EVs + e-scooters + an autonomous shuttle pod
 *
 * All geometry is procedural (boxes / low-poly hemispheres); no external
 * model assets are used. Headlights and taillights are self-luminous
 * (emissive) materials so they read clearly without extra light rigging.
 *
 * Lifecycle contract: `bootstrap(scene, era)` -> `update(delta, era)` ->
 * `dispose()`. On an era change the vehicle fleet is rebuilt in place, which
 * is the "morph" trigger the compose/scene owner keys off.
 *
 * This module owns only the `EraDefinition.vehicles` segment: it never
 * mutates the era registry or any other era field.
 */
import * as THREE from 'three';
import { eraRegistry } from '../data/eraRegistry';
import type { EraDefinition, EraKey } from '../data/eraDefinition';

// ---------------------------------------------------------------------------
// Road loop convention (shared with the pedestrians module)
// ---------------------------------------------------------------------------

/** Half length (world units) of the straight road sections along X. */
export const ROAD_HALF_LEN = 30;

/** Radius of the semicircular road ends; the road centre sits at z = ±radius. */
export const ROAD_CORNER_RADIUS = 11;

/** A point + heading along a rounded-rectangle loop in the XZ (ground) plane. */
export interface LoopPose {
  x: number;
  z: number;
  /** Yaw about Y in radians; local +Z (vehicle forward) maps onto travel dir. */
  yaw: number;
}

/** Perimeter of a rounded-rectangle loop with the given half-length/radius. */
export function loopPerimeter(halfLen: number, radius: number): number {
  return 4 * halfLen + 2 * Math.PI * radius;
}

/**
 * Map a travelled arc length to a position + heading on a rounded-rectangle
 * loop. The path is continuous and smooth (straight sections joined by
 * semicircular ends), so animating `arc += speed * dt` never teleports or
 * jitters. `arc` may be any real number (negative / > perimeter are wrapped).
 */
export function loopPoint(arc: number, halfLen: number, radius: number): LoopPose {
  const straight = 2 * halfLen;
  const end = Math.PI * radius;
  const perimeter = loopPerimeter(halfLen, radius);
  let s = ((arc % perimeter) + perimeter) % perimeter;

  // Front straight: x from -halfLen -> +halfLen, z = +radius, facing +X.
  if (s < straight) {
    return { x: -halfLen + s, z: radius, yaw: Math.PI / 2 };
  }
  s -= straight;

  // Right semicircle: front -> back at x = +halfLen.
  if (s < end) {
    const a = s / radius; // 0..PI
    return {
      x: halfLen + radius * Math.sin(a),
      z: radius * Math.cos(a),
      yaw: Math.atan2(Math.cos(a), -Math.sin(a)),
    };
  }
  s -= end;

  // Back straight: x from +halfLen -> -halfLen, z = -radius, facing -X.
  if (s < straight) {
    return { x: halfLen - s, z: -radius, yaw: -Math.PI / 2 };
  }
  s -= straight;

  // Left semicircle: back -> front at x = -halfLen.
  const a = s / radius; // 0..PI
  return {
    x: -halfLen - radius * Math.sin(a),
    z: -radius * Math.cos(a),
    yaw: Math.atan2(-Math.cos(a), Math.sin(a)),
  };
}

/** Convenience wrapper for the actual road loop that vehicles drive. */
export function roadLoopPoint(arc: number): LoopPose {
  return loopPoint(arc, ROAD_HALF_LEN, ROAD_CORNER_RADIUS);
}

/** Perimeter of the road loop. */
export function roadLoopPerimeter(): number {
  return loopPerimeter(ROAD_HALF_LEN, ROAD_CORNER_RADIUS);
}

// ---------------------------------------------------------------------------
// Small procedural helpers
// ---------------------------------------------------------------------------

/** Build a MeshStandardMaterial from a hex colour plus optional extras. */
function mat(
  color: string,
  opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number } = {},
): THREE.MeshStandardMaterial {
  const params: THREE.MeshStandardMaterialParameters = {
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.08,
  };
  if (opts.emissive !== undefined) {
    params.emissive = opts.emissive;
    params.emissiveIntensity = opts.emissiveIntensity ?? 1.6;
  }
  return new THREE.MeshStandardMaterial(params);
}

/** A single low-poly box mesh. */
function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/** A low-poly top hemisphere (dome) of unit radius, scaled/capped as needed. */
function dome(material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), material);
}

/**
 * Add four (or `n` for long vehicles) dark wheel boxes under a body.
 * `body` is the vehicle root group; body length is along +Z, width along +X.
 */
function addWheels(root: THREE.Group, width: number, length: number, wheelH: number, n: number, mat_: THREE.Material): void {
  const wheelW = 0.55;
  const wheelD = 0.55;
  const insetX = width / 2 - 0.32;
  const positions: Array<[number, number]> = [];
  if (n === 4) {
    positions.push([-insetX, length / 2 - 0.9], [insetX, length / 2 - 0.9], [-insetX, -length / 2 + 0.9], [insetX, -length / 2 + 0.9]);
  } else {
    // 6 wheels for buses / shuttles.
    for (const zz of [length / 2 - 1.1, 0, -length / 2 + 1.1]) {
      positions.push([-insetX, zz], [insetX, zz]);
    }
  }
  for (const [px, pz] of positions) {
    const w = box(wheelW, wheelH, wheelD, mat_);
    w.position.set(px, wheelH / 2, pz);
    root.add(w);
  }
}

/** Add two emissive headlights at the front (+Z) face. */
function addHeadlights(root: THREE.Group, width: number, lightH: number, frontZ: number, color: string): void {
  const inset = width / 2 - 0.42;
  for (const px of [-inset, inset]) {
    const l = box(0.5, 0.34, 0.12, mat(color, { emissive: color, emissiveIntensity: 2.2 }));
    l.position.set(px, lightH, frontZ);
    root.add(l);
  }
}

/** Add two emissive red taillights at the rear (-Z) face. */
function addTaillights(root: THREE.Group, width: number, lightH: number, rearZ: number, color: string): void {
  const inset = width / 2 - 0.42;
  for (const px of [-inset, inset]) {
    const l = box(0.42, 0.28, 0.1, mat(color, { emissive: color, emissiveIntensity: 1.9 }));
    l.position.set(px, lightH, rearZ);
    root.add(l);
  }
}

// ---------------------------------------------------------------------------
// Vehicle builders
// ---------------------------------------------------------------------------

/** The distinct procedural vehicle silhouettes used across eras. */
export type VehicleKind =
  | 'sedan'
  | 'tailfin'
  | 'boxy'
  | 'hatchback'
  | 'crossover'
  | 'ev'
  | 'taxi'
  | 'van'
  | 'bus'
  | 'trolleybus'
  | 'scooter'
  | 'shuttle';

/** Colours resolved from the era definition (used for accents). */
interface EraAccents {
  accent: string;
}

/** Build a generic car body with an era-specific cabin silhouette. */
function buildCar(kind: VehicleKind, era: EraAccents): THREE.Group {
  const root = new THREE.Group();
  const bodyColor = kind === 'taxi' ? '#f4e14a' : kind === 'ev' ? '#e8f0f4' : kind === 'crossover' ? '#7f9bb5' : kind === 'boxy' ? '#b09a78' : kind === 'hatchback' ? '#c94f2f' : kind === 'tailfin' ? '#2f7d9b' : '#2e3a2e';
  const roofColor = kind === 'taxi' ? '#d9c03a' : kind === 'ev' ? '#cfdde6' : kind === 'crossover' ? '#5f7d9e' : kind === 'boxy' ? '#8f7c5e' : kind === 'hatchback' ? '#a83c24' : kind === 'tailfin' ? '#7a9bbf' : '#1f2620';

  const isCrossover = kind === 'crossover' || kind === 'taxi';
  const length = isCrossover ? 5.2 : 4.6;
  const width = isCrossover ? 2.2 : 1.9;
  const bodyH = isCrossover ? 1.35 : 1.15;
  const cabinL = isCrossover ? 2.6 : 2.3;
  const cabinW = isCrossover ? 1.9 : 1.55;
  const cabinH = isCrossover ? 0.62 : 0.52;
  const cabinZ = isCrossover ? -0.25 : -0.15;

  const bodyMat = mat(bodyColor, { metalness: isCrossover ? 0.35 : 0.2 });
  const roofMat = mat(roofColor, { metalness: 0.15 });

  // Body.
  const body = box(width, bodyH, length, bodyMat);
  body.position.set(0, bodyH / 2, 0);
  root.add(body);

  // Cabin roof (domed for 1940s rounded sedans, boxy otherwise).
  if (kind === 'sedan') {
    const d = dome(roofMat);
    d.scale.set(cabinW, cabinH * 1.55, cabinL);
    d.position.set(0, bodyH, cabinZ);
    root.add(d);
  } else {
    const cab = box(cabinW, cabinH, cabinL, roofMat);
    cab.position.set(0, bodyH + cabinH / 2, cabinZ);
    root.add(cab);
  }

  // 1960s tailfin: a vertical fin plate rising from the rear deck.
  if (kind === 'tailfin') {
    const fin = box(0.16, 0.85, 0.5, mat(era.accent, { metalness: 0.3 }));
    fin.position.set(0, bodyH + 0.42, -length / 2 + 0.35);
    root.add(fin);
  }

  // 2000s crossover: roof rails along the cabin edges.
  if (isCrossover) {
    for (const px of [-cabinW / 2 + 0.12, cabinW / 2 - 0.12]) {
      const rail = box(0.1, 0.1, cabinL + 0.3, mat(era.accent, { metalness: 0.6 }));
      rail.position.set(px, bodyH + cabinH + 0.05, cabinZ);
      root.add(rail);
    }
  }

  // 2025 EV: a slim emissive light band across the front fascia.
  if (kind === 'ev') {
    const band = box(width - 0.5, 0.14, 0.1, mat('#9fe8ff', { emissive: '#9fe8ff', emissiveIntensity: 2.4 }));
    band.position.set(0, bodyH * 0.55, length / 2 - 0.08);
    root.add(band);
  }

  const wheelH = isCrossover ? 0.72 : 0.62;
  addWheels(root, width, length, wheelH, 4, mat('#1b1b1b', { roughness: 0.95 }));
  addHeadlights(root, width, bodyH * 0.6, length / 2 + 0.02, kind === 'taxi' ? '#fff6d8' : '#fff2c8');
  addTaillights(root, width, bodyH * 0.55, -length / 2 - 0.02, '#d81f1f');

  if (kind === 'taxi') {
    // Roof taxi sign (emissive).
    const sign = box(0.7, 0.4, 0.24, mat('#ffe14a', { emissive: '#ffe14a', emissiveIntensity: 2.0 }));
    sign.position.set(0, bodyH + cabinH + 0.32, cabinZ + 0.1);
    root.add(sign);
  }

  return root;
}

/** Build a delivery van (1965). */
function buildVan(era: EraAccents): THREE.Group {
  const root = new THREE.Group();
  const bodyMat = mat('#c8cfc2', { metalness: 0.18 });
  const length = 5.6;
  const width = 2.1;
  const bodyH = 1.95;

  const body = box(width, bodyH, length, bodyMat);
  body.position.set(0, bodyH / 2, 0);
  root.add(body);

  // Boxier rear cargo section.
  const rear = box(width * 0.82, bodyH * 0.55, length * 0.5, mat(era.accent, { metalness: 0.2 }));
  rear.position.set(0, bodyH + bodyH * 0.55 / 2, 0);
  root.add(rear);

  // Windshield band.
  const glass = box(width * 0.8, 0.42, length * 0.14, mat('#9fd4e8', { metalness: 0.5 }));
  glass.position.set(0, bodyH * 0.72, length / 2 - 0.6);
  root.add(glass);

  addWheels(root, width, length, 0.6, 4, mat('#1b1b1b', { roughness: 0.95 }));
  addHeadlights(root, width, bodyH * 0.55, length / 2 + 0.02, '#fff2c8');
  addTaillights(root, width, bodyH * 0.5, -length / 2 - 0.02, '#d81f1f');
  return root;
}

/** Build a transit bus (1985). */
function buildBus(era: EraAccents): THREE.Group {
  const root = new THREE.Group();
  const bodyMat = mat('#d8cf8a', { metalness: 0.15 });
  const length = 9.5;
  const width = 2.6;
  const bodyH = 2.6;

  const body = box(width, bodyH, length, bodyMat);
  body.position.set(0, bodyH / 2, 0);
  root.add(body);

  // Window strip (light band along the side).
  const glass = box(width - 0.15, 0.7, length - 1.4, mat('#a9cfe8', { metalness: 0.45 }));
  glass.position.set(0, bodyH - 0.55, 0);
  root.add(glass);

  // Roof stripe accent.
  const stripe = box(width * 0.7, 0.12, length - 1.0, mat(era.accent));
  stripe.position.set(0, bodyH + 0.06, 0);
  root.add(stripe);

  addWheels(root, width, length, 0.62, 6, mat('#1b1b1b', { roughness: 0.95 }));
  addHeadlights(root, width, bodyH * 0.55, length / 2 + 0.02, '#fff6d8');
  addTaillights(root, width, bodyH * 0.5, -length / 2 - 0.02, '#d81f1f');
  return root;
}

/** Build a trolleybus (1945). */
function buildTrolleybus(era: EraAccents): THREE.Group {
  const root = new THREE.Group();
  const bodyMat = mat('#3a4438', { metalness: 0.1 });
  const length = 8.6;
  const width = 2.4;
  const bodyH = 2.5;

  const body = box(width, bodyH, length, bodyMat);
  body.position.set(0, bodyH / 2, 0);
  root.add(body);

  const glass = box(width - 0.15, 0.62, length - 1.2, mat('#b8cfc4', { metalness: 0.4 }));
  glass.position.set(0, bodyH - 0.5, 0);
  root.add(glass);

  // Trolley poles rising from the roof.
  for (const px of [-0.7, 0.7]) {
    const pole = box(0.12, 1.5, 0.12, mat('#222222'));
    pole.position.set(px, bodyH + 0.75, -0.4);
    root.add(pole);
  }
  const accentStripe = box(width * 0.7, 0.14, length - 1.2, mat(era.accent));
  accentStripe.position.set(0, bodyH + 0.07, 0);
  root.add(accentStripe);

  addWheels(root, width, length, 0.6, 6, mat('#1b1b1b', { roughness: 0.95 }));
  addHeadlights(root, width, bodyH * 0.55, length / 2 + 0.02, '#ffedb0');
  addTaillights(root, width, bodyH * 0.5, -length / 2 - 0.02, '#a81c1c');
  return root;
}

/** Build an e-scooter (2025). */
function buildScooter(era: EraAccents): THREE.Group {
  const root = new THREE.Group();
  const deck = box(0.45, 0.12, 1.1, mat('#d8dde2', { metalness: 0.5 }));
  deck.position.set(0, 0.3, 0);
  root.add(deck);

  // Stem + handlebar.
  const stem = box(0.1, 1.0, 0.1, mat('#2a2a2a'));
  stem.position.set(0, 0.85, 0.35);
  root.add(stem);
  const bar = box(0.5, 0.09, 0.1, mat('#2a2a2a'));
  bar.position.set(0, 1.42, 0.35);
  root.add(bar);

  // Two small wheels.
  for (const zz of [0.5, -0.45]) {
    const w = box(0.4, 0.5, 0.4, mat('#161616', { roughness: 0.95 }));
    w.position.set(0, 0.25, zz);
    root.add(w);
  }

  // Emissive headlight.
  const hl = box(0.16, 0.16, 0.1, mat('#eaffff', { emissive: '#eaffff', emissiveIntensity: 2.4 }));
  hl.position.set(0, 1.05, 0.42);
  root.add(hl);

  // Accent deck stripe.
  const stripe = box(0.4, 0.05, 0.9, mat(era.accent, { emissive: era.accent, emissiveIntensity: 1.2 }));
  stripe.position.set(0, 0.36, 0);
  root.add(stripe);
  return root;
}

/** Build an autonomous shuttle pod (2025). */
function buildShuttle(era: EraAccents): THREE.Group {
  const root = new THREE.Group();
  const bodyMat = mat('#eef4f8', { metalness: 0.45 });
  const length = 5.0;
  const width = 2.4;
  const bodyH = 1.5;

  // Rounded pod: a wide, flat dome on a low base.
  const base = box(width, bodyH * 0.45, length, bodyMat);
  base.position.set(0, bodyH * 0.225, 0);
  root.add(base);

  const pod = dome(mat('#d7e6f0', { metalness: 0.4 }));
  pod.scale.set(width * 0.9, bodyH * 0.5, length * 0.9);
  pod.position.set(0, bodyH * 0.45, 0);
  root.add(pod);

  // Emissive light band (front-facing) around the pod.
  const band = box(width * 0.8, 0.16, 0.12, mat('#7fe3ff', { emissive: '#7fe3ff', emissiveIntensity: 2.2 }));
  band.position.set(0, bodyH * 0.5, length / 2 - 0.1);
  root.add(band);

  // Sensor cluster on the roof.
  const sensor = box(0.5, 0.3, 0.5, mat(era.accent, { emissive: era.accent, emissiveIntensity: 1.6 }));
  sensor.position.set(0, bodyH * 0.95, 0.1);
  root.add(sensor);

  addWheels(root, width, length, 0.55, 6, mat('#1b1b1b', { roughness: 0.95 }));
  addHeadlights(root, width, bodyH * 0.4, length / 2 + 0.02, '#eaffff');
  addTaillights(root, width, bodyH * 0.36, -length / 2 - 0.02, '#d81f1f');
  return root;
}

/** Build a single vehicle mesh for the given kind. */
function buildVehicle(kind: VehicleKind, era: EraDefinition): THREE.Group {
  const accents: EraAccents = { accent: era.palette.accent };
  switch (kind) {
    case 'sedan':
    case 'tailfin':
    case 'boxy':
    case 'hatchback':
    case 'crossover':
    case 'ev':
    case 'taxi':
      return buildCar(kind, accents);
    case 'van':
      return buildVan(accents);
    case 'bus':
      return buildBus(accents);
    case 'trolleybus':
      return buildTrolleybus(accents);
    case 'scooter':
      return buildScooter(accents);
    case 'shuttle':
      return buildShuttle(accents);
  }
}

// ---------------------------------------------------------------------------
// Per-era vehicle segment
// ---------------------------------------------------------------------------

/** Fleet composition + base cruise speed for each year. */
export interface VehicleSegment {
  kinds: VehicleKind[];
  /** Cruise speed in world units per second along the road loop. */
  speed: number;
}

/**
 * The `EraDefinition.vehicles` segment, keyed per year. Each year's fleet is
 * authored here; other era fields are intentionally left untouched.
 */
export const VEHICLE_SEGMENT: Record<EraKey, VehicleSegment> = {
  1945: { kinds: ['sedan', 'sedan', 'trolleybus'], speed: 7.0 },
  1965: { kinds: ['tailfin', 'tailfin', 'van'], speed: 8.0 },
  1985: { kinds: ['boxy', 'hatchback', 'bus'], speed: 9.0 },
  2005: { kinds: ['crossover', 'crossover', 'taxi'], speed: 11.0 },
  2025: { kinds: ['ev', 'scooter', 'scooter', 'shuttle'], speed: 12.0 },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** One animated vehicle instance on the road loop. */
interface MovingVehicle {
  group: THREE.Group;
  /** Arc-length offset (world units) around the loop; spaces the fleet out. */
  offset: number;
  /** Per-vehicle speed multiplier (scooters are quicker, buses slower). */
  speedMul: number;
}

export interface VehiclesFactory {
  /** Create the fleet group and attach it to the scene for the given era. */
  bootstrap(scene: THREE.Scene, era?: EraDefinition): VehiclesFactory;
  /** Advance time and rebuild the fleet when the era changes. */
  update(delta: number, era: EraDefinition): void;
  /** Remove the fleet from the scene and release resources. */
  dispose(): void;
  /** Root group owning all animated vehicles (null before bootstrap). */
  readonly root: THREE.Group | null;
  /** The currently active year. */
  readonly year: EraKey | null;
}

/**
 * Create a vehicles factory. The factory is a single registration point for
 * the `EraDefinition.vehicles` segment: it builds and animates the per-year
 * fleet, and never touches any other era field.
 */
export function vehiclesFactory(): VehiclesFactory {
  const root = new THREE.Group();
  root.name = 'era-vehicles';

  let scene: THREE.Scene | null = null;
  let elapsed = 0;
  let currentYear: EraKey | null = null;
  const fleet: MovingVehicle[] = [];

  /** Rebuild the fleet for the given era (used on bootstrap and era change). */
  function rebuild(era: EraDefinition): void {
    root.clear();
    fleet.length = 0;
    const segment = VEHICLE_SEGMENT[era.year];
    const perimeter = roadLoopPerimeter();
    const count = segment.kinds.length;
    for (let i = 0; i < count; i += 1) {
      const kind = segment.kinds[i];
      const group = buildVehicle(kind, era);
      // Spread evenly around the loop; scooters travel faster, buses slower.
      const speedMul =
        kind === 'scooter' ? 1.35 : kind === 'bus' || kind === 'trolleybus' || kind === 'shuttle' ? 0.85 : 1.0;
      fleet.push({ group, offset: (i / count) * perimeter, speedMul });
      root.add(group);
    }
    currentYear = era.year;
  }

  return {
    get root() {
      return root;
    },
    get year() {
      return currentYear;
    },
    bootstrap(sceneArg: THREE.Scene, era?: EraDefinition): VehiclesFactory {
      scene = sceneArg;
      const def = era ?? eraRegistry[1945];
      scene.add(root);
      rebuild(def);
      return this;
    },
    update(delta: number, era: EraDefinition): void {
      elapsed += delta;
      if (era.year !== currentYear) {
        rebuild(era);
      }
      const segment = VEHICLE_SEGMENT[era.year];
      for (const vehicle of fleet) {
        const arc = vehicle.offset + elapsed * segment.speed * vehicle.speedMul;
        const pose = roadLoopPoint(arc);
        vehicle.group.position.set(pose.x, 0, pose.z);
        vehicle.group.rotation.y = pose.yaw;
      }
    },
    dispose(): void {
      if (scene) {
        scene.remove(root);
      }
      root.clear();
      fleet.length = 0;
      scene = null;
      currentYear = null;
    },
  };
}