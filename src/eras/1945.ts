/**
 * Era 1945 — "Post-War Rebuild".
 *
 * Complete content descriptor plus the procedural scene bundle for the first
 * timeline stop. Everything is authored from Three.js primitives and
 * canvas-generated textures (no external assets); every texture helper
 * degrades to flat colors when `document` is unavailable, keeping the builder
 * safe in headless/node test environments.
 *
 * Period rules enforced by this module:
 * - Buildings: low-rise brick tenements, warehouses and wood-frame structures
 *   with wartime proportions, water towers and chimney pots; construction was
 *   rationed, so one corner lot still sits vacant with demolition rubble, a
 *   wooden hoarding and a victory garden. Signage is minimal.
 * - Vehicles: 1940s boxy sedans with separate fenders and running boards, olive
 *   drab military surplus trucks, and very few cars overall (gas was still
 *   rationed into August 1945). A wooden streetcar runs the double rail set in
 *   the asphalt under an overhead wire.
 * - Storefronts: small local shops — grocery, hardware, drug store, bakery,
 *   barber, shoe repair, tailor, deli — with hand-painted sign boards, striped
 *   canvas awnings and period-correct goods in the display windows.
 * - Advertisements: painted brick wall ads (war bonds, Coca-Cola 5¢), a
 *   newspaper stand on the sidewalk, and radio-era painted billboards
 *   advertising a console radio set.
 * - Pedestrians: men in suits and fedora hats, women in dresses and gloves,
 *   children in shorts and caps — all in a muted, rationed palette.
 * - Ambience: sparse wartime traffic, the distant streetcar bell and a light
 *   crowd murmur, registered on the era audio descriptor for the AudioBus.
 */

import * as THREE from 'three';
import type { EraAudioDescriptor } from '../core/AudioBus';
import type { EraContentBuilder } from '../core/EraRegistry';
import type { EraContent, EraId } from './types';

/** Registry key for this era (`EraRegistry.register(ERA_1945_ID, buildEra1945)`). */
export const ERA_1945_ID: EraId = '1945';

/** Complete descriptor for the 1945 era: buildings, vehicles, retail, ads, crowd, ambience, SFX. */
export const era1945Content: EraContent = {
  id: ERA_1945_ID,
  label: '1945 — Post-War Rebuild',
  description:
    'A rationed, sepia block just after V-J Day: low brick tenements and warehouses with water towers, a rubble-strewn ' +
    'vacant lot with a victory garden, hand-painted shop signs under striped awnings, painted war-bonds and soda wall ads, ' +
    'few boxy sedans and olive-drab surplus trucks — and a wooden streetcar clanging down the rails.',
  buildings: {
    facadePalette: ['#8a5a44', '#9c6a50', '#7a4f3a', '#a8845c', '#6e5646', '#b09a78'],
    minHeightMeters: 5,
    maxHeightMeters: 16,
    windows: { columns: 6, rows: 3, litRatio: 0.28, emissiveColor: '#ffd9a0' },
    roofProps: ['water-tower', 'chimney', 'wooden-billboard'],
  },
  vehicles: {
    kinds: ['vintage-sedan'],
    paintPalette: ['#22282e', '#3e4245', '#5b4632', '#6e2f28', '#2e3a30', '#7a7466'],
    // Rationing kept most civilian cars parked: far below the fleet density
    // of any later era. The military trucks and streetcar live in the scene
    // bundle below (the shared VehicleKind union has no wartime entries).
    density: 0.45,
    speedScale: 0.85,
  },
  storefronts: {
    names: [
      'WEINBERG GROCER',
      'ACME HARDWARE',
      'REXALL DRUGS',
      'BARBER SHOP',
      "MOM'S BAKERY",
      'SHOE REPAIR',
      'DYERS & CLEANERS',
      'KOSHER DELI',
      'TAILOR',
    ],
    awningPalette: ['#4e5a44', '#7a3b2e', '#3e4a56', '#8a7448', '#5a6470'],
    signageGlow: 0.35,
  },
  advertisements: {
    billboards: [
      { text: 'BUY WAR BONDS', inkColor: '#f2ecda', glowColor: '#c8b98a', animated: false },
      { text: 'DRINK COCA-COLA — 5¢', inkColor: '#f2ecda', glowColor: '#b8452e', animated: false },
      { text: 'RCA VICTOR RADIO', inkColor: '#f2ecda', glowColor: '#3e5a78', animated: false },
      { text: 'LUCKY STRIKE CIGARETTES', inkColor: '#f2ecda', glowColor: '#8a4a3a', animated: false },
    ],
    glowIntensity: 0.5,
  },
  pedestrians: {
    outfitPalette: ['#3e4448', '#4a4f45', '#54503f', '#2e3336', '#5b5348', '#6e5a4a', '#7a6a54'],
    density: 1,
    walkSpeed: 0.95,
  },
  ambience: {
    skyZenith: '#7d94ad',
    skyHorizon: '#e6d3ac',
    sunColor: '#ffe6bd',
    sunIntensity: 2.2,
    ambientColor: '#c9c2b0',
    ambientIntensity: 0.5,
    fogColor: '#ddd0b2',
    fogDensity: 0.0032,
    particles: 'coal-smoke',
    streetLamps: 'gas-lamp',
  },
  sfx: {
    ambientDroneHz: [46, 92],
    ambientGain: 0.4,
    trafficProfile: 'wartime-rationed',
    events: ['streetcar-bell', 'vintage-horn'],
    eventIntervalSeconds: [5, 14],
    musicStyle: 'radio-jazz',
    masterGain: 0.75,
  },
};

/**
 * Per-era audio channels for the AudioBus: the looping ambience bed carries
 * the sparse rationed traffic, the rail clatter of the streetcar and a light
 * crowd murmur; one-shot events are the distant streetcar bell and vintage
 * horns. Nothing here is anachronistic — the trolley is still running.
 */
