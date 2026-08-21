/**
 * Era 1965 — "Mid-Century Boom".
 *
 * Complete content descriptor plus the procedural scene bundle for the second
 * timeline stop. Everything is authored from Three.js primitives and
 * canvas-generated textures (no external assets); every texture helper
 * degrades to flat colors when `document` is unavailable, keeping the builder
 * safe in headless/node test environments.
 *
 * Period rules enforced by this module:
 * - Buildings: mid-century modern low-rises (pastel stucco, ribbon windows,
 *   flat roofs with early AC units), renovated brick storefront rows, one new
 *   glass-front office tower, and a parking lot replacing the vacant lot.
 * - Vehicles: chrome-heavy '60s cruisers, station wagons and delivery vans;
 *   a diesel transit bus serves the stop where the 1945 streetcar used to
 *   (see the patched track seams in the asphalt).
 * - Storefronts: neon signage arrives — diner pylon, record shop, retail sign
 *   bands — with updated window displays.
 * - Advertisements: painted billboards now carrying printed posters, soda and
 *   cigarette wall ads, and a drive-in style pylon sign.
 * - Pedestrians: men in slacks and button-downs, women in shift dresses with
 *   bouffant hair, in a brighter post-war palette.
 * - Ambience: moderate traffic hum, bus engine idle and diner chatter bleed
 *   registered on the era audio descriptor for the AudioBus.
 */

import * as THREE from 'three';
import type { EraContentBuilder } from '../core/EraRegistry';
import type { EraAudioDescriptor } from '../core/AudioBus';
import type { EraContent, EraId } from './types';

/** Registry key for this era (`EraRegistry.register(ERA_1965_ID, buildEra1965)`). */
export const ERA_1965_ID: EraId = '1965';

/** Complete descriptor for the 1965 era: buildings, vehicles, retail, ads, crowd, ambience, SFX. */
export const era1965Content: EraContent = {
  id: ERA_1965_ID,
  label: '1965 — Mid-Century Boom',
  description:
    'Post-war optimism at full throttle: pastel mid-century low-rises beside renovated brick rows, a new ' +
    'glass-front office tower, chrome-heavy cruisers and station wagons, neon diner and record-shop signage, ' +
    'printed posters over painted billboards — and a diesel bus where the streetcar used to run.',
  buildings: {
    facadePalette: ['#a8c5b4', '#e6d690', '#e0876a', '#e8e3d5', '#9c4f38', '#d8c8a8'],
    minHeightMeters: 6,
    maxHeightMeters: 34,
    windows: { columns: 10, rows: 4, litRatio: 0.45, emissiveColor: '#ffe9b8' },
    roofProps: ['ac-unit', 'antenna', 'chimney'],
  },
  vehicles: {
    kinds: ['chrome-cruiser', 'boxy-wagon', 'vintage-sedan'],
    paintPalette: ['#3fb8af', '#d94530', '#f2ead0', '#6fa8dc', '#22252b', '#c9a227', '#c96f4a'],
    density: 1.15,
    speedScale: 1.05,
  },
  storefronts: {
    names: [
      'STARLITE DINER',
      'SPIN RECORDS',
      'FIVE & DIME',
      'TV & RADIO REPAIR',
      'DRUG STORE',
      'BARBER SHOP',
      'LAUNDROMAT',
    ],
    awningPalette: ['#d94f3d', '#3fb8af', '#e6b33d', '#7fb069', '#c96f4a'],
    signageGlow: 1.4,
  },
  advertisements: {
    billboards: [
      { text: 'DRINK SODA — ICE COLD 10¢', inkColor: '#f7f3e2', glowColor: '#ff5f4a', animated: false },
      { text: 'SMOKE CHESTERFIELDS', inkColor: '#f2ecdc', glowColor: '#d8e2cf', animated: false },
      { text: 'GATEWAY DRIVE-IN — TONITE', inkColor: '#ffd98a', glowColor: '#ffb347', animated: false },
      { text: "MEL'S MOTORS — NEW '65 FUTURA", inkColor: '#eaf3f5', glowColor: '#6fd8e0', animated: false },
    ],
    glowIntensity: 1.2,
  },
  pedestrians: {
    outfitPalette: ['#e8618c', '#f2c14e', '#4fb0a5', '#e07a5f', '#8a9bb8', '#cfe3ea', '#e8d8b0'],
    density: 1.2,
    walkSpeed: 1.05,
  },
  ambience: {
    skyZenith: '#5a8ec2',
    skyHorizon: '#ecd9b0',
    sunColor: '#fff0cf',
    sunIntensity: 2.6,
    ambientColor: '#cfd9e8',
    ambientIntensity: 0.55,
    fogColor: '#e3d4b4',
    fogDensity: 0.0024,
    particles: 'smog',
    streetLamps: 'cobra-neon',
  },
  sfx: {
    ambientDroneHz: [55, 110, 220],
    ambientGain: 0.5,
    trafficProfile: 'postwar-boom',
    events: ['car-horn', 'vintage-horn', 'distant-siren'],
    eventIntervalSeconds: [3.5, 9],
    musicStyle: 'surf-rock',
    masterGain: 0.85,
  },
};

/**
 * Per-era audio channels for the AudioBus: the looping ambience bed carries
 * the moderate traffic hum, the parked transit bus engine and the diner
 * chatter/jukebox bleeding onto the sidewalk; one-shot events exclude the
 * streetcar bell (the trolley is gone by 1965).
 */
export const era1965Audio: EraAudioDescriptor = {
  ambience: 0.9,
  sfx: 1,
  data: {
    label: '1965 mid-century block',
    ambienceLayers: [
      { id: 'traffic-hum', profile: 'postwar-boom', gain: 0.55 },
      { id: 'bus-engine', kind: 'diesel-idle-loop', gain: 0.4 },
      { id: 'diner-chatter', kind: 'interior-bleed', gain: 0.28 },
      { id: 'jukebox-bleed', style: 'surf-rock', gain: 0.16 },
    ],
    events: era1965Content.sfx.events,
    musicStyle: era1965Content.sfx.musicStyle,
    droneHz: era1965Content.sfx.ambientDroneHz,
    replacedInstrument: { from: 'streetcar-bell', to: 'diesel-transit-bus' },
  },
};

/* ------------------------------------------------------------------ */
/* Layout constants (meters, world space)                              */
/* ------------------------------------------------------------------ */

