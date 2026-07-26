/* global process */
/**
 * Generate era-accurate 2050s 3D assets (GLB) for the city timelapse project.
 *
 * Produces one GLB per asset category under assets/2055/<category>/:
 *   - buildings     (biomimetic/sustainable: vertical farms, smart glass, living walls)
 *   - vehicles      (autonomous flying cars, maglev pods, solar EVs)
 *   - storefronts   (holographic displays, smart glass, interactive surfaces)
 *   - ads           (holographic 3D billboards, AR overlay panels, floating displays)
 *   - pedestrians   (smart fabrics, AR glasses, exoskeleton assists, sustainable wear)
 *   - environment   (magnetic lanes, adaptive LED lighting, integrated vertical gardens)
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

const ERA = '2055';
const ASSETS_ROOT = path.join(__dirname, '..', 'assets', ERA);

const CATEGORIES = ['buildings', 'vehicles', 'storefronts', 'ads', 'pedestrians', 'environment'];

// 2050s color palette — sustainable, luminous, high-tech
const COLORS = {
  // Architecture / sustainable materials
  bioGlass: 0xa8e6cf,       // light bio-glass (green-tinted smart glass)
  livingWall: 0x2e8b57,     // vertical garden foliage
  solarPanel: 0x1a1a2e,     // dark solar cell surface
  carbonFiber: 0x1c1c1c,    // lightweight structural carbon fiber
  white: 0xf8f9fa,
  black: 0x0d1117,
  concrete: 0xdddddd,
  steel: 0x708090,
  // Luminous / holographic
  holoBlue: 0x00f0ff,       // holographic blue
  holoPink: 0xff00ff,       // holographic magenta
  holoGreen: 0x39ff14,      // holographic green
  holoCyan: 0x00ffff,       // holographic cyan
  neonBlue: 0x1f00ff,
  neonPink: 0xff10f0,
  neonGreen: 0x39ff14,
  neonYellow: 0xffff33,
  // Adaptive lighting
  ledWhite: 0xe0e0ff,
  ledWarm: 0xffd27f,
  // Vehicles
  aero: 0x87ceeb,           // autonomous vehicle body
  maglev: 0xc0c0c0,         // magnetic levitation pod
  solarRoof: 0xffd700,      // solar panel roof
  // Fashion
  smartFabric: 0x4a90d9,    // smart textile base
  arGlass: 0x8a2be2,        // AR glasses
  exoFrame: 0xa9a9a9,       // exoskeleton frame
  bioDye: 0x228b22,         // bio-based dye
  // Environment
  magLane: 0x4682b4,        // magnetic lane marking
  greenPavement: 0x20b2aa,  // eco-pavement
  adaptiveLight: 0xffffff,
  // Ads
  hologram: 0xffffff,
  screenBlack: 0x050505,
};

function makeMaterial(color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.1,
    roughness: opts.roughness ?? 0.6,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
  });
  if (opts.emissive !== undefined) mat.emissive = new THREE.Color(opts.emissive);
  if (opts.emissiveIntensity !== undefined) mat.emissiveIntensity = opts.emissiveIntensity;
  return mat;
}

function makeGlassMaterial(color = COLORS.bioGlass) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.2,
    roughness: 0.05,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
}

function makeHoloMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.8,
    metalness: 0.3,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
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

function boxGlass(w, h, d, color = COLORS.bioGlass) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeGlassMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function boxHolo(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeHoloMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function boxNeon(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeNeonMaterial(color);
  return new THREE.Mesh(geo, mat);
}

function cylinder(rTop, rBottom, h, color, segs = 16, opts = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
  const mat = makeMaterial(color, opts);
  return new THREE.Mesh(geo, mat);
}

function sphere(r, color, opts = {}) {
  const geo = new THREE.SphereGeometry(r, 24, 16);
  const mat = makeMaterial(color, opts);
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

// ===== BUILDINGS (biomimetic/sustainable: vertical farms, smart glass, living walls) =====
function createBuilding() {
  const building = new THREE.Group();

  // Main tower: biomimetic structure with organic curves and living walls
  const coreHeight = 18;
  const coreWidth = 8;
  const coreDepth = 8;

  // Central core (carbon fiber composite)
  building.add(box(coreWidth, coreHeight, coreDepth, COLORS.carbonFiber, { roughness: 0.4, metalness: 0.6 }));

  // Smart glass facade (bioGlass — transitions from transparent to display)
  const glassW = coreWidth + 0.2;
  const glassD = coreDepth + 0.2;
  const glassH = coreHeight - 2;
  const glassFront = boxGlass(glassW, glassH, 0.1, COLORS.bioGlass);
  glassFront.position.y = 2.0;
  glassFront.position.z = coreDepth / 2 + 0.05;
  building.add(glassFront);

  const glassBack = boxGlass(glassW, glassH, 0.1, COLORS.bioGlass);
  glassBack.position.y = 2.0;
  glassBack.position.z = -(coreDepth / 2 + 0.05);
  building.add(glassBack);

  const glassLeft = boxGlass(0.1, glassH, glassD, COLORS.bioGlass);
  glassLeft.position.y = 2.0;
  glassLeft.position.x = coreWidth / 2 + 0.05;
  building.add(glassLeft);

  const glassRight = boxGlass(0.1, glassH, glassD, COLORS.bioGlass);
  glassRight.position.y = 2.0;
  glassRight.position.x = -(coreWidth / 2 + 0.05);
  building.add(glassRight);

  // Living wall (vertical garden) on the front facade
  const plantGeo = new THREE.PlaneGeometry(6, 8);
  const plantMat = makeMaterial(COLORS.livingWall, { roughness: 0.8, emissive: COLORS.livingWall, emissiveIntensity: 0.2 });
  const plantWall = new THREE.Mesh(plantGeo, plantMat);
  plantWall.position.set(0, 7, coreDepth / 2 + 0.1);
  plantWall.rotation.y = 0;
  building.add(plantWall);

  // Solar panel array on the roof
  const solarGeo = new THREE.PlaneGeometry(6, 3);
  const solarMat = makeMaterial(COLORS.solarPanel, { roughness: 0.3, metalness: 0.7 });
  const solarPanel = new THREE.Mesh(solarGeo, solarMat);
  solarPanel.position.set(0, coreHeight + 0.1, 0);
  solarPanel.rotation.x = Math.PI / 2;
  building.add(solarPanel);

  // Drone docking station (ring-shaped landing pad on the roof)
  const dockGeo = new THREE.TorusGeometry(2, 0.3, 16, 50);
  const dockMat = makeMaterial(COLORS.steel, { roughness: 0.2, metalness: 0.8 });
  const dock = new THREE.Mesh(dockGeo, dockMat);
  dock.position.set(3, coreHeight + 0.5, 3);
  dock.rotation.x = Math.PI / 2;
  building.add(dock);

  // Organic biomimetic extension (curved volume inspired by leaves)
  const organicShape = new THREE.Shape();
  organicShape.moveTo(-2, 0);
  organicShape.bezierCurveTo(-2, 3, 2, 3, 2, 0);
  organicShape.bezierCurveTo(2, -1, -2, -1, -2, 0);
  const organicGeo = new THREE.ExtrudeGeometry(organicShape, { depth: 2, bevelEnabled: true, bevelThickness: 0.3, curveSegments: 8 });
  organicGeo.rotateX(Math.PI / 2);
  organicGeo.translate(-coreWidth / 2 - 2, coreHeight - 6, -1);
  const organicMat = makeMaterial(COLORS.white, { roughness: 0.3, metalness: 0.2 });
  const organic = new THREE.Mesh(organicGeo, organicMat);
  building.add(organic);

  // Second sustainable volume: modular hexagonal tower with integrated greenery
  const hexTower = new THREE.Group();
  const hexRadius = 3;
  const hexHeight = 12;
  const hexGeo = new THREE.CylinderGeometry(hexRadius, hexRadius, hexHeight, 6);
  const hexMat = makeMaterial(COLORS.concrete, { roughness: 0.7 });
  const hexCore = new THREE.Mesh(hexGeo, hexMat);
  hexCore.position.y = hexHeight / 2;
  hexTower.add(hexCore);

  // Hexagonal smart glass panels
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const panel = boxGlass(2.8, 8, 0.1, COLORS.bioGlass);
    panel.position.y = 6;
    panel.position.x = Math.cos(angle) * hexRadius;
    panel.position.z = Math.sin(angle) * hexRadius;
    panel.rotation.y = angle;
    hexTower.add(panel);
  }

  // Living wall on the hexagonal tower
  const hexPlantGeo = new THREE.PlaneGeometry(4, 6);
  const hexPlantMat = makeMaterial(COLORS.livingWall, { roughness: 0.8, emissive: COLORS.livingWall, emissiveIntensity: 0.2 });
  const hexPlant = new THREE.Mesh(hexPlantGeo, hexPlantMat);
  hexPlant.position.y = 6;
  hexPlant.position.z = hexRadius + 0.1;
  hexTower.add(hexPlant);

  hexTower.position.set(-12, 0, -3);
  building.add(hexTower);

  // Third volume: adaptive building with kinetic facade
  const adaptive = new THREE.Group();
  const adHeight = 10;
  const adWidth = 5;
  const adDepth = 5;
  adaptive.add(box(adWidth, adHeight, adDepth, COLORS.carbonFiber, { roughness: 0.5, metalness: 0.7 }));

  // Kinetic facade panels (adjustable louvers)
  for (let i = 0; i < 5; i++) {
    const louver = box(adWidth + 0.2, 0.4, 0.1, COLORS.steel, { roughness: 0.3, metalness: 0.8 });
    louver.position.y = 1 + i * 1.8;
    louver.position.z = adDepth / 2 + 0.05;
    adaptive.add(louver);
  }

  // Holographic display on the facade
  const holoDisplay = boxHolo(adWidth - 0.5, 4, 0.1, COLORS.holoBlue);
  holoDisplay.position.y = 5;
  holoDisplay.position.z = adDepth / 2 + 0.06;
  adaptive.add(holoDisplay);

  adaptive.position.set(12, 0, 2);
  building.add(adaptive);

  return building;
}

// ===== VEHICLES (autonomous flying cars, maglev pods, solar EVs) =====
function createVehicle() {
  const vehicle = new THREE.Group();

  // Autonomous flying car (VTOL drone-car)
  // Main body (aerodynamic pod)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.5, 0);
  bodyShape.bezierCurveTo(-2.5, 0.8, 2.5, 0.8, 2.5, 0);
  bodyShape.bezierCurveTo(2.5, -0.3, -2.5, -0.3, -2.5, 0);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.15, curveSegments: 8 });
  const body = new THREE.Mesh(bodyGeo, makeMaterial(COLORS.aero, { roughness: 0.2, metalness: 0.7 }));
  body.position.y = 2.5;
  body.position.z = -0.7;
  vehicle.add(body);

  // Transparent smart glass canopy
  const canopyGeo = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const canopy = new THREE.Mesh(canopyGeo, makeGlassMaterial(COLORS.bioGlass));
  canopy.position.set(0, 3.2, 0);
  canopy.scale.set(2.2, 1.2, 1.4);
  vehicle.add(canopy);

  // Four propulsion pods (electric ducted fans)
  const podGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16);
  const podMat = makeMaterial(COLORS.maglev, { roughness: 0.2, metalness: 0.8 });
  const podPositions = [
    [-1.8, 1.8, 0.6],
    [1.8, 1.8, 0.6],
    [-1.8, 1.8, -0.6],
    [1.8, 1.8, -0.6],
  ];
  podPositions.forEach((pos) => {
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set(pos[0], pos[1], pos[2]);
    pod.rotation.z = Math.PI / 2;
    vehicle.add(pod);

    // Inner rotor (glowing)
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12),
      makeNeonMaterial(COLORS.neonBlue)
    );
    rotor.position.set(pos[0], pos[1], pos[2]);
    rotor.rotation.z = Math.PI / 2;
    vehicle.add(rotor);
  });

  // Solar roof panel on top of the body
  const solarRoof = box(2.2, 0.15, 1.0, COLORS.solarRoof, { roughness: 0.3, metalness: 0.7 });
  solarRoof.position.set(0, 3.0, 0);
  vehicle.add(solarRoof);

  // Holographic navigation display
  const navDisplay = boxHolo(1.5, 0.4, 0.1, COLORS.holoCyan);
  navDisplay.position.set(0, 3.1, 0.71);
  vehicle.add(navDisplay);

  // Landing gear (retractable)
  const gearGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8);
  const gearMat = makeMaterial(COLORS.steel, { roughness: 0.3, metalness: 0.8 });
  for (const x of [-1.5, 1.5]) {
    const gear = new THREE.Mesh(gearGeo, gearMat);
    gear.position.set(x, 1.0, 0);
    vehicle.add(gear);
  }

  // Second vehicle: magnetic levitation pod
  const pod = new THREE.Group();
  const podBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 3.5, 16),
    makeMaterial(COLORS.maglev, { roughness: 0.15, metalness: 0.9 })
  );
  podBody.rotation.z = Math.PI / 2;
  pod.add(podBody);

  // Magnetic field generators (blue glowing rings)
  for (const y of [-1.0, 0, 1.0]) {
    const magRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.1, 8, 30),
      makeNeonMaterial(COLORS.neonBlue)
    );
    magRing.position.y = y;
    magRing.rotation.y = Math.PI / 2;
    pod.add(magRing);
  }

  // Transparent passenger compartment
  const comp = boxGlass(0.7, 0.8, 0.7, COLORS.bioGlass);
  comp.position.set(0, 0, 0);
  pod.add(comp);

  pod.position.set(0, 0.5, 0);
  vehicle.add(pod);

  return vehicle;
}

// ===== STOREFRONTS (holographic displays, smart glass, interactive surfaces) =====
function createStorefront() {
  const store = new THREE.Group();

  // Base structure (sustainable composite)
  const baseW = 10;
  const baseH = 6;
  const baseD = 4;
  store.add(box(baseW, baseH, baseD, COLORS.concrete, { roughness: 0.7 }));

  // Smart glass storefront window (transitions from transparent to display)
  const windowW = baseW - 0.5;
  const windowH = baseH - 1.5;
  const windowGeo = new THREE.BoxGeometry(windowW, windowH, 0.1);
  const windowMat = makeGlassMaterial(COLORS.bioGlass);
  const windowMesh = new THREE.Mesh(windowGeo, windowMat);
  windowMesh.position.set(0, 1.5, baseD / 2 + 0.05);
  store.add(windowMesh);

  // Holographic display inside the storefront (floating 3D ad)
  const holoDisplay = boxHolo(4, 3, 0.1, COLORS.holoPink);
  holoDisplay.position.set(-1.5, 2.5, baseD / 2 - 0.3);
  store.add(holoDisplay);

  // Interactive touch surface (holographic control panel)
  const touchPanel = boxHolo(3, 1.5, 0.1, COLORS.holoBlue);
  touchPanel.position.set(2, 2.0, baseD / 2 - 0.2);
  store.add(touchPanel);

  // Living wall planter integrated into the storefront
  const planter = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.5, 0.3),
    makeMaterial(COLORS.livingWall, { roughness: 0.8, emissive: COLORS.livingWall, emissiveIntensity: 0.2 })
  );
  planter.position.set(0, 0.75, baseD / 2 + 0.06);
  store.add(planter);

  // Smart awning (adaptive LED strip)
  const awning = box(baseW + 0.4, 0.5, 1.5, COLORS.carbonFiber, { roughness: 0.3, metalness: 0.7 });
  awning.position.set(0, baseH + 0.25, 0);
  store.add(awning);

  // LED strip under the awning
  const ledStrip = boxNeon(baseW - 0.4, 0.15, 0.1, COLORS.ledWarm);
  ledStrip.position.set(0, baseH + 0.25, 0.7);
  store.add(ledStrip);

  // Door (smart sliding door)
  const door = box(2.2, 2.4, 0.15, COLORS.carbonFiber, { roughness: 0.3, metalness: 0.7 });
  door.position.set(0, 1.2, baseD / 2 + 0.06);
  store.add(door);

  // AR window display (holographic mannequin)
  const mannequin = sphere(0.5, COLORS.holoCyan, {
    emissive: COLORS.holoCyan,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.6,
  });
  mannequin.position.set(-2.5, 1.5, baseD / 2 - 0.3);
  store.add(mannequin);

  return store;
}

// ===== ADS (holographic 3D billboards, AR overlay panels, floating displays) =====
function createAd() {
  const ad = new THREE.Group();

  // Main holographic billboard frame (carbon fiber)
  const frameW = 8;
  const frameH = 5;
  const frameD = 0.4;
  const frame = box(frameW, frameH, frameD, COLORS.carbonFiber, { roughness: 0.3, metalness: 0.7 });
  ad.add(frame);

  // Holographic display screen (floating, semi-transparent)
  const screen = boxHolo(frameW - 0.4, frameH - 0.4, 0.1, COLORS.holoBlue);
  screen.position.z = frameD / 2 + 0.05;
  ad.add(screen);

  // Holographic 3D projection above the screen (floating geometric shapes)
  const holoShape1 = torusKnotNeon(COLORS.holoPink);
  holoShape1.scale.set(0.5, 0.5, 0.5);
  holoShape1.position.set(0, 3.5, 0);
  ad.add(holoShape1);

  const holoShape2 = sphere(0.4, COLORS.holoGreen, {
    emissive: COLORS.holoGreen,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.6,
  });
  holoShape2.position.set(-2.5, 2.5, 0.5);
  ad.add(holoShape2);

  const holoShape3 = torusNeon(COLORS.holoCyan, 0.5, 0.1);
  holoShape3.position.set(2.5, 2.5, 0.5);
  holoShape3.rotation.x = Math.PI / 4;
  ad.add(holoShape3);

  // AR overlay panel (side-mounted)
  const arPanel = boxHolo(2.5, 3, 0.1, COLORS.holoPink);
  arPanel.position.set(frameW / 2 + 0.3, 0, 0);
  arPanel.rotation.y = -Math.PI / 2;
  ad.add(arPanel);

  // Floating holographic text (represented as neon bars)
  const textBars = [];
  for (let i = 0; i < 5; i++) {
    const bar = boxNeon(0.3, 1.2, 0.1, COLORS.neonYellow);
    bar.position.set(-2 + i * 1.0, -1.5, frameD / 2 + 0.05);
    ad.add(bar);
    textBars.push(bar);
  }

  // Holographic starburst background
  const starburst = torusNeon(COLORS.neonBlue, 2.5, 0.1);
  starburst.position.set(0, 0, -frameD / 2 - 0.1);
  starburst.rotation.y = Math.PI / 2;
  ad.add(starburst);

  // Floating drone camera (for dynamic ad viewing)
  const droneCam = new THREE.Group();
  const camBody = box(0.4, 0.2, 0.3, COLORS.carbonFiber, { roughness: 0.2, metalness: 0.8 });
  droneCam.add(camBody);
  const camLens = sphere(0.12, COLORS.ledWhite, { emissive: COLORS.ledWhite, emissiveIntensity: 0.8 });
  camLens.position.set(0, 0, 0.2);
  droneCam.add(camLens);
  droneCam.position.set(0, -4, 0);
  ad.add(droneCam);

  return ad;
}

// ===== PEDESTRIANS (smart fabrics, AR glasses, exoskeleton assists) =====
function createPedestrian() {
  const person = new THREE.Group();

  // Head
  const head = sphere(0.35, COLORS.white);
  head.position.y = 3.2;
  person.add(head);

  // AR glasses (holographic display)
  const arGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.2, 0.1),
    makeMaterial(COLORS.arGlass, { emissive: COLORS.arGlass, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })
  );
  arGlass.position.set(0, 3.2, 0.36);
  person.add(arGlass);

  // Smart fabric jacket (with embedded LED patterns)
  const torsoW = 1.0;
  const torsoH = 1.5;
  const torsoD = 0.4;
  const torso = box(torsoW, torsoH, torsoD, COLORS.smartFabric, { roughness: 0.5 });
  torso.position.y = 2.2;
  person.add(torso);

  // LED pattern strips on the jacket
  const ledStrip1 = boxNeon(torsoW - 0.2, 0.15, 0.05, COLORS.neonBlue);
  ledStrip1.position.set(0, 2.8, torsoD / 2 + 0.01);
  person.add(ledStrip1);

  const ledStrip2 = boxNeon(torsoW - 0.2, 0.15, 0.05, COLORS.neonPink);
  ledStrip2.position.set(0, 2.0, torsoD / 2 + 0.01);
  person.add(ledStrip2);

  // Legs (sustainable bio-fabric pants)
  const legH = 1.8;
  const legW = 0.45;
  const legD = 0.55;
  const legL = box(legW, legH, legD, COLORS.bioDye, { roughness: 0.7 });
  legL.position.set(-0.25, 1.0, 0);
  person.add(legL);

  const legR = legL.clone();
  legR.position.x = 0.25;
  person.add(legR);

  // Exoskeleton assist device (on the back)
  const exoFrame = new THREE.Group();
  const vertebrae = [];
  for (let i = 0; i < 5; i++) {
    const vert = box(0.15, 0.5, 0.15, COLORS.exoFrame, { roughness: 0.3, metalness: 0.8 });
    vert.position.set(0, 2.0 + i * 0.5, 0.3);
    exoFrame.add(vert);
    vertebrae.push(vert);
  }
  // Connecting rods
  for (let i = 0; i < 4; i++) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8),
      makeMaterial(COLORS.exoFrame, { roughness: 0.3, metalness: 0.8 })
    );
    rod.position.set(0, 2.25 + i * 0.5, 0.3);
    rod.rotation.z = Math.PI / 2;
    exoFrame.add(rod);
  }
  exoFrame.position.set(0, 0, 0);
  person.add(exoFrame);

  // Arms
  const armL = box(0.3, 1.6, 0.3, COLORS.smartFabric, { roughness: 0.5 });
  armL.position.set(-0.85, 2.3, 0);
  person.add(armL);

  const armR = armL.clone();
  armR.position.x = 0.85;
  person.add(armR);

  // Smart shoes (with embedded LEDs)
  const shoeL = box(0.5, 0.3, 0.7, COLORS.black, { roughness: 0.5 });
  shoeL.position.set(-0.25, -0.1, 0);
  person.add(shoeL);

  const shoeR = shoeL.clone();
  shoeR.position.x = 0.25;
  person.add(shoeR);

  // LED sole lights
  const soleL = boxNeon(0.4, 0.08, 0.1, COLORS.neonBlue);
  soleL.position.set(-0.25, -0.25, 0);
  person.add(soleL);

  const soleR = soleL.clone();
  soleR.position.x = 0.25;
  person.add(soleR);

  return person;
}

// ===== ENVIRONMENT (magnetic lanes, adaptive lighting, integrated vertical gardens) =====
function createEnvironment() {
  const env = new THREE.Group();

  // Road surface (eco-pavement with integrated charging strips)
  const roadW = 24;
  const roadD = 12;
  const road = box(roadW, 0.5, roadD, COLORS.greenPavement, { roughness: 0.9, metalness: 0.1 });
  road.position.y = -0.25;
  env.add(road);

  // Magnetic lanes (blue glowing strips for autonomous vehicles)
  const magLaneGeo = new THREE.PlaneGeometry(roadW, 1.5);
  const magLaneMat = makeMaterial(COLORS.magLane, { emissive: COLORS.magLane, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.8 });
  const magLaneL = new THREE.Mesh(magLaneGeo, magLaneMat);
  magLaneL.rotation.x = -Math.PI / 2;
  magLaneL.position.set(0, 0.01, 2.5);
  env.add(magLaneL);

  const magLaneR = magLaneL.clone();
  magLaneR.position.set(0, 0.01, -2.5);
  env.add(magLaneR);

  // Center magnetic lane (for flying vehicles)
  const centerLane = new THREE.Mesh(magLaneGeo, magLaneMat);
  centerLane.rotation.x = -Math.PI / 2;
  centerLane.position.set(0, 0.01, 0);
  centerLane.scale.set(1, 1, 0.5);
  env.add(centerLane);

  // Adaptive LED lighting strips along the road edges
  const ledStripGeo = new THREE.PlaneGeometry(roadW, 0.2);
  const ledStripMat = makeNeonMaterial(COLORS.ledWhite);
  const ledStripL = new THREE.Mesh(ledStripGeo, ledStripMat);
  ledStripL.rotation.x = -Math.PI / 2;
  ledStripL.position.set(0, 0.02, roadD / 2 - 0.1);
  env.add(ledStripL);

  const ledStripR = ledStripL.clone();
  ledStripR.position.set(0, 0.02, -(roadD / 2 - 0.1));
  env.add(ledStripR);

  // Sidewalks (permeable eco-concrete)
  const sidewalkW = 4;
  const sidewalkDepth = 0.5;
  const sidewalkY = 0.25;
  const sidewalkL = box(sidewalkW, sidewalkDepth, roadD, COLORS.concrete, { roughness: 0.8 });
  sidewalkL.position.set(-roadW / 2 - sidewalkW / 2, sidewalkY, 0);
  env.add(sidewalkL);

  const sidewalkR = sidewalkL.clone();
  sidewalkR.position.x = roadW / 2 + sidewalkW / 2;
  env.add(sidewalkR);

  // Integrated vertical gardens on sidewalk barriers
  const gardenGeo = new THREE.PlaneGeometry(2, 3);
  const gardenMat = makeMaterial(COLORS.livingWall, { roughness: 0.8, emissive: COLORS.livingWall, emissiveIntensity: 0.2 });
  for (let x = -roadW / 2 - sidewalkW + 1; x < roadW / 2 + sidewalkW; x += 4) {
    const garden = new THREE.Mesh(gardenGeo, gardenMat);
    garden.position.set(x, 1.5, roadD / 2 + 0.1);
    env.add(garden);

    const garden2 = garden.clone();
    garden2.position.set(x, 1.5, -(roadD / 2 + 0.1));
    garden2.rotation.y = Math.PI;
    env.add(garden2);
  }

  // Smart traffic management system (holographic signals)
  const trafficPole = cylinder(0.15, 0.15, 6, COLORS.steel, 12, { roughness: 0.6, metalness: 0.8 });
  trafficPole.position.set(-roadW / 2 - sidewalkW - 1, 3, -roadD / 2 - 1);
  env.add(trafficPole);

  // Holographic traffic signal head
  const signalHead = boxHolo(0.8, 1.8, 0.3, COLORS.holoBlue);
  signalHead.position.set(-roadW / 2 - sidewalkW - 1, 6.5, -roadD / 2 - 1);
  env.add(signalHead);

  // Three holographic signal lights
  const signalColors = [COLORS.holoPink, COLORS.neonYellow, COLORS.holoGreen];
  for (let i = 0; i < 3; i++) {
    const light = sphere(0.2, signalColors[i], {
      emissive: signalColors[i],
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.8,
    });
    light.position.set(-roadW / 2 - sidewalkW - 1, 6.5 - i * 0.5, -roadD / 2 - 1 + 0.1);
    env.add(light);
  }

  // Adaptive streetlight (with integrated solar panel and LED array)
  const lampPole = cylinder(0.12, 0.12, 8, COLORS.steel, 12, { roughness: 0.6, metalness: 0.8 });
  lampPole.position.set(roadW / 2 + sidewalkW + 1, 4, roadD / 2 + 1);
  env.add(lampPole);

  // Solar panel on top of the streetlight
  const lampSolar = box(1.5, 0.15, 1.5, COLORS.solarPanel, { roughness: 0.3, metalness: 0.7 });
  lampSolar.position.set(roadW / 2 + sidewalkW + 1, 8.2, roadD / 2 + 1);
  env.add(lampSolar);

  // Adaptive LED array (multi-directional lighting)
  const ledArray = boxNeon(1.2, 0.3, 0.3, COLORS.ledWarm);
  ledArray.position.set(roadW / 2 + sidewalkW + 1, 7.8, roadD / 2 + 1);
  env.add(ledArray);

  // Smart bench with integrated charging
  const bench = box(3, 0.4, 0.8, COLORS.carbonFiber, { roughness: 0.3, metalness: 0.7 });
  bench.position.set(0, 0.2, roadD / 2 + 0.5);
  env.add(bench);

  // Wireless charging pad on the bench
  const charger = box(1.5, 0.1, 0.8, COLORS.neonBlue, { emissive: COLORS.neonBlue, emissiveIntensity: 0.5 });
  charger.position.set(0, 0.3, roadD / 2 + 0.5);
  env.add(charger);

  // Drone delivery station
  const droneStation = new THREE.Group();
  const stationBase = box(2, 1.5, 2, COLORS.carbonFiber, { roughness: 0.4, metalness: 0.7 });
  droneStation.add(stationBase);
  const stationTop = box(2.5, 0.3, 2.5, COLORS.steel, { roughness: 0.3, metalness: 0.8 });
  stationTop.position.y = 0.9;
  droneStation.add(stationTop);
  // Holographic landing guidance
  const landingHolo = boxHolo(2, 0.1, 2, COLORS.holoCyan);
  landingHolo.position.y = 1.0;
  droneStation.add(landingHolo);
  droneStation.position.set(roadW / 2 - 3, 0.75, -roadD / 2 - 0.5);
  env.add(droneStation);

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

  // Write a top-level manifest for the 2055 era
  const eraManifestPath = path.join(ASSETS_ROOT, 'manifest.json');
  fs.writeFileSync(eraManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  ✓ 2055/manifest.json`);

  // Also write per-category manifests (asset-management.js reads these)
  for (const category of CATEGORIES) {
    const catManifestPath = path.join(ASSETS_ROOT, category, 'manifest.json');
    fs.writeFileSync(catManifestPath, JSON.stringify(manifest[category], null, 2));
  }

  console.log('\nAll 2055 assets generated successfully.');
}

main().catch((err) => {
  console.error('Failed to generate assets:', err);
  process.exit(1);
});