export const era1945Audio: EraAudioDescriptor = {
  ambience: 0.85,
  sfx: 1,
  data: {
    label: '1945 post-war block',
    ambienceLayers: [
      { id: 'sparse-traffic', profile: 'wartime-rationed', gain: 0.32 },
      { id: 'trolley-rumble', kind: 'rail-clatter-loop', gain: 0.2 },
      { id: 'crowd-murmur', kind: 'interior-bleed', gain: 0.22 },
    ],
    events: era1945Content.sfx.events,
    musicStyle: era1945Content.sfx.musicStyle,
    droneHz: era1945Content.sfx.ambientDroneHz,
    oneShotEvents: [
      { id: 'distant-trolley-bell', kind: 'streetcar-bell', gain: 0.5, distanceAttenuation: 0.45 },
      { id: 'vintage-horn', kind: 'vintage-horn', gain: 0.4 },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Layout constants (meters, world space)                              */
/* ------------------------------------------------------------------ */

const NORTH_WALK_Z = -2.2;
const SOUTH_WALK_Z = -17.8;
const NORTH_FRONT_Z = 0;
const SOUTH_FRONT_Z = -20;

/** Center line of the streetcar track embedded in the asphalt. */
const TRACK_CENTER_Z = -6.9;
const TRACK_GAUGE = 0.72;
/** Height of the overhead contact wire above the rails. */
const OVERHEAD_WIRE_Y = 5.4;

/* ------------------------------------------------------------------ */
/* Deterministic randomness (stable endpoints for transitions)         */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Canvas texture helpers (browser-only; null in node environments)    */
/* ------------------------------------------------------------------ */

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

interface SignTextureOptions {
  readonly background?: string;
  readonly ink: string;
  /** Soft painted highlight; 1945 signage is never neon. */
  readonly glow?: string;
  readonly subtext?: string;
}

/** Hand-painted sign board texture in period serif lettering. */
function signTexture(text: string, options: SignTextureOptions): THREE.CanvasTexture | null {
  const canvas = createCanvas(512, 256);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, 512, 256);
  }
  ctx.fillStyle = options.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 58px Georgia, "Times New Roman", serif';
  if (options.glow) {
    ctx.shadowColor = options.glow;
    ctx.shadowBlur = 10;
  }
  const baselineY = options.subtext ? 100 : 128;
  // Two slightly offset passes read as hand-painted brushwork.
  ctx.fillText(text, 257, baselineY + 1, 480);
  ctx.fillText(text, 256, baselineY, 480);
  if (options.subtext) {
    ctx.shadowBlur = 0;
    ctx.font = '600 36px Georgia, "Times New Roman", serif';
    ctx.fillText(options.subtext, 256, 186, 480);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function brickTexture(base: string, mortar: string): THREE.CanvasTexture | null {
  const canvas = createCanvas(256, 256);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = base;
  const brickHeight = 20;
  const brickWidth = 52;
  const gap = 4;
  for (let row = 0; row * (brickHeight + gap) < 256; row++) {
    const y = row * (brickHeight + gap);
    const offset = row % 2 === 0 ? 0 : -(brickWidth + gap) / 2;
    for (let x = offset; x < 256; x += brickWidth + gap) {
      ctx.fillRect(x, y, brickWidth, brickHeight);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Horizontal clapboard siding for the wood-frame structures. */
function sidingTexture(base: string, seam: string): THREE.CanvasTexture | null {
  const canvas = createCanvas(128, 128);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = seam;
  for (let y = 0; y < 128; y += 16) {
    ctx.fillRect(0, y, 128, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Striped canvas for awnings and the barber pole. */
function stripeTexture(a: string, b: string): THREE.CanvasTexture | null {
  const canvas = createCanvas(64, 64);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  for (let x = 0; x < 64; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? a : b;
    ctx.fillRect(x, 0, 16, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Shared materials + tiny primitive helpers                           */
/* ------------------------------------------------------------------ */

interface EraMaterials {
  readonly asphalt: THREE.MeshStandardMaterial;
  readonly sidewalk: THREE.MeshStandardMaterial;
  readonly curb: THREE.MeshStandardMaterial;
  readonly paint: THREE.MeshStandardMaterial;
  readonly brightWork: THREE.MeshStandardMaterial;
  readonly tire: THREE.MeshStandardMaterial;
  readonly glassDark: THREE.MeshStandardMaterial;
  readonly shopGlass: THREE.MeshStandardMaterial;
  readonly windowLit: THREE.MeshStandardMaterial;
  readonly steel: THREE.MeshStandardMaterial;
  readonly trunk: THREE.MeshStandardMaterial;
  readonly foliage: THREE.MeshStandardMaterial;
  readonly signBoard: THREE.MeshStandardMaterial;
  readonly darkTrim: THREE.MeshStandardMaterial;
  readonly brickTrim: THREE.MeshStandardMaterial;
  readonly lampLens: THREE.MeshStandardMaterial;
  readonly tailLight: THREE.MeshStandardMaterial;
  readonly brick: THREE.MeshStandardMaterial;
  readonly benchWood: THREE.MeshStandardMaterial;
  readonly woodSiding: THREE.MeshStandardMaterial;
  readonly oliveDrab: THREE.MeshStandardMaterial;
  readonly railSteel: THREE.MeshStandardMaterial;
  readonly tieWood: THREE.MeshStandardMaterial;
  readonly ironDark: THREE.MeshStandardMaterial;
  readonly canvasCream: THREE.MeshStandardMaterial;
  readonly dirt: THREE.MeshStandardMaterial;
  readonly rubbleBrick: THREE.MeshStandardMaterial;
  readonly wire: THREE.MeshStandardMaterial;
  readonly trolleyGreen: THREE.MeshStandardMaterial;
  readonly paperWhite: THREE.MeshStandardMaterial;
}

function createEraMaterials(): EraMaterials {
  const brickMap = brickTexture('#8a5a44', '#cfc4ae');
  if (brickMap) {
    brickMap.repeat.set(4, 3);
  }
  const sidingMap = sidingTexture('#b8a888', '#8a7a5e');
  if (sidingMap) {
    sidingMap.repeat.set(3, 2);
  }
  return {
    asphalt: new THREE.MeshStandardMaterial({ color: '#45484d', roughness: 0.98 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: '#b5ad9a', roughness: 0.94 }),
    curb: new THREE.MeshStandardMaterial({ color: '#a8a396', roughness: 0.92 }),
    paint: new THREE.MeshStandardMaterial({ color: '#e8e2ce', roughness: 0.9 }),
    brightWork: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.9, roughness: 0.3 }),
    tire: new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.95 }),
    glassDark: new THREE.MeshStandardMaterial({ color: '#2a323a', metalness: 0.5, roughness: 0.25 }),
    shopGlass: new THREE.MeshStandardMaterial({
      color: '#2a323a',
      metalness: 0.3,
      roughness: 0.25,
      emissive: new THREE.Color('#ffe2a8'),
      emissiveIntensity: 0.3,
    }),
    windowLit: new THREE.MeshStandardMaterial({
      color: '#3a4048',
      metalness: 0.2,
      roughness: 0.3,
      emissive: new THREE.Color('#ffd9a0'),
      emissiveIntensity: 0.55,
    }),
    steel: new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.8, roughness: 0.4 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#6b4f35', roughness: 0.95 }),
    foliage: new THREE.MeshStandardMaterial({ color: '#5a7a48', roughness: 0.95 }),
    signBoard: new THREE.MeshStandardMaterial({ color: '#2a2620', roughness: 0.75 }),
    darkTrim: new THREE.MeshStandardMaterial({ color: '#3a3f45', metalness: 0.5, roughness: 0.45 }),
    brickTrim: new THREE.MeshStandardMaterial({ color: '#8f8778', roughness: 0.9 }),
    lampLens: new THREE.MeshStandardMaterial({
      color: '#fff3cf',
      emissive: new THREE.Color('#ffd9a0'),
      emissiveIntensity: 0.85,
    }),
    tailLight: new THREE.MeshStandardMaterial({
      color: '#7a1f1a',
      emissive: new THREE.Color('#ff3b2f'),
      emissiveIntensity: 0.4,
    }),
    brick: brickMap
      ? new THREE.MeshStandardMaterial({ map: brickMap, roughness: 0.92 })
      : new THREE.MeshStandardMaterial({ color: '#8a5a44', roughness: 0.92 }),
    benchWood: new THREE.MeshStandardMaterial({ color: '#7a5f40', roughness: 0.85 }),
    woodSiding: sidingMap
      ? new THREE.MeshStandardMaterial({ map: sidingMap, roughness: 0.9 })
      : new THREE.MeshStandardMaterial({ color: '#b8a888', roughness: 0.9 }),
    oliveDrab: new THREE.MeshStandardMaterial({ color: '#4a5238', roughness: 0.85 }),
    railSteel: new THREE.MeshStandardMaterial({ color: '#6a6f74', metalness: 0.85, roughness: 0.45 }),
    tieWood: new THREE.MeshStandardMaterial({ color: '#4a3c2c', roughness: 0.95 }),
    ironDark: new THREE.MeshStandardMaterial({ color: '#23262a', metalness: 0.6, roughness: 0.55 }),
    canvasCream: new THREE.MeshStandardMaterial({ color: '#ddd4bc', roughness: 0.95 }),
    dirt: new THREE.MeshStandardMaterial({ color: '#6a5a44', roughness: 1 }),
    rubbleBrick: new THREE.MeshStandardMaterial({ color: '#7a4a38', roughness: 0.95 }),
    wire: new THREE.MeshStandardMaterial({ color: '#2a2c2e', metalness: 0.7, roughness: 0.6 }),
    trolleyGreen: new THREE.MeshStandardMaterial({ color: '#2e4a3c', roughness: 0.6 }),
    paperWhite: new THREE.MeshStandardMaterial({ color: '#e2ddce', roughness: 0.9 }),
  };
}

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  name?: string,
  rotation?: readonly [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }
  if (name) {
    mesh.name = name;
  }
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  position: readonly [number, number, number],
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  );
  mesh.position.set(position[0], position[1], position[2]);
  if (name) {
    mesh.name = name;
  }
  parent.add(mesh);
  return mesh;
}

function addSphere(
  parent: THREE.Object3D,
  material: THREE.Material,
  radius: number,
  position: readonly [number, number, number],
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
  mesh.position.set(position[0], position[1], position[2]);
  if (name) {
    mesh.name = name;
  }
  parent.add(mesh);
  return mesh;
}

function addPlane(
  parent: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  position: readonly [number, number, number],
  name?: string,
  rotationY = 0,
  rotationX = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.y = rotationY;
  mesh.rotation.x = rotationX;
  if (name) {
    mesh.name = name;
  }
  parent.add(mesh);
  return mesh;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/* ------------------------------------------------------------------ */
/* Street bed with embedded streetcar track                            */
/* ------------------------------------------------------------------ */

function buildStreetBed(parent: THREE.Object3D, mats: EraMaterials): void {
  const bed = new THREE.Group();
  bed.name = 'street-bed';

  addPlane(bed, mats.asphalt, 132, 12, [0, 0.01, -10], 'street-asphalt', 0, -Math.PI / 2);
  for (let x = -62; x <= 62; x += 8) {
    addBox(bed, mats.paint, [3.2, 0.012, 0.28], [x, 0.02, -10]);
  }
  addBox(bed, mats.sidewalk, [132, 0.18, 3.6], [0, 0.09, NORTH_WALK_Z], 'sidewalk-north');
  addBox(bed, mats.sidewalk, [132, 0.18, 3.6], [0, 0.09, SOUTH_WALK_Z], 'sidewalk-south');
  addBox(bed, mats.curb, [132, 0.24, 0.28], [0, 0.12, -3.95], 'curb-north');
  addBox(bed, mats.curb, [132, 0.24, 0.28], [0, 0.12, -16.05], 'curb-south');

  // Double-rail streetcar track bedded in the asphalt: steel rails on
  // wooden ties, running the full length of the block.
  for (const side of [-1, 1]) {
    addBox(
      bed,
      mats.railSteel,
      [132, 0.08, 0.1],
      [0, 0.045, TRACK_CENTER_Z + (side * TRACK_GAUGE) / 2],
      'streetcar-track',
    );
  }
  for (let x = -64; x <= 64; x += 3.2) {
    addBox(bed, mats.tieWood, [0.24, 0.05, 1.4], [x, 0.025, TRACK_CENTER_Z], 'streetcar-tie');
  }

  // Overhead contact wire with curb-line support poles at both ends.
  addBox(bed, mats.wire, [132, 0.035, 0.035], [0, OVERHEAD_WIRE_Y, TRACK_CENTER_Z], 'overhead-wire');
  for (const x of [-40, 40]) {
    const pole = new THREE.Group();
    pole.name = 'overhead-wire-pole';
    pole.position.set(x, 0, -4.6);
    addCylinder(pole, mats.ironDark, 0.07, 0.1, 6.2, 8, [0, 3.1, 0]);
    addBox(pole, mats.ironDark, [1.6, 0.1, 0.1], [0, 5.9, TRACK_CENTER_Z + 4.6]);
    addBox(pole, mats.ironDark, [0.06, 0.06, 2.3], [0, 5.45, TRACK_CENTER_Z + 4.6]);
    bed.add(pole);
  }

  parent.add(bed);
}

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

interface BrickBuildingOptions {
  readonly x: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly frontZ: number;
  readonly faceDir: -1 | 1;
  readonly name: string;
  readonly chimney?: boolean;
  readonly cornice?: boolean;
  readonly sashWindows?: boolean;
  readonly freightDoors?: boolean;
  readonly waterTower?: boolean;
}

/**
 * Low-rise masonry block (tenement / warehouse / commercial row) with
 * wartime proportions: two-to-four stories, tall ground floor, small
 * double-hung windows and a flat roof behind a parapet.
 */
function addBrickBuilding(parent: THREE.Object3D, mats: EraMaterials, o: BrickBuildingOptions): void {
  const building = new THREE.Group();
  building.name = o.name;
  building.position.set(o.x, 0, o.frontZ - o.faceDir * (o.depth / 2));
  const frontZ = o.faceDir * (o.depth / 2);

  addBox(building, mats.brick, [o.width, o.height, o.depth], [0, o.height / 2, 0]);
  // Parapet cap.
  addBox(building, mats.brickTrim, [o.width + 0.35, 0.4, o.depth + 0.35], [0, o.height + 0.2, 0]);
  if (o.cornice) {
    addBox(building, mats.brickTrim, [o.width + 0.55, 0.5, o.depth + 0.55], [0, o.height - 0.55, frontZ]);
  }

  if (o.sashWindows) {
    const columns = 4;
    const rows = Math.max(1, Math.floor((o.height - 3.2) / 3.2));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const wx = (col - (columns - 1) / 2) * (o.width / (columns + 1));
        const wy = 4.4 + row * 3.2;
        if (wy > o.height - 1.2) {
          continue;
        }
        const lit = (row * 7 + col * 3) % 5 === 0;
        addBox(
          building,
          lit ? mats.windowLit : mats.glassDark,
          [0.9, 1.35, 0.08],
          [wx, wy, frontZ + o.faceDir * 0.05],
        );
        addBox(
          building,
          mats.brickTrim,
          [1.08, 0.14, 0.12],
          [wx, wy + 0.76, frontZ + o.faceDir * 0.06],
        );
      }
    }
    // Recessed entry with stone steps.
    addBox(building, mats.darkTrim, [1.15, 2.5, 0.1], [o.width / 2 - 1.4, 1.25, frontZ + o.faceDir * 0.06]);
    addBox(building, mats.curb, [1.6, 0.36, 0.9], [o.width / 2 - 1.4, 0.18, frontZ + o.faceDir * 0.5]);
  }

  if (o.freightDoors) {
    for (const dx of [-o.width / 4, o.width / 4]) {
      addBox(building, mats.benchWood, [2.6, 3.2, 0.14], [dx, 1.6, frontZ + o.faceDir * 0.08]);
      addBox(building, mats.ironDark, [2.7, 0.16, 0.18], [dx, 3.3, frontZ + o.faceDir * 0.1]);
    }
    // Small high clerestory windows.
    for (const dx of [-o.width / 4, o.width / 4, 0]) {
      addBox(building, mats.glassDark, [0.8, 0.7, 0.08], [dx, o.height - 1.4, frontZ + o.faceDir * 0.05]);
    }
  }

  if (o.chimney) {
    addBox(building, mats.brick, [0.9, 2.1, 0.9], [-o.width / 4, o.height + 1.05, 0], 'chimney');
    addBox(building, mats.brickTrim, [1.1, 0.25, 1.1], [-o.width / 4, o.height + 2.2, 0]);
  }

  if (o.waterTower) {
    addWaterTower(building, mats, o.width / 4, o.height + 0.4, 0);
  }

  parent.add(building);
}

/** Rooftop wooden water tank on steel legs — the classic 1945 silhouette. */
function addWaterTower(parent: THREE.Object3D, mats: EraMaterials, x: number, baseY: number, z: number): void {
  const tower = new THREE.Group();
  tower.name = 'water-tower';
  tower.position.set(x, baseY, z);
  for (const [lx, lz] of [
    [-0.8, -0.8],
    [0.8, -0.8],
    [-0.8, 0.8],
    [0.8, 0.8],
  ] as const) {
    addCylinder(tower, mats.tieWood, 0.07, 0.09, 2.3, 6, [lx, 1.15, lz]);
  }
  addCylinder(tower, mats.benchWood, 1.15, 1.15, 2.4, 12, [0, 3.35, 0]);
  addCylinder(tower, mats.tieWood, 1.25, 1.25, 0.15, 12, [0, 2.25, 0]);
  addCylinder(tower, mats.tieWood, 1.25, 1.25, 0.15, 12, [0, 4.45, 0]);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 12), mats.darkTrim);
  roof.position.set(0, 5.0, 0);
  tower.add(roof);
  addCylinder(tower, mats.tieWood, 0.08, 0.08, 1.1, 6, [0, 5.7, 0]);
  parent.add(tower);
}

interface WoodFrameOptions {
  readonly x: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly frontZ: number;
  readonly faceDir: -1 | 1;
  readonly name: string;
}

/** Clapboard wood-frame house with a gabled roof and front porch. */
function addWoodFrameBuilding(parent: THREE.Object3D, mats: EraMaterials, o: WoodFrameOptions): void {
  const house = new THREE.Group();
  house.name = o.name;
  house.position.set(o.x, 0, o.frontZ - o.faceDir * (o.depth / 2));
  const frontZ = o.faceDir * (o.depth / 2);

  addBox(house, mats.woodSiding, [o.width, o.height, o.depth], [0, o.height / 2, 0]);
  // Gable roof: two slopes meeting at a ridge along X.
  const slopeLength = Math.sqrt((o.depth / 2 + 0.5) ** 2 + 1.9 ** 2);
  const slopeAngle = Math.atan2(1.9, o.depth / 2 + 0.5);
  addBox(
    house,
    mats.darkTrim,
    [o.width + 0.8, 0.12, slopeLength],
    [0, o.height + 0.95, -(o.depth / 4 + 0.12)],
    undefined,
    [slopeAngle, 0, 0],
  );
  addBox(
    house,
    mats.darkTrim,
    [o.width + 0.8, 0.12, slopeLength],
    [0, o.height + 0.95, o.depth / 4 + 0.12],
    undefined,
    [-slopeAngle, 0, 0],
  );
  addBox(house, mats.brickTrim, [0.5, 0.3, o.depth + 0.6], [0, o.height + 0.05, 0]);
  addBox(house, mats.brick, [0.6, 1.6, 0.6], [o.width / 3, o.height + 1.1, 0], 'chimney');

  // Windows and door on the street face.
  for (const wx of [-o.width / 3, o.width / 3]) {
    addBox(house, mats.windowLit, [0.95, 1.2, 0.08], [wx, o.height * 0.55, frontZ + o.faceDir * 0.05]);
    addBox(house, mats.benchWood, [1.15, 0.12, 0.14], [wx, o.height * 0.55 - 0.7, frontZ + o.faceDir * 0.06]);
  }
  addBox(house, mats.darkTrim, [1.0, 2.2, 0.1], [0, 1.1, frontZ + o.faceDir * 0.06]);

  // Front porch: deck, posts, hip roof.
  addBox(house, mats.benchWood, [o.width * 0.7, 0.25, 1.6], [0, 0.32, frontZ + o.faceDir * 0.9]);
  for (const px of [-o.width * 0.3, o.width * 0.3]) {
    addCylinder(house, mats.benchWood, 0.08, 0.1, 2.3, 6, [px, 1.6, frontZ + o.faceDir * 1.6]);
  }
  addBox(house, mats.darkTrim, [o.width * 0.8, 0.12, 1.9], [0, 2.85, frontZ + o.faceDir * 1.0]);

  parent.add(house);
}

/* ------------------------------------------------------------------ */
/* Vacant lot: rubble, hoarding fence, victory garden                   */
/* ------------------------------------------------------------------ */

function addVacantLot(parent: THREE.Object3D, mats: EraMaterials): void {
  const lot = new THREE.Group();
  lot.name = 'vacant-lot-rubble';
  lot.position.set(-4, 0, -26);

  // Bare dirt where a demolished row once stood.
  addPlane(lot, mats.dirt, 18, 11, [0, 0.015, 0], undefined, 0, -Math.PI / 2);

  // Wooden hoarding along the sidewalk edge, planks slightly askew.
  const fence = new THREE.Group();
  fence.name = 'hoarding-fence';
  fence.position.set(0, 0, 5.4);
  const rng = mulberry32(19451231);
  for (let x = -8.4; x <= 8.4; x += 1.2) {
    addBox(
      fence,
      mats.benchWood,
      [1.15, 1.85, 0.07],
      [x, 0.93, 0],
      undefined,
      [0, 0, (rng() - 0.5) * 0.08],
    );
  }
  for (const px of [-8.4, -4.2, 0, 4.2, 8.4]) {
    addBox(fence, mats.tieWood, [0.14, 2.1, 0.14], [px, 1.05, -0.1]);
  }
  lot.add(fence);

  // Demolition rubble: two piles of broken brick and timber.
  for (const [cx, cz, count] of [
    [-5.5, 0.5, 9],
    [4.5, -1.5, 8],
  ] as const) {
    const pile = new THREE.Group();
    pile.name = 'rubble-pile';
    pile.position.set(cx, 0, cz);
    for (let i = 0; i < count; i++) {
      const s = 0.25 + rng() * 0.4;
      addBox(
        pile,
        i % 3 === 0 ? mats.tieWood : mats.rubbleBrick,
        [s, s * 0.6, s * 0.8],
        [(rng() - 0.5) * 3.2, 0.12 + rng() * 0.5, (rng() - 0.5) * 2.2],
        undefined,
        [(rng() - 0.5) * 0.8, rng() * Math.PI, (rng() - 0.5) * 0.8],
      );
    }
    lot.add(pile);
  }

  // Victory garden: raised beds of wartime vegetables.
  const garden = new THREE.Group();
  garden.name = 'victory-garden';
  garden.position.set(-1, 0, -3);
  for (const rowZ of [-1.2, 0, 1.2]) {
    addBox(garden, mats.benchWood, [4.4, 0.3, 0.9], [0, 0.15, rowZ]);
    for (let i = 0; i < 5; i++) {
      addSphere(garden, mats.foliage, 0.16, [-1.8 + i * 0.9, 0.38, rowZ]);
    }
  }
  lot.add(garden);

  // A few weeds along the fence line.
  for (const wx of [-7, -2.5, 2.5, 7]) {
    addCylinder(lot, mats.foliage, 0.02, 0.05, 0.5, 5, [wx, 0.25, 4.6], 'weeds');
  }

  parent.add(lot);
}

/* ------------------------------------------------------------------ */
/* Storefronts: hand-painted signs, canvas awnings, window goods        */
/* ------------------------------------------------------------------ */

type StorefrontDisplay =
  | 'canned-goods'
  | 'tools'
  | 'toiletries'
  | 'bread'
  | 'shoes'
  | 'barber'
  | 'deli';

interface StorefrontOptions {
  readonly x: number;
  readonly width: number;
  readonly frontZ: number;
  readonly faceDir: -1 | 1;
  readonly name: string;
  readonly sign: string;
  readonly ink: string;
  readonly awning: string;
  readonly awningStripe?: string;
  readonly display: StorefrontDisplay;
}

const DISPLAY_GOOD_COLORS: readonly string[] = ['#8a6a4a', '#5a6470', '#7a4a3a', '#4e5a44'];

function addStorefront(parent: THREE.Object3D, mats: EraMaterials, o: StorefrontOptions): void {
  const shop = new THREE.Group();
  shop.name = o.name;
  shop.position.set(o.x, 0, 0);
  const out = (depth: number): number => o.frontZ + o.faceDir * depth;
  const caseWidth = o.width - 0.6;

  // Display window: bulkhead, jambs, header, single sheet of glass.
  addBox(shop, mats.brickTrim, [caseWidth, 0.5, 1.1], [0, 0.25, out(0.55)]);
  addBox(shop, mats.darkTrim, [caseWidth, 0.35, 1.1], [0, 2.93, out(0.55)]);
  addBox(shop, mats.darkTrim, [0.12, 2.6, 1.1], [-caseWidth / 2, 1.55, out(0.55)]);
  addBox(shop, mats.darkTrim, [0.12, 2.6, 1.1], [caseWidth / 2, 1.55, out(0.55)]);
  addPlane(
    shop,
    mats.shopGlass,
    caseWidth - 0.2,
    2.05,
    [0, 1.55, out(1.12)],
    undefined,
    o.faceDir === -1 ? Math.PI : 0,
  );
  // Wooden door beside the display case.
  const doorX = (o.faceDir === -1 ? -1 : 1) * (o.width / 2 - 0.75);
  addBox(shop, mats.benchWood, [0.95, 2.55, 0.14], [doorX, 1.28, out(0.1)]);

  // Striped canvas awning on support rods.
  const stripe = stripeTexture(o.awning, o.awningStripe ?? '#e8e2ce');
  if (stripe) {
    stripe.repeat.set(Math.max(2, Math.round(o.width / 1.1)), 1);
  }
  const awningMaterial = stripe
    ? new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.95 })
    : new THREE.MeshStandardMaterial({ color: o.awning, roughness: 0.9 });
  addBox(
    shop,
    awningMaterial,
    [o.width - 0.4, 0.1, 1.7],
    [0, 3.45, out(0.8)],
    undefined,
    [o.faceDir * 0.32, 0, 0],
  );
  for (const rx of [-o.width / 3, o.width / 3]) {
    addCylinder(shop, mats.ironDark, 0.025, 0.025, 1.5, 6, [rx, 2.85, out(1.15)]);
  }

  // Hand-painted sign board above the awning.
  addBox(shop, mats.benchWood, [o.width - 0.3, 1.0, 0.3], [0, 4.35, out(0.16)]);
  const signTextureResult = signTexture(o.sign, {
    background: '#e8e2ce',
    ink: o.ink,
  });
  const signMaterial = signTextureResult
    ? new THREE.MeshStandardMaterial({ map: signTextureResult, roughness: 0.85 })
    : new THREE.MeshStandardMaterial({ color: '#e8e2ce', roughness: 0.85 });
  addPlane(
    shop,
    signMaterial,
    o.width - 0.7,
    0.85,
    [0, 4.35, out(0.32)],
    `painted-sign-${slug(o.sign)}`,
    o.faceDir === -1 ? Math.PI : 0,
  );

  // Period-correct goods visible through the display glass.
  const shelf = addBox(shop, mats.benchWood, [caseWidth - 0.6, 0.08, 0.5], [0, 1.0, out(0.5)]);
  shelf.name = 'display-shelf';
  switch (o.display) {
    case 'canned-goods': {
      for (let i = 0; i < 6; i++) {
        const tin = new THREE.MeshStandardMaterial({
          color: DISPLAY_GOOD_COLORS[i % DISPLAY_GOOD_COLORS.length],
          metalness: 0.5,
          roughness: 0.5,
        });
        addCylinder(
          shop,
          tin,
          0.1,
          0.1,
          0.24,
          8,
          [-(caseWidth / 3) + (i % 3) * (caseWidth / 3), 1.16 + Math.floor(i / 3) * 0.5, out(0.5)],
        );
      }
      break;
    }
    case 'tools': {
      for (let i = 0; i < 3; i++) {
        const tool = new THREE.MeshStandardMaterial({
          color: DISPLAY_GOOD_COLORS[i % DISPLAY_GOOD_COLORS.length],
          roughness: 0.6,
        });
        addBox(shop, tool, [0.5, 0.34, 0.3], [(i - 1) * (caseWidth / 3.2), 1.2, out(0.5)]);
      }
      break;
    }
    case 'toiletries': {
      for (let i = 0; i < 5; i++) {
        const bottle = new THREE.MeshStandardMaterial({ color: '#d8d2be', roughness: 0.4 });
        addCylinder(
          shop,
          bottle,
          0.07,
          0.09,
          0.3,
          8,
          [-(caseWidth / 3) + i * (caseWidth / 3.6), 1.19, out(0.5)],
        );
      }
      break;
    }
    case 'bread': {
      for (let i = 0; i < 3; i++) {
        const loaf = addSphere(shop, new THREE.MeshStandardMaterial({ color: '#a87848', roughness: 0.9 }), 0.18, [
          (i - 1) * 0.8,
          1.2,
          out(0.5),
        ]);
        loaf.scale.set(1.5, 0.75, 0.9);
      }
      break;
    }
    case 'shoes': {
      for (let i = 0; i < 4; i++) {
        const shoe = new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 0.7 });
        const mesh = addSphere(
          shop,
          shoe,
          0.11,
          [-(caseWidth / 3.2) + (i % 2) * 1.1, 1.14 + Math.floor(i / 2) * 0.42, out(0.5)],
        );
        mesh.scale.set(1.7, 0.7, 0.8);
      }
      break;
    }
    case 'barber': {
      // Classic red/white barber pole mounted on the facade.
      const poleStripe = stripeTexture('#c8452e', '#f2ede0');
      const poleMaterial = poleStripe
        ? new THREE.MeshStandardMaterial({ map: poleStripe, roughness: 0.6 })
        : new THREE.MeshStandardMaterial({ color: '#c8452e', roughness: 0.6 });
      const pole = addCylinder(shop, poleMaterial, 0.1, 0.1, 0.9, 10, [doorX * 0.4, 2.2, out(0.2)], 'barber-pole');
      pole.rotation.z = 0;
      addSphere(shop, mats.glassDark, 0.11, [doorX * 0.4, 2.7, out(0.2)]);
      break;
    }
    case 'deli': {
      for (let i = 0; i < 4; i++) {
        const link = new THREE.MeshStandardMaterial({ color: '#6a3a28', roughness: 0.85 });
        addCylinder(shop, link, 0.07, 0.07, 0.5, 8, [-(caseWidth / 3) + i * 0.7, 2.55, out(0.35)]);
      }
      break;
    }
  }

  parent.add(shop);
}