const NORTH_WALK_Z = -2.2;
const SOUTH_WALK_Z = -17.8;
const NORTH_FRONT_Z = 0;
const SOUTH_FRONT_Z = -20;

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
  readonly glow?: string;
  readonly subtext?: string;
}

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
  ctx.font = 'bold 64px "Arial Narrow", Arial, sans-serif';
  if (options.glow) {
    ctx.shadowColor = options.glow;
    ctx.shadowBlur = 22;
  }
  const baselineY = options.subtext ? 100 : 128;
  ctx.fillText(text, 256, baselineY, 480);
  if (options.glow) {
    ctx.fillText(text, 256, baselineY, 480);
  }
  if (options.subtext) {
    ctx.shadowBlur = 0;
    ctx.font = '600 38px Arial, sans-serif';
    ctx.fillText(options.subtext, 256, 186, 480);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function neonTextTexture(text: string, ink: string, glow: string): THREE.CanvasTexture | null {
  const canvas = createCanvas(512, 128);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, 512, 128);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = ink;
  ctx.font = 'bold 62px "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Double pass brightens the "tube".
  ctx.fillText(text, 256, 64, 480);
  ctx.fillText(text, 256, 64, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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

function checkerTexture(a: string, b: string): THREE.CanvasTexture | null {
  const canvas = createCanvas(128, 128);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const cell = 16;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  return texture;
}

function parkingLotTexture(): THREE.CanvasTexture | null {
  const canvas = createCanvas(512, 256);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = '#3a3d42';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#43474e';
  for (let i = 0; i < 260; i++) {
    ctx.fillRect((i * 97) % 512, (i * 211) % 256, 2, 2);
  }
  ctx.strokeStyle = '#d8d4c4';
  ctx.lineWidth = 5;
  for (const rowY of [10, 246]) {
    for (let x = 10; x <= 502; x += 63) {
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x, rowY === 10 ? 116 : 140);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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
  readonly chrome: THREE.MeshStandardMaterial;
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
  readonly curtainWall: THREE.MeshStandardMaterial;
}

function createEraMaterials(): EraMaterials {
  const brickMap = brickTexture('#9c4f38', '#d8c8b0');
  if (brickMap) {
    brickMap.repeat.set(4, 3);
  }
  return {
    asphalt: new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.98 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: '#c9c3b2', roughness: 0.94 }),
    curb: new THREE.MeshStandardMaterial({ color: '#b9b4a6', roughness: 0.92 }),
    paint: new THREE.MeshStandardMaterial({ color: '#e8e5da', roughness: 0.9 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#eef1f5', metalness: 1, roughness: 0.12 }),
    tire: new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.95 }),
    glassDark: new THREE.MeshStandardMaterial({ color: '#26333c', metalness: 0.6, roughness: 0.18 }),
    shopGlass: new THREE.MeshStandardMaterial({
      color: '#26333c',
      metalness: 0.4,
      roughness: 0.2,
      emissive: new THREE.Color('#ffe9b8'),
      emissiveIntensity: 0.35,
    }),
    windowLit: new THREE.MeshStandardMaterial({
      color: '#31404d',
      metalness: 0.2,
      roughness: 0.25,
      emissive: new THREE.Color('#ffe9b8'),
      emissiveIntensity: 0.65,
    }),
    steel: new THREE.MeshStandardMaterial({ color: '#dfe4e8', metalness: 0.85, roughness: 0.35 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#6b4f35', roughness: 0.95 }),
    foliage: new THREE.MeshStandardMaterial({ color: '#5f8a4f', roughness: 0.95 }),
    signBoard: new THREE.MeshStandardMaterial({ color: '#1d2226', roughness: 0.7 }),
    darkTrim: new THREE.MeshStandardMaterial({ color: '#3d4a54', metalness: 0.6, roughness: 0.4 }),
    brickTrim: new THREE.MeshStandardMaterial({ color: '#8f8778', roughness: 0.9 }),
    lampLens: new THREE.MeshStandardMaterial({
      color: '#fff3cf',
      emissive: new THREE.Color('#ffe9b8'),
      emissiveIntensity: 0.9,
    }),
    tailLight: new THREE.MeshStandardMaterial({
      color: '#7a1f1a',
      emissive: new THREE.Color('#ff3b2f'),
      emissiveIntensity: 0.55,
    }),
    brick: brickMap
      ? new THREE.MeshStandardMaterial({ map: brickMap, roughness: 0.92 })
      : new THREE.MeshStandardMaterial({ color: '#9c4f38', roughness: 0.92 }),
    benchWood: new THREE.MeshStandardMaterial({ color: '#8a6844', roughness: 0.85 }),
    curtainWall: new THREE.MeshStandardMaterial({ color: '#9fc4d8', metalness: 0.85, roughness: 0.18 }),
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

interface NeonTextOptions {
  readonly text: string;
  readonly ink: string;
  readonly glow: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly faceDir: -1 | 1;
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

function addNeonText(parent: THREE.Object3D, options: NeonTextOptions): void {
  const texture = neonTextTexture(options.text, options.ink, options.glow);
  const material = texture
    ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    : new THREE.MeshStandardMaterial({
        color: '#14181d',
        emissive: new THREE.Color(options.glow),
        emissiveIntensity: 1.5,
      });
  addPlane(
    parent,
    material,
    options.width,
    options.height,
    [options.x, options.y, options.z],
    options.name,
    options.faceDir === -1 ? Math.PI : 0,
  );
}

/* ------------------------------------------------------------------ */
/* Street bed                                                          */
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

  // The 1945 streetcar is long gone — dark repaved seams mark the old rails.
  const seam = new THREE.MeshStandardMaterial({ color: '#33363b', roughness: 0.95 });
  addBox(bed, seam, [12, 0.014, 0.6], [-8, 0.018, -6.6], 'track-repair-seam');
  addBox(bed, seam, [12, 0.014, 0.6], [14, 0.018, -6.6], 'track-repair-seam');

  parent.add(bed);
}

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

function addGlassOffice(parent: THREE.Object3D, mats: EraMaterials): void {
  const tower = new THREE.Group();
  tower.name = 'building-glass-office';
  tower.position.set(-32, 0, 7);

  addBox(tower, mats.curtainWall, [16, 30, 14], [0, 15, 0]);
  for (let x = -7; x <= 7; x += 2) {
    addBox(tower, mats.darkTrim, [0.14, 30, 0.18], [x, 15, -7.05]);
  }
  for (let y = 3.75; y < 30; y += 3.75) {
    addBox(tower, mats.darkTrim, [16.05, 0.4, 0.16], [0, y, -7.06]);
  }
  // Street-level lobby: recessed glass, steel canopy.
  addBox(tower, mats.glassDark, [5.5, 3.4, 0.5], [0, 1.7, -7.1]);
  addBox(tower, mats.steel, [6.5, 0.28, 2.4], [0, 3.55, -8.0]);
  addCylinder(tower, mats.steel, 0.05, 0.05, 1.3, 6, [-2.8, 2.85, -8.8]);
  addCylinder(tower, mats.steel, 0.05, 0.05, 1.3, 6, [2.8, 2.85, -8.8]);
  // Parapet + rooftop plant and antenna.
  addBox(tower, mats.darkTrim, [16.3, 0.7, 14.3], [0, 30.3, 0]);
  addBox(tower, mats.steel, [2.2, 1.3, 1.6], [-5.5, 30.7, 4]);
  const fan = addCylinder(tower, mats.darkTrim, 0.5, 0.5, 0.18, 12, [-5.5, 31.42, 4]);
  fan.rotation.x = Math.PI / 2;
  addCylinder(tower, mats.steel, 0.05, 0.07, 4.2, 6, [5, 32.1, 4]);
  addSphere(tower, mats.darkTrim, 0.16, [5, 34.3, 4]);

  parent.add(tower);
}

interface MidCenturyOptions {
  readonly x: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly frontZ: number;
  readonly faceDir: -1 | 1;
  readonly color: string;
  readonly name: string;
  readonly roofProp: 'ac-unit' | 'antenna';
}

function addMidCenturyBuilding(parent: THREE.Object3D, mats: EraMaterials, o: MidCenturyOptions): void {
  const building = new THREE.Group();
  building.name = o.name;
  building.position.set(o.x, 0, 0);
  const centerZ = o.frontZ + (o.faceDir * o.depth) / 2;
  const facade = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.88 });

  addBox(building, facade, [o.width, o.height, o.depth], [0, o.height / 2, centerZ]);
  addBox(
    building,
    facade,
    [o.width + 0.35, 0.55, o.depth + 0.35],
    [0, o.height + 0.27, centerZ],
  );
  addBox(
    building,
    mats.brickTrim,
    [o.width + 0.15, 0.7, o.depth + 0.12],
    [0, 0.35, centerZ],
  );

  // Horizontal ribbon windows — the mid-century signature.
  const floors = Math.max(1, Math.round((o.height - 2.2) / 3.1));
  const floorHeight = (o.height - 2.2) / floors;
  for (let f = 0; f < floors; f++) {
    const y = 1.8 + floorHeight * (f + 0.5);
    const bandHeight = Math.min(1.35, floorHeight * 0.55);
    addBox(
      building,
      mats.windowLit,
      [o.width - 2.6, bandHeight, 0.14],
      [0, y, o.frontZ + o.faceDir * 0.07],
    );
    addBox(
      building,
      mats.brickTrim,
      [o.width - 2.2, 0.12, 0.2],
      [0, y - bandHeight / 2 - 0.08, o.frontZ + o.faceDir * 0.09],
    );
  }
  for (const px of [-1, 1]) {
    addBox(
      building,
      facade,
      [0.55, o.height - 1.4, 0.16],
      [px * (o.width / 2 - 1.1), (o.height - 1.4) / 2 + 0.6, o.frontZ + o.faceDir * 0.06],
    );
  }

  const roofZ = o.frontZ + o.depth * 0.62;
  if (o.roofProp === 'ac-unit') {
    addBox(building, mats.steel, [1.8, 1.1, 1.4], [-o.width / 2 + 2, o.height + 0.85, roofZ]);
    const fan = addCylinder(
      building,
      mats.darkTrim,
      0.45,
      0.45,
      0.16,
      12,
      [-o.width / 2 + 2, o.height + 1.45, roofZ],
    );
    fan.rotation.x = Math.PI / 2;
  } else {
    addCylinder(
      building,
      mats.steel,
      0.04,
      0.06,
      3.6,
      6,
      [o.width / 2 - 1.5, o.height + 2.1, roofZ],
    );
    addSphere(building, mats.darkTrim, 0.14, [o.width / 2 - 1.5, o.height + 3.95, roofZ]);
  }

  parent.add(building);
}

interface BrickBuildingOptions {
  readonly x: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly frontZ: number;
  readonly faceDir: -1 | 1;
  readonly name: string;
  readonly chimney: boolean;
  readonly sashWindows: boolean;
}

function addBrickBuilding(parent: THREE.Object3D, mats: EraMaterials, o: BrickBuildingOptions): void {
  const building = new THREE.Group();
  building.name = o.name;
  building.position.set(o.x, 0, 0);
  const centerZ = o.frontZ + (o.faceDir * o.depth) / 2;

  addBox(building, mats.brick, [o.width, o.height, o.depth], [0, o.height / 2, centerZ]);
  addBox(building, mats.brickTrim, [o.width + 0.4, 0.5, o.depth + 0.4], [0, o.height + 0.2, centerZ]);
  addBox(building, mats.brickTrim, [o.width + 0.2, 0.9, o.depth + 0.16], [0, 0.45, centerZ]);
  if (o.chimney) {
    addBox(
      building,
      mats.brick,
      [0.9, 2.0, 0.9],
      [-o.width / 2 + 1.2, o.height + 1.3, centerZ + o.faceDir * o.depth * 0.25],
    );
  }
  if (o.sashWindows) {
    const floors = Math.max(1, Math.floor((o.height - 3.2) / 3.0));
    const cols = Math.max(2, Math.floor((o.width - 2) / 2.8));
    for (let f = 0; f < floors; f++) {
      const y = 4.2 + f * 3.0;
      for (let c = 0; c < cols; c++) {
        const wx = -((cols - 1) * 2.8) / 2 + c * 2.8;
        addBox(building, mats.windowLit, [1.5, 1.7, 0.14], [wx, y, o.frontZ + o.faceDir * 0.07]);
        addBox(
          building,
          mats.brickTrim,
          [1.8, 0.14, 0.2],
          [wx, y - 0.95, o.frontZ + o.faceDir * 0.09],
        );
      }
    }
  }

  parent.add(building);
}

/* ------------------------------------------------------------------ */
/* Diner + generic storefronts                                         */
/* ------------------------------------------------------------------ */

function addDiner(parent: THREE.Object3D, mats: EraMaterials): void {
  const diner = new THREE.Group();
  diner.name = 'storefront-diner';
  diner.position.set(17, 0, 0);
  const body = new THREE.MeshStandardMaterial({ color: '#dfe4e8', metalness: 0.75, roughness: 0.32 });
  const trim = new THREE.MeshStandardMaterial({ color: '#c94f43', roughness: 0.6 });

  addBox(diner, body, [14, 6.5, 12], [0, 3.25, 6]);
  addBox(diner, mats.shopGlass, [12.6, 1.6, 0.16], [0, 3.6, -0.06]);
  addBox(diner, trim, [14.15, 0.32, 12.15], [0, 5.2, 6]);
  const checker = checkerTexture('#26333c', '#e8e4d4');
  const baseMaterial = checker
    ? new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 })
    : new THREE.MeshStandardMaterial({ color: '#26333c', roughness: 0.8 });
  addBox(diner, baseMaterial, [14.2, 0.9, 12.2], [0, 0.45, 6]);
  addBox(diner, mats.steel, [14.4, 0.4, 12.4], [0, 6.7, 6]);
  addBox(diner, mats.glassDark, [1.1, 2.5, 0.12], [-4.6, 1.25, -0.05]);
  addBox(diner, mats.brickTrim, [2.4, 0.18, 1.1], [-4.6, 0.09, -0.55]);
  // Rooftop neon pylon.
  addBox(diner, mats.steel, [0.55, 4.2, 0.55], [2.5, 8.9, 2.5]);
  addBox(diner, mats.signBoard, [6.4, 2.3, 0.5], [2.5, 11.6, 2.5]);
  addNeonText(diner, {
    text: 'STARLITE DINER',
    ink: '#ff6f61',
    glow: '#ff3b2f',
    x: 2.5,
    y: 11.6,
    z: 2.22,
    faceDir: -1,
    width: 6.0,
    height: 1.9,
    name: 'neon-sign-starlite-diner',
  });

  parent.add(diner);
}

interface StorefrontOptions {
  readonly x: number;
  readonly width: number;
  readonly frontZ: number;
  readonly faceDir: -1 | 1;
  readonly name: string;
  readonly sign: string;
  readonly ink: string;
  readonly glow: string;
  readonly awning: string;
  readonly display: 'goods' | 'albums';
}

const GOODS_COLORS: readonly string[] = ['#c8452e', '#2e6f6a', '#e6b33d'];
const ALBUM_COLORS: readonly string[] = ['#e8618c', '#4fb0a5', '#f2c14e', '#6fa8dc', '#c96f4a', '#7fb069'];

function addStorefront(parent: THREE.Object3D, mats: EraMaterials, o: StorefrontOptions): void {
  const shop = new THREE.Group();
  shop.name = o.name;
  shop.position.set(o.x, 0, 0);
  const out = (depth: number): number => o.frontZ + o.faceDir * depth;
  const caseWidth = o.width - 0.6;

  // Open-fronted display case projecting from the facade.
  addBox(shop, mats.darkTrim, [caseWidth, 2.6, 0.12], [0, 1.55, out(0.06)]);
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
  // Door beside the display case.
  const doorX = (o.faceDir === -1 ? -1 : 1) * (o.width / 2 - 0.75);
  addBox(shop, mats.glassDark, [0.95, 2.55, 0.14], [doorX, 1.28, out(0.1)]);
  // Sloped awning over the case.
  const awningMaterial = new THREE.MeshStandardMaterial({ color: o.awning, roughness: 0.8 });
  addBox(shop, awningMaterial, [o.width - 0.4, 0.12, 1.5], [0, 3.5, out(0.7)], undefined, [
    o.faceDir * 0.3,
    0,
    0,
  ]);
  // Neon sign band.
  addBox(shop, mats.signBoard, [o.width - 0.3, 1.0, 0.4], [0, 4.35, out(0.2)]);
  addNeonText(shop, {
    text: o.sign,
    ink: o.ink,
    glow: o.glow,
    x: 0,
    y: 4.35,
    z: out(0.42),
    faceDir: o.faceDir,
    width: Math.min(o.width - 1.2, 6.5),
    height: 0.8,
    name: `neon-sign-${slug(o.sign)}`,
  });

  // Updated window displays, visible through the glass.
  if (o.display === 'goods') {
    addBox(shop, mats.brickTrim, [caseWidth - 0.6, 0.08, 0.5], [0, 1.0, out(0.5)]);
    for (let i = 0; i < 3; i++) {
      const goods = new THREE.MeshStandardMaterial({
        color: GOODS_COLORS[i % GOODS_COLORS.length],
        roughness: 0.6,
      });
      addBox(
        shop,
        goods,
        [0.42, 0.5, 0.42],
        [(i - 1) * (caseWidth / 3.4), 1.32, out(0.5)],
      );
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const cover = new THREE.MeshStandardMaterial({
        color: ALBUM_COLORS[i % ALBUM_COLORS.length],
        roughness: 0.55,
      });
      addPlane(
        shop,
        cover,
        0.55,
        0.55,
        [
          -(caseWidth / 3.2) + (i % 3) * (caseWidth / 3.2),
          0.95 + Math.floor(i / 3) * 0.8,
          out(0.4),
        ],
        undefined,
        o.faceDir === -1 ? Math.PI : 0,
      );
    }
  }

  parent.add(shop);
}

/* ------------------------------------------------------------------ */
/* Parking lot (former vacant lot)                                     */
/* ------------------------------------------------------------------ */

function addParkingLot(parent: THREE.Object3D, mats: EraMaterials): void {
  const lot = new THREE.Group();
  lot.name = 'parking-lot';
  lot.position.set(12, 0, -26);

  const surfaceTexture = parkingLotTexture();
  const surfaceMaterial = surfaceTexture
    ? new THREE.MeshStandardMaterial({ map: surfaceTexture, roughness: 0.98 })
    : new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.98 });
  addPlane(lot, surfaceMaterial, 28, 12, [0, 0.015, 0], undefined, 0, -Math.PI / 2);
  if (!surfaceTexture) {
    for (const rowZ of [-2.6, 2.6]) {
      for (let x = -12; x <= 12; x += 3) {
        addBox(lot, mats.paint, [0.14, 0.012, 5.4], [x, 0.024, rowZ]);
      }
    }
  }
  // Entrance apron up to the south sidewalk.
  addBox(lot, mats.asphalt, [6, 0.2, 4.6], [-1, 0.1, 7.0]);

  // Attendant booth.
  const boothMaterial = new THREE.MeshStandardMaterial({ color: '#d8d2c0', roughness: 0.8 });
  addBox(lot, boothMaterial, [1.7, 2.4, 1.7], [3.6, 1.2, 6.6]);
  addBox(lot, mats.steel, [2.0, 0.15, 2.0], [3.6, 2.5, 6.6]);
  addPlane(lot, mats.shopGlass, 1.2, 0.8, [3.6, 1.5, 7.46]);

  // Rate sign.
  addCylinder(lot, mats.steel, 0.05, 0.05, 2.8, 6, [5.8, 1.4, 6.9]);
  const rateTexture = signTexture('PARKING 25¢', { background: '#f5f2e8', ink: '#c8452e' });
  const rateMaterial = rateTexture
    ? new THREE.MeshStandardMaterial({ map: rateTexture, roughness: 0.75 })
    : new THREE.MeshStandardMaterial({ color: '#f5f2e8', roughness: 0.75 });
  addPlane(lot, rateMaterial, 1.7, 0.85, [5.8, 2.95, 6.9], 'sign-parking');

  // Lot floodlight.
  addCylinder(lot, mats.steel, 0.08, 0.1, 5.2, 8, [-10, 2.6, -3.5]);
  addBox(lot, mats.steel, [0.9, 0.16, 0.5], [-10, 5.2, -3.1]);
  addPlane(lot, mats.lampLens, 0.7, 0.34, [-10, 5.1, -3.1], undefined, 0, Math.PI / 2);

  parent.add(lot);
}

