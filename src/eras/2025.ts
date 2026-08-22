import * as THREE from 'three';

/**
 * Era module: 2025 — "Electric Present".
 *
 * Procedural contemporary city block profile built entirely from three.js
 * primitives plus canvas-drawn textures (no model or texture downloads):
 *  - Layer 1 (buildings): a tall glass tower with rooftop solar array and
 *    roof garden, flanked by contemporary mixed-use podium towers with
 *    bronze accents, over a lit background skyline.
 *  - Layer 2 (storefronts): modern retail row — minimalist café, EV/mobility
 *    brand store, grocery market and electronics studio — each fronted by a
 *    high-resolution animated LED display.
 *  - Layer 3 (advertising): a flush-mounted LED billboard on the hero tower,
 *    a double-sided street pylon board with scrolling ticker, and shimmering
 *    media-facade strips plus a podium light band.
 *  - Layer 4 (vehicles): sleek EV sedans cruising both lanes plus an
 *    autonomous shuttle pod that dwells at its marked curbside stop;
 *    aero-covered wheels roll with travel speed.
 *  - Layer 5 (pedestrians): contemporary walkers in athleisure palettes with
 *    wireless earbuds and glowing phones; several idle checking devices.
 *  - Layer 6 (street furniture): smart streetlights with pulsing sensor pods,
 *    slim traffic signals, an EV charging plaza with a plugged-in car, a
 *    bike-share dock, parked e-scooters, benches, planters, bins and bus
 *    shelters with digital arrivals panels.
 * Two quadcopter drones fly looping overhead circuits above it all.
 *
 * Animation state lives in `group.userData.era2025` so `update(dt, group)`
 * stays instance-safe; `update(dt)` after `buildEra2025()` also works.
 * Polygon budget: boxes plus low-segment cylinders/spheres/tori keep the
 * block far below the ~50k triangle target (~20k triangles assembled).
 */

type Dir = 1 | -1;

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

const AVENUE_LENGTH = 96;
const HALF_LEN = AVENUE_LENGTH / 2;
const ROAD_HALF_W = 6.4;
const WALK_INNER = ROAD_HALF_W + 0.25;
const WALK_OUTER = WALK_INNER + 4;
/** Building/podium streetwall face, flush with the outer sidewalk edge. */
const FACE_X = WALK_OUTER;
const PODIUM_DEPTH = 7;
const CURB_H = 0.28;
const SIDEWALK_TOP = 0.15;
const CAR_WRAP_Z = 46;
const WALKER_WRAP_Z = 21;
const WALKER_X = 7.85;
const CROSSWALK_HALF = 7.2;
const SIGNAL_PERIOD = 8.5;
const HIP_Y = 0.86;
const BIKE_LANE_W = 1.7;
/** Curbside z where the autonomous shuttle dwells at its stop. */
const SHUTTLE_STOP_Z = 14;

/* ------------------------------------------------------------------ */
/* Runtime state                                                       */
/* ------------------------------------------------------------------ */

interface CarRuntime {
  group: THREE.Group;
  dirZ: Dir;
  speed: number;
  wheels: THREE.Object3D[];
  wheelRadius: number;
}

interface ShuttleRuntime {
  group: THREE.Group;
  dirZ: Dir;
  baseSpeed: number;
  speed: number;
  wheels: THREE.Object3D[];
  wheelRadius: number;
  mode: 'cruise' | 'dwell';
  dwellLeft: number;
}

interface WalkerParts {
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Mesh;
}

interface WalkerRuntime {
  group: THREE.Group;
  parts: WalkerParts;
  dirZ: Dir;
  speed: number;
  phase: number;
  seed: number;
  curY: number;
  phone: boolean;
  idle: boolean;
}

interface SignalRuntime {
  red: THREE.MeshStandardMaterial;
  yellow: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
  offset: number;
}

interface ScreenRuntime {
  material: THREE.MeshBasicMaterial;
  frames: THREE.Texture[];
  period: number;
  phase: number;
  current: number;
}

interface TickerRuntime {
  texture: THREE.Texture | null;
  speed: number;
}

interface PulseRuntime {
  material: THREE.MeshStandardMaterial;
  base: number;
  amp: number;
  rate: number;
  seed: number;
}

interface DroneRuntime {
  pivot: THREE.Group;
  rotors: THREE.Object3D[];
  angularSpeed: number;
  phase: number;
  baseY: number;
  bobAmp: number;
  bobRate: number;
}

interface Era2025State {
  elapsed: number;
  cars: CarRuntime[];
  shuttles: ShuttleRuntime[];
  drones: DroneRuntime[];
  walkers: WalkerRuntime[];
  signals: SignalRuntime[];
  screens: ScreenRuntime[];
  tickers: TickerRuntime[];
  pulses: PulseRuntime[];
  walkersRoot: THREE.Group;
  shuttleRoot: THREE.Group;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function std(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, ...params });
}

function basic(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

function boxAt(
  parent: THREE.Object3D,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylAt(
  parent: THREE.Object3D,
  mat: THREE.Material,
  rTop: number,
  rBottom: number,
  h: number,
  seg: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function sphereAt(
  parent: THREE.Object3D,
  mat: THREE.Material,
  r: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function torusAt(
  parent: THREE.Object3D,
  mat: THREE.Material,
  radius: number,
  tube: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 14), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Deterministic LCG so every rebuild is identical. */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * Draws onto a CanvasTexture. Returns null when DOM canvas is unavailable
 * (node-side smoke tests) so callers can fall back to flat materials.
 */
function canvasTexture(w: number, h: number, draw: Draw): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx, w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */

/** Cool high-performance glass curtain wall: dense mullion grid, lit offices. */
function makeCurtainWallMaterial(cols: number, rows: number, seedNum: number): THREE.MeshStandardMaterial {
  const rng = createRng(seedNum);
  const panes = ['#a9c9d8', '#8db3c4', '#7197ab', '#bcd6e0', '#5d8496', '#93b9c8'];
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#232b33';
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const lit = rng() < 0.26;
        ctx.fillStyle = lit ? '#eaf4ff' : panes[Math.floor(rng() * panes.length)];
        ctx.fillRect(c * cw + 1.5, r * ch + 1.5, cw - 3, ch - 3);
      }
    }
  });
  if (!texture) {
    return std({ color: 0x7fa5b5, metalness: 0.7, roughness: 0.22 });
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.34,
    metalness: 0.68,
    roughness: 0.2,
  });
}

/** Sparse cool window grid for the background skyline. */
function makeWindowGridMaterial(seedNum: number): THREE.MeshStandardMaterial {
  const rng = createRng(seedNum);
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#33383f';
    ctx.fillRect(0, 0, w, h);
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 8; r++) {
        ctx.fillStyle = rng() < 0.34 ? '#eef6ff' : '#4c545e';
        ctx.fillRect(c * 16 + 3, r * 16 + 3, 10, 10);
      }
    }
  });
  if (!texture) {
    return std({ color: 0x464d56 });
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.24,
    roughness: 0.8,
  });
}

/** LED-backlit channel-letter sign band above a storefront. */
function makeLedSignMaterial(text: string, bg: number, fg: number): THREE.MeshStandardMaterial {
  const texture = canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(fg);
    ctx.font = `bold ${Math.min(64, (w * 0.9) / Math.max(text.length * 0.62, 1))}px Arial, Helvetica, sans-serif`;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
  if (!texture) {
    return std({ color: bg, emissive: new THREE.Color(bg), emissiveIntensity: 0.95 });
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: texture,
    emissiveIntensity: 1.25,
    roughness: 0.45,
  });
}

type DisplayMotif = 'leaf' | 'bolt' | 'dots' | 'bars';

/** One high-res storefront LED display frame (2025-era branding). */
function makeDisplayFrameTexture(
  headline: string,
  sub: string,
  bg: string,
  fg: string,
  accent: string,
  motif: DisplayMotif,
): THREE.Texture | null {
  return canvasTexture(768, 384, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Motif art keeps every brand's screen distinct at a glance.
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = accent;
    if (motif === 'leaf') {
      ctx.beginPath();
      ctx.ellipse(w * 0.82, h * 0.32, 90, 52, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.72, h * 0.55, 60, 34, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (motif === 'bolt') {
      ctx.beginPath();
      ctx.moveTo(w * 0.78, h * 0.12);
      ctx.lineTo(w * 0.62, h * 0.55);
      ctx.lineTo(w * 0.74, h * 0.55);
      ctx.lineTo(w * 0.66, h * 0.88);
      ctx.lineTo(w * 0.9, h * 0.42);
      ctx.lineTo(w * 0.76, h * 0.42);
      ctx.closePath();
      ctx.fill();
    } else if (motif === 'dots') {
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 === 0 ? accent : '#ffffff';
        ctx.beginPath();
        ctx.arc(w * (0.66 + (i % 4) * 0.09), h * (0.24 + Math.floor(i / 4) * 0.16), 17, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(w * (0.64 + i * 0.06), h * 0.18 + (i % 2) * 30, 22, 130 - (i % 2) * 40);
      }
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.min(84, (w * 0.56) / Math.max(headline.length * 0.58, 1))}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = fg;
    ctx.fillText(headline, 42, h * 0.36);
    ctx.font = 'bold 38px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, 44, h * 0.68);
    ctx.fillStyle = accent;
    ctx.fillRect(42, h * 0.78, 180, 10);
  });
}

/** One digital-billboard advertising frame. */
function makeAdFrameTexture(headline: string, sub: string, bg: number, fg: number): THREE.Texture | null {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, 0, w, 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(fg);
    ctx.font = `bold ${Math.min(76, (w * 0.86) / Math.max(headline.length * 0.58, 1))}px Arial, Helvetica, sans-serif`;
    ctx.fillText(headline, w / 2, h * 0.4);
    ctx.font = 'bold 32px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, w / 2, h * 0.74);
  });
}

