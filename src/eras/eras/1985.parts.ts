import * as THREE from 'three';
import type { EraContext, InteractivePoint } from '../../types';
import { BLOCK, CURB, SIDEWALK, STREET } from '../../layout';

/**
 * 1985 era — procedural scene parts.
 *
 * Every mesh and texture in this module is generated procedurally so the repo
 * stays free of binary assets. All geometry is authored against the frozen
 * layout constants (BLOCK / STREET / SIDEWALK / CURB) so the block lines up
 * with the other eras.
 *
 * The module is fully headless-safe: canvas-backed textures are only produced
 * when a DOM is present (browser). In a node test environment `document` is
 * undefined and materials fall back to flat saturated colors, which is enough
 * for composition / content-count assertions.
 */

// ---------------------------------------------------------------------------
// Layout anchors
// ---------------------------------------------------------------------------
// The camera sits at +z looking north, so the block's south edge is the
// showcase "front". Buildings line that edge; a wide asphalt street with
// double-yellow lines runs in front of them; pedestrians use the sidewalk.
const SIDEWALK_Z0 = 56.0; // inner sidewalk edge (building side)
const SIDEWALK_Z1 = 60.0; // outer sidewalk edge (curb side)
const STREET_Z0 = SIDEWALK_Z1 + CURB.depth; // inner asphalt edge
const STREET_C = STREET_Z0 + STREET.width / 2; // double-yellow center line
const STREET_Z1 = STREET_Z0 + STREET.width;
const NEAR_LANE_Z = STREET_C - 4.6; // camera-side driving lane
const FAR_LANE_Z = STREET_C + 4.6; // far-side driving lane
const VEHICLE_X_MIN = -72.0;
const VEHICLE_X_MAX = 72.0;
const PED_X_MIN = -58.0;
const PED_X_MAX = 58.0;

// ---------------------------------------------------------------------------
// 80s saturated palette
// ---------------------------------------------------------------------------
export const PALETTE = Object.freeze({
  // Mirrored / glass curtain-wall tints.
  glass: Object.freeze([0x1e3a5f, 0x2b5f8e, 0x1a4b6e, 0x3a6b9f, 0x245a7d]),
  glassAccent: Object.freeze([0x4fd6f5, 0x9fe8ff, 0x6fc3e8]),
  // Neon tube colors.
  neon: Object.freeze([0xff2fd6, 0x00f0ff, 0xff00aa, 0x39ff14, 0xff9a00, 0x4dffdf, 0xff3366]),
  // Saturated billboard / poster primaries.
  billboard: Object.freeze([0xff0044, 0x00aaff, 0xffd500, 0x00ff88, 0xff6600, 0xcc00ff]),
  // Windbreaker brights.
  windbreaker: Object.freeze([0xff00b0, 0x00e5ff, 0xffe600, 0x00ff66, 0xff6a00, 0xb026ff]),
  denim: Object.freeze([0x245a8a, 0x1f4a78]),
  sneaker: Object.freeze([0xffffff, 0xffdddd, 0xddffdd]),
  asphalt: 0x2a2a2e,
  yellow: 0xf2d02a,
  white: 0xf4f4f4,
  concrete: 0x9a9a94,
  neonSignBack: 0x1a1a22,
  graffiti: Object.freeze([0xff2fd6, 0x00ffcc, 0xffe600, 0xff3300]),
});

// ---------------------------------------------------------------------------
// Stats / state
// ---------------------------------------------------------------------------
export interface Era1985Stats {
  buildings: number;
  curtainWallBuildings: number;
  storefronts: number;
  billboards: number;
  vehicles: number;
  buses: number;
  pedestrians: number;
  signals: number;
  planters: number;
  bollards: number;
  graffiti: number;
  interactivePoints: number;
  disposed: boolean;
}

export const emptyStats = (): Era1985Stats => ({
  buildings: 0,
  curtainWallBuildings: 0,
  storefronts: 0,
  billboards: 0,
  vehicles: 0,
  buses: 0,
  pedestrians: 0,
  signals: 0,
  planters: 0,
  bollards: 0,
  graffiti: 0,
  interactivePoints: 0,
  disposed: false,
});

/** A movable element (vehicle / pedestrian) driven by `update`. */
interface Animated {
  group: THREE.Group;
  axis: 'x' | 'z';
  speed: number;
  min: number;
  max: number;
  dir: 1 | -1;
}

export interface Era1985SceneState {
  /** Top-level group attached to the era scene root. */
  root: THREE.Group;
  stats: Era1985Stats;
  points: InteractivePoint[];
  animated: Animated[];
  textures: THREE.CanvasTexture[];
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------
const mat = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color });