/* ------------------------------------------------------------------ */
/* Advertisements: wall ads, billboards, newspaper stand                */
/* ------------------------------------------------------------------ */

interface BillboardCopyView {
  readonly text: string;
  readonly inkColor: string;
  readonly glowColor: string;
}

function addWallAd(
  parent: THREE.Object3D,
  mats: EraMaterials,
  name: string,
  x: number,
  y: number,
  z: number,
  faceDir: -1 | 1,
  width: number,
  height: number,
  copy: BillboardCopyView,
  background: string,
): void {
  const texture = signTexture(copy.text, { background, ink: copy.inkColor });
  const material = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 })
    : new THREE.MeshStandardMaterial({ color: background, roughness: 0.95 });
  addPlane(
    parent,
    material,
    width,
    height,
    [x, y, z + faceDir * 0.06],
    name,
    faceDir === -1 ? Math.PI : 0,
  );
  void mats;
}

/** Painted billboard on wooden posts, standing above the roofline. */
function addRooftopBillboard(
  parent: THREE.Object3D,
  mats: EraMaterials,
  copy: BillboardCopyView,
  x: number,
  roofY: number,
  z: number,
  name: string,
): void {
  const board = new THREE.Group();
  board.name = name;
  board.position.set(x, roofY, z);

  addBox(board, mats.tieWood, [0.35, 4.4, 0.35], [-4.2, 2.2, 0]);
  addBox(board, mats.tieWood, [0.35, 4.4, 0.35], [4.2, 2.2, 0]);
  addBox(board, mats.benchWood, [10.4, 0.3, 1.2], [0, 0.6, 0]);
  addBox(board, mats.signBoard, [10.4, 3.4, 0.35], [0, 2.6, 0.1]);
  const texture = signTexture(copy.text, {
    background: '#3e5a78',
    ink: copy.inkColor,
    glow: copy.glowColor,
    subtext: 'ASK FOR IT BY NAME',
  });
  const material = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 })
    : new THREE.MeshStandardMaterial({ color: '#3e5a78', roughness: 0.85 });
  addPlane(board, material, 9.9, 3.0, [0, 2.6, -0.09], undefined, Math.PI);

  parent.add(board);
}