/** Horizontally tiling ticker strip for LED screens. */
function makeTickerMaterial(text: string, bg: number, fg: number): {
  material: THREE.MeshBasicMaterial;
  texture: THREE.Texture | null;
} {
  const texture = canvasTexture(1024, 96, (ctx, w, h) => {
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(fg);
    ctx.font = 'bold 50px Arial, Helvetica, sans-serif';
    ctx.fillText(text, 8, h / 2 + 2);
    ctx.fillText(text, w / 2 + 8, h / 2 + 2);
  });
  if (!texture) {
    return { material: basic(0x04121e), texture: null };
  }
  texture.wrapS = THREE.RepeatWrapping;
  return { material: new THREE.MeshBasicMaterial({ map: texture }), texture };
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

interface MaterialSet {
  asphalt: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  plaza: THREE.MeshStandardMaterial;
  bikeGreen: THREE.MeshStandardMaterial;
  paintWhite: THREE.MeshStandardMaterial;
  precastLight: THREE.MeshStandardMaterial;
  precastWarm: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  aluminum: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  shopGlass: THREE.MeshStandardMaterial;
  interiorWarm: THREE.MeshBasicMaterial;
  interiorCool: THREE.MeshBasicMaterial;
  tire: THREE.MeshStandardMaterial;
  rimAero: THREE.MeshStandardMaterial;
  vehicleGlass: THREE.MeshStandardMaterial;
  taillight: THREE.MeshStandardMaterial;
  lightBar: THREE.MeshStandardMaterial;
  signalBox: THREE.MeshStandardMaterial;
  backplate: THREE.MeshStandardMaterial;
  seatSlat: THREE.MeshStandardMaterial;
  planterWood: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  foliageRoof: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  solar: THREE.MeshStandardMaterial;
  solarFrame: THREE.MeshStandardMaterial;
  sensorPod: THREE.MeshStandardMaterial;
  sensorLed: THREE.MeshStandardMaterial;
  chargeGreen: THREE.MeshStandardMaterial;
  phoneGlow: THREE.MeshStandardMaterial;
  earbud: THREE.MeshStandardMaterial;
  sneaker: THREE.MeshStandardMaterial;
  droneBody: THREE.MeshStandardMaterial;
  rotorDisc: THREE.MeshStandardMaterial;
  navRed: THREE.MeshStandardMaterial;
  navGreen: THREE.MeshStandardMaterial;
}

function createMaterials(): MaterialSet {
  return {
    asphalt: std({ color: 0x303339, roughness: 0.96 }),
    curb: std({ color: 0xbdbab1, roughness: 0.9 }),
    sidewalk: std({ color: 0xcbc8bf, roughness: 0.92 }),
    plaza: std({ color: 0xb0ada3, roughness: 0.94 }),
    bikeGreen: std({ color: 0x2e7d5b, roughness: 0.9 }),
    paintWhite: std({ color: 0xeae8e0, roughness: 0.65 }),
    precastLight: std({ color: 0xe3ddd2, roughness: 0.82 }),
    precastWarm: std({ color: 0xcbb9a2, roughness: 0.85 }),
    darkMetal: std({ color: 0x353a41, metalness: 0.6, roughness: 0.42 }),
    aluminum: std({ color: 0xd3d8dc, metalness: 0.82, roughness: 0.3 }),
    bronze: std({ color: 0xa98a5f, metalness: 0.75, roughness: 0.35 }),
    shopGlass: std({ color: 0xa8ccd6, metalness: 0.45, roughness: 0.1, transparent: true, opacity: 0.34 }),
    interiorWarm: basic(0xffe6ba),
    interiorCool: basic(0xcfeaff),
    tire: std({ color: 0x1b1d1f, roughness: 0.95 }),
    rimAero: std({ color: 0xbfc6cc, metalness: 0.85, roughness: 0.3 }),
    vehicleGlass: std({ color: 0x27333c, metalness: 0.6, roughness: 0.08, transparent: true, opacity: 0.72 }),
    taillight: std({ color: 0x7c1616, emissive: new THREE.Color(0xff3028), emissiveIntensity: 1.4 }),
    lightBar: std({ color: 0xffffff, emissive: new THREE.Color(0xf2fbff), emissiveIntensity: 2.1 }),
    signalBox: std({ color: 0x2a2e33, roughness: 0.7 }),
    backplate: std({ color: 0x1c1e21, roughness: 0.8 }),
    seatSlat: std({ color: 0x8a6f4d, roughness: 0.85 }),
    planterWood: std({ color: 0x9a7a54, roughness: 0.9 }),
    foliage: std({ color: 0x4f7040, roughness: 0.95 }),
    foliageRoof: std({ color: 0x5d8a4a, roughness: 0.95 }),
    trunk: std({ color: 0x59452f, roughness: 0.95 }),
    solar: std({ color: 0x14263f, metalness: 0.65, roughness: 0.25 }),
    solarFrame: std({ color: 0x9aa4ad, metalness: 0.8, roughness: 0.35 }),
    sensorPod: std({ color: 0x22262b, metalness: 0.5, roughness: 0.5 }),
    sensorLed: std({ color: 0x0e3f46, emissive: new THREE.Color(0x35e0d6), emissiveIntensity: 1.4 }),
    chargeGreen: std({ color: 0x0e4d2c, emissive: new THREE.Color(0x39e07a), emissiveIntensity: 1.5 }),
    phoneGlow: std({ color: 0xaee0ff, emissive: new THREE.Color(0xaee0ff), emissiveIntensity: 1.0 }),
    earbud: std({ color: 0xf4f4f2, roughness: 0.5 }),
    sneaker: std({ color: 0xf2f2ef, roughness: 0.7 }),
    droneBody: std({ color: 0x2c3138, metalness: 0.6, roughness: 0.4 }),
    rotorDisc: std({ color: 0x3a4149, transparent: true, opacity: 0.4, roughness: 0.4 }),
    navRed: std({ color: 0x5a1010, emissive: new THREE.Color(0xff3028), emissiveIntensity: 1.6 }),
    navGreen: std({ color: 0x105a20, emissive: new THREE.Color(0x2aff5a), emissiveIntensity: 1.6 }),
  };
}

/* ------------------------------------------------------------------ */
/* Layer 4: vehicles — EV sedans + autonomous shuttle                  */
/* ------------------------------------------------------------------ */

function addWheel(parent: THREE.Object3D, mats: MaterialSet, x: number, y: number, z: number, radius: number): THREE.Object3D {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.28, 10), mats.tire);
  tire.rotation.z = Math.PI / 2;
  wheel.add(tire);
  // Flush aero cover instead of spokes — the 2020s EV tell.
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.31, 10), mats.rimAero);
  cover.rotation.z = Math.PI / 2;
  wheel.add(cover);
  wheel.position.set(x, y, z);
  parent.add(wheel);
  return wheel;
}

function buildEvSedan(mats: MaterialSet, paint: number): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const g = new THREE.Group();
  const body = std({ color: paint, metalness: 0.55, roughness: 0.3 });
  // Low cab-forward monobox: long smooth deck, fastback glass, no grille.
  boxAt(g, body, 1.84, 0.48, 4.5, 0, 0.68, 0);
  boxAt(g, mats.vehicleGlass, 1.68, 0.5, 2.7, 0, 1.16, -0.25);
  boxAt(g, body, 1.6, 0.07, 2.8, 0, 1.43, -0.25);
  // Full-width light bars front and rear.
  boxAt(g, mats.lightBar, 1.7, 0.07, 0.06, 0, 0.92, 2.27);
  boxAt(g, mats.taillight, 1.72, 0.08, 0.06, 0, 0.94, -2.27);
  // Sealed smooth bumpers + rocker.
  boxAt(g, body, 1.86, 0.16, 0.12, 0, 0.52, 2.24);
  boxAt(g, body, 1.86, 0.16, 0.12, 0, 0.52, -2.24);
  boxAt(g, mats.darkMetal, 1.88, 0.08, 3.4, 0, 0.44, 0);
  // Camera nubs instead of mirrors.
  boxAt(g, mats.darkMetal, 0.08, 0.07, 0.1, -0.94, 1.02, 0.9);
  boxAt(g, mats.darkMetal, 0.08, 0.07, 0.1, 0.94, 1.02, 0.9);
  const wheels = [
    addWheel(g, mats, -0.82, 0.36, 1.5, 0.36),
    addWheel(g, mats, 0.82, 0.36, 1.5, 0.36),
    addWheel(g, mats, -0.82, 0.36, -1.5, 0.36),
    addWheel(g, mats, 0.82, 0.36, -1.5, 0.36),
  ];
  return { group: g, wheels };
}