/* ------------------------------------------------------------------ */
/* Advertisements                                                      */
/* ------------------------------------------------------------------ */

interface BillboardCopyView {
  readonly text: string;
  readonly inkColor: string;
  readonly glowColor: string;
}

function addBillboard(parent: THREE.Object3D, mats: EraMaterials, copy: BillboardCopyView): void {
  const board = new THREE.Group();
  board.name = 'billboard-print-poster';
  board.position.set(-15, 13.45, 3.0);

  addBox(board, mats.steel, [0.32, 2.6, 0.32], [-4.6, 1.3, 0]);
  addBox(board, mats.steel, [0.32, 2.6, 0.32], [4.6, 1.3, 0]);
  addBox(board, mats.steel, [12.8, 0.12, 1.0], [0, 0.4, 0]);
  addBox(board, mats.signBoard, [12.8, 5.0, 0.35], [0, 3.0, 0.1]);
  const panelTexture = signTexture(copy.text, {
    background: '#274232',
    ink: copy.inkColor,
    glow: copy.glowColor,
    subtext: 'NOW IN THE NEW PRINT',
  });
  const panelMaterial = panelTexture
    ? new THREE.MeshStandardMaterial({ map: panelTexture, roughness: 0.85 })
    : new THREE.MeshStandardMaterial({ color: '#274232', roughness: 0.85 });
  addPlane(board, panelMaterial, 12.2, 4.4, [0, 3.0, -0.1], undefined, Math.PI);
  // A fresher printed poster pasted over the painted board.
  const posterTexture = signTexture('DRINK SODA — ICE COLD 10¢', {
    background: '#c8452e',
    ink: '#f7f3e2',
  });
  const posterMaterial = posterTexture
    ? new THREE.MeshStandardMaterial({ map: posterTexture, roughness: 0.7 })
    : new THREE.MeshStandardMaterial({ color: '#c8452e', roughness: 0.7 });
  addPlane(board, posterMaterial, 3.6, 2.6, [3.6, 2.5, -0.14], undefined, Math.PI);

  parent.add(board);
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
  const texture = signTexture(copy.text, { background, ink: copy.inkColor, glow: copy.glowColor });
  const material = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 })
    : new THREE.MeshStandardMaterial({ color: background, roughness: 0.9 });
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