/** Ground-mounted painted billboard behind the south sidewalk. */
function addGroundBillboard(
  parent: THREE.Object3D,
  mats: EraMaterials,
  copy: BillboardCopyView,
  x: number,
  z: number,
  name: string,
): void {
  const board = new THREE.Group();
  board.name = name;
  board.position.set(x, 0, z);

  addBox(board, mats.tieWood, [0.35, 5.2, 0.35], [-4.6, 2.6, 0]);
  addBox(board, mats.tieWood, [0.35, 5.2, 0.35], [4.6, 2.6, 0]);
  addBox(board, mats.signBoard, [10.6, 3.8, 0.35], [0, 6.2, 0.1]);
  const texture = signTexture(copy.text, {
    background: '#b8452e',
    ink: copy.inkColor,
    glow: copy.glowColor,
    subtext: 'ICE COLD',
  });
  const material = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 })
    : new THREE.MeshStandardMaterial({ color: '#b8452e', roughness: 0.85 });
  // Faces north, toward the street.
  addPlane(board, material, 10.1, 3.4, [0, 6.2, -0.09], undefined, Math.PI);

  parent.add(board);
}

/** Sidewalk kiosk stacked with the day's papers. */
function addNewspaperStand(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const stand = new THREE.Group();
  stand.name = 'newspaper-stand';
  stand.position.set(x, 0, z);

  addBox(stand, mats.benchWood, [2.4, 1.0, 1.3], [0, 0.5, 0]);
  addBox(stand, mats.benchWood, [2.6, 0.08, 1.4], [0, 1.05, 0]);
  for (const px of [-1.15, 1.15]) {
    addCylinder(stand, mats.benchWood, 0.05, 0.05, 1.9, 6, [px, 2.0, 0.55]);
  }
  addBox(stand, mats.canvasCream, [2.7, 0.08, 1.6], [0, 2.95, 0], undefined, [0.18, 0, 0]);
  addBox(stand, mats.signBoard, [2.4, 1.5, 0.12], [0, 2.0, -0.55]);
  const signTextureResult = signTexture('NEWSPAPERS', { background: '#f2ede0', ink: '#2e3336' });
  const signMaterial = signTextureResult
    ? new THREE.MeshStandardMaterial({ map: signTextureResult, roughness: 0.85 })
    : new THREE.MeshStandardMaterial({ color: '#f2ede0', roughness: 0.85 });
  addPlane(stand, signMaterial, 2.2, 1.2, [0, 2.0, -0.48], 'painted-sign-newspapers', 0);

  // Neat stacks of folded papers on the counter.
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      addBox(
        stand,
        mats.paperWhite,
        [0.42, 0.14, 0.55],
        [-0.9 + i * 0.6, 1.16 + row * 0.16, 0.25],
        'newspaper-stack',
      );
    }
  }

  parent.add(stand);
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                             */
/* ------------------------------------------------------------------ */