function buildShuttle(state: Era2025State, mats: MaterialSet, dirZ: Dir): void {
  const g = new THREE.Group();
  const bodyMat = std({ color: 0xf2f5f7, roughness: 0.45, metalness: 0.25 });
  // Boxy one-volume pod.
  boxAt(g, bodyMat, 2.1, 1.15, 4.6, 0, 0.92, 0);
  // Livery bands on the long sides (plain body avoids texture smear).
  const liveryMat = makeLedSignMaterial('AUTONOMOUS · 6 RIDERS', 0xf2f5f7, 0x0e7c86);
  for (const sz of [-1, 1]) {
    boxAt(g, liveryMat, 1.9, 0.5, 0.06, 0, 1.0, sz * 2.32);
  }
  // Wrap-around glazing band with a bright interior behind it.
  boxAt(g, mats.vehicleGlass, 2.12, 0.72, 3.9, 0, 1.83, 0.05);
  boxAt(g, mats.interiorCool, 1.7, 0.6, 3.4, 0, 1.78, 0.05);
  boxAt(g, bodyMat, 2.0, 0.16, 4.0, 0, 2.24, 0.05);
  // Roof sensor puck + dome lidar + antenna blade.
  cylAt(g, mats.sensorPod, 0.2, 0.24, 0.16, 10, 0, 2.4, -0.4);
  sphereAt(g, mats.darkMetal, 0.13, 0, 2.52, -0.4);
  boxAt(g, mats.sensorPod, 0.3, 0.1, 0.5, 0, 2.36, 0.9);
  // Front/rear light bars + door seam lines.
  boxAt(g, mats.lightBar, 1.9, 0.08, 0.06, 0, 1.1, 2.32);
  boxAt(g, mats.taillight, 1.9, 0.08, 0.06, 0, 1.1, -2.32);
  boxAt(g, mats.darkMetal, 0.03, 1.0, 0.03, 1.06, 0.92, 0.35);
  boxAt(g, mats.darkMetal, 0.03, 1.0, 0.03, 1.06, 0.92, -1.55);
  const wheels = [
    addWheel(g, mats, -0.95, 0.38, 1.55, 0.38),
    addWheel(g, mats, 0.95, 0.38, 1.55, 0.38),
    addWheel(g, mats, -0.95, 0.38, -1.55, 0.38),
    addWheel(g, mats, 0.95, 0.38, -1.55, 0.38),
  ];
  g.position.set(dirZ === 1 ? 3.9 : -3.9, 0, dirZ === 1 ? -CAR_WRAP_Z * 0.3 : CAR_WRAP_Z * 0.3);
  g.rotation.y = dirZ === 1 ? 0 : Math.PI;
  state.shuttleRoot.add(g);
  state.shuttles.push({
    group: g,
    dirZ,
    baseSpeed: 4.2,
    speed: 4.2,
    wheels,
    wheelRadius: 0.38,
    mode: 'cruise',
    dwellLeft: 0,
  });
}

function buildVehicles(state: Era2025State, mats: MaterialSet, root: THREE.Group, rng: () => number): void {
  // Calm electric-era palette: whites, silvers, muted blues/greens.
  const paints = [0xf0f3f5, 0x22262b, 0x3d6ea5, 0x9aa3ab, 0x37655a, 0xe4e7ea, 0x5a6470, 0x274a72];
  for (let i = 0; i < 8; i++) {
    const dirZ: Dir = i % 2 === 0 ? 1 : -1;
    const kind = buildEvSedan(mats, paints[i]);
    kind.group.position.set(dirZ === 1 ? 1.7 : -1.7, 0, ((i + 0.5) / 8 * 2 - 1) * CAR_WRAP_Z);
    kind.group.rotation.y = dirZ === 1 ? 0 : Math.PI;
    root.add(kind.group);
    state.cars.push({
      group: kind.group,
      dirZ,
      speed: 6.5 + rng() * 3,
      wheels: kind.wheels,
      wheelRadius: 0.36,
    });
  }
  buildShuttle(state, mats, 1);
}

/* ------------------------------------------------------------------ */
/* Layer 5: pedestrians — contemporary fashion                          */
/* ------------------------------------------------------------------ */

interface WalkerSpec {
  x: number;
  z: number;
  faceYaw: number;
  dirZ: Dir;
  phone: boolean;
  idle: boolean;
}

function buildWalker(state: Era2025State, mats: MaterialSet, spec: WalkerSpec, rng: () => number): void {
  // Athleisure palette: joggers, earth tones, soft pastels.
  const jogger = [0x4a5560, 0x6b7b8c, 0x3c4a44][Math.floor(rng() * 3)];
  const pants = rng() < 0.6 ? jogger : [0x8c8474, 0x2e3236, 0x5c5346][Math.floor(rng() * 3)];
  const puffer = rng() < 0.4;
  const top = puffer
    ? [0x37424e, 0x7c4436, 0x44584e][Math.floor(rng() * 3)]
    : [0xe4dfd3, 0xc46a55, 0x51687a, 0x8d97a5, 0xa9b39c][Math.floor(rng() * 5)];
  const skin = [0xf1c9a5, 0xd9a06b, 0xb97e52, 0x8d5a3b, 0xefd7b8][Math.floor(rng() * 5)];
  const hair = [0x241f1a, 0x4a3524, 0x777268, 0x171310][Math.floor(rng() * 4)];

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legMat = std({ color: pants, roughness: 0.9 });
  const topMat = std({ color: top, roughness: 0.9 });
  const skinMat = std({ color: skin, roughness: 0.75 });

  const makeLimb = (x: number, y: number, r: number, len: number, mat: THREE.Material): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 8), mat);
    mesh.position.y = -len / 2;
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  };

  const legL = makeLimb(-0.13, HIP_Y, 0.09, 0.86, legMat);
  const legR = makeLimb(0.13, HIP_Y, 0.09, 0.86, legMat);
  // Chunky sneakers.
  boxAt(legL, mats.sneaker, 0.18, 0.1, 0.34, 0, -0.84, 0.06);
  boxAt(legR, mats.sneaker, 0.18, 0.1, 0.34, 0, -0.84, 0.06);

  boxAt(body, topMat, 0.46, 0.62, 0.26, 0, HIP_Y + 0.31, 0);
  if (puffer) {
    // Quilted vest bulge over the torso.
    boxAt(body, topMat, 0.52, 0.4, 0.32, 0, HIP_Y + 0.42, 0);
  }
  const armL = makeLimb(-0.29, HIP_Y + 0.56, 0.065, 0.64, topMat);
  const armR = makeLimb(0.29, HIP_Y + 0.56, 0.065, 0.64, topMat);

  const head = sphereAt(body, skinMat, 0.155, 0, HIP_Y + 0.78, 0);
  // Hair cap.
  const hairCap = sphereAt(body, std({ color: hair }), 0.165, 0, HIP_Y + 0.83, -0.01);
  hairCap.scale.set(1, 0.62, 1);
  // Wireless earbuds.
  sphereAt(body, mats.earbud, 0.032, -0.14, HIP_Y + 0.79, 0.02);
  sphereAt(body, mats.earbud, 0.032, 0.14, HIP_Y + 0.79, 0.02);
  if (rng() < 0.35) {
    // Crossbody strap.
    const strap = boxAt(body, std({ color: 0x2e2a24 }), 0.08, 0.7, 0.05, 0.06, HIP_Y + 0.42, 0.15);
    strap.rotation.z = 0.5;
  }

  if (spec.phone) {
    // Glowing smartphone held up in front of the face.
    boxAt(armR, mats.phoneGlow, 0.09, 0.17, 0.02, 0, -0.6, 0.15);
  }

  root.position.set(spec.x, SIDEWALK_TOP, spec.z);
  root.rotation.y = spec.faceYaw;
  state.walkersRoot.add(root);
  state.walkers.push({
    group: root,
    parts: { body, legL, legR, armL, armR, head },
    dirZ: spec.dirZ,
    speed: spec.idle ? 0 : 1.15 + rng() * 0.65,
    phase: rng() * Math.PI * 2,
    seed: rng() * Math.PI * 2,
    curY: SIDEWALK_TOP,
    phone: spec.phone,
    idle: spec.idle,
  });
}

function buildPedestrians(state: Era2025State, mats: MaterialSet, rng: () => number): void {
  const specs: WalkerSpec[] = [
    { x: WALKER_X, z: -14, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: WALKER_X, z: 6, faceYaw: Math.PI, dirZ: -1, phone: true, idle: false },
    { x: -WALKER_X, z: -20, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: -WALKER_X, z: 2, faceYaw: Math.PI, dirZ: -1, phone: true, idle: false },
    { x: WALKER_X, z: 19, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: -WALKER_X, z: 16, faceYaw: 0, dirZ: 1, phone: false, idle: false },
    { x: WALKER_X, z: -30, faceYaw: 0, dirZ: 1, phone: true, idle: false },
    { x: -WALKER_X, z: -6, faceYaw: Math.PI, dirZ: -1, phone: true, idle: false },
    { x: 7.3, z: 11.4, faceYaw: -Math.PI / 2, dirZ: 1, phone: true, idle: true },
    { x: -7.3, z: -11.2, faceYaw: Math.PI / 2, dirZ: 1, phone: false, idle: true },
    { x: 8.6, z: -18.4, faceYaw: -Math.PI / 2, dirZ: 1, phone: true, idle: true },
  ];
  for (const spec of specs) buildWalker(state, mats, spec, rng);
}

/* ------------------------------------------------------------------ */
/* Layers 1–3: buildings, storefronts, advertising                     */
/* ------------------------------------------------------------------ */

interface TowerSpec {
  /** -1 = west side of the avenue, +1 = east side. */
  side: Dir;
  z: number;
  towerW: number;
  towerD: number;
  /** Retail podium height; its street face sits flush with FACE_X. */
  podiumH: number;
  /** Podium length along the avenue (covers its storefront stretch). */
  podLen: number;
  towerH: number;
  seed: number;
}