function addDriveInPylon(parent: THREE.Object3D, mats: EraMaterials, copy: BillboardCopyView): void {
  const pylon = new THREE.Group();
  pylon.name = 'sign-drive-in-pylon';
  pylon.position.set(24, 0, -19.6);

  addBox(pylon, mats.steel, [0.7, 7.2, 0.7], [0, 3.6, 0]);
  addBox(pylon, mats.signBoard, [5.6, 3.4, 0.45], [0, 8.8, 0]);
  const texture = signTexture(copy.text, {
    background: '#141a20',
    ink: copy.inkColor,
    glow: copy.glowColor,
    subtext: 'GATEWAY DRIVE-IN',
  });
  const material = texture
    ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    : new THREE.MeshStandardMaterial({
        color: '#141a20',
        emissive: new THREE.Color(copy.glowColor),
        emissiveIntensity: 1.2,
      });
  addPlane(pylon, material, 5.2, 3.0, [0, 8.8, 0.24]);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 1.8, 3),
    new THREE.MeshStandardMaterial({ color: '#e6b33d', roughness: 0.5 }),
  );
  arrow.rotation.z = Math.PI / 2;
  arrow.position.set(-3.6, 8.8, 0);
  pylon.add(arrow);

  parent.add(pylon);
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

type Era1965VehicleKind = 'chrome-cruiser' | 'boxy-wagon' | 'delivery-van' | 'transit-bus';