type Era1945VehicleKind = 'sedan' | 'military-truck' | 'streetcar';

interface VehiclePlacement {
  readonly kind: Era1945VehicleKind;
  readonly x: number;
  readonly z: number;
  /** Heading in radians; 0 faces +X. */
  readonly heading: number;
  readonly paint: string;
  readonly name: string;
}

const VEHICLES: readonly VehiclePlacement[] = [
  { kind: 'streetcar', x: 10, z: TRACK_CENTER_Z, heading: 0, paint: '#e8e2ce', name: 'vehicle-streetcar' },
  { kind: 'sedan', x: -34, z: -5.0, heading: 0, paint: '#22282e', name: 'vehicle-sedan' },
  { kind: 'sedan', x: -12, z: -5.0, heading: 0, paint: '#5b4632', name: 'vehicle-sedan' },
  { kind: 'military-truck', x: 28, z: -5.0, heading: 0, paint: '#4a5238', name: 'vehicle-military-truck' },
  { kind: 'sedan', x: -22, z: -9.3, heading: Math.PI, paint: '#6e2f28', name: 'vehicle-sedan' },
  { kind: 'military-truck', x: 2, z: -11.2, heading: Math.PI, paint: '#4a5238', name: 'vehicle-military-truck' },
  { kind: 'sedan', x: 20, z: -13, heading: Math.PI, paint: '#2e3a30', name: 'vehicle-sedan' },
  { kind: 'sedan', x: 36, z: -15.2, heading: 0, paint: '#3e4245', name: 'vehicle-sedan' },
];