function buildTower(state: Era2025State, mats: MaterialSet, parent: THREE.Group, spec: TowerSpec): void {
  const glass = makeCurtainWallMaterial(
    Math.max(4, Math.round(spec.towerW / 3)),
    Math.max(6, Math.round(spec.towerH / 2.4)),
    spec.seed,
  );
  const px = spec.side * (FACE_X + PODIUM_DEPTH / 2);

  if (spec.podiumH > 0) {
    // Retail podium flush with the sidewalk edge (2005-module convention).
    boxAt(parent, mats.precastLight, PODIUM_DEPTH, spec.podiumH, spec.podLen, px, spec.podiumH / 2, spec.z);
    // Bronze cornice strip along the street face.
    boxAt(parent, mats.bronze, 0.3, 0.3, spec.podLen, spec.side * FACE_X, spec.podiumH - 0.15, spec.z);
  }

  // Curtain-wall tower mass set back behind the podium.
  const towerX = spec.side * (FACE_X + PODIUM_DEPTH + spec.towerW / 2 - 1);
  boxAt(parent, glass, spec.towerW, spec.towerH, spec.towerD, towerX, spec.podiumH + spec.towerH / 2, spec.z);
  // Corner mullion strips.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      boxAt(
        parent,
        mats.bronze,
        0.2,
        spec.towerH,
        0.2,
        towerX + (sx * spec.towerW) / 2,
        spec.podiumH + spec.towerH / 2,
        spec.z + (sz * spec.towerD) / 2,
      );
    }
  }

  const roofY = spec.podiumH + spec.towerH;

  if (spec.seed === 101) {
    /* ---- Hero tower: rooftop solar array + garden + media facade ---- */
    // Solar canopy on tilted frames across the back half of the roof.
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const sx = towerX - spec.towerW / 2 + 1.8 + c * ((spec.towerW - 3.4) / 4);
        const sz = spec.z + spec.towerD / 2 - 1.7 - r * 1.6;
        const frame = boxAt(parent, mats.solarFrame, 1.3, 0.08, 0.95, sx, roofY + 0.55, sz);
        frame.rotation.x = -0.42;
        const cell = boxAt(parent, mats.solar, 1.2, 0.05, 0.85, sx, roofY + 0.63, sz);
        cell.rotation.x = -0.42;
      }
    }
    // Green roof: sedum carpet, planters with shrubs, two small trees.
    boxAt(parent, mats.foliageRoof, spec.towerW * 0.46, 0.12, spec.towerD * 0.5, towerX + spec.towerW * 0.18, roofY + 0.06, spec.z - spec.towerD * 0.2);
    for (let p = 0; p < 3; p++) {
      const pxp = towerX - 1.6 + p * 1.8;
      boxAt(parent, mats.planterWood, 1.4, 0.5, 0.75, pxp, roofY + 0.25, spec.z - spec.towerD * 0.28);
      sphereAt(parent, mats.foliageRoof, 0.42, pxp, roofY + 0.68, spec.z - spec.towerD * 0.28);
    }
    cylAt(parent, mats.trunk, 0.06, 0.09, 1.3, 6, towerX + spec.towerW * 0.26, roofY + 0.75, spec.z - spec.towerD * 0.34);
    sphereAt(parent, mats.foliageRoof, 0.55, towerX + spec.towerW * 0.26, roofY + 1.55, spec.z - spec.towerD * 0.34);
    cylAt(parent, mats.trunk, 0.05, 0.08, 1.1, 6, towerX - spec.towerW * 0.1, roofY + 0.65, spec.z + spec.towerD * 0.3);
    sphereAt(parent, mats.foliageRoof, 0.45, towerX - spec.towerW * 0.1, roofY + 1.35, spec.z + spec.towerD * 0.3);
    // Glass parapet rails around the terrace edges.
    boxAt(parent, mats.shopGlass, spec.towerW, 0.5, 0.06, towerX, roofY + 0.35, spec.z + spec.towerD / 2);
    boxAt(parent, mats.shopGlass, spec.towerW, 0.5, 0.06, towerX, roofY + 0.35, spec.z - spec.towerD / 2);

    // Mechanical core beside the garden.
    boxAt(parent, mats.precastWarm, spec.towerW * 0.3, 1.4, spec.towerD * 0.34, towerX + spec.towerW * 0.28, roofY + 0.7, spec.z + spec.towerD * 0.24);

    /* Media facade: shimmering vertical LED strips flanking the billboard,
     * mounted proud of the road-facing tower face. */
    const faceStripX = spec.side * FACE_X + spec.side * 0.06;
    for (const szEdge of [-1, 1]) {
      const stripMat = std({
        color: 0x0d3a4a,
        emissive: new THREE.Color(szEdge < 0 ? 0x2fd8c8 : 0x7fd4ff),
        emissiveIntensity: 1.1,
      });
      boxAt(parent, stripMat, 0.07, spec.towerH * 0.78, 0.35, faceStripX, spec.podiumH + spec.towerH * 0.56, spec.z + szEdge * (spec.towerD / 2 - 0.4));
      state.pulses.push({ material: stripMat, base: 1.1, amp: 0.6, rate: 1.3 + szEdge * 0.4, seed: szEdge * 2.1 });
    }
  } else {
    // Roof cap, parapet and rooftop HVAC + antenna.
    boxAt(parent, mats.precastWarm, spec.towerW + 0.6, 0.4, spec.towerD + 0.6, towerX, roofY + 0.2, spec.z);
    boxAt(parent, mats.aluminum, 2.4, 1.1, 1.8, towerX + (spec.seed % 3) - 1, roofY + 0.95, spec.z + (spec.seed % 5) - 2);
    cylAt(parent, mats.darkMetal, 0.06, 0.09, 4.0, 6, towerX + spec.towerW / 4, roofY + 2.4, spec.z - spec.towerD / 4);
  }
}

function buildBackgroundSkyline(parent: THREE.Group): void {
  const blocks: Array<[number, number, number, number, number]> = [
    [47, -28, 11, 12, 26],
    [45, 27, 10, 11, 17],
    [49, -6, 12, 11, 30],
    [47, 44, 11, 12, 22],
    [-46, 40, 11, 10, 18],
    [-44, -40, 12, 12, 24],
  ];
  blocks.forEach(([x, z, w, d, h], i) => {
    const mesh = boxAt(parent, makeWindowGridMaterial(7000 + i * 13), w, h, d, x, h / 2, z);
    mesh.name = 'background-block';
  });
}

type StorefrontKind = 'cafe' | 'mobility' | 'market' | 'studio';

interface StorefrontSpec {
  side: Dir;
  z: number;
  width: number;
  kind: StorefrontKind;
}

function buildStorefront(state: Era2025State, mats: MaterialSet, parent: THREE.Group, spec: StorefrontSpec): void {
  const toStreet = -spec.side; // unit step toward the road
  const inward = spec.side; // unit step into the block interior
  const faceX = spec.side * FACE_X;

  const signTexts: Record<StorefrontKind, [string, number, number]> = {
    cafe: ['OAT & OAK CAFÉ', 0x1d3a2f, 0xf3ead7],
    mobility: ['VOLT MOBILITY', 0x0d1b2a, 0x35e0ff],
    market: ['NOVA MARKET', 0x14351f, 0xd8f3a3],
    studio: ['LUMEN STUDIO', 0x120a24, 0xc79bff],
  };

  // Glazed shopfront window with glowing interior behind it.
  boxAt(parent, mats.shopGlass, 0.1, 1.6, spec.width - 0.6, faceX + inward * 0.06, 0.95, spec.z);
  boxAt(parent, spec.kind === 'mobility' || spec.kind === 'studio' ? mats.interiorCool : mats.interiorWarm, 0.06, 1.4, spec.width - 1.0, faceX + inward * 0.9, 0.85, spec.z);
  // Recessed door pair.
  const doorMat = std({ color: 0x5d6d74, metalness: 0.5, roughness: 0.2, transparent: true, opacity: 0.55 });
  boxAt(parent, doorMat, 0.12, 2.0, 1.0, faceX + inward * 0.3, 1.0, spec.z - spec.width * 0.28);
  boxAt(parent, doorMat, 0.12, 2.0, 1.0, faceX + inward * 0.3, 1.0, spec.z + spec.width * 0.28);
  // Dark slim storefront frame.
  boxAt(parent, mats.darkMetal, 0.18, 0.2, spec.width, faceX + toStreet * 0.04, 0.1, spec.z);
  boxAt(parent, mats.darkMetal, 0.18, 0.2, spec.width, faceX + toStreet * 0.04, 3.62, spec.z);

  // High-res LED display filling the middle facade band.
  const framesByKind: Record<StorefrontKind, Array<[string, string, string, string, string, DisplayMotif]>> = {
    cafe: [
      ['OAT & OAK', 'slow coffee · oat milk', '#20402f', '#f3ead7', '#7fb069', 'leaf'],
      ['OAT & OAK', 'matcha season is here', '#2b4a38', '#fdf6e3', '#9bc53d', 'leaf'],
    ],
    mobility: [
      ['VOLT', 'ride · charge · go', '#0b1622', '#35e0ff', '#ffd166', 'bolt'],
      ['VOLT', 'scooters from $1', '#101c2c', '#7fdcff', '#35e0ff', 'bolt'],
    ],
    market: [
      ['NOVA MARKET', 'fresh · local · daily', '#16301d', '#dff3b0', '#f4a259', 'dots'],
      ['NOVA MARKET', 'zero-waste refills', '#1c3a24', '#eaf7c8', '#e07a5f', 'dots'],
    ],
    studio: [
      ['LUMEN', '8k laser cinema', '#150b26', '#d9c2ff', '#7b5cff', 'bars'],
      ['LUMEN', 'spatial audio nights', '#1b1030', '#efe4ff', '#b388ff', 'bars'],
    ],
  };
  const frames: THREE.Texture[] = [];
  for (const f of framesByKind[spec.kind]) {
    const tex = makeDisplayFrameTexture(f[0], f[1], f[2], f[3], f[4], f[5]);
    if (tex) frames.push(tex);
  }
  const fallbackColor: Record<StorefrontKind, number> = {
    cafe: 0x20402f,
    mobility: 0x0b1622,
    market: 0x16301d,
    studio: 0x150b26,
  };
  const displayMat = new THREE.MeshBasicMaterial({
    color: frames.length > 0 ? 0xffffff : fallbackColor[spec.kind],
  });
  if (frames.length > 0) displayMat.map = frames[0];
  // Backing plate recessed behind the screen plane.
  boxAt(parent, mats.darkMetal, 0.08, 2.5, spec.width - 0.5, faceX + inward * 0.02, 2.62, spec.z);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(spec.width - 0.7, 2.3), displayMat);
  display.position.set(faceX + toStreet * 0.06, 2.62, spec.z);
  display.rotation.y = (-spec.side * Math.PI) / 2;
  display.name = 'led-screen';
  parent.add(display);
  state.screens.push({
    material: displayMat,
    frames,
    period: 4.5 + (spec.z % 3),
    phase: (spec.z + 100) * 0.07,
    current: 0,
  });

  // Channel-letter sign band crowning the storefront.
  const [text, bg, fg] = signTexts[spec.kind];
  const signMat = makeLedSignMaterial(text, bg, fg);
  boxAt(parent, signMat, 0.16, 0.7, spec.width - 0.8, faceX + toStreet * 0.1, 4.25, spec.z);

  // Slim awning over the doorway.
  const awning = boxAt(parent, mats.precastLight, 0.7, 0.06, spec.width - 1.4, faceX + toStreet * 0.35, 1.92, spec.z);
  awning.rotation.z = -spec.side * 0.16;
}