interface VehiclePlacement {
  readonly kind: Era1965VehicleKind;
  readonly x: number;
  readonly z: number;
  /** Heading in radians; 0 faces +X. */
  readonly heading: number;
  readonly paint: string;
  readonly name: string;
}

const VEHICLES: readonly VehiclePlacement[] = [
  { kind: 'transit-bus', x: 4.5, z: -6.9, heading: 0, paint: '#e8e4d4', name: 'vehicle-transit-bus' },
  { kind: 'chrome-cruiser', x: -30, z: -7, heading: 0, paint: '#3fb8af', name: 'vehicle-chrome-cruiser' },
  { kind: 'chrome-cruiser', x: -12, z: -7, heading: 0, paint: '#d94530', name: 'vehicle-chrome-cruiser' },
  { kind: 'boxy-wagon', x: 26, z: -7, heading: 0, paint: '#6fa8dc', name: 'vehicle-boxy-wagon' },
  { kind: 'chrome-cruiser', x: 20, z: -13, heading: Math.PI, paint: '#f2ead0', name: 'vehicle-chrome-cruiser' },
  { kind: 'boxy-wagon', x: -2, z: -13, heading: Math.PI, paint: '#22252b', name: 'vehicle-boxy-wagon' },
  { kind: 'delivery-van', x: -28, z: -13, heading: Math.PI, paint: '#c9a227', name: 'vehicle-delivery-van' },
  { kind: 'boxy-wagon', x: -16, z: -5.1, heading: 0, paint: '#c96f4a', name: 'vehicle-boxy-wagon' },
  { kind: 'chrome-cruiser', x: 32, z: -14.9, heading: Math.PI, paint: '#4fb0a5', name: 'vehicle-chrome-cruiser' },
  { kind: 'delivery-van', x: 14, z: -14.9, heading: 0, paint: '#8a9bb8', name: 'vehicle-delivery-van' },
  { kind: 'chrome-cruiser', x: 2.5, z: -24.5, heading: -Math.PI / 2, paint: '#c9a227', name: 'vehicle-chrome-cruiser' },
  { kind: 'boxy-wagon', x: 6, z: -24.5, heading: -Math.PI / 2, paint: '#7fb069', name: 'vehicle-boxy-wagon' },
  { kind: 'chrome-cruiser', x: 20, z: -28.5, heading: Math.PI / 2, paint: '#6fa8dc', name: 'vehicle-chrome-cruiser' },
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
        mats.chrome,
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
    metalness: 0.4,
    roughness: 0.32,
  });

  if (placement.kind === 'transit-bus') {
    // Diesel transit bus — the streetcar's replacement.
    addBox(vehicle, paint, [8.5, 1.9, 2.4], [0, 1.65, 0]);
    addBox(vehicle, new THREE.MeshStandardMaterial({ color: '#2e6f6a', roughness: 0.6 }), [
      8.52,
      0.55,
      2.44,
    ], [0, 0.62, 0]);
    addBox(vehicle, mats.shopGlass, [7.8, 0.8, 0.1], [0, 2.2, 1.21]);
    addBox(vehicle, mats.shopGlass, [7.8, 0.8, 0.1], [0, 2.2, -1.21]);
    addPlane(vehicle, mats.shopGlass, 2.2, 0.95, [4.26, 1.95, 0], undefined, Math.PI / 2);
    addPlane(vehicle, mats.signBoard, 1.5, 0.42, [4.26, 2.62, 0], undefined, Math.PI / 2);
    addBox(vehicle, mats.chrome, [0.3, 0.32, 2.3], [4.32, 0.5, 0]);
    addBox(vehicle, mats.chrome, [0.3, 0.32, 2.3], [-4.32, 0.5, 0]);
    addWheelSet(vehicle, mats, [2.9, -2.2, -3.3], 1.02, 0.45);
  } else if (placement.kind === 'chrome-cruiser') {
    // Chrome-heavy '60s cruiser: long deck, grille bar, tail fins.
    addBox(vehicle, paint, [4.7, 0.72, 1.95], [0, 0.74, 0]);
    addBox(vehicle, paint, [2.3, 0.6, 1.76], [-0.25, 1.38, 0]);
    addBox(vehicle, mats.shopGlass, [0.1, 0.5, 1.6], [0.92, 1.4, 0]);
    addBox(vehicle, mats.chrome, [0.14, 0.44, 1.5], [2.36, 0.8, 0]);
    addBox(vehicle, mats.chrome, [0.28, 0.22, 2.05], [2.44, 0.45, 0]);
    addBox(vehicle, mats.chrome, [0.28, 0.22, 2.05], [-2.44, 0.45, 0]);
    addBox(vehicle, paint, [0.85, 0.5, 0.12], [-1.95, 1.18, 0.92]);
    addBox(vehicle, paint, [0.85, 0.5, 0.12], [-1.95, 1.18, -0.92]);
    addBox(vehicle, mats.tailLight, [0.06, 0.16, 0.3], [-2.36, 0.88, 0.6]);
    addBox(vehicle, mats.tailLight, [0.06, 0.16, 0.3], [-2.36, 0.88, -0.6]);
    addWheelSet(vehicle, mats, [1.55, -1.55], 0.98, 0.34);
  } else if (placement.kind === 'boxy-wagon') {
    // Station wagon with faux-wood sides.
    addBox(vehicle, paint, [4.5, 0.78, 1.9], [0, 0.76, 0]);
    addBox(vehicle, paint, [3.6, 0.66, 1.8], [-0.35, 1.48, 0]);
    addBox(vehicle, mats.shopGlass, [0.1, 0.48, 1.55], [1.05, 1.44, 0]);
    addBox(vehicle, mats.shopGlass, [0.1, 0.48, 1.55], [-2.12, 1.44, 0]);
    addBox(vehicle, mats.chrome, [0.26, 0.2, 2.0], [2.32, 0.44, 0]);
    addBox(vehicle, mats.chrome, [0.26, 0.2, 2.0], [-2.32, 0.44, 0]);
    addBox(vehicle, mats.trunk, [3.4, 0.4, 1.94], [-0.4, 0.95, 0]);
    addWheelSet(vehicle, mats, [1.5, -1.5], 0.97, 0.34);
  } else {
    // Delivery van: cab forward, tall cargo box.
    addBox(vehicle, paint, [1.5, 1.25, 1.95], [1.55, 1.0, 0]);
    addBox(vehicle, paint, [3.0, 2.0, 2.05], [-0.55, 1.32, 0]);
    addBox(
      vehicle,
      new THREE.MeshStandardMaterial({ color: '#f0ede2', roughness: 0.6 }),
      [3.02, 1.1, 2.07],
      [-0.55, 1.5, 0],
    );
    addBox(vehicle, mats.shopGlass, [0.1, 0.6, 1.7], [2.28, 1.32, 0]);
    addBox(vehicle, mats.chrome, [0.26, 0.24, 2.0], [2.34, 0.42, 0]);
    addBox(vehicle, mats.chrome, [0.26, 0.24, 2.0], [-2.1, 0.42, 0]);
    addWheelSet(vehicle, mats, [1.6, -1.4], 1.0, 0.4);
  }

  parent.add(vehicle);
}