/** Build a positioned box mesh with a name and attach it to a parent group. */
function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  name: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** A thin glowing neon tube (a bright emissive-looking thin box). */
function neonTube(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  name: string,
): THREE.Mesh {
  return box(parent, w, h, d, color, x, y, z, name);
}

/**
 * Procedurally draw a texture onto a canvas. Returns a CanvasTexture in a DOM
 * environment, or null in a headless node test so the scene still builds.
 */
function makeProceduralTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 128,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  return new THREE.CanvasTexture(canvas);
}

/** A box whose face uses a procedural texture when available. */
function texturedBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  fallback: number,
  x: number,
  y: number,
  z: number,
  name: string,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  textures: THREE.CanvasTexture[],
): THREE.Mesh {
  const texture = makeProceduralTexture(draw);
  const material = texture
    ? new THREE.MeshBasicMaterial({ map: texture })
    : new THREE.MeshBasicMaterial({ color: fallback });
  if (texture) textures.push(texture);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Draw a saturated poster with a bold hand-drawn title. */
function drawPoster(ctx: CanvasRenderingContext2D, size: number, title: string, bg: string, fg: string): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = fg;
  ctx.lineWidth = Math.max(2, size / 12);
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.max(10, size / 5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, size / 2, size / 2);
}

/** Draw a graffiti scribble. */
function drawGraffiti(ctx: CanvasRenderingContext2D, size: number, word: string, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size / 14);
  ctx.font = `bold ${Math.max(14, size / 4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(word, size / 2, size / 2);
  ctx.strokeText('!', size / 2 + size / 5, size / 2 + size / 8);
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------
interface BuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  glass: number;
  name: string;
}

/** A tall 80s commercial tower with a mirrored/glass curtain wall and retail base. */
function makeCurtainWallBuilding(
  parent: THREE.Object3D,
  spec: BuildingSpec,
  stats: Era1985Stats,
  textures: THREE.CanvasTexture[],
): THREE.Group {
  const g = new THREE.Group();
  g.name = `building-${spec.name}`;
  const zFront = spec.z + spec.depth / 2;

  // Main glass tower.
  box(g, spec.width, spec.height, spec.depth, spec.glass, spec.x, spec.height / 2, spec.z, `${spec.name}-tower`);
  // Vertical mullion stripes on the facade (facing the street / camera).
  const mullionCount = Math.max(4, Math.floor(spec.width / 3));
  const mullionSpacing = spec.width / mullionCount;
  for (let i = 0; i <= mullionCount; i++) {
    const mx = spec.x - spec.width / 2 + i * mullionSpacing;
    box(g, 0.25, spec.height, 0.15, 0xbfe4ff, mx, spec.height / 2, zFront + 0.02, `${spec.name}-mullion`);
  }
  // Horizontal floor-band accents.
  const bandCount = Math.max(3, Math.floor(spec.height / 12));
  for (let i = 1; i <= bandCount; i++) {
    const by = (spec.height / (bandCount + 1)) * i;
    box(g, spec.width, 0.2, 0.1, 0x9fe8ff, spec.x, by, zFront + 0.02, `${spec.name}-band`);
  }
  // Roof parapet.
  box(g, spec.width + 0.6, 1.2, spec.depth + 0.6, 0xcfd6dd, spec.x, spec.height + 0.6, spec.z, `${spec.name}-parapet`);
  // Side-wall graffiti accent.
  const graffitiColors = [PALETTE.graffiti[0], PALETTE.graffiti[1], PALETTE.graffiti[2], PALETTE.graffiti[3]];
  const gw = Math.min(5.0, spec.depth * 0.7);
  const gh = Math.min(4.0, spec.height * 0.12);
  const gx = spec.x + spec.width / 2 + 0.02;
  const gz = spec.z;
  const gy = Math.min(4.0, spec.height * 0.1) + gh / 2;
  texturedBox(
    g,
    0.2,
    gh,
    gw,
    graffitiColors[spec.name.length % graffitiColors.length],
    gx,
    gy,
    gz,
    `${spec.name}-graffiti`,
    (ctx, size) => drawGraffiti(ctx, size, '80s', '#ff2fd6'),
    textures,
  );
  stats.graffiti += 1;
  stats.buildings += 1;
  stats.curtainWallBuildings += 1;
  parent.add(g);
  return g;
}

/** Ground-floor retail storefront: glass front, neon fascia, hand-drawn posters. */
function makeStorefront(
  parent: THREE.Object3D,
  x: number,
  zFront: number,
  width: number,
  height: number,
  neon: number,
  kind: string,
  posterTitle: string,
  stats: Era1985Stats,
  textures: THREE.CanvasTexture[],
): THREE.Group {
  const g = new THREE.Group();
  g.name = `storefront-${kind}`;
  const depth = 1.4;
  const z = zFront - depth / 2;

  // Back wall / interior.
  box(g, width, height, depth, 0x15151c, x, height / 2, z, `${kind}-shell`);
  // Glass storefront window (front face).
  box(g, width * 0.94, height * 0.72, 0.12, 0x8fd8f0, x, height * 0.42, zFront - 0.06, `${kind}-glass`);
  // Neon fascia sign above the window.
  const fasciaH = Math.min(2.2, height * 0.22);
  box(g, width * 0.96, fasciaH, 0.5, PALETTE.neonSignBack, x, height - fasciaH / 2, zFront - 0.1, `${kind}-fascia`);
  neonTube(g, width * 0.8, fasciaH * 0.5, 0.1, neon, x, height - fasciaH * 0.55, zFront - 0.02, `${kind}-neon`);
  // Hand-drawn poster board in the window.
  const posterW = Math.min(3.4, width * 0.4);
  const posterH = Math.min(3.6, height * 0.45);
  texturedBox(
    g,
    posterW,
    posterH,
    0.1,
    neon,
    x,
    height * 0.42,
    zFront - 0.04,
    `${kind}-poster`,
    (ctx, size) => {
      const bg = ['#ff0044', '#00aaff', '#ffd500', '#00ff88'][kind.length % 4];
      drawPoster(ctx, size, posterTitle, bg, '#ffffff');
    },
    textures,
  );
  // Door frame.
  box(g, width * 0.14, height * 0.72, 0.2, 0x333a44, x - width * 0.36, height * 0.42, zFront - 0.1, `${kind}-door`);
  // Awning stripe accent above the door.
  box(g, width * 0.5, 0.35, 0.4, neon === PALETTE.neon[0] ? 0xffd500 : 0x39ff14, x - width * 0.1, height * 0.78, zFront - 0.12, `${kind}-awning`);

  stats.storefronts += 1;
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// Billboards
// ---------------------------------------------------------------------------
interface BillboardSpec {
  x: number;
  z: number;
  y: number;
  width: number;
  height: number;
  copy: string;
  colors: [string, string];
}

function makeBillboard(
  parent: THREE.Object3D,
  spec: BillboardSpec,
  stats: Era1985Stats,
  textures: THREE.CanvasTexture[],
): THREE.Group {
  const g = new THREE.Group();
  g.name = `billboard-${spec.copy}`;
  // Support posts.
  box(g, 0.5, spec.y, 0.5, 0x4a4f58, spec.x - spec.width * 0.36, spec.y / 2, spec.z, 'billboard-post-l');
  box(g, 0.5, spec.y, 0.5, 0x4a4f58, spec.x + spec.width * 0.36, spec.y / 2, spec.z, 'billboard-post-r');
  // Panel with saturated 80s copy.
  texturedBox(
    g,
    spec.width,
    spec.height,
    0.4,
    0xff0044,
    spec.x,
    spec.y + spec.height / 2,
    spec.z,
    'billboard-panel',
    (ctx, size) => {
      ctx.fillStyle = spec.colors[0];
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = spec.colors[1];
      ctx.font = `bold ${Math.max(10, size / 5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.copy, size / 2, size / 2);
    },
    textures,
  );
  // Neon tube rim around the panel.
  neonTube(g, spec.width + 0.3, 0.12, 0.12, 0xff2fd6, spec.x, spec.y + spec.height + 0.06, spec.z, 'billboard-neon-top');
  neonTube(g, spec.width + 0.3, 0.12, 0.12, 0xff2fd6, spec.x, spec.y - 0.06, spec.z, 'billboard-neon-bot');
  stats.billboards += 1;
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
export type VehicleKind = 'sedan' | 'hatchback' | 'van' | 'bus' | 'tram';