function addWheelSet(
  parent: THREE.Object3D,
  mats: EraMaterials,
  axleXs: readonly number[],
  halfTrack: number,
  radius: number,
): void {
  for (const axleX of axleXs) {
    for (const side of [-1, 1]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.24, 12), mats.tire);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(axleX, radius, side * halfTrack);
      parent.add(tire);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, 0.26, 12),
        mats.brightWork,
      );
      hub.rotation.x = Math.PI / 2;
      hub.position.set(axleX, radius, side * halfTrack);
      parent.add(hub);
    }
  }
}

function addVehicle(parent: THREE.Object3D, mats: EraMaterials, placement: VehiclePlacement): void {
  const vehicle = new THREE.Group();
  vehicle.name = placement.name;
  vehicle.position.set(placement.x, 0, placement.z);
  vehicle.rotation.y = placement.heading;
  const paint = new THREE.MeshStandardMaterial({
    color: placement.paint,
    metalness: 0.25,
    roughness: 0.45,
  });

  if (placement.kind === 'streetcar') {
    // Wooden single-truck streetcar under the overhead wire.
    addBox(vehicle, paint, [9.6, 2.1, 2.3], [0, 1.6, 0]);
    addBox(vehicle, mats.trolleyGreen, [9.7, 0.55, 2.36], [0, 0.78, 0]);
    addBox(vehicle, mats.shopGlass, [8.4, 0.72, 0.07], [0, 2.2, 1.16]);
    addBox(vehicle, mats.shopGlass, [8.4, 0.72, 0.07], [0, 2.2, -1.16]);
    addPlane(vehicle, mats.shopGlass, 1.9, 0.85, [4.81, 2.05, 0], undefined, Math.PI / 2);
    addBox(vehicle, mats.benchWood, [9.2, 0.18, 2.1], [0, 2.72, 0]);
    addBox(vehicle, mats.trolleyGreen, [7.6, 0.35, 1.7], [0, 2.95, 0]);
    addBox(vehicle, mats.benchWood, [7.8, 0.12, 1.8], [0, 3.2, 0]);
    // Destination roll sign.
    const destTexture = signTexture('BROADWAY', { background: '#2a2620', ink: '#ffd9a0' });
    const destMaterial = destTexture
      ? new THREE.MeshBasicMaterial({ map: destTexture, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: '#2a2620', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.6 });
    addPlane(vehicle, destMaterial, 1.5, 0.4, [4.83, 2.62, 0], undefined, Math.PI / 2);
    // Trolley pole reaching to the contact wire.
    const pole = addCylinder(vehicle, mats.ironDark, 0.04, 0.05, 2.7, 6, [-3.4, 4.15, 0]);
    pole.rotation.z = 0.5;
    addSphere(vehicle, mats.ironDark, 0.09, [-2.72, 5.35, 0]);
    // Headlights and tail lights.
    for (const side of [-1, 1]) {
      addSphere(vehicle, mats.lampLens, 0.11, [4.85, 1.05, side * 0.7]);
      addBox(vehicle, mats.tailLight, [0.05, 0.14, 0.24], [-4.82, 1.15, side * 0.75]);
    }
    // Wheels riding the rails.
    for (const axleX of [3.1, -3.1]) {
      for (const side of [-1, 1]) {
        addCylinder(
          vehicle,
          mats.tire,
          0.36,
          0.36,
          0.1,
          12,
          [axleX, 0.36, side * (TRACK_GAUGE / 2)],
        );
      }
    }
  } else if (placement.kind === 'sedan') {
    // 1940s boxy sedan: separate fenders, running boards, upright grille.
    addBox(vehicle, paint, [4.3, 0.8, 1.8], [0, 0.78, 0]);
    addBox(vehicle, paint, [1.35, 0.42, 1.72], [1.5, 1.28, 0]);
    addBox(vehicle, paint, [2.0, 0.66, 1.7], [-0.35, 1.5, 0]);
    addBox(vehicle, mats.shopGlass, [0.08, 0.5, 1.5], [0.72, 1.52, 0]);
    addBox(vehicle, mats.shopGlass, [0.08, 0.42, 1.5], [-1.42, 1.5, 0]);
    addBox(vehicle, mats.shopGlass, [1.2, 0.4, 0.06], [-0.35, 1.5, 0.86]);
    addBox(vehicle, mats.shopGlass, [1.2, 0.4, 0.06], [-0.35, 1.5, -0.86]);
    // Fender tops over each wheel.
    for (const fx of [1.45, -1.45]) {
      for (const side of [-1, 1]) {
        addBox(vehicle, paint, [1.15, 0.26, 0.18], [fx, 0.98, side * 0.97]);
      }
    }
    // Running boards.
    for (const side of [-1, 1]) {
      addBox(vehicle, paint, [1.7, 0.07, 0.34], [0, 0.45, side * 1.02]);
    }
    // Grille, bumpers, lamps.
    addBox(vehicle, mats.brightWork, [0.1, 0.55, 1.1], [2.16, 0.88, 0]);
    addBox(vehicle, mats.brightWork, [0.14, 0.18, 1.9], [2.2, 0.42, 0]);
    addBox(vehicle, mats.brightWork, [0.14, 0.18, 1.9], [-2.2, 0.42, 0]);
    for (const side of [-1, 1]) {
      addSphere(vehicle, mats.lampLens, 0.1, [2.2, 1.12, side * 0.72]);
      addBox(vehicle, mats.tailLight, [0.05, 0.14, 0.24], [-2.17, 0.95, side * 0.7]);
    }
    addWheelSet(vehicle, mats, [1.45, -1.45], 0.95, 0.34);
  } else {
    // Military surplus 2.5-ton truck: canvas-topped cargo bed, olive drab.
    addBox(vehicle, paint, [4.9, 0.35, 1.9], [-0.1, 0.55, 0]);
    addBox(vehicle, paint, [1.1, 0.65, 1.7], [2.15, 1.05, 0]);
    addBox(vehicle, paint, [1.5, 1.15, 2.0], [1.05, 1.6, 0]);
    addBox(vehicle, mats.shopGlass, [0.07, 0.5, 1.8], [1.82, 1.7, 0]);
    // Cargo bed with slat sides and canvas cover.
    addBox(vehicle, paint, [3.2, 0.5, 2.1], [-1.35, 1.05, 0]);
    for (const side of [-1, 1]) {
      addBox(vehicle, paint, [3.2, 0.55, 0.09], [-1.35, 1.55, side * 1.02]);
    }
    addBox(vehicle, paint, [0.09, 0.55, 2.1], [-2.95, 1.55, 0]);
    addBox(vehicle, mats.canvasCream, [3.24, 0.55, 2.14], [-1.35, 1.98, 0]);
    // Brush guard, bumper, single headlight pods.
    addBox(vehicle, mats.ironDark, [0.12, 0.4, 1.9], [2.75, 0.6, 0]);
    for (const side of [-1, 1]) {
      addSphere(vehicle, mats.lampLens, 0.09, [2.72, 1.05, side * 0.62]);
    }
    addWheelSet(vehicle, mats, [2.1], 0.92, 0.42);
    addWheelSet(vehicle, mats, [-1.1, -1.9], 0.92, 0.45);
  }

  parent.add(vehicle);
}

/* ------------------------------------------------------------------ */
/* Pedestrians                                                          */
/* ------------------------------------------------------------------ */

type FigureKind = 'man' | 'woman' | 'child';

interface FigureSpec {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly kind: FigureKind;
  readonly outfit: string;
  readonly bottoms: string;
  readonly skin: string;
  readonly hair: string;
  readonly hat: string;
}