/* ------------------------------------------------------------------ */
/* Pedestrians                                                         */
/* ------------------------------------------------------------------ */

interface PedestrianSpec {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly female: boolean;
  readonly outfit: string;
  readonly bottoms: string;
  readonly skin: string;
  readonly hair: string;
}

function addPedestrian(parent: THREE.Object3D, mats: EraMaterials, spec: PedestrianSpec): void {
  const figure = new THREE.Group();
  figure.name = spec.female ? 'pedestrian-woman' : 'pedestrian-man';
  figure.position.set(spec.x, 0, spec.z);
  figure.rotation.y = spec.heading;

  const outfit = new THREE.MeshStandardMaterial({ color: spec.outfit, roughness: 0.85 });
  const bottoms = new THREE.MeshStandardMaterial({ color: spec.bottoms, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: spec.skin, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: spec.hair, roughness: 0.95 });

  if (spec.female) {
    // Shift dress with bouffant hair.
    addCylinder(figure, outfit, 0.16, 0.34, 1.15, 10, [0, 0.85, 0]);
    addCylinder(figure, skin, 0.055, 0.055, 0.5, 6, [0.1, 0.25, 0]);
    addCylinder(figure, skin, 0.055, 0.055, 0.5, 6, [-0.1, 0.25, 0]);
    addSphere(figure, skin, 0.14, [0, 1.58, 0]);
    const bouffant = addSphere(figure, hair, 0.17, [0, 1.68, 0]);
    bouffant.scale.set(1, 0.85, 1);
  } else {
    // Button-down shirt over slacks.
    addCylinder(figure, outfit, 0.17, 0.15, 0.72, 8, [0, 1.16, 0]);
    addBox(figure, bottoms, [0.34, 0.8, 0.2], [0, 0.4, 0]);
    addSphere(figure, skin, 0.14, [0, 1.66, 0]);
    const shortHair = addSphere(figure, hair, 0.145, [0, 1.74, 0]);
    shortHair.scale.set(1, 0.72, 1);
  }
  void mats;

  parent.add(figure);
}

/* ------------------------------------------------------------------ */
/* Street furniture                                                    */
/* ------------------------------------------------------------------ */