interface VehicleSpec {
  kind: VehicleKind;
  color: number;
  x: number;
  z: number;
  dir: 1 | -1;
  speed: number;
}

function buildVehicleMesh(vehicle: THREE.Group, kind: VehicleKind, color: number): void {
  const wheels = (xOff: number, zOff: number) => {
    box(vehicle, 0.4, 0.5, 0.4, 0x1a1a1c, xOff, 0.25, zOff, 'vehicle-wheel');
  };
  if (kind === 'bus' || kind === 'tram') {
    const len = kind === 'bus' ? 12.0 : 15.0;
    box(vehicle, 2.7, 2.6, len, color, 0, 1.3, 0, 'vehicle-body');
    box(vehicle, 2.7, 0.9, len, 0x9fe8ff, 0, 2.05, 0, 'vehicle-windowband');
    box(vehicle, 2.9, 0.5, len + 0.4, 0xcfd6dd, 0, 2.85, 0, 'vehicle-roof');
    for (const zz of [-len / 2 + 1.2, -len / 2 + 3.4, len / 2 - 1.2, len / 2 - 3.4]) wheels(0, zz);
    box(vehicle, 2.7, 0.6, 1.4, 0xff0044, 0, 2.0, len / 2 - 0.1, 'vehicle-destination');
    return;
  }
  if (kind === 'van') {
    box(vehicle, 2.0, 1.6, 4.6, color, 0, 0.8, 0, 'vehicle-body');
    box(vehicle, 2.0, 1.1, 2.6, 0xdfe6ee, 0, 1.35, 0.7, 'vehicle-cargo');
    box(vehicle, 1.9, 0.5, 1.6, 0x9fe8ff, 0, 1.15, -0.9, 'vehicle-cab');
    for (const zz of [-1.7, -0.6, 0.6, 1.7]) wheels(0, zz);
    return;
  }
  // sedan / hatchback
  const len = kind === 'sedan' ? 4.2 : 3.6;
  box(vehicle, 1.9, 0.7, len, color, 0, 0.35, 0, 'vehicle-body');
  const cabLen = kind === 'sedan' ? 2.1 : 2.4;
  const cabZ = kind === 'sedan' ? -0.2 : 0.1;
  box(vehicle, 1.7, 0.5, cabLen, 0xaee4ff, 0, 0.9, cabZ, 'vehicle-cabin');
  box(vehicle, 1.8, 0.25, len * 0.7, 0xdfe6ee, 0, 1.05, cabZ, 'vehicle-roofline');
  for (const zz of [-1.5, 1.5]) wheels(0, zz);
}