function buildBillboards(state: Era2025State, mats: MaterialSet, parent: THREE.Group): void {
  /* --- Flush LED billboard on the hero tower's road-facing face --- */
  const framesA: THREE.Texture[] = [];
  const adsA: Array<[string, string, number, number]> = [
    ['NEXUS AI', 'your world, anticipated', 0x0a1a2f, 0x53e0ff],
    ['NEXUS AI', 'city transit · live', 0x0c2440, 0x8be9ff],
    ['GREENGRID', '61% solar today', 0x0e2b1c, 0x7deda0],
  ];
  for (const [h, s, bg, fg] of adsA) {
    const tex = makeAdFrameTexture(h, s, bg, fg);
    if (tex) framesA.push(tex);
  }
  const matA = new THREE.MeshBasicMaterial({ color: framesA.length > 0 ? 0xffffff : 0x0a1a2f });
  if (framesA.length > 0) matA.map = framesA[0];
  // Bezel cabinet behind the screen.
  boxAt(parent, mats.darkMetal, 0.5, 6.0, 11.5, FACE_X + 0.3, 16, -8);
  const screenA = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), matA);
  screenA.position.set(FACE_X - 0.04, 16, -8);
  screenA.rotation.y = -Math.PI / 2;
  screenA.name = 'led-screen';
  parent.add(screenA);
  state.screens.push({ material: matA, frames: framesA, period: 5, phase: 0.2, current: 0 });

  /* --- Double-sided street pylon board on the open west end --- */
  const framesB: THREE.Texture[] = [];
  const adsB: Array<[string, string, number, number]> = [
    ['HALO BUDS', 'hear everything', 0x2b1220, 0xff9f8a],
    ['ZEPHYR EV', 'charge forward', 0xf0f3f5, 0x0e7c86],
  ];
  for (const [h, s, bg, fg] of adsB) {
    const tex = makeAdFrameTexture(h, s, bg, fg);
    if (tex) framesB.push(tex);
  }
  const matB = new THREE.MeshBasicMaterial({ color: framesB.length > 0 ? 0xffffff : 0x12222e });
  if (framesB.length > 0) matB.map = framesB[0];
  const pylonX = -(FACE_X + 2.0);
  cylAt(parent, mats.darkMetal, 0.2, 0.3, 9.4, 10, pylonX, 4.7, -30);
  boxAt(parent, mats.darkMetal, 0.6, 4.3, 8.1, pylonX, 11.5, -30);
  for (const faceTurn of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.75), matB);
    side.position.set(pylonX + faceTurn * 0.33, 11.5, -30);
    side.rotation.y = (faceTurn * Math.PI) / 2;
    parent.add(side);
  }
  state.screens.push({ material: matB, frames: framesB, period: 6, phase: 0.55, current: 0 });

  // Scrolling LED ticker band under the pylon board.
  const ticker = makeTickerMaterial(
    'NEXUS AI · TRANSIT LIVE · AIR QUALITY 38 GOOD · SCOOTER DOCKS 12 FREE · CITY SOLAR 61% · ',
    0x04121e,
    0x53e0ff,
  );
  for (const faceTurn of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 0.55), ticker.material);
    strip.position.set(pylonX + faceTurn * 0.33, 9.2, -30);
    strip.rotation.y = (faceTurn * Math.PI) / 2;
    parent.add(strip);
  }
  state.tickers.push({ texture: ticker.texture, speed: 0.045 });
}

/* ------------------------------------------------------------------ */
/* Layer 6: street furniture                                           */
/* ------------------------------------------------------------------ */

function registerPulse(state: Era2025State, mat: THREE.MeshStandardMaterial, base: number, amp: number, rate: number, seed: number): void {
  state.pulses.push({ material: mat, base, amp, rate, seed });
}

function buildSmartStreetlight(state: Era2025State, mats: MaterialSet, parent: THREE.Group, x: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  parent.add(g);
  // Slender pole with a tapered cap.
  cylAt(g, mats.aluminum, 0.05, 0.09, 6.8, 8, 0, 3.4, 0);
  cylAt(g, mats.darkMetal, 0.07, 0.05, 0.22, 8, 0, 6.85, 0);
  // Slim arm cantilevered over the roadway + flat LED head.
  boxAt(g, mats.aluminum, 0.1, 0.1, 1.5, 0, 6.75, 0.65);
  const head = boxAt(g, mats.lightBar, 0.5, 0.06, 0.9, 0, 6.62, 1.25);
  head.rotation.x = 0.3;
  // Smart-city sensor pod with a pulsing status LED.
  boxAt(g, mats.sensorPod, 0.22, 0.34, 0.22, 0, 5.6, 0.12);
  const ledMat = mats.sensorLed.clone();
  boxAt(g, ledMat, 0.1, 0.1, 0.03, 0, 5.68, 0.24);
  // 5G canister antenna.
  cylAt(g, mats.sensorPod, 0.05, 0.05, 0.7, 6, 0, 7.4, 0);
  registerPulse(state, ledMat, 1.4, 0.8, 1.1 + (z % 3) * 0.13, z * 0.31);
}

function buildTrafficSignal(
  state: Era2025State,
  mats: MaterialSet,
  parent: THREE.Group,
  x: number,
  z: number,
  armYaw: number,
  offset: number,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = armYaw;
  parent.add(g);
  cylAt(g, mats.darkMetal, 0.08, 0.11, 5.4, 8, 0, 2.7, 0);
  boxAt(g, mats.darkMetal, 0.1, 0.1, 4.2, 0, 5.3, 1.9);
  boxAt(g, mats.backplate, 0.6, 1.4, 0.06, 0, 4.7, 3.8);
  boxAt(g, mats.signalBox, 0.44, 1.24, 0.22, 0, 4.7, 3.92);
  const red = std({ color: 0x5a1010, emissive: new THREE.Color(0xff2a22), emissiveIntensity: 0.18 });
  const yellow = std({ color: 0x5a4a10, emissive: new THREE.Color(0xffc22a), emissiveIntensity: 0.18 });
  const green = std({ color: 0x105a20, emissive: new THREE.Color(0x2aff5a), emissiveIntensity: 0.18 });
  const lens = (mat: THREE.Material, y: number): void => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(0, y, 4.05);
    g.add(m);
  };
  lens(red, 5.1);
  lens(yellow, 4.7);
  lens(green, 4.3);
  state.signals.push({ red, yellow, green, offset });
  boxAt(g, mats.signalBox, 0.22, 0.34, 0.16, 0, 3.0, 0.14);
}

function buildBusShelter(state: Era2025State, mats: MaterialSet, parent: THREE.Group, x: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = yaw;
  parent.add(g);
  // Roof, rear glass wall, posts, bench.
  boxAt(g, mats.darkMetal, 4.8, 0.1, 1.8, 0, 2.5, 0);
  boxAt(g, mats.shopGlass, 4.4, 2.2, 0.06, 0, 1.25, -0.72);
  for (const bx of [-2.2, 2.2]) cylAt(g, mats.darkMetal, 0.05, 0.05, 2.5, 6, bx, 1.25, 0.55);
  boxAt(g, mats.seatSlat, 3.2, 0.08, 0.45, 0, 0.55, -0.35);
  for (const bz of [-1.4, 1.4]) boxAt(g, mats.darkMetal, 0.4, 0.5, 0.08, 0, 0.28, bz);
  // Digital arrivals panel glowing on the rear wall.
  const panelMat = std({ color: 0x04121e, emissive: new THREE.Color(0x53e0ff), emissiveIntensity: 1.1 });
  boxAt(g, panelMat, 1.4, 0.7, 0.08, 0.9, 1.7, -0.64);
  registerPulse(state, panelMat, 1.1, 0.35, 0.9, x + z);
}