function addStreetLamp(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number, armDirZ: -1 | 1): void {
  const lamp = new THREE.Group();
  lamp.name = 'street-lamp-cobra';
  lamp.position.set(x, 0, z);
  addCylinder(lamp, mats.steel, 0.09, 0.11, 6.8, 8, [0, 3.4, 0]);
  addBox(lamp, mats.steel, [0.14, 0.14, 2.0], [0, 6.7, armDirZ * 1.0]);
  addBox(lamp, mats.steel, [0.95, 0.16, 0.45], [0, 6.66, armDirZ * 1.9]);
  addPlane(lamp, mats.lampLens, 0.75, 0.32, [0, 6.56, armDirZ * 1.9], undefined, 0, Math.PI / 2);
  parent.add(lamp);
}

function addTrafficSignal(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const signal = new THREE.Group();
  signal.name = 'traffic-signal';
  signal.position.set(x, 0, z);
  signal.rotation.y = Math.PI;
  addCylinder(signal, mats.darkTrim, 0.09, 0.11, 4.6, 8, [0, 2.3, 0]);
  addBox(signal, mats.signBoard, [0.44, 1.1, 0.3], [0, 3.95, 0]);
  const lensColors: readonly string[] = ['#ff5148', '#ffc94d', '#57d977'];
  for (let i = 0; i < 3; i++) {
    const lens = new THREE.MeshStandardMaterial({
      color: lensColors[i],
      emissive: new THREE.Color(lensColors[i]),
      emissiveIntensity: 1.1,
    });
    addPlane(signal, lens, 0.22, 0.22, [0, 4.3 - i * 0.35, 0.16]);
  }
  parent.add(signal);
}

function addBench(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number, rotY: number): void {
  const bench = new THREE.Group();
  bench.name = 'bench';
  bench.position.set(x, 0, z);
  bench.rotation.y = rotY;
  addBox(bench, mats.benchWood, [1.9, 0.09, 0.5], [0, 0.55, 0]);
  addBox(bench, mats.benchWood, [1.9, 0.5, 0.08], [0, 0.95, -0.24]);
  addBox(bench, mats.steel, [0.09, 0.55, 0.46], [-0.8, 0.275, 0]);
  addBox(bench, mats.steel, [0.09, 0.55, 0.46], [0.8, 0.275, 0]);
  parent.add(bench);
}

function addBusShelter(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const shelter = new THREE.Group();
  shelter.name = 'bus-shelter';
  shelter.position.set(x, 0, z);
  addBox(shelter, mats.steel, [4.2, 0.12, 1.7], [0, 2.55, 0]);
  for (const px of [-1.9, 0, 1.9]) {
    addCylinder(shelter, mats.steel, 0.05, 0.05, 2.55, 6, [px, 1.275, 0.75]);
  }
  addCylinder(shelter, mats.steel, 0.05, 0.05, 2.55, 6, [-1.9, 1.275, -0.75]);
  addCylinder(shelter, mats.steel, 0.05, 0.05, 2.55, 6, [1.9, 1.275, -0.75]);
  addPlane(shelter, mats.shopGlass, 3.8, 1.9, [0, 1.4, 0.75], undefined, Math.PI);
  addPlane(shelter, mats.shopGlass, 1.4, 1.9, [-2.02, 1.4, 0], undefined, Math.PI / 2);
  addBench(shelter, mats, 0, -0.15, Math.PI);
  addCylinder(shelter, mats.steel, 0.04, 0.04, 3.0, 6, [2.6, 1.5, -0.3]);
  const signTextureResult = signTexture('BUS STOP', { background: '#2e6f6a', ink: '#f5f2e8' });
  const signMaterial = signTextureResult
    ? new THREE.MeshStandardMaterial({ map: signTextureResult, roughness: 0.7 })
    : new THREE.MeshStandardMaterial({ color: '#2e6f6a', roughness: 0.7 });
  addPlane(shelter, signMaterial, 0.9, 0.45, [2.6, 3.2, -0.3], undefined, Math.PI);
  parent.add(shelter);
}

function addPhoneBooth(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const booth = new THREE.Group();
  booth.name = 'phone-booth';
  booth.position.set(x, 0, z);
  addBox(booth, mats.steel, [1.0, 0.12, 1.0], [0, 0.06, 0]);
  addBox(booth, mats.darkTrim, [1.0, 0.22, 1.0], [0, 2.42, 0]);
  for (const corner of [
    [-0.46, -0.46],
    [0.46, -0.46],
    [-0.46, 0.46],
    [0.46, 0.46],
  ] as const) {
    addCylinder(booth, mats.steel, 0.04, 0.04, 2.3, 6, [corner[0], 1.15, corner[1]]);
  }
  addPlane(booth, mats.shopGlass, 0.92, 2.2, [0, 1.2, 0.46], undefined, Math.PI);
  addPlane(booth, mats.shopGlass, 0.92, 2.2, [-0.46, 1.2, 0], undefined, Math.PI / 2);
  addBox(booth, mats.signBoard, [0.3, 0.5, 0.14], [0, 1.5, -0.4]);
  parent.add(booth);
}

function addHydrant(parent: THREE.Object3D, mats: EraMaterials, x: number, z: number): void {
  const hydrant = new THREE.Group();
  hydrant.name = 'hydrant';
  hydrant.position.set(x, 0, z);
  const red = new THREE.MeshStandardMaterial({ color: '#c94f43', roughness: 0.6 });
  addCylinder(hydrant, red, 0.16, 0.19, 0.6, 10, [0, 0.3, 0]);
  const dome = addSphere(hydrant, red, 0.16, [0, 0.62, 0]);
  dome.scale.set(1, 0.7, 1);
  addCylinder(hydrant, mats.darkTrim, 0.06, 0.06, 0.1, 8, [0, 0.76, 0]);
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
  const blue = new THREE.MeshStandardMaterial({ color: '#3e6fa3', roughness: 0.55 });
  addBox(mailbox, blue, [0.55, 0.85, 0.5], [0, 0.65, 0]);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.55, 12), blue);
  top.rotation.z = Math.PI / 2;
  top.position.set(0, 1.075, 0);
  mailbox.add(top);
  addPlane(mailbox, mats.darkTrim, 0.4, 0.5, [0, 0.7, 0.26]);
  parent.add(mailbox);
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
/* Era builder                                                         */
/* ------------------------------------------------------------------ */

/**
 * Builds the complete 1965 scene bundle: a named THREE.Group with every
 * procedural mesh plus the era audio descriptor for the AudioBus. Safe to run
 * in node environments (canvas textures degrade to flat colors).
 */