function addPedestrian(parent: THREE.Object3D, mats: EraMaterials, spec: FigureSpec): void {
  const figure = new THREE.Group();
  figure.name = spec.kind === 'woman' ? 'pedestrian-woman' : spec.kind === 'child' ? 'pedestrian-child' : 'pedestrian-man';
  figure.position.set(spec.x, 0, spec.z);
  figure.rotation.y = spec.heading;

  const outfit = new THREE.MeshStandardMaterial({ color: spec.outfit, roughness: 0.85 });
  const bottoms = new THREE.MeshStandardMaterial({ color: spec.bottoms, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: spec.skin, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: spec.hair, roughness: 0.95 });
  const hat = new THREE.MeshStandardMaterial({ color: spec.hat, roughness: 0.9 });
  void mats;

  if (spec.kind === 'man') {
    // Suit trousers, jacket, and a fedora.
    addBox(figure, bottoms, [0.34, 0.82, 0.22], [0, 0.41, 0]);
    addCylinder(figure, outfit, 0.22, 0.19, 0.78, 8, [0, 1.2, 0]);
    for (const side of [-1, 1]) {
      addCylinder(figure, outfit, 0.05, 0.045, 0.6, 6, [side * 0.26, 1.18, 0]);
      addSphere(figure, skin, 0.05, [side * 0.26, 0.85, 0]);
    }
    addSphere(figure, skin, 0.135, [0, 1.72, 0]);
    addCylinder(figure, hair, 0.14, 0.14, 0.08, 8, [0, 1.79, 0]);
    addCylinder(figure, hat, 0.215, 0.215, 0.03, 12, [0, 1.845, 0]);
    addCylinder(figure, hat, 0.125, 0.14, 0.16, 10, [0, 1.93, 0]);
  } else if (spec.kind === 'woman') {
    // Knee-length dress with gloved forearms and a pinned bun.
    addCylinder(figure, outfit, 0.15, 0.33, 1.12, 10, [0, 0.86, 0]);
    for (const side of [-1, 1]) {
      addCylinder(figure, outfit, 0.045, 0.04, 0.3, 6, [side * 0.22, 1.32, 0]);
      addCylinder(figure, hat, 0.042, 0.038, 0.32, 6, [side * 0.24, 1.0, 0]);
      addSphere(figure, hat, 0.045, [side * 0.24, 0.82, 0]);
    }
    addSphere(figure, skin, 0.13, [0, 1.55, 0]);
    const bun = addSphere(figure, hair, 0.15, [0, 1.65, 0]);
    bun.scale.set(1, 0.8, 1);
    addSphere(figure, hair, 0.075, [0, 1.6, -0.12]);
  } else {
    // Child in shorts and a cap, roughly 60% adult height.
    addBox(figure, bottoms, [0.26, 0.42, 0.16], [0, 0.31, 0]);
    for (const side of [-1, 1]) {
      addCylinder(figure, bottoms, 0.045, 0.04, 0.2, 6, [side * 0.08, 0.1, 0]);
    }
    addCylinder(figure, outfit, 0.13, 0.15, 0.5, 8, [0, 0.76, 0]);
    for (const side of [-1, 1]) {
      addCylinder(figure, outfit, 0.04, 0.035, 0.42, 6, [side * 0.19, 0.78, 0]);
    }
    addSphere(figure, skin, 0.115, [0, 1.12, 0]);
    addCylinder(figure, hair, 0.12, 0.12, 0.06, 8, [0, 1.18, 0]);
    addCylinder(figure, hat, 0.16, 0.16, 0.02, 10, [0, 1.2, 0]);
    addCylinder(figure, hat, 0.1, 0.11, 0.09, 8, [0, 1.25, 0]);
  }

  parent.add(figure);
}

/* ------------------------------------------------------------------ */
/* Street furniture                                                     */
/* ------------------------------------------------------------------ */

function addGasLamp(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const lamp = new THREE.Group();
  lamp.name = 'street-lamp-gas';
  lamp.position.set(x, 0, z);
  addCylinder(lamp, mats.ironDark, 0.06, 0.09, 3.4, 8, [0, 1.7, 0]);
  addCylinder(lamp, mats.ironDark, 0.16, 0.05, 0.25, 8, [0, 3.5, 0]);
  addBox(lamp, mats.lampLens, [0.3, 0.4, 0.3], [0, 3.85, 0]);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.26, 0.24, 4), mats.ironDark);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(0, 4.16, 0);
  lamp.add(cap);
  parent.add(lamp);
}

function addTrafficSignal(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const signal = new THREE.Group();
  signal.name = 'traffic-signal';
  signal.position.set(x, 0, z);
  signal.rotation.y = Math.PI;
  addCylinder(signal, mats.ironDark, 0.09, 0.11, 4.6, 8, [0, 2.3, 0]);
  addBox(signal, mats.signBoard, [0.44, 1.1, 0.3], [0, 3.95, 0]);
  const lensColors: readonly string[] = ['#ff5148', '#ffc94d', '#57d977'];
  for (let i = 0; i < 3; i++) {
    const lens = new THREE.MeshStandardMaterial({
      color: lensColors[i],
      emissive: new THREE.Color(lensColors[i]),
      emissiveIntensity: 0.9,
    });
    addPlane(signal, lens, 0.22, 0.22, [0, 4.3 - i * 0.35, 0.16]);
  }
  parent.add(signal);
}

function addHydrant(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const hydrant = new THREE.Group();
  hydrant.name = 'hydrant';
  hydrant.position.set(x, 0, z);
  const red = new THREE.MeshStandardMaterial({ color: '#a84236', roughness: 0.6 });
  addCylinder(hydrant, red, 0.16, 0.19, 0.6, 10, [0, 0.3, 0]);
  const dome = addSphere(hydrant, red, 0.16, [0, 0.62, 0]);
  dome.scale.set(1, 0.7, 1);
  addCylinder(hydrant, mats.ironDark, 0.06, 0.06, 0.1, 8, [0, 0.76, 0]);
  const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), red);
  nub.rotation.z = Math.PI / 2;
  nub.position.set(0.19, 0.42, 0);
  hydrant.add(nub);
  const nub2 = nub.clone();
  nub2.position.x = -0.19;
  hydrant.add(nub2);
  parent.add(hydrant);
}

function addMailbox(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const mailbox = new THREE.Group();
  mailbox.name = 'mailbox';
  mailbox.position.set(x, 0, z);
  // Wartime mailboxes were dark green, not the later blue.
  const green = new THREE.MeshStandardMaterial({ color: '#2e4a38', roughness: 0.55 });
  addBox(mailbox, green, [0.55, 0.85, 0.5], [0, 0.65, 0]);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.55, 12), green);
  top.rotation.z = Math.PI / 2;
  top.position.set(0, 1.075, 0);
  mailbox.add(top);
  addPlane(mailbox, mats.ironDark, 0.4, 0.5, [0, 0.7, 0.26]);
  parent.add(mailbox);
}

function addBench(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number, rotY: number): void {
  const bench = new THREE.Group();
  bench.name = 'bench';
  bench.position.set(x, 0, z);
  bench.rotation.y = rotY;
  addBox(bench, mats.benchWood, [1.9, 0.09, 0.5], [0, 0.55, 0]);
  addBox(bench, mats.benchWood, [1.9, 0.5, 0.08], [0, 0.95, -0.24]);
  addBox(bench, mats.ironDark, [0.09, 0.55, 0.46], [-0.8, 0.275, 0]);
  addBox(bench, mats.ironDark, [0.09, 0.55, 0.46], [0.8, 0.275, 0]);
  parent.add(bench);
}

function addTree(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const tree = new THREE.Group();
  tree.name = 'tree';
  tree.position.set(x, 0, z);
  addCylinder(tree, mats.trunk, 0.12, 0.17, 1.7, 8, [0, 0.85, 0]);
  addSphere(tree, mats.foliage, 1.05, [0, 2.5, 0]);
  addSphere(tree, mats.foliage, 0.75, [0.35, 3.15, 0.1]);
  parent.add(tree);
}

/* ------------------------------------------------------------------ */
/* Era builder                                                          */
/* ------------------------------------------------------------------ */

/**
 * Builds the complete 1945 scene bundle: a named THREE.Group with every
 * procedural mesh plus the era audio descriptor for the AudioBus. Safe to run
 * in node environments (canvas textures degrade to flat colors).
 */