function buildChargingStation(state: Era2025State, mats: MaterialSet, parent: THREE.Group): void {
  const g = new THREE.Group();
  g.position.set(-(FACE_X + 2.35), 0, -24);
  parent.add(g);
  // Paved plaza pad under the station.
  boxAt(g, mats.plaza, 10, 0.12, 9, 0, 0.06, 0);
  // Solar canopy on slim posts.
  for (const [cx, cz] of [[-1.6, -2.4], [-1.6, 2.4], [1.6, -2.4], [1.6, 2.4]] as const) {
    boxAt(g, mats.solarFrame, 0.16, 3.4, 0.16, cx, 1.7, cz);
  }
  boxAt(g, mats.aluminum, 4.6, 0.14, 5.4, 0, 3.45, 0);
  const canopySolar = boxAt(g, mats.solar, 4.4, 0.08, 5.2, 0, 3.56, 0);
  canopySolar.rotation.x = 0.06;
  boxAt(g, mats.lightBar, 4.6, 0.05, 0.08, 0, 3.4, 2.68);

  // Two charge posts with glowing status rings, screens and cables.
  for (const cx of [-1.0, 1.0]) {
    boxAt(g, mats.aluminum, 0.5, 1.25, 0.36, cx, 0.69, 0);
    const screenMat = mats.sensorLed.clone();
    boxAt(g, screenMat, 0.34, 0.24, 0.03, cx, 1.1, 0.19);
    registerPulse(state, screenMat, 1.4, 0.5, 1.6, cx);
    torusAt(g, mats.chargeGreen, 0.16, 0.03, cx, 0.55, 0.19);
    const cable = torusAt(g, mats.darkMetal, 0.55, 0.035, cx - 0.5, 0.67, 0.3);
    cable.rotation.set(Math.PI / 2, 0, 0.9);
    boxAt(g, mats.paintWhite, 0.3, 0.16, 0.02, cx, 0.9, 0.19);
  }

  // Parked EV sedan plugged into the near post.
  const parked = buildEvSedan(mats, 0xf0f3f5);
  parked.group.position.set(-2.7, 0.12, 0.4);
  parked.group.rotation.y = Math.PI / 2;
  g.add(parked.group);

  // "EV CHARGING" sign on a slim totem.
  boxAt(g, mats.darkMetal, 0.12, 3.9, 0.12, -1.2, 1.95, -2.6);
  boxAt(g, mats.darkMetal, 0.12, 3.9, 0.12, 1.2, 1.95, -2.6);
  const signMat = makeLedSignMaterial('EV CHARGING', 0x0e2b1c, 0x7deda0);
  const sign = boxAt(g, signMat, 2.6, 0.6, 0.12, 0, 4.1, -2.6);
  sign.rotation.x = -0.06;
  registerPulse(state, signMat, 1.2, 0.2, 0.7, 3.3);
}

function buildDockedBike(parent: THREE.Group, mats: MaterialSet, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = Math.PI / 2; // bikes sit perpendicular to the dock rail
  parent.add(g);
  const frameMat = std({ color: 0x2e9e8f, roughness: 0.5, metalness: 0.3 });
  // Wheels.
  const wheelGeo = new THREE.TorusGeometry(0.32, 0.035, 6, 14);
  const w1 = new THREE.Mesh(wheelGeo, mats.tire);
  w1.position.set(0, 0.34, 0.52);
  g.add(w1);
  const w2 = new THREE.Mesh(wheelGeo, mats.tire);
  w2.position.set(0, 0.34, -0.52);
  g.add(w2);
  // Step-through frame tubes.
  const bar1 = boxAt(g, frameMat, 0.05, 0.05, 0.95, 0, 0.55, 0);
  bar1.rotation.x = 0.5;
  const bar2 = boxAt(g, frameMat, 0.05, 0.5, 0.05, 0, 0.62, -0.42);
  bar2.rotation.x = 0.25;
  boxAt(g, frameMat, 0.05, 0.42, 0.05, 0, 0.6, 0.42);
  // Saddle, bars, basket, headlight.
  boxAt(g, mats.darkMetal, 0.09, 0.06, 0.3, 0, 0.92, -0.5);
  boxAt(g, mats.aluminum, 0.42, 0.05, 0.05, 0, 1.0, 0.44);
  boxAt(g, mats.aluminum, 0.05, 0.22, 0.05, 0, 0.88, 0.44);
  boxAt(g, mats.aluminum, 0.3, 0.2, 0.24, 0, 0.82, 0.6);
  boxAt(g, mats.lightBar, 0.06, 0.06, 0.05, 0, 0.72, 0.78);
}

function buildBikeShareDock(state: Era2025State, parent: THREE.Group, mats: MaterialSet): void {
  const g = new THREE.Group();
  g.position.set(7.35, 0, 24.5);
  parent.add(g);
  // Dock rail with docking points.
  boxAt(g, mats.aluminum, 0.3, 0.1, 5.6, 0, 0.2, 0);
  boxAt(g, std({ color: 0x2e9e8f }), 0.32, 0.12, 5.6, 0, 0.3, 0);
  for (let i = 0; i < 5; i++) {
    const dz = -2.2 + i * 1.1;
    boxAt(g, mats.darkMetal, 0.24, 0.5, 0.1, 0, 0.4, dz);
    if (i < 4) buildDockedBike(g, mats, 0, dz);
  }
  // Pay kiosk with a pulsing screen.
  boxAt(g, mats.aluminum, 0.4, 1.15, 0.3, 0.7, 0.73, 2.9);
  const kioskMat = mats.sensorLed.clone();
  const kioskScreen = boxAt(g, kioskMat, 0.28, 0.2, 0.03, 0.7, 1.1, 3.06);
  kioskScreen.rotation.x = -0.25;
  registerPulse(state, kioskMat, 1.3, 0.4, 1.2, 4.4);
}

function buildScooter(mats: MaterialSet, parent: THREE.Group, x: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = yaw;
  parent.add(g);
  const deckMat = std({ color: 0x22262b, roughness: 0.6 });
  const accentMat = std({ color: 0x1899a8, emissive: new THREE.Color(0x35e0ff), emissiveIntensity: 0.9 });
  boxAt(g, deckMat, 0.2, 0.07, 0.95, 0, 0.16, -0.1);
  const stem = boxAt(g, deckMat, 0.06, 0.95, 0.06, 0, 0.6, 0.38);
  stem.rotation.x = 0.12;
  boxAt(g, deckMat, 0.4, 0.05, 0.06, 0, 1.06, 0.44);
  boxAt(g, accentMat, 0.06, 0.05, 0.5, 0, 0.2, -0.1);
  const wf = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), mats.tire);
  wf.rotation.z = Math.PI / 2;
  wf.position.set(0, 0.11, 0.44);
  g.add(wf);
  const wb = new THREE.Mesh(wf.geometry, mats.tire);
  wb.rotation.z = Math.PI / 2;
  wb.position.set(0, 0.11, -0.55);
  g.add(wb);
  // Kickstand lean.
  g.rotation.z = 0.09;
}

function buildPlanterTree(mats: MaterialSet, parent: THREE.Group, x: number, z: number, rng: () => number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  parent.add(g);
  boxAt(g, mats.planterWood, 1.5, 0.55, 1.5, 0, 0.28, 0);
  boxAt(g, mats.plaza, 1.3, 0.06, 1.3, 0, 0.58, 0);
  cylAt(g, mats.trunk, 0.08, 0.12, 2.4, 7, 0, 1.75, 0);
  const blobY = 3.3 + rng() * 0.4;
  sphereAt(g, mats.foliage, 1.0 + rng() * 0.25, 0, blobY, 0);
  sphereAt(g, mats.foliage, 0.6 + rng() * 0.2, 0.5, blobY - 0.4, 0.3);
  sphereAt(g, mats.foliage, 0.55 + rng() * 0.2, -0.45, blobY - 0.3, -0.25);
}

function buildBench(mats: MaterialSet, parent: THREE.Group, x: number, z: number, yaw: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  g.rotation.y = yaw;
  parent.add(g);
  boxAt(g, mats.seatSlat, 2.0, 0.08, 0.5, 0, 0.5, 0);
  boxAt(g, mats.seatSlat, 2.0, 0.5, 0.08, 0, 0.75, -0.24);
  for (const px of [-0.85, 0.85]) boxAt(g, mats.darkMetal, 0.08, 0.5, 0.45, px, 0.25, 0);
}

function buildLitterBin(mats: MaterialSet, parent: THREE.Group, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, SIDEWALK_TOP, z);
  parent.add(g);
  cylAt(g, mats.darkMetal, 0.28, 0.24, 0.85, 10, 0, 0.43, 0);
  cylAt(g, mats.aluminum, 0.3, 0.3, 0.06, 10, 0, 0.88, 0);
}

function buildShuttleStopMarker(mats: MaterialSet, parent: THREE.Group): void {
  // Painted curbside pad where the autonomous shuttle dwells.
  boxAt(parent, mats.paintWhite, 2.6, 0.02, 5.0, 3.9, 0.075, SHUTTLE_STOP_Z);
  boxAt(parent, std({ color: 0x0e7c86 }), 2.2, 0.021, 0.35, 3.9, 0.076, SHUTTLE_STOP_Z - 2.1);
  // Sidewalk signpost.
  const g = new THREE.Group();
  g.position.set(6.85, SIDEWALK_TOP, SHUTTLE_STOP_Z);
  parent.add(g);
  cylAt(g, mats.darkMetal, 0.04, 0.05, 3.2, 6, 0, 1.6, 0);
  boxAt(g, makeLedSignMaterial('SHUTTLE STOP', 0x0e2b1c, 0x9fffcf), 0.1, 0.55, 1.7, 0, 2.7, 0);
}