export const buildEra1965: EraContentBuilder = () => {
  const group = new THREE.Group();
  group.name = 'era-1965';
  const mats = createEraMaterials();

  buildStreetBed(group, mats);

  // North row, west to east.
  addGlassOffice(group, mats);
  addBrickBuilding(group, mats, {
    x: -15,
    width: 14,
    depth: 13,
    height: 13,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'building-brick-renovated',
    chimney: true,
    sashWindows: true,
  });
  addMidCenturyBuilding(group, mats, {
    x: 1,
    width: 14,
    depth: 12,
    height: 11,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    color: '#a8c5b4',
    name: 'building-midcentury-a',
    roofProp: 'ac-unit',
  });
  addDiner(group, mats);
  addMidCenturyBuilding(group, mats, {
    x: 33,
    width: 14,
    depth: 12,
    height: 14,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    color: '#e6d690',
    name: 'building-midcentury-b',
    roofProp: 'antenna',
  });

  // South row: brick retail, the new parking lot (former vacant lot), pastel low-rise.
  addBrickBuilding(group, mats, {
    x: -15,
    width: 18,
    depth: 12,
    height: 10,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    name: 'building-south-brick',
    chimney: false,
    sashWindows: true,
  });
  addParkingLot(group, mats);
  addMidCenturyBuilding(group, mats, {
    x: 34,
    width: 12,
    depth: 12,
    height: 9,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    color: '#e0876a',
    name: 'building-midcentury-c',
    roofProp: 'ac-unit',
  });

  // Neon-era storefronts with updated displays.
  addStorefront(group, mats, {
    x: -15,
    width: 10,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-drug-store',
    sign: 'DRUG STORE',
    ink: '#7fe0d3',
    glow: '#2ec4b6',
    awning: '#7fb069',
    display: 'goods',
  });
  addStorefront(group, mats, {
    x: -2.6,
    width: 5.6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-record-shop',
    sign: 'SPIN RECORDS',
    ink: '#ff9ec4',
    glow: '#ff4fa3',
    awning: '#d94f3d',
    display: 'albums',
  });
  addStorefront(group, mats, {
    x: 4.6,
    width: 5.6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-five-and-dime',
    sign: 'FIVE & DIME',
    ink: '#ffe08a',
    glow: '#ffb347',
    awning: '#3fb8af',
    display: 'goods',
  });
  addStorefront(group, mats, {
    x: 30,
    width: 6,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-tv-and-radio',
    sign: 'TV & RADIO REPAIR',
    ink: '#aee6ff',
    glow: '#5ec8f2',
    awning: '#e6b33d',
    display: 'goods',
  });
  addStorefront(group, mats, {
    x: 36.6,
    width: 5.2,
    frontZ: NORTH_FRONT_Z,
    faceDir: -1,
    name: 'storefront-barber-shop',
    sign: 'BARBER SHOP',
    ink: '#ff8a7a',
    glow: '#ff5f4a',
    awning: '#7fb069',
    display: 'goods',
  });
  addStorefront(group, mats, {
    x: -15,
    width: 12,
    frontZ: SOUTH_FRONT_Z,
    faceDir: 1,
    name: 'storefront-laundromat',
    sign: 'LAUNDROMAT',
    ink: '#bfeaff',
    glow: '#6fd8e0',
    awning: '#c96f4a',
    display: 'goods',
  });

  // Advertisements: painted boards with printed posters, wall ads, drive-in pylon.
  const billboards = era1965Content.advertisements.billboards;
  addBillboard(group, mats, billboards[1]);
  addWallAd(
    group,
    mats,
    'wall-ad-soda',
    -15,
    6.4,
    SOUTH_FRONT_Z,
    1,
    9,
    5,
    billboards[0],
    '#c8452e',
  );
  addWallAd(
    group,
    mats,
    'wall-ad-cigarettes',
    -15,
    9.6,
    NORTH_FRONT_Z,
    -1,
    9.5,
    5.2,
    billboards[1],
    '#3a5a40',
  );
  addDriveInPylon(group, mats, billboards[2]);

  // Vehicle fleet: chrome cruisers, wagons, delivery vans, and the bus.
  for (const placement of VEHICLES) {
    addVehicle(group, mats, placement);
  }

  // Pedestrians: brighter post-war outfits, deterministic placement.
  const rng = mulberry32(19651231);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const skinTones: readonly string[] = ['#f0c8a0', '#e0aa7e', '#c98d5f', '#9c6a44', '#7a4f33'];
  const hairColors: readonly string[] = ['#2a211a', '#161210', '#5f4630', '#c9a24a', '#8a8578', '#4a3423'];
  const womenDresses: readonly string[] = ['#e8618c', '#f2c14e', '#4fb0a5', '#e07a5f', '#6fa8dc', '#c94f84'];
  const menShirts: readonly string[] = ['#f5f2e8', '#cfe3ea', '#e8d8b0', '#b8c9d8', '#d9e6df', '#e6d690'];
  const menSlacks: readonly string[] = ['#5a6470', '#3e4a56', '#7a6f5a', '#4a5568', '#635a4e'];
  const spots: readonly (readonly [number, number, boolean])[] = [
    [-36, -1.2, true],
    [-30, -3.0, false],
    [-24, -1.4, false],
    [-19, -2.8, true],
    [-12, -1.2, false],
    [-6, -3.0, true],
    [-1, -1.3, false],
    [4, -2.9, true],
    [9, -1.2, false],
    [15, -3.0, true],
    [21, -1.4, false],
    [28, -2.8, true],
    [34, -1.2, false],
    [39, -2.9, true],
    [-20, -16.9, false],
    [-13, -18.5, true],
    [-5, -16.8, true],
    [2, -18.6, false],
    [30, -16.9, true],
    [37, -18.5, false],
  ];
  for (const [x, z, female] of spots) {
    addPedestrian(group, mats, {
      x,
      z,
      heading: rng() * Math.PI * 2,
      female,
      outfit: female ? pick(womenDresses) : pick(menShirts),
      bottoms: female ? '#e0aa7e' : pick(menSlacks),
      skin: pick(skinTones),
      hair: pick(hairColors),
    });
  }

  // Street furniture: cobra lamps, signal, shelter, booth, hydrant, mailbox, trees.
  for (const x of [-30, -6, 18, 42]) {
    addStreetLamp(group, mats, x, -1.3, -1);
  }
  for (const x of [-18, 6, 30]) {
    addStreetLamp(group, mats, x, -18.7, 1);
  }
  addTrafficSignal(group, mats, 15, -3.2);
  addBusShelter(group, mats, 2, NORTH_WALK_Z);
  addPhoneBooth(group, mats, 11.5, -1.3);
  addHydrant(group, mats, -26, -1.3);
  addMailbox(group, mats, -12, -18.4);
  addBench(group, mats, -9, -1.6, Math.PI);
  addBench(group, mats, -2, -18.4, 0);
  addTree(group, mats, 34, -1.3);
  addTree(group, mats, 44, -1.3);
  addTree(group, mats, -3, -18.9);

  return { id: ERA_1965_ID, group, audio: era1965Audio };
};