/** Build a reusable vehicle mesh into a group (used by the provider API). */
export function buildVehicleForProvider(group: THREE.Group, kind: VehicleKind, color: number): void {
  buildVehicleMesh(group, kind, color);
}

function makeVehicle(
  parent: THREE.Object3D,
  spec: VehicleSpec,
  stats: Era1985Stats,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `vehicle-${spec.kind}`;
  buildVehicleMesh(g, spec.kind, spec.color);
  g.position.set(spec.x, 0, spec.z);
  stats.vehicles += 1;
  if (spec.kind === 'bus' || spec.kind === 'tram') stats.buses += 1;
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// Pedestrians (80s fashion)
// ---------------------------------------------------------------------------
export interface OutfitVariant {
  id: string;
  windbreaker: number;
  stripe: number;
  denim: number;
  sneaker: number;
  hair: number;
  boombox: boolean;
}

export const OUTFIT_VARIANTS: readonly OutfitVariant[] = Object.freeze([
  { id: 'neon-pink', windbreaker: 0xff00b0, stripe: 0x00e5ff, denim: 0x245a8a, sneaker: 0xffffff, hair: 0x1a1a1a, boombox: true },
  { id: 'aqua', windbreaker: 0x00e5ff, stripe: 0xffe600, denim: 0x1f4a78, sneaker: 0xffdddd, hair: 0x332211, boombox: false },
  { id: 'yellow', windbreaker: 0xffe600, stripe: 0xff00b0, denim: 0x245a8a, sneaker: 0xffffff, hair: 0x883300, boombox: true },
  { id: 'green', windbreaker: 0x00ff66, stripe: 0x0044ff, denim: 0x1f4a78, sneaker: 0xddffdd, hair: 0x000000, boombox: false },
  { id: 'orange', windbreaker: 0xff6a00, stripe: 0x00ff88, denim: 0x245a8a, sneaker: 0xffffff, hair: 0x442200, boombox: false },
  { id: 'purple', windbreaker: 0xb026ff, stripe: 0x39ff14, denim: 0x1f4a78, sneaker: 0xffdddd, hair: 0x221111, boombox: true },
  { id: 'red', windbreaker: 0xff0044, stripe: 0xffd500, denim: 0x245a8a, sneaker: 0xffffff, hair: 0x000000, boombox: false },
  { id: 'teal', windbreaker: 0x00ffcc, stripe: 0xff6600, denim: 0x1f4a78, sneaker: 0xddffdd, hair: 0x553300, boombox: false },
]);

/** Build a blocky 80s pedestrian: windbreaker, denim, sneakers, optional boombox. */
function buildPedestrianMesh(ped: THREE.Group, outfit: OutfitVariant): void {
  const H = 1.75;
  // Legs (denim).
  box(ped, 0.22, 0.7, 0.24, outfit.denim, -0.14, H - 0.35, 0, 'ped-leg-l');
  box(ped, 0.22, 0.7, 0.24, outfit.denim, 0.14, H - 0.35, 0, 'ped-leg-r');
  // Sneakers.
  box(ped, 0.26, 0.14, 0.42, outfit.sneaker, -0.14, 0.07, 0.05, 'ped-shoe-l');
  box(ped, 0.26, 0.14, 0.42, outfit.sneaker, 0.14, 0.07, 0.05, 'ped-shoe-r');
  // Torso (windbreaker).
  box(ped, 0.5, 0.62, 0.32, outfit.windbreaker, 0, H - 0.31, 0, 'ped-torso');
  // Windbreaker stripe.
  box(ped, 0.52, 0.14, 0.34, outfit.stripe, 0, H - 0.52, 0, 'ped-stripe');
  // Arms.
  box(ped, 0.16, 0.5, 0.18, outfit.windbreaker, -0.34, H - 0.5, 0, 'ped-arm-l');
  box(ped, 0.16, 0.5, 0.18, outfit.windbreaker, 0.34, H - 0.5, 0, 'ped-arm-r');
  // Head + hair.
  box(ped, 0.3, 0.3, 0.3, 0xdfb48a, 0, H - 0.15, 0, 'ped-head');
  box(ped, 0.32, 0.1, 0.32, outfit.hair, 0, H + 0.05, 0, 'ped-hair');
  // Boombox on shoulder.
  if (outfit.boombox) {
    box(ped, 0.34, 0.22, 0.14, 0x2a2a2e, 0.36, H - 0.42, 0, 'ped-boombox');
    box(ped, 0.1, 0.1, 0.1, 0xff2fd6, 0.36, H - 0.36, 0, 'ped-boombox-speaker');
  }
}

interface PedestrianSpec {
  x: number;
  z: number;
  outfit: OutfitVariant;
  dir: 1 | -1;
  speed: number;
  axis: 'x' | 'z';
}

function makePedestrian(
  parent: THREE.Object3D,
  spec: PedestrianSpec,
  stats: Era1985Stats,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `pedestrian-${spec.outfit.id}`;
  buildPedestrianMesh(g, spec.outfit);
  g.position.set(spec.x, 0, spec.z);
  stats.pedestrians += 1;
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// Street furniture: road, signage, signals, planters, bollards
// ---------------------------------------------------------------------------
function makeRoad(parent: THREE.Object3D): void {
  const length = BLOCK.width + STREET.width * 2; // extends past the block
  // Asphalt.
  box(parent, length, 0.1, STREET.width, PALETTE.asphalt, 0, -0.05, STREET_C, 'asphalt');
  // Double-yellow center line.
  box(parent, length, 0.02, 0.22, PALETTE.yellow, 0, 0.001, STREET_C, 'double-yellow-l');
  box(parent, length, 0.02, 0.22, PALETTE.yellow, 0, 0.001, STREET_C + 0.32, 'double-yellow-r');
  // Lane edge dashes.
  for (const dz of [NEAR_LANE_Z - 2.2, NEAR_LANE_Z + 2.2, FAR_LANE_Z - 2.2, FAR_LANE_Z + 2.2]) {
    for (let dx = -length / 2 + 3; dx < length / 2 - 3; dx += 6) {
      box(parent, 2.6, 0.02, 0.16, PALETTE.white, dx, 0.001, dz, 'lane-dash');
    }
  }
  // Crosswalk stripes near the block corners.
  for (const cx of [-BLOCK.width / 2 + 3, BLOCK.width / 2 - 3]) {
    for (let dz = STREET_C - 1.6; dz <= STREET_C + 1.6; dz += 0.8) {
      box(parent, 0.5, 0.02, 0.6, PALETTE.white, cx, 0.001, dz, 'crosswalk');
    }
  }
  // Sidewalk slabs.
  box(parent, BLOCK.width + 8, 0.1, SIDEWALK.width, PALETTE.concrete, 0, SIDEWALK.height / 2, (SIDEWALK_Z0 + SIDEWALK_Z1) / 2, 'sidewalk');
  // Curb.
  box(parent, BLOCK.width + 8, CURB.height, CURB.depth, 0x8a8a86, 0, CURB.height / 2, SIDEWALK_Z1 + CURB.depth / 2, 'curb');
}

/** Highway-style overhead signage gantry over the street. */
function makeHighwaySign(parent: THREE.Object3D, stats: Era1985Stats, textures: THREE.CanvasTexture[]): void {
  const g = new THREE.Group();
  g.name = 'highway-sign';
  const span = BLOCK.width * 0.6;
  const y = 7.5;
  const z = STREET_C;
  // Gantry posts.
  box(g, 0.6, y, 0.6, 0x4a4f58, -span / 2, y / 2, z, 'highway-post-l');
  box(g, 0.6, y, 0.6, 0x4a4f58, span / 2, y / 2, z, 'highway-post-r');
  // Green sign panel with white legend.
  texturedBox(
    g,
    span,
    3.0,
    0.3,
    0x0a5a2a,
    0,
    y + 1.5,
    z,
    'highway-panel',
    (ctx, size) => {
      ctx.fillStyle = '#0a5a2a';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(8, size / 9)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOWNTOWN EXIT 14', size / 2, size / 2 - size / 8);
      ctx.fillText('NEON BLVD 2 MI', size / 2, size / 2 + size / 8);
    },
    textures,
  );
  stats.signals += 1;
  parent.add(g);
}

/** Traffic signal + pedestrian signal clusters at the corners. */
function makeSignals(parent: THREE.Object3D, stats: Era1985Stats): void {
  const corners = [
    { x: -BLOCK.width / 2 + 2, z: STREET_Z0 + 1.5 },
    { x: BLOCK.width / 2 - 2, z: STREET_Z0 + 1.5 },
    { x: -BLOCK.width / 2 + 2, z: STREET_Z1 - 1.5 },
    { x: BLOCK.width / 2 - 2, z: STREET_Z1 - 1.5 },
  ];
  for (const c of corners) {
    const g = new THREE.Group();
    g.name = 'signal-cluster';
    box(g, 0.35, 5.2, 0.35, 0x333a44, c.x, 2.6, c.z, 'signal-pole');
    // Traffic light head.
    box(g, 0.7, 1.9, 0.5, 0x1a1a1a, c.x, 4.5, c.z, 'traffic-head');
    neonTube(g, 0.5, 0.4, 0.1, 0xff0044, c.x, 5.3, c.z, 'traffic-red');
    neonTube(g, 0.5, 0.4, 0.1, 0xffaa00, c.x, 4.7, c.z, 'traffic-yellow');
    neonTube(g, 0.5, 0.4, 0.1, 0x39ff14, c.x, 4.1, c.z, 'traffic-green');
    // Pedestrian signal on a lower arm.
    box(g, 0.3, 0.9, 0.3, 0x1a1a1a, c.x + 1.1, 2.6, c.z + 0.4, 'ped-signal-head');
    neonTube(g, 0.2, 0.4, 0.1, 0xff0044, c.x + 1.1, 2.9, c.z + 0.4, 'ped-dont-walk');
    neonTube(g, 0.2, 0.4, 0.1, 0x39ff14, c.x + 1.1, 2.4, c.z + 0.4, 'ped-walk');
    parent.add(g);
    stats.signals += 1;
  }
}

function makePlantersAndBollards(parent: THREE.Object3D, stats: Era1985Stats): void {
  // Concrete planters along the sidewalk.
  const planterXs = [-44, -20, 4, 28, 52];
  for (const px of planterXs) {
    box(parent, 1.6, 0.9, 1.6, PALETTE.concrete, px, 0.45, SIDEWALK_Z0 + 0.9, 'planter');
    // Neon-tipped shrub.
    box(parent, 1.1, 0.7, 1.1, 0x1f6b2a, px, 1.25, SIDEWALK_Z0 + 0.9, 'planter-shrub');
    box(parent, 0.25, 0.5, 0.25, 0x39ff14, px + 0.3, 1.6, SIDEWALK_Z0 + 1.2, 'planter-neon-flower');
    stats.planters += 1;
  }
  // Metal bollards at the sidewalk edge.
  const bollardXs = [-52, -38, -26, -8, 10, 22, 40, 56];
  for (const bx of bollardXs) {
    box(parent, 0.4, 1.0, 0.4, 0x2b2f36, bx, 0.5, SIDEWALK_Z1 - 0.6, 'bollard');
    box(parent, 0.42, 0.16, 0.42, 0xffd500, bx, 1.05, SIDEWALK_Z1 - 0.6, 'bollard-cap');
    stats.bollards += 1;
  }
}

// ---------------------------------------------------------------------------
// Build / update / dispose
// ---------------------------------------------------------------------------
export function build1985Scene(ctx: EraContext): Era1985SceneState {
  const root = new THREE.Group();
  root.name = 'era-1985';
  const stats = emptyStats();
  const textures: THREE.CanvasTexture[] = [];
  const points: InteractivePoint[] = [];
  const animated: Animated[] = [];

  // --- Road + street furniture ---
  makeRoad(root);
  makeHighwaySign(root, stats, textures);
  makeSignals(root, stats);
  makePlantersAndBollards(root, stats);

  // --- Buildings (front showcase row, all curtain-wall) ---
  const frontSpecs: BuildingSpec[] = [
    { x: -48, z: 49, width: 14, depth: 14, height: 52, glass: PALETTE.glass[0], name: 'tower-a' },
    { x: -32, z: 49, width: 14, depth: 14, height: 44, glass: PALETTE.glass[1], name: 'tower-b' },
    { x: -16, z: 49, width: 14, depth: 14, height: 36, glass: PALETTE.glass[2], name: 'tower-c' },
    { x: 0, z: 49, width: 16, depth: 14, height: 58, glass: PALETTE.glass[3], name: 'tower-d' },
    { x: 16, z: 49, width: 14, depth: 14, height: 40, glass: PALETTE.glass[4], name: 'tower-e' },
    { x: 32, z: 49, width: 14, depth: 14, height: 48, glass: PALETTE.glass[0], name: 'tower-f' },
    { x: 48, z: 49, width: 14, depth: 14, height: 34, glass: PALETTE.glass[1], name: 'tower-g' },
  ];
  for (const spec of frontSpecs) {
    makeCurtainWallBuilding(root, spec, stats, textures);
  }

  // --- Storefronts at the base of select front buildings ---
  const zFront = 56.0;
  const storefronts: Array<{ x: number; width: number; height: number; neon: number; kind: string; poster: string }> = [
    { x: -32, width: 8, height: 6, neon: PALETTE.neon[0], kind: 'arcade', poster: 'PAC-MANIA' },
    { x: 0, width: 9, height: 6, neon: PALETTE.neon[1], kind: 'video-rental', poster: 'RENT 2 GET 1' },
    { x: 16, width: 8, height: 6, neon: PALETTE.neon[2], kind: 'music', poster: 'MIXTAPE' },
    { x: 32, width: 8, height: 6, neon: PALETTE.neon[3], kind: 'electronics', poster: 'STEREO BLOWOUT' },
  ];
  for (const s of storefronts) {
    makeStorefront(root, s.x, zFront, s.width, s.height, s.neon, s.kind, s.poster, stats, textures);
    points.push({
      id: `storefront-${s.kind}`,
      position: new THREE.Vector3(s.x, 3, zFront - 0.6),
      label: `${s.kind.replace('-', ' ')} storefront`,
    });
  }

  // --- Billboards on rooftops ---
  const billboards: BillboardSpec[] = [
    { x: -48, z: 42, y: 54, width: 11, height: 7, copy: 'NEON CITY', colors: ['#ff0044', '#ffffff'] },
    { x: 48, z: 42, y: 36, width: 11, height: 7, copy: 'VIDEO GAMES', colors: ['#00aaff', '#ffffff'] },
    { x: 0, z: 34, y: 60, width: 12, height: 7, copy: 'TOTAL RECALL', colors: ['#ffd500', '#000000'] },
  ];
  for (const b of billboards) {
    makeBillboard(root, b, stats, textures);
    points.push({
      id: `billboard-${b.copy}`,
      position: new THREE.Vector3(b.x, b.y + b.height / 2, b.z),
      label: `${b.copy} billboard`,
    });
  }

  // --- Vehicles on the street ---
  const vehicleSpecs: VehicleSpec[] = [
    { kind: 'sedan', color: 0xff0044, x: -40, z: NEAR_LANE_Z, dir: 1, speed: 4.0 },
    { kind: 'hatchback', color: 0x00aaff, x: -18, z: NEAR_LANE_Z, dir: 1, speed: 3.2 },
    { kind: 'sedan', color: 0x2a2a2e, x: 30, z: NEAR_LANE_Z, dir: -1, speed: 3.6 },
    { kind: 'van', color: 0xcfd6dd, x: 8, z: FAR_LANE_Z, dir: -1, speed: 2.6 },
    { kind: 'sedan', color: 0xffd500, x: -52, z: FAR_LANE_Z, dir: -1, speed: 3.0 },
    { kind: 'bus', color: 0xff6600, x: 20, z: FAR_LANE_Z, dir: 1, speed: 2.0 },
    { kind: 'tram', color: 0x00c8c8, x: -6, z: FAR_LANE_Z, dir: 1, speed: 2.4 },
  ];
  for (const v of vehicleSpecs) {
    makeVehicle(root, v, stats);
    animated.push({ group: root.children[root.children.length - 1] as THREE.Group, axis: 'x', speed: v.speed, min: VEHICLE_X_MIN, max: VEHICLE_X_MAX, dir: v.dir });
  }

  // --- Pedestrians on the sidewalk ---
  const pedSpecs: PedestrianSpec[] = [
    { x: -48, z: 58.4, outfit: OUTFIT_VARIANTS[0], dir: 1, speed: 0.9, axis: 'x' },
    { x: -32, z: 58.6, outfit: OUTFIT_VARIANTS[1], dir: -1, speed: 0.7, axis: 'x' },
    { x: -12, z: 58.4, outfit: OUTFIT_VARIANTS[2], dir: 1, speed: 1.0, axis: 'x' },
    { x: 4, z: 58.6, outfit: OUTFIT_VARIANTS[3], dir: -1, speed: 0.8, axis: 'x' },
    { x: 20, z: 58.4, outfit: OUTFIT_VARIANTS[4], dir: 1, speed: 0.7, axis: 'x' },
    { x: 36, z: 58.6, outfit: OUTFIT_VARIANTS[5], dir: -1, speed: 0.9, axis: 'x' },
    { x: 50, z: 58.4, outfit: OUTFIT_VARIANTS[6], dir: 1, speed: 0.6, axis: 'x' },
    { x: -20, z: 59.0, outfit: OUTFIT_VARIANTS[7], dir: 1, speed: 0.5, axis: 'z' },
    { x: 28, z: 59.0, outfit: OUTFIT_VARIANTS[0], dir: -1, speed: 0.5, axis: 'z' },
  ];
  for (const p of pedSpecs) {
    makePedestrian(root, p, stats);
    const group = root.children[root.children.length - 1] as THREE.Group;
    if (p.axis === 'x') {
      animated.push({ group, axis: 'x', speed: p.speed, min: PED_X_MIN, max: PED_X_MAX, dir: p.dir });
    } else {
      animated.push({ group, axis: 'z', speed: p.speed, min: SIDEWALK_Z0 + 0.4, max: SIDEWALK_Z1 - 0.4, dir: p.dir });
    }
  }

  // --- Interactive points for landmarks ---
  points.push({
    id: 'tower-d-main',
    position: new THREE.Vector3(0, 30, 49),
    label: 'Neon Plaza Tower',
  });
  points.push({
    id: 'highway-gantry',
    position: new THREE.Vector3(0, 9, STREET_C),
    label: 'Downtown highway signage',
  });

  stats.interactivePoints = points.length;

  const state: Era1985SceneState = {
    root,
    stats,
    points,
    animated,
    textures,
  };
  ctx.scene.add(root);
  return state;
}

export function update1985Scene(state: Era1985SceneState, delta: number): void {
  for (const a of state.animated) {
    const pos = a.group.position;
    let next = (a.axis === 'x' ? pos.x : pos.z) + a.dir * a.speed * delta;
    if (next > a.max) {
      next = a.min + (next - a.max);
      a.dir = -1;
    } else if (next < a.min) {
      next = a.max - (a.min - next);
      a.dir = 1;
    }
    if (a.axis === 'x') pos.x = next;
    else pos.z = next;
  }
}

export function dispose1985Scene(state: Era1985SceneState): void {
  for (const texture of state.textures) {
    try {
      texture.dispose();
    } catch {
      // Texture may already be disposed; ignore.
    }
  }
  state.textures.length = 0;
  state.animated.length = 0;
  state.points.length = 0;
  // Detach the root from its parent scene graph.
  if (state.root.parent) {
    state.root.parent.remove(state.root);
  }
  state.stats.disposed = true;
}

// ---------------------------------------------------------------------------
// Providers handed to the simulation / main integration
// ---------------------------------------------------------------------------
export interface VehicleMeshProvider {
  id: string;
  kind: VehicleKind;
  color: number;
  /** Build the vehicle mesh into the given group (positioned at origin). */
  build: (group: THREE.Group) => void;
}

export interface Era1985Providers {
  era: '1985';
  outfitVariants: readonly OutfitVariant[];
  vehicleProviders: readonly VehicleMeshProvider[];
  getStats: () => Era1985Stats | null;
}