function buildStreetFurniture(
  state: Era2025State,
  mats: MaterialSet,
  parent: THREE.Group,
  rng: () => number,
): void {
  // Smart streetlights, arms cantilevered over the roadway.
  buildSmartStreetlight(state, mats, parent, 9.0, -26, -Math.PI / 2);
  buildSmartStreetlight(state, mats, parent, 9.0, 22, -Math.PI / 2);
  buildSmartStreetlight(state, mats, parent, -9.0, -14, Math.PI / 2);
  buildSmartStreetlight(state, mats, parent, -9.0, 26, Math.PI / 2);

  // Slim mast-arm signals at the intersection corners.
  buildTrafficSignal(state, mats, parent, 6.9, -6.9, -Math.PI / 2, 0);
  buildTrafficSignal(state, mats, parent, -6.9, 6.9, Math.PI / 2, 0.5);
  buildTrafficSignal(state, mats, parent, 6.9, 6.9, -Math.PI / 2, 0.5);
  buildTrafficSignal(state, mats, parent, -6.9, -6.9, Math.PI / 2, 0);

  // EV charging plaza with a plugged-in car.
  buildChargingStation(state, mats, parent);

  // Autonomous-shuttle curbside stop.
  buildShuttleStopMarker(mats, parent);

  // Bike-share dock + parked e-scooters nearby.
  buildBikeShareDock(state, parent, mats);
  buildScooter(mats, parent, 7.4, 20.6, 0.5);
  buildScooter(mats, parent, 7.4, 21.5, 0.35);
  buildScooter(mats, parent, 7.4, 22.4, 0.62);
  buildScooter(mats, parent, -7.4, -16.2, -0.4);
  buildScooter(mats, parent, -7.4, -17.1, -0.55);

  // Bus shelters with digital arrivals panels.
  buildBusShelter(state, mats, parent, 8.6, -2.5, -Math.PI / 2);
  buildBusShelter(state, mats, parent, -8.6, 20, Math.PI / 2);

  // Benches, bins, planted trees.
  buildBench(mats, parent, 8.6, 14.5, Math.PI / 2);
  buildBench(mats, parent, -8.6, -14, -Math.PI / 2);
  buildBench(mats, parent, 7.4, 12.2, Math.PI / 2);
  buildLitterBin(mats, parent, 7.3, 18.6);
  buildLitterBin(mats, parent, -7.3, -20.8);
  buildPlanterTree(mats, parent, -8.9, -8, rng);
  buildPlanterTree(mats, parent, -8.9, 12, rng);
  buildPlanterTree(mats, parent, 8.9, 28, rng);
  buildPlanterTree(mats, parent, 8.9, -32, rng);
}

/* ------------------------------------------------------------------ */
/* Streetscape base: road, sidewalks, markings                         */
/* ------------------------------------------------------------------ */

function buildStreetscape(mats: MaterialSet, parent: THREE.Group): void {
  boxAt(parent, mats.asphalt, ROAD_HALF_W * 2, 0.06, AVENUE_LENGTH, 0, 0.03, 0);
  // Sidewalks and curbs are split so pedestrians can dip through the
  // intersection at grade.
  const segLen = HALF_LEN - CROSSWALK_HALF;
  const segCenter = CROSSWALK_HALF + segLen / 2;
  for (const side of [-1, 1] as const) {
    boxAt(parent, mats.curb, 0.25, CURB_H, segLen, side * (ROAD_HALF_W + 0.125), CURB_H / 2, segCenter);
    boxAt(parent, mats.curb, 0.25, CURB_H, segLen, side * (ROAD_HALF_W + 0.125), CURB_H / 2, -segCenter);
    boxAt(parent, mats.sidewalk, WALK_OUTER - WALK_INNER, SIDEWALK_TOP, segLen, side * (WALK_INNER + (WALK_OUTER - WALK_INNER) / 2), SIDEWALK_TOP / 2, segCenter);
    boxAt(parent, mats.sidewalk, WALK_OUTER - WALK_INNER, SIDEWALK_TOP, segLen, side * (WALK_INNER + (WALK_OUTER - WALK_INNER) / 2), SIDEWALK_TOP / 2, -segCenter);
  }
  // Center double white line, broken through the intersection.
  const centerLen = HALF_LEN - 4 - CROSSWALK_HALF;
  const centerOffset = CROSSWALK_HALF + centerLen / 2;
  for (const side of [-1, 1] as const) {
    boxAt(parent, mats.paintWhite, 0.12, 0.02, centerLen, -0.16, 0.07, side * centerOffset);
    boxAt(parent, mats.paintWhite, 0.12, 0.02, centerLen, 0.16, 0.07, side * centerOffset);
  }
  // Dashed lane-edge lines between travel and parking lanes.
  for (const side of [-1, 1] as const) {
    for (let z = -45; z <= 45; z += 5) {
      if (Math.abs(z) < CROSSWALK_HALF + 1.2) continue;
      boxAt(parent, mats.paintWhite, 0.12, 0.02, 2, side * 3.3, 0.07, z);
    }
  }
  // Continental crosswalk + stop lines at the intersection.
  for (let i = 0; i < 8; i++) {
    boxAt(parent, mats.paintWhite, 0.7, 0.02, 5.2, -5.6 + i * 1.6, 0.075, 0);
  }
  for (const side of [-1, 1] as const) {
    boxAt(parent, mats.paintWhite, 6.0, 0.02, 0.4, side * 3.2, 0.075, side * (CROSSWALK_HALF + 0.4));
  }
  // Protected green bike lanes hugging both curbs.
  for (const side of [-1, 1] as const) {
    boxAt(parent, mats.bikeGreen, BIKE_LANE_W, 0.021, segLen, side * (ROAD_HALF_W - BIKE_LANE_W / 2 - 0.05), 0.072, segCenter);
    boxAt(parent, mats.bikeGreen, BIKE_LANE_W, 0.021, segLen, side * (ROAD_HALF_W - BIKE_LANE_W / 2 - 0.05), 0.072, -segCenter);
    for (let z = -44; z <= 44; z += 6) {
      if (Math.abs(z) < CROSSWALK_HALF + 1.4) continue;
      boxAt(parent, mats.paintWhite, 0.1, 0.02, 1.4, side * (ROAD_HALF_W - BIKE_LANE_W - 0.1), 0.073, z);
    }
    // Flexible delineator posts between bike lane and travel lane.
    for (let z = -42; z <= 42; z += 7.5) {
      if (Math.abs(z) < CROSSWALK_HALF + 2) continue;
      cylAt(parent, mats.aluminum, 0.035, 0.035, 0.85, 6, side * (ROAD_HALF_W - BIKE_LANE_W - 0.12), 0.43, z);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Aerial layer: delivery drones                                       */
/* ------------------------------------------------------------------ */

function buildDroneBody(mats: MaterialSet, scale: number): { group: THREE.Group; rotors: THREE.Object3D[] } {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  // Fuselage faces -Z (its flight direction while orbiting).
  boxAt(g, mats.droneBody, 0.34, 0.13, 0.62, 0, 0, 0);
  boxAt(g, mats.droneBody, 0.1, 0.08, 0.2, 0, 0.02, 0.36);
  // Gimbal camera underneath.
  const gimbal = sphereAt(g, mats.droneBody, 0.07, 0, -0.1, 0.12);
  gimbal.scale.set(1, 0.8, 1);
  const lens = cylAt(g, mats.darkMetal, 0.035, 0.035, 0.03, 8, 0, -0.11, 0.05);
  lens.rotation.x = Math.PI / 2;
  // X-frame arms + rotors.
  const arms: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const rotors: THREE.Object3D[] = [];
  for (const [ax, az] of arms) {
    const arm = boxAt(g, mats.droneBody, 0.05, 0.03, 0.34, ax * 0.17, 0.04, az * 0.17);
    arm.rotation.y = ax === az ? -0.78 : 0.78;
    cylAt(g, mats.darkMetal, 0.035, 0.045, 0.07, 8, ax * 0.32, 0.07, az * 0.32);
    const rotor = new THREE.Group();
    rotor.position.set(ax * 0.32, 0.115, az * 0.32);
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 12), mats.rotorDisc));
    g.add(rotor);
    rotors.push(rotor);
  }
  // Nav strobes: red port, green starboard.
  boxAt(g, mats.navRed, 0.05, 0.03, 0.05, -0.32, 0.03, -0.32);
  boxAt(g, mats.navGreen, 0.05, 0.03, 0.05, 0.32, 0.03, -0.32);
  // Landing skids.
  boxAt(g, mats.droneBody, 0.04, 0.1, 0.04, -0.12, -0.14, 0.1);
  boxAt(g, mats.droneBody, 0.04, 0.1, 0.04, 0.12, -0.14, 0.1);
  boxAt(g, mats.droneBody, 0.3, 0.02, 0.04, 0, -0.2, 0.1);
  return { group: g, rotors };
}