export const buildEra1945: EraContentBuilder = () => {
  const group = new THREE.Group();
  group.name = 'era-1945';
  const mats = createEraMaterials();

  buildStreetBed(group, mats);

  // North row, west to east: warehouse, tenement, mixed-use retail row,
  // wood-frame shop, commercial block.
  addBrickBuilding(group, mats, {
    x: -36,
    width: 16,
    depth: 13,
    height: 13,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'building-brick-warehouse',
    waterTower: true,
    freightDoors: true,
  });
  addBrickBuilding(group, mats, {
    x: -16,
    width: 14,
    depth: 12,
    height: 12,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'building-brick-tenement',
    chimney: true,
    cornice: true,
    sashWindows: true,
  });
  addBrickBuilding(group, mats, {
    x: 1,
    width: 14,
    depth: 11,
    height: 9,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'building-mixed-use-row',
    cornice: true,
    sashWindows: true,
  });
  addWoodFrameBuilding(group, mats, {
    x: 16,
    width: 10,
    depth: 10,
    height: 5.5,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'building-wood-frame',
  });
  addBrickBuilding(group, mats, {
    x: 32,
    width: 14,
    depth: 12,
    height: 10,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'building-commercial-brick',
    cornice: true,
    sashWindows: true,
  });

  // South row: retail row, the rationing-era vacant lot, wood house,
  // and the south warehouse carrying the painted soda wall ad.
  addBrickBuilding(group, mats, {
    x: -24,
    width: 14,
    depth: 12,
    height: 10,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    name: 'building-south-row',
    cornice: true,
    sashWindows: true,
  });
  addVacantLot(group, mats);
  addWoodFrameBuilding(group, mats, {
    x: 16,
    width: 10,
    depth: 10,
    height: 5.5,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    name: 'building-south-wood',
  });
  addBrickBuilding(group, mats, {
    x: 34,
    width: 14,
    depth: 12,
    height: 11,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    name: 'building-south-warehouse',
    freightDoors: true,
  });

  // Storefronts: hand-painted signs under striped canvas awnings.
  addStorefront(group, mats, {
    x: -20,
    width: 6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-grocery',
    sign: 'WEINBERG GROCER',
    ink: '#3e4448',
    awning: '#4e5a44',
    display: 'canned-goods',
  });
  addStorefront(group, mats, {
    x: -13,
    width: 4.6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-barber-shop',
    sign: 'BARBER SHOP',
    ink: '#7a2e28',
    awning: '#7a3b2e',
    display: 'barber',
  });
  addStorefront(group, mats, {
    x: -4,
    width: 5.6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-drug-store',
    sign: 'REXALL DRUGS',
    ink: '#2e4a3c',
    awning: '#3e4a56',
    display: 'toiletries',
  });
  addStorefront(group, mats, {
    x: 2.5,
    width: 4.6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-bakery',
    sign: "MOM'S BAKERY",
    ink: '#6a4a2a',
    awning: '#8a7448',
    display: 'bread',
  });
  addStorefront(group, mats, {
    x: 8.5,
    width: 4.4,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-shoe-repair',
    sign: 'SHOE REPAIR',
    ink: '#3e3a34',
    awning: '#5a6470',
    display: 'shoes',
  });
  addStorefront(group, mats, {
    x: 16,
    width: 4.2,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-cleaners',
    sign: 'DYERS & CLEANERS',
    ink: '#2e3336',
    awning: '#4e5a44',
    display: 'tools',
  });
  addStorefront(group, mats, {
    x: 30,
    width: 6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-hardware',
    sign: 'ACME HARDWARE',
    ink: '#5a2e28',
    awning: '#7a3b2e',
    display: 'tools',
  });
  addStorefront(group, mats, {
    x: -27.5,
    width: 5.5,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    name: 'storefront-kosher-deli',
    sign: 'KOSHER DELI',
    ink: '#3e4448',
    awning: '#5a6470',
    display: 'deli',
  });
  addStorefront(group, mats, {
    x: -20.5,
    width: 4,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    name: 'storefront-tailor',
    sign: 'TAILOR',
    ink: '#2e3336',
    awning: '#8a7448',
    display: 'shoes',
  });

  // Advertisements: painted wall ads, rooftop radio billboard, ground
  // billboard, and the sidewalk newspaper stand.
  const billboards = era1945Content.advertisements.billboards;
  addWallAd(
    group,
    mats,
    'wall-ad-war-bonds',
    -16,
    8.2,
    NORTH_FRONT_Z,
    -1,
    9.5,
    5,
    billboards[0],
    '#7a4f3a',
  );
  addWallAd(
    group,
    mats,
    'wall-ad-coca-cola',
    34,
    6.5,
    SOUTH_FRONT_Z,
    1,
    9,
    4.6,
    billboards[1],
    '#8a5a44',
  );
  addRooftopBillboard(group, mats, billboards[2], -24, 10.6, -26, 'billboard-radio-victor');
  addGroundBillboard(group, mats, billboards[1], 44, -24, 'billboard-coca-cola');
  addNewspaperStand(group, mats, 6, -2.2);

  // Vehicle fleet: one streetcar, four sedans, two surplus trucks —
  // rationing kept the block quiet.
  for (const placement of VEHICLES) {
    addVehicle(group, mats, placement);
  }

  // Pedestrians: suits and fedoras, dresses and gloves, children — muted
  // rationed palette, deterministic placement.
  const rng = mulberry32(19450815);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const skinTones: readonly string[] = ['#f0c8a0', '#e0aa7e', '#c98d5f', '#9c6a44', '#7a4f33'];
  const hairColors: readonly string[] = ['#2a211a', '#161210', '#5f4630', '#8a8578', '#4a3423'];
  const womenDresses: readonly string[] = ['#6e5a4a', '#5a6470', '#7a6a54', '#4e5a44', '#8a7460', '#54503f'];
  const gloveColors: readonly string[] = ['#c9b8a0', '#8a7460', '#3e4448'];
  const menSuits: readonly string[] = ['#3e4448', '#4a4f45', '#54503f', '#2e3336', '#5b5348'];
  const hatColors: readonly string[] = ['#3a3630', '#4a4438', '#5a5244', '#2e2b26'];
  const childOutfits: readonly string[] = ['#8a8070', '#7a8a94', '#9a8a6a', '#6a7a5e'];
  const childShorts: readonly string[] = ['#5b5348', '#4a4f45', '#3e4448'];
  const spots: readonly (readonly [number, number, FigureKind])[] = [
    [-38, -1.3, 'man'],
    [-33, -2.9, 'woman'],
    [-27, -1.4, 'man'],
    [-22, -3.0, 'woman'],
    [-17, -1.2, 'man'],
    [-11, -2.9, 'woman'],
    [-6.5, -1.5, 'child'],
    [-4, -2.6, 'woman'],
    [1, -1.3, 'man'],
    [9, -3.0, 'man'],
    [13, -1.4, 'child'],
    [21, -2.8, 'woman'],
    [27, -1.2, 'man'],
    [33, -3.0, 'woman'],
    [-21, -16.9, 'woman'],
    [-14, -18.4, 'man'],
    [-7, -17.0, 'child'],
    [0, -18.5, 'woman'],
    [8, -16.9, 'man'],
    [26, -18.4, 'woman'],
    [33, -17.0, 'man'],
  ];
  for (const [x, z, kind] of spots) {
    const hat = pick(hatColors);
    addPedestrian(group, mats, {
      x,
      z,
      heading: rng() * Math.PI * 2,
      kind,
      outfit:
        kind === 'woman' ? pick(womenDresses) : kind === 'child' ? pick(childOutfits) : pick(menSuits),
      bottoms: kind === 'child' ? pick(childShorts) : kind === 'woman' ? pick(gloveColors) : pick(menSuits),
      skin: pick(skinTones),
      hair: pick(hairColors),
      hat: kind === 'woman' ? pick(gloveColors) : hat,
    });
  }

  // Street furniture: gas lamps, signal, hydrant, mailbox, benches, trees.
  for (const x of [-34, -10, 14, 38]) {
    addGasLamp(group, mats, x, -1.3);
  }
  for (const x of [-22, 2, 26]) {
    addGasLamp(group, mats, x, -18.7);
  }
  addTrafficSignal(group, mats, 12, -3.2);
  addHydrant(group, mats, -28, -1.3);
  addMailbox(group, mats, -8, -18.4);
  addBench(group, mats, -9, -1.6, Math.PI);
  addBench(group, mats, -2, -18.4, 0);
  addTree(group, mats, -44, -1.3);
  addTree(group, mats, 24, -1.3);
  addTree(group, mats, 44, -1.3);
  addTree(group, mats, -12, -18.9);

  return { id: ERA_1945_ID, group, audio: era1945Audio };
};
