/* global process */
/**
 * Generate era-accurate 1980s 3D assets (GLB) for the city timelapse project.
 *
 * Produces one GLB per asset category under assets/1985/<category>/:
 *   - buildings     (postmodern architecture: asymmetrical facades, glass curtain walls)
 *   - vehicles      (boxy 1980s cars: sedans, hatchbacks, boxy SUVs)
 *   - storefronts   (neon-lit retail fronts, large glass windows, 1980s signage)
 *   - ads           (neon signs, backlit posters, 1980s typography)
 *   - pedestrians   (1980s fashion: shoulder pads, acid wash, aerobics wear)
 *   - environment   (asphalt roads, concrete sidewalks, period traffic signals)
 *
 * Each GLB is a self-contained model built from three.js primitives so it can be
 * loaded directly by the app's GLTFLoader. A manifest.json is written per category
 * listing the generated files so asset-management.js can discover them.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';

// Polyfill FileReader for Node.js (required by three.js GLTFExporter)
if (typeof globalThis.FileReader === 'undefined') {
  class FileReader {
    constructor() {
      this.readyState = 0;
      this.result = null;
      this.error = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.readyState = 2;
        if (this.onloadend) this.onloadend();
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = 'data:application/octet-stream;base64,' + Buffer.from(result).toString('base64');
        this.readyState = 2;
        if (this.onloadend) this.onloadend();
      });
    }
  }
  globalThis.FileReader = FileReader;
}

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ERA = '1985';
const ASSETS_ROOT = path.join(__dirname, '..', 'assets', ERA);

const CATEGORIES = ['buildings', 'vehicles', 'storefronts', 'ads', 'pedestrians', 'environment'];

// 1980s color palette
const COLORS = {
  // Postmodern / architecture
  teal: 0x008080,
  coral: 0xff6f61,
  magenta: 0xff0080,
  electricBlue: 0x00bfff,
  hotPink: 0xff1493,
  lavender: 0xe6e6fa,
  mint: 0x98fb98,
  yellow: 0xffff00,
  orange: 0xff8c00,
  // Neon
  neonPink: 0xff10f0,
  neonGreen: 0x39ff14,
  neonBlue: 0x1f00ff,
  neonYellow: 0xffff33,
  // Materials
  glass: 0xa0d8f1,
  concrete: 0xcccccc,
  asphalt: 0x2b2b2b,
  brick: 0xb22222,
  chrome: 0xc0c0c0,
  white: 0xffffff,
  black: 0x111111,
  // Fashion
  acidWashBlue: 0x4682b4,
  neonLime: 0xccff00,
  salmon: 0xfa8072,
  khaki: 0xf0e68c,
};

function makeMaterial(color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.1,
    roughness: opts.roughness ?? 0.6,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
  });
  return mat;
}

function makeGlassMaterial(color = COLORS.glass) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
}

function makeNeonMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.9,
    metalness: 0.4,
    roughness: 0.2,
  });
}

// ===== GROUP HELPERS =====
function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeMaterial(color, opts);
  return new THREE.Mesh(geo, mat);
}

function boxGlass(w, h, d, color = COLORS.glass) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeGlassMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function boxNeon(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeNeonMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function cylinder(rTop, rBottom, h, color, segs = 16) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
  const mat = makeMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function torusNeon(color, tubeRadius = 0.15, tubeTube = 0.08) {
  const geo = new THREE.TorusGeometry(tubeRadius, tubeTube, 16, 50);
  const mat = makeNeonMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function torusKnotNeon(color) {
  const geo = new THREE.TorusKnotGeometry(0.6, 0.18, 160, 20);
  const mat = makeNeonMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function sphere(r, color, opts = {}) {
  const geo = new THREE.SphereGeometry(r, 24, 16);
  const mat = makeMaterial(color, opts);
  return new THREE.Mesh(geo, mat);
}

// ===== BUILDINGS (postmodern: asymmetrical, glass curtain walls, geometric) =====
function createBuilding() {
  const building = new THREE.Group();

  // Main tower: tall glass curtain wall with a postmodern twist
  const coreHeight = 14;
  const coreWidth = 6;
  const coreDepth = 6;

  // Central core (concrete)
  building.add(box(coreWidth, coreHeight, coreDepth, COLORS.concrete, { roughness: 0.8 }));

  // Glass curtain wall wrapping the core
  const glassW = coreWidth + 0.2;
  const glassD = coreDepth + 0.2;
  const glassH = coreHeight - 1;
  const glassFront = boxGlass(glassW, glassH, 0.1, COLORS.glass);
  glassFront.position.y = 1.5;
  glassFront.position.z = coreDepth / 2 + 0.05;
  building.add(glassFront);

  const glassBack = boxGlass(glassW, glassH, 0.1, COLORS.glass);
  glassBack.position.y = 1.5;
  glassBack.position.z = -(coreDepth / 2 + 0.05);
  building.add(glassBack);

  const glassLeft = boxGlass(0.1, glassH, glassD, COLORS.glass);
  glassLeft.position.y = 1.5;
  glassLeft.position.x = coreWidth / 2 + 0.05;
  building.add(glassLeft);

  const glassRight = boxGlass(0.1, glassH, glassD, COLORS.glass);
  glassRight.position.y = 1.5;
  glassRight.position.x = -(coreWidth / 2 + 0.05);
  building.add(glassRight);

  // Postmodern geometric accent: a magenta cube jutting out (deconstructivist)
  const accent = box(3, 3, 3, COLORS.hotPink, { roughness: 0.3 });
  accent.position.set(coreWidth / 2 + 1.5, coreHeight - 3, coreDepth / 2 - 1);
  building.add(accent);

  // Teal slab (postmodern horizontal band)
  const slab = box(8, 1.5, 8, COLORS.teal, { roughness: 0.5 });
  slab.position.y = coreHeight - 0.75;
  building.add(slab);

  // Neon-lit crown at the top
  const crown = boxNeon(6.5, 1, 6.5, COLORS.neonBlue);
  crown.position.y = coreHeight + 0.5;
  building.add(crown);

  // A second shorter postmodern volume with asymmetrical facade
  const tower2 = new THREE.Group();
  const t2Height = 8;
  const t2W = 5;
  const t2D = 5;
  tower2.add(box(t2W, t2Height, t2D, COLORS.concrete, { roughness: 0.8 }));

  // Coral-colored geometric panel
  const panel = box(t2W, 3, 0.1, COLORS.coral, { roughness: 0.4 });
  panel.position.z = t2D / 2 + 0.05;
  panel.position.y = 2.5;
  tower2.add(panel);

  // Lavender window strip
  const winStrip = box(t2W, 0.8, 0.1, COLORS.lavender, { roughness: 0.3 });
  winStrip.position.z = t2D / 2 + 0.05;
  winStrip.position.y = 6;
  tower2.add(winStrip);

  // Neon trim around top
  const trim = boxNeon(t2W + 0.3, 0.5, t2D + 0.3, COLORS.neonPink);
  trim.position.y = t2Height + 0.25;
  tower2.add(trim);

  tower2.position.set(-10, 0, 0);
  building.add(tower2);

  // Third volume: glass pyramid-ish structure (postmodern geometric)
  const pyramid = new THREE.Group();
  const pW = 4;
  const pD = 4;
  const pH = 6;
  pyramid.add(box(pW, pH, pD, COLORS.concrete, { roughness: 0.7 }));
  // Stepped glass levels
  for (let i = 0; i < 3; i++) {
    const gw = pW - i * 0.8;
    const gh = 1.2;
    const gl = boxGlass(gw, gh, 0.1, COLORS.glass);
    gl.position.y = 1 + i * 1.6;
    gl.position.z = pD / 2 + 0.05;
    pyramid.add(gl);
  }
  pyramid.position.set(10, 0, -2);
  building.add(pyramid);

  return building;
}

// ===== VEHICLES (boxy 1980s cars) =====
function createVehicle() {
  const vehicle = new THREE.Group();

  // Main body (boxy sedan silhouette)
  const bodyW = 4.5;
  const bodyH = 1.5;
  const bodyD = 1.8;
  const body = box(bodyW, bodyH, bodyD, COLORS.neonBlue, { roughness: 0.3, metalness: 0.6 });
  body.position.y = 1.2;
  vehicle.add(body);

  // Cabin (separate box, 1980s hatchback style)
  const cabinW = 2.2;
  const cabinH = 1.4;
  const cabinD = 1.6;
  const cabin = box(cabinW, cabinH, cabinD, COLORS.neonPink, { roughness: 0.3, metalness: 0.6 });
  cabin.position.set(0, 2.6, 0);
  vehicle.add(cabin);

  // Front grille (1980s wide grille)
  const grille = box(2.5, 0.8, 0.1, COLORS.chrome, { roughness: 0.1, metalness: 0.9 });
  grille.position.set(0, 1.3, bodyD / 2 + 0.05);
  vehicle.add(grille);

  // Headlights (two rectangles)
  const headlightL = box(0.5, 0.4, 0.1, COLORS.neonYellow, { emissive: COLORS.neonYellow, emissiveIntensity: 0.8 });
  headlightL.position.set(-0.9, 1.4, bodyD / 2 + 0.06);
  vehicle.add(headlightL);

  const headlightR = headlightL.clone();
  headlightR.position.x = 0.9;
  vehicle.add(headlightR);

  // Tail lights
  const taillightL = box(0.4, 0.3, 0.1, COLORS.neonPink, { emissive: COLORS.neonPink, emissiveIntensity: 0.7 });
  taillightL.position.set(-0.7, 1.3, -bodyD / 2 - 0.05);
  vehicle.add(taillightL);

  const taillightR = taillightL.clone();
  taillightR.position.x = 0.7;
  vehicle.add(taillightR);

  // Wheels (4 cylinders)
  const wheelPositions = [
    [-1.3, 0.6, 1.1],
    [1.3, 0.6, 1.1],
    [-1.3, 0.6, -1.1],
    [1.3, 0.6, -1.1],
  ];
  wheelPositions.forEach((pos) => {
    const wheel = cylinder(0.45, 0.45, 0.4, COLORS.black, 16);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(pos[0], pos[1], pos[2]);
    vehicle.add(wheel);
  });

  // Roof rack (1980s accessory)
  const rackL = box(3.8, 0.15, 0.15, COLORS.chrome, { roughness: 0.1, metalness: 0.8 });
  rackL.position.set(0, 3.3, 0.9);
  vehicle.add(rackL);
  const rackR = rackL.clone();
  rackR.position.z = -0.9;
  vehicle.add(rackR);

  // Side decal (neon stripe)
  const stripe = box(bodyW, 0.3, 0.05, COLORS.neonGreen, { emissive: COLORS.neonGreen, emissiveIntensity: 0.6 });
  stripe.position.set(0, 1.2, bodyD / 2 + 0.01);
  vehicle.add(stripe);

  return vehicle;
}

// ===== STOREFRONTS (neon-lit retail, large glass windows, 1980s signage) =====
function createStorefront() {
  const store = new THREE.Group();

  // Base structure
  const baseW = 8;
  const baseH = 6;
  const baseD = 4;
  store.add(box(baseW, baseH, baseD, COLORS.concrete, { roughness: 0.7 }));

  // Large glass storefront window
  const windowW = baseW - 0.5;
  const windowH = baseH - 1.5;
  const windowGeo = new THREE.BoxGeometry(windowW, windowH, 0.1);
  const windowMat = makeGlassMaterial(COLORS.glass);
  const windowMesh = new THREE.Mesh(windowGeo, windowMat);
  windowMesh.position.set(0, 1.5, baseD / 2 + 0.05);
  store.add(windowMesh);

  // Neon "OPEN" sign above the door
  const openSign = boxNeon(2.5, 0.6, 0.3, COLORS.neonPink);
  openSign.position.set(0, 5.2, baseD / 2 + 0.1);
  store.add(openSign);

  // Door (red 1980s style)
  const door = box(1.8, 2.2, 0.2, COLORS.brick, { roughness: 0.5 });
  door.position.set(0, 1.1, baseD / 2 + 0.06);
  store.add(door);

  // Neon trim border around the window
  const trimTop = boxNeon(windowW + 0.2, 0.3, 0.15, COLORS.neonBlue);
  trimTop.position.set(0, 4.3, baseD / 2 + 0.02);
  store.add(trimTop);

  const trimBottom = trimTop.clone();
  trimBottom.position.y = 0.8;
  store.add(trimBottom);

  const trimLeft = boxNeon(0.3, windowH + 0.2, 0.15, COLORS.neonBlue);
  trimLeft.position.set(-windowW / 2 - 0.1, 1.5, baseD / 2 + 0.02);
  store.add(trimLeft);

  const trimRight = trimLeft.clone();
  trimRight.position.x = windowW / 2 + 0.1;
  store.add(trimRight);

  // Side awning (neon-lit)
  const awning = box(baseW + 0.4, 0.5, 1.5, COLORS.neonYellow, { emissive: COLORS.neonYellow, emissiveIntensity: 0.5 });
  awning.position.set(0, 6.25, 0);
  store.add(awning);

  // Poster on the side wall (backlit advertisement)
  const poster = box(3, 4, 0.1, COLORS.hotPink, { emissive: COLORS.hotPink, emissiveIntensity: 0.4 });
  poster.position.set(baseW / 2 + 0.05, 4, 0);
  store.add(poster);

  // Display window mannequin (simple)
  const mannequin = box(0.5, 2.5, 0.3, COLORS.chrome, { roughness: 0.2, metalness: 0.8 });
  mannequin.position.set(-1.5, 2.5, baseD / 2 - 0.3);
  store.add(mannequin);

  return store;
}

// ===== ADS (neon signs, backlit posters, 1980s typography) =====
function createAd() {
  const ad = new THREE.Group();

  // Backlit poster board
  const posterW = 6;
  const posterH = 4;
  const posterD = 0.3;
  const poster = box(posterW, posterH, posterD, COLORS.black, { roughness: 0.9 });
  ad.add(poster);

  // Neon border frame
  const frameTop = boxNeon(posterW + 0.4, 0.4, 0.2, COLORS.neonBlue);
  frameTop.position.y = posterH / 2 + 0.2;
  ad.add(frameTop);

  const frameBottom = frameTop.clone();
  frameBottom.position.y = -posterH / 2 - 0.2;
  ad.add(frameBottom);

  const frameLeft = boxNeon(0.4, posterH + 0.4, 0.2, COLORS.neonBlue);
  frameLeft.position.x = -posterW / 2 - 0.2;
  ad.add(frameLeft);

  const frameRight = frameLeft.clone();
  frameRight.position.x = posterW / 2 + 0.2;
  ad.add(frameRight);

  // Neon "VIDEO" text (1980s arcade style) - represented as neon tubes
  const letters = [
    { x: -1.8, text: 'V' },
    { x: -0.6, text: 'I' },
    { x: 0.6, text: 'D' },
    { x: 1.8, text: 'E' },
  ];
  letters.forEach((l) => {
    const tube = new THREE.TorusGeometry(0.35, 0.08, 16, 30, Math.PI);
    const mat = makeNeonMaterial(COLORS.neonPink);
    const mesh = new THREE.Mesh(tube, mat);
    mesh.position.set(l.x, 0.5, posterD / 2 + 0.05);
    ad.add(mesh);
  });

  // Neon starburst accent (1980s geometric)
  const starburst = torusNeon(COLORS.neonYellow, 1.2, 0.1);
  starburst.position.set(0, -1.2, posterD / 2 + 0.1);
  ad.add(starburst);

  // Hanging neon tube sign below
  const neonTube = new THREE.CylinderGeometry(0.08, 0.08, 4, 16);
  const neonTubeMat = makeNeonMaterial(COLORS.neonGreen);
  const neonTubeMesh = new THREE.Mesh(neonTube, neonTubeMat);
  neonTubeMesh.rotation.z = Math.PI / 2;
  neonTubeMesh.position.set(0, -3, 0);
  ad.add(neonTubeMesh);

  // Two neon "80s" digits
  const eight = torusKnotNeon(COLORS.neonPink);
  eight.scale.set(0.3, 0.3, 0.3);
  eight.position.set(-0.5, -3, 0.5);
  ad.add(eight);

  const zero = torusNeon(COLORS.neonPink, 0.3, 0.1);
  zero.position.set(0.5, -3, 0.5);
  ad.add(zero);

  return ad;
}

// ===== PEDESTRIANS (1980s fashion) =====
function createPedestrian() {
  const person = new THREE.Group();

  // Head
  const head = sphere(0.35, COLORS.salmon);
  head.position.y = 3.2;
  person.add(head);

  // Torso (shoulder pads - big 1980s shoulders)
  const torsoW = 1.2;
  const torsoH = 1.4;
  const torsoD = 0.5;
  const torso = box(torsoW, torsoH, torsoD, COLORS.neonBlue, { roughness: 0.5 });
  torso.position.y = 2.2;
  person.add(torso);

  // Acid wash jeans
  const legH = 1.8;
  const legW = 0.5;
  const legD = 0.6;
  const legL = box(legW, legH, legD, COLORS.acidWashBlue, { roughness: 0.7 });
  legL.position.set(-0.25, 1.0, 0);
  person.add(legL);

  const legR = legL.clone();
  legR.position.x = 0.25;
  person.add(legR);

  // Arms (with shoulder pad effect)
  const armL = box(0.3, 1.6, 0.3, COLORS.neonPink, { roughness: 0.5 });
  armL.position.set(-0.85, 2.3, 0);
  person.add(armL);

  const armR = armL.clone();
  armR.position.x = 0.85;
  person.add(armR);

  // Leg warmers (1980s aerobics accessory)
  const warmers = box(0.55, 0.4, 0.65, COLORS.neonLime, { emissive: COLORS.neonLime, emissiveIntensity: 0.5 });
  warmers.position.set(0, 0.0, 0);
  person.add(warmers);

  // Headband
  const headband = box(0.8, 0.1, 0.15, COLORS.neonGreen, { emissive: COLORS.neonGreen, emissiveIntensity: 0.6 });
  headband.position.y = 3.4;
  person.add(headband);

  // Simple sneakers
  const shoeL = box(0.5, 0.3, 0.7, COLORS.white, { roughness: 0.5 });
  shoeL.position.set(-0.25, -0.1, 0);
  person.add(shoeL);

  const shoeR = shoeL.clone();
  shoeR.position.x = 0.25;
  person.add(shoeR);

  return person;
}

// ===== ENVIRONMENT (asphalt roads, concrete sidewalks, period traffic signals) =====
function createEnvironment() {
  const env = new THREE.Group();

  // Road (asphalt)
  const roadW = 20;
  const roadD = 10;
  const road = box(roadW, 0.5, roadD, COLORS.asphalt, { roughness: 0.95, metalness: 0.1 });
  road.position.y = -0.25;
  env.add(road);

  // Road markings (white dashed lines)
  const lineLength = 2;
  const lineGap = 1.5;
  const numLines = 8;
  for (let i = 0; i < numLines; i++) {
    const z = -roadD / 2 + 1 + i * (lineLength + lineGap);
    const line = box(0.5, 0.02, lineLength, COLORS.white, { roughness: 0.8 });
    line.position.set(0, 0.01, z);
    env.add(line);
  }

  // Center divider (double yellow line)
  for (let i = 0; i < numLines; i++) {
    const z = -roadD / 2 + 1 + i * (lineLength + lineGap);
    const line = box(0.4, 0.02, lineLength, COLORS.yellow, { roughness: 0.8 });
    line.position.set(0, 0.01, z);
    env.add(line);
  }

  // Sidewalks (concrete)
  const sidewalkW = 4;
  const sidewalkDepth = 0.5;
  const sidewalkY = 0.25;

  // Left sidewalk
  const sidewalkL = box(sidewalkW, sidewalkDepth, roadD, COLORS.concrete, { roughness: 0.8 });
  sidewalkL.position.set(-roadW / 2 - sidewalkW / 2, sidewalkY, 0);
  env.add(sidewalkL);

  // Right sidewalk
  const sidewalkR = sidewalkL.clone();
  sidewalkR.position.x = roadW / 2 + sidewalkW / 2;
  env.add(sidewalkR);

  // Crosswalk (zebra crossing)
  const crosswalkW = 3;
  const stripeCount = 8;
  for (let i = 0; i < stripeCount; i++) {
    const stripe = box(0.3, 0.02, crosswalkW, COLORS.white, { roughness: 0.8 });
    stripe.position.set(0, 0.01, -roadD / 2 - 0.5);
    stripe.rotation.y = Math.PI / 2;
    stripe.position.x = -roadW / 4 + i * 0.4;
    env.add(stripe);
  }

  // Period traffic signal (1980s style - simple pole with 3-light head)
  const pole = cylinder(0.15, 0.15, 6, COLORS.chrome, 12);
  pole.position.set(-roadW / 2 - sidewalkW - 1, 3, -roadD / 2 - 1);
  env.add(pole);

  // Signal head (boxy 1980s style)
  const signalHead = box(0.8, 1.8, 0.5, COLORS.black, { roughness: 0.3 });
  signalHead.position.set(-roadW / 2 - sidewalkW - 1, 6.5, -roadD / 2 - 1);
  env.add(signalHead);

  // Three signal lights (red, yellow, green)
  const lightColors = [COLORS.neonPink, COLORS.neonYellow, 0x39ff14];
  for (let i = 0; i < 3; i++) {
    const light = sphere(0.2, lightColors[i], { emissive: lightColors[i], emissiveIntensity: 0.7 });
    light.position.set(-roadW / 2 - sidewalkW - 1, 6.5 - i * 0.5, -roadD / 2 - 1 + 0.1);
    env.add(light);
  }

  // Street lamp (1980s sodium vapor style)
  const lampPole = cylinder(0.12, 0.12, 8, COLORS.chrome, 12);
  lampPole.position.set(roadW / 2 + sidewalkW + 1, 4, roadD / 2 + 1);
  env.add(lampPole);

  const lampHead = box(1.5, 0.5, 0.5, COLORS.chrome, { roughness: 0.2, metalness: 0.8 });
  lampHead.position.set(roadW / 2 + sidewalkW + 1, 8, roadD / 2 + 1);
  env.add(lampHead);

  const lampBulb = sphere(0.25, COLORS.neonYellow, { emissive: COLORS.neonYellow, emissiveIntensity: 0.8 });
  lampBulb.position.set(roadW / 2 + sidewalkW + 1, 7.8, roadD / 2 + 1.2);
  env.add(lampBulb);

  // Fire hydrant (red)
  const hydrant = cylinder(0.4, 0.4, 1.2, COLORS.brick, 12);
  hydrant.position.set(roadW / 2 - 2, 0.6, roadD / 2 + 0.5);
  env.add(hydrant);

  const hydrantCap = box(0.5, 0.3, 0.5, COLORS.chrome, { roughness: 0.2, metalness: 0.8 });
  hydrantCap.position.set(roadW / 2 - 2, 1.3, roadD / 2 + 0.5);
  env.add(hydrantCap);

  // Trash cans (1980s green metal)
  const trashCan = cylinder(0.4, 0.4, 1, COLORS.neonGreen, 12);
  trashCan.position.set(-roadW / 2 - sidewalkW + 1, 0.5, roadD / 2 + 0.5);
  env.add(trashCan);

  const trashLid = sphere(0.4, COLORS.neonGreen);
  trashLid.position.set(-roadW / 2 - sidewalkW + 1, 1.05, roadD / 2 + 0.5);
  env.add(trashLid);

  return env;
}

// ===== EXPORT =====
async function exportGLB(group, outputPath) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      group,
      (result) => {
        const buffer = result instanceof ArrayBuffer ? Buffer.from(result) : Buffer.from(result);
        fs.writeFileSync(outputPath, buffer);
        resolve(outputPath);
      },
      (error) => {
        reject(error);
      },
      { binary: true }
    );
  });
}

async function main() {
  const creators = {
    buildings: createBuilding,
    vehicles: createVehicle,
    storefronts: createStorefront,
    ads: createAd,
    pedestrians: createPedestrian,
    environment: createEnvironment,
  };

  const manifest = {};

  for (const category of CATEGORIES) {
    const dir = path.join(ASSETS_ROOT, category);
    fs.mkdirSync(dir, { recursive: true });

    // Remove old .gitkeep so the directory has real content
    const gitkeep = path.join(dir, '.gitkeep');
    if (fs.existsSync(gitkeep)) {
      fs.unlinkSync(gitkeep);
    }

    const creator = creators[category];
    const group = creator();
    const fileName = `${category}.glb`;
    const outputPath = path.join(dir, fileName);

    await exportGLB(group, outputPath);
    const stats = fs.statSync(outputPath);
    console.log(`  ✓ ${category}/${fileName} (${stats.size} bytes)`);

    manifest[category] = [fileName];
  }

  // Write a top-level manifest for the 1985 era
  const eraManifestPath = path.join(ASSETS_ROOT, 'manifest.json');
  fs.writeFileSync(eraManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  ✓ 1985/manifest.json`);

  // Also write per-category manifests (asset-management.js reads these)
  for (const category of CATEGORIES) {
    const catManifestPath = path.join(ASSETS_ROOT, category, 'manifest.json');
    fs.writeFileSync(catManifestPath, JSON.stringify(manifest[category], null, 2));
  }

  console.log('\nAll 1985 assets generated successfully.');
}

main().catch((err) => {
  console.error('Failed to generate assets:', err);
  process.exit(1);
});