function buildAerialLayer(state: Era2025State, mats: MaterialSet, root: THREE.Group): void {
  const aerial = new THREE.Group();
  aerial.name = 'aerial';

  const hero = buildDroneBody(mats, 1.6);
  const heroPivot = new THREE.Group();
  heroPivot.position.set(0, 15.5, 0);
  hero.group.position.set(11, 0, 0);
  heroPivot.add(hero.group);
  aerial.add(heroPivot);
  state.drones.push({
    pivot: heroPivot,
    rotors: hero.rotors,
    angularSpeed: 0.42,
    phase: 0,
    baseY: 15.5,
    bobAmp: 0.8,
    bobRate: 0.5,
  });

  const distant = buildDroneBody(mats, 1.0);
  const distantPivot = new THREE.Group();
  distantPivot.position.set(0, 19.5, 0);
  distant.group.position.set(-16, 0, 0);
  distantPivot.add(distant.group);
  aerial.add(distantPivot);
  state.drones.push({
    pivot: distantPivot,
    rotors: distant.rotors,
    angularSpeed: -0.3,
    phase: 2.2,
    baseY: 19.5,
    bobAmp: 1.1,
    bobRate: 0.36,
  });

  root.add(aerial);
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

/** Module-level handle so `update(dt)` works without passing the group. */
let activeState: Era2025State | null = null;

function resolveState(group?: THREE.Group): Era2025State | null {
  if (group) {
    const own = group.userData.era2025 as Era2025State | undefined;
    if (own) return own;
  }
  return activeState;
}

export function buildEra2025(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'era-2025';
  const rng = createRng(20252025);
  const mats = createMaterials();

  const pedestriansRoot = new THREE.Group();
  pedestriansRoot.name = 'pedestrians';

  const shuttleRoot = new THREE.Group();

  const state: Era2025State = {
    elapsed: 0,
    cars: [],
    shuttles: [],
    drones: [],
    walkers: [],
    signals: [],
    screens: [],
    tickers: [],
    pulses: [],
    walkersRoot: pedestriansRoot,
    shuttleRoot,
  };

  const streetscape = new THREE.Group();
  streetscape.name = 'streetscape-base';
  buildStreetscape(mats, streetscape);
  root.add(streetscape);

  const buildings = new THREE.Group();
  buildings.name = 'buildings';
  const towers: TowerSpec[] = [
    // Hero tower with rooftop solar + garden and media facade.
    { side: 1, z: -8, towerW: 14, towerD: 14, podiumH: 5.2, podLen: 18, towerH: 26, seed: 101 },
    { side: 1, z: 14, towerW: 12, towerD: 12, podiumH: 5.0, podLen: 16, towerH: 17, seed: 202 },
    { side: -1, z: 8, towerW: 13, towerD: 13, podiumH: 4.6, podLen: 16, towerH: 18.4, seed: 303 },
    { side: -1, z: -12, towerW: 12, towerD: 12, podiumH: 4.6, podLen: 16, towerH: 20, seed: 404 },
  ];
  for (const spec of towers) buildTower(state, mats, buildings, spec);
  buildBackgroundSkyline(buildings);
  root.add(buildings);

  const storefronts = new THREE.Group();
  storefronts.name = 'storefronts';
  const units: StorefrontSpec[] = [
    { side: -1, z: -12, width: 8.4, kind: 'cafe' },
    { side: -1, z: 8, width: 8.4, kind: 'studio' },
    { side: 1, z: -8, width: 8.4, kind: 'mobility' },
    { side: 1, z: 14, width: 8.4, kind: 'market' },
  ];
  for (const unit of units) buildStorefront(state, mats, storefronts, unit);
  root.add(storefronts);

  const advertising = new THREE.Group();
  advertising.name = 'advertising';
  buildBillboards(state, mats, advertising);
  root.add(advertising);

  const vehicles = new THREE.Group();
  vehicles.name = 'vehicles';
  vehicles.add(shuttleRoot);
  buildVehicles(state, mats, vehicles, rng);
  root.add(vehicles);

  buildPedestrians(state, mats, rng);
  root.add(pedestriansRoot);

  const furniture = new THREE.Group();
  furniture.name = 'street-furniture';
  buildStreetFurniture(state, mats, furniture, rng);
  root.add(furniture);

  buildAerialLayer(state, mats, root);

  root.userData.era2025 = state;
  activeState = state;
  return root;
}

/* ------------------------------------------------------------------ */
/* Per-frame update                                                    */
/* ------------------------------------------------------------------ */

export function update(dt: number, group?: THREE.Group): void {
  const state = resolveState(group);
  if (!state) return;
  const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.05) : 0;
  if (step <= 0) return;
  state.elapsed += step;
  const t = state.elapsed;

  // EV sedans cruise both lanes; aero covers spin with travel speed.
  for (const car of state.cars) {
    car.group.position.z += car.dirZ * car.speed * step;
    if (car.group.position.z > CAR_WRAP_Z) {
      car.group.position.z -= CAR_WRAP_Z * 2;
    } else if (car.group.position.z < -CAR_WRAP_Z) {
      car.group.position.z += CAR_WRAP_Z * 2;
    }
    const spin = (car.dirZ * car.speed * step) / car.wheelRadius;
    for (const wheel of car.wheels) {
      wheel.rotation.x += spin;
    }
  }

  // Autonomous shuttle: cruise → dwell at its marked stop → resume.
  for (const shuttle of state.shuttles) {
    if (shuttle.mode === 'cruise') {
      shuttle.speed += (shuttle.baseSpeed - shuttle.speed) * Math.min(step * 1.5, 1);
      const before = shuttle.group.position.z;
      shuttle.group.position.z += shuttle.dirZ * shuttle.speed * step;
      if (
        (shuttle.dirZ === 1 && before < SHUTTLE_STOP_Z && shuttle.group.position.z >= SHUTTLE_STOP_Z) ||
        (shuttle.dirZ === -1 && before > SHUTTLE_STOP_Z && shuttle.group.position.z <= SHUTTLE_STOP_Z)
      ) {
        shuttle.mode = 'dwell';
        shuttle.dwellLeft = 4.5;
        shuttle.group.position.z = SHUTTLE_STOP_Z;
      }
    } else {
      shuttle.dwellLeft -= step;
      shuttle.speed *= Math.max(1 - step * 6, 0);
      shuttle.group.position.z += shuttle.dirZ * shuttle.speed * step;
      if (shuttle.dwellLeft <= 0) {
        shuttle.mode = 'cruise';
        shuttle.speed = shuttle.baseSpeed * 0.35;
      }
    }
    if (shuttle.group.position.z > CAR_WRAP_Z) {
      shuttle.group.position.z -= CAR_WRAP_Z * 2;
    } else if (shuttle.group.position.z < -CAR_WRAP_Z) {
      shuttle.group.position.z += CAR_WRAP_Z * 2;
    }
    const spin = (shuttle.dirZ * shuttle.speed * step) / shuttle.wheelRadius;
    for (const wheel of shuttle.wheels) {
      wheel.rotation.x += spin;
    }
  }

  // Pedestrians walk the sidewalks and dip to street level at the crossing.
  for (const w of state.walkers) {
    if (w.idle) {
      // Phone-check idlers: head down, gentle sway.
      w.parts.body.rotation.y = Math.sin(t * 0.8 + w.seed) * 0.1;
      w.parts.head.rotation.x = w.phone
        ? 0.42 + Math.sin(t * 1.3 + w.seed) * 0.04
        : Math.sin(t * 0.5 + w.seed) * 0.2;
      w.parts.head.rotation.y = w.phone
        ? Math.sin(t * 0.9 + w.seed) * 0.06
        : Math.sin(t * 0.55 + w.seed * 1.7) * 0.4;
      w.parts.body.position.y = Math.abs(Math.sin(t * 0.45 + w.seed)) * 0.02;
      if (w.phone) w.parts.armR.rotation.x = -1.9 + Math.sin(t * 1.1 + w.seed) * 0.06;
      continue;
    }
    w.phase += w.speed * step * 4.4;
    w.group.position.z += w.dirZ * w.speed * step;
    if (w.group.position.z > WALKER_WRAP_Z) {
      w.group.position.z -= WALKER_WRAP_Z * 2;
    } else if (w.group.position.z < -WALKER_WRAP_Z) {
      w.group.position.z += WALKER_WRAP_Z * 2;
    }
    const targetY = Math.abs(w.group.position.z) < CROSSWALK_HALF ? 0.02 : SIDEWALK_TOP;
    w.curY += (targetY - w.curY) * Math.min(step * 6, 1);
    w.group.position.y = w.curY;

    const swing = Math.sin(w.phase) * 0.55;
    w.parts.legL.rotation.x = swing;
    w.parts.legR.rotation.x = -swing;
    w.parts.armL.rotation.x = -swing * 0.6;
    w.parts.armR.rotation.x = w.phone ? -1.9 + Math.sin(w.phase) * 0.08 : swing * 0.6;
    w.parts.body.position.y = Math.abs(Math.cos(w.phase)) * 0.05;
    w.parts.body.rotation.x = 0.04;
    w.parts.head.rotation.x = w.phone ? 0.35 : Math.sin(w.phase * 0.21) * 0.08;
  }

  // Signal cycle (north-south vs east-west phases).
  for (const signal of state.signals) {
    const phase = (t / SIGNAL_PERIOD + signal.offset) % 1;
    let ri = 0.18;
    let yi = 0.18;
    let gi = 0.18;
    if (phase < 0.42) gi = 2.4;
    else if (phase < 0.5) yi = 2.4;
    else ri = 2.4;
    signal.red.emissiveIntensity = ri;
    signal.yellow.emissiveIntensity = yi;
    signal.green.emissiveIntensity = gi;
  }

  // LED displays cycle their content frames.
  for (const screen of state.screens) {
    if (screen.frames.length === 0) continue;
    const idx = Math.floor(t / screen.period + screen.phase) % screen.frames.length;
    if (idx !== screen.current) {
      screen.current = idx;
      screen.material.map = screen.frames[idx];
      screen.material.needsUpdate = true;
    }
  }

  // Tickers scroll continuously.
  for (const ticker of state.tickers) {
    if (!ticker.texture) continue;
    ticker.texture.offset.x = (((ticker.texture.offset.x - ticker.speed * step) % 1) + 1) % 1;
  }

  // Sensor LEDs, charger rings, arrival panels and media strips breathe.
  for (const pulse of state.pulses) {
    pulse.material.emissiveIntensity =
      pulse.base + pulse.amp * (0.5 + 0.5 * Math.sin(t * pulse.rate + pulse.seed));
  }

  // Drones fly their overhead circuits: orbit, bob, bank, spin rotors.
  for (const drone of state.drones) {
    drone.pivot.rotation.y += drone.angularSpeed * step;
    drone.pivot.position.y =
      drone.baseY + Math.sin(t * drone.bobRate + drone.phase) * drone.bobAmp;
    const bank = drone.angularSpeed > 0 ? -0.16 : 0.16;
    const body = drone.pivot.children[0];
    body.rotation.z += (bank - body.rotation.z) * Math.min(step * 3, 1);
    for (const rotor of drone.rotors) {
      rotor.rotation.y += 34 * step;
    }
  }
}
