/**
 * Procedural vehicle generator.
 *
 * Builds an era-correct vehicle silhouette from primitives (boxes, cylinders):
 * body with era-specific proportions, four wheels, headlights matched to the
 * era's headlight type, a grille, and era-correct paint colour.
 *
 * Vehicles are oriented so they face +Z (forward direction). The caller can
 * rotate the group 90° for cross-street travel.
 */
import * as THREE from 'three';
import type { EraSpec, VehicleSpec } from '../eraRegistry';
import { makeRng, type Rng } from './textures';

// ---------------------------------------------------------------------------
// Material helper
// ---------------------------------------------------------------------------

function makeBoxMaterial(
  color: string,
  roughness: number,
  metalness = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// ---------------------------------------------------------------------------
// Wheel factory
// ---------------------------------------------------------------------------

function makeWheel(
  radius: number,
  width: number,
): { mesh: THREE.Mesh; tireMat: THREE.MeshStandardMaterial } {
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#1a1a1a',
    roughness: 0.85,
    metalness: 0.1,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#b0b0b0',
    roughness: 0.4,
    metalness: 0.7,
  });
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 20),
    tireMat,
  );
  tire.rotation.z = Math.PI / 2; // axle along X
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12),
    rimMat,
  );
  rim.rotation.z = Math.PI / 2;
  const group = new THREE.Group();
  group.add(tire, rim);
  return { mesh: group as unknown as THREE.Mesh, tireMat };
}

/** Place four wheels under a vehicle body. */
function addWheels(
  group: THREE.Group,
  spec: VehicleSpec,
  bodyLength: number,
  bodyWidth: number,
): void {
  const wheelX = bodyWidth / 2 + 0.02;
  const wheelZ = bodyLength * 0.32;
  const wheelY = spec.wheelRadius;
  const positions: [number, number, number][] = [
    [wheelX, wheelY, wheelZ],
    [-wheelX, wheelY, wheelZ],
    [wheelX, wheelY, -wheelZ],
    [-wheelX, wheelY, -wheelZ],
  ];
  for (const [x, y, z] of positions) {
    const wheel = makeWheel(spec.wheelRadius, spec.wheelWidth);
    wheel.mesh.position.set(x, y, z);
    group.add(wheel.mesh);
  }
}

// ---------------------------------------------------------------------------
// Headlight factory — era-correct headlight type
// ---------------------------------------------------------------------------

function addHeadlights(
  group: THREE.Group,
  spec: VehicleSpec,
  bodyWidth: number,
  frontZ: number,
  headlightY: number,
): void {
  const mat = new THREE.MeshStandardMaterial({
    color: spec.headlightColor,
    emissive: spec.headlightColor,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.2,
  });
  const xOffset = bodyWidth * 0.32;
  switch (spec.headlightType) {
    case 'round-bulb': {
      const geo = new THREE.SphereGeometry(0.12, 12, 10);
      const left = new THREE.Mesh(geo, mat);
      left.position.set(-xOffset, headlightY, frontZ);
      const right = left.clone();
      right.position.x = xOffset;
      group.add(left, right);
      break;
    }
    case 'dual-round': {
      const geo = new THREE.SphereGeometry(0.10, 12, 10);
      for (const sx of [-xOffset - 0.12, -xOffset + 0.12, xOffset - 0.12, xOffset + 0.12]) {
        const lt = new THREE.Mesh(geo, mat);
        lt.position.set(sx, headlightY, frontZ);
        group.add(lt);
      }
      break;
    }
    case 'rectangular': {
      const geo = new THREE.BoxGeometry(0.22, 0.12, 0.05);
      const left = new THREE.Mesh(geo, mat);
      left.position.set(-xOffset, headlightY, frontZ);
      const right = left.clone();
      right.position.x = xOffset;
      group.add(left, right);
      break;
    }
    case 'projector': {
      const housing = new THREE.MeshStandardMaterial({
        color: '#2a2a2a',
        roughness: 0.6,
        metalness: 0.3,
      });
      const lensGeo = new THREE.CircleGeometry(0.09, 16);
      for (const sx of [-xOffset, xOffset]) {
        const housing3d = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 0.16, 0.08),
          housing,
        );
        housing3d.position.set(sx, headlightY, frontZ);
        const lens = new THREE.Mesh(lensGeo, mat);
        lens.position.set(sx, headlightY, frontZ + 0.045);
        group.add(housing3d, lens);
      }
      break;
    }
    case 'led-strip': {
      const stripGeo = new THREE.BoxGeometry(bodyWidth * 0.7, 0.04, 0.03);
      const strip = new THREE.Mesh(stripGeo, mat);
      strip.position.set(0, headlightY, frontZ);
      group.add(strip);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Grille factory
// ---------------------------------------------------------------------------

function addGrille(
  group: THREE.Group,
  spec: VehicleSpec,
  bodyWidth: number,
  frontZ: number,
  grilleY: number,
): void {
  if (spec.grilleStyle === 'closed-panel') {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.5, 0.25, 0.04),
      makeBoxMaterial('#1a1a1a', 0.4, 0.5),
    );
    panel.position.set(0, grilleY, frontZ);
    group.add(panel);
    return;
  }
  if (spec.grilleStyle === 'body-color') return;

  const grilleMat = makeBoxMaterial('#2a2a2a', 0.5, 0.6);
  const grilleW = bodyWidth * 0.45;
  const grilleH = 0.22;
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(grilleW, grilleH, 0.03),
    grilleMat,
  );
  backing.position.set(0, grilleY, frontZ);
  group.add(backing);

  // Bars
  const barMat = makeBoxMaterial('#c0c0c0', 0.3, 0.8);
  if (spec.grilleStyle === 'vertical-bars') {
    const count = 5;
    const spacing = grilleW / (count + 1);
    for (let i = 1; i <= count; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, grilleH * 0.8, 0.04),
        barMat,
      );
      bar.position.set(-grilleW / 2 + spacing * i, grilleY, frontZ + 0.02);
      group.add(bar);
    }
  } else if (spec.grilleStyle === 'horizontal-bars') {
    const count = 3;
    const spacing = grilleH / (count + 1);
    for (let i = 1; i <= count; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(grilleW * 0.9, 0.03, 0.04),
        barMat,
      );
      bar.position.set(0, grilleY - grilleH / 2 + spacing * i, frontZ + 0.02);
      group.add(bar);
    }
  } else if (spec.grilleStyle === 'mesh') {
    // Simple mesh cross-hatch
    for (let i = 0; i < 6; i++) {
      const v = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, grilleH * 0.8, 0.03),
        barMat,
      );
      v.position.set(-grilleW * 0.35 + i * (grilleW * 0.14), grilleY, frontZ + 0.02);
      group.add(v);
    }
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Mesh(
        new THREE.BoxGeometry(grilleW * 0.8, 0.02, 0.03),
        barMat,
      );
      h.position.set(0, grilleY - grilleH * 0.3 + i * (grilleH * 0.3), frontZ + 0.02);
      group.add(h);
    }
  }
}

// ---------------------------------------------------------------------------
// Silhouette-specific body builders
// ---------------------------------------------------------------------------

interface BodyDims {
  length: number;
  width: number;
  height: number;
  cabinRatio: number;
  groundClearance: number;
}

function computeBodyDims(spec: VehicleSpec, rng: Rng): BodyDims {
  const variance = 0.94 + rng() * 0.12; // ±6% size variation
  const length = spec.averageLength * variance;
  const width = spec.averageWidth * variance;
  const height = spec.averageHeight * variance;
  return {
    length,
    width,
    height,
    cabinRatio: spec.cabinRatio,
    groundClearance: spec.wheelRadius * 0.5,
  };
}

function buildBodyGroup(
  spec: VehicleSpec,
  dims: BodyDims,
  paint: string,
): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = makeBoxMaterial(paint, 0.35, spec.chromeLikelihood > 0.5 ? 0.4 : 0.2);
  const trimMat = makeBoxMaterial(
    spec.chromeLikelihood > 0.5 ? '#c8c8c8' : '#2a2a2a',
    0.3,
    spec.chromeLikelihood > 0.5 ? 0.8 : 0.3,
  );
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1a2a3a',
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.75,
  });

  const wheelTop = spec.wheelRadius * 1.5; // body floor height
  const bodyH = dims.height - wheelTop * 0.4;
  const cabinH = bodyH * dims.cabinRatio;
  const hoodH = bodyH - cabinH;
  const cabinLen = dims.length * 0.45;
  const hoodLen = dims.length * 0.28;

  switch (spec.silhouette) {
    case 'rounded-fender-1940s': {
      // Lower body (full length, rounded feel via separate hood + cabin)
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width, bodyH * 0.55, dims.length),
        bodyMat,
      );
      lower.position.y = wheelTop + (bodyH * 0.55) / 2;
      group.add(lower);
      // Fender bumps (cylinders over wheels)
      for (const sz of [dims.length * 0.32, -dims.length * 0.32]) {
        const fender = new THREE.Mesh(
          new THREE.CylinderGeometry(spec.wheelRadius * 1.3, spec.wheelRadius * 1.3, dims.width + 0.1, 16, 1, false, 0, Math.PI),
          bodyMat,
        );
        fender.rotation.z = Math.PI / 2;
        fender.rotation.y = Math.PI;
        fender.position.set(0, wheelTop, sz);
        group.add(fender);
      }
      // Cabin (taller, rounded)
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.9, cabinH, cabinLen),
        bodyMat,
      );
      cabin.position.set(0, wheelTop + bodyH * 0.55 + cabinH / 2, -dims.length * 0.05);
      group.add(cabin);
      // Windows
      const winGeo = new THREE.BoxGeometry(dims.width * 0.92, cabinH * 0.6, cabinLen * 0.7);
      const win = new THREE.Mesh(winGeo, glassMat);
      win.position.set(0, wheelTop + bodyH * 0.55 + cabinH * 0.5, -dims.length * 0.05);
      group.add(win);
      // Running board / trim strip
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width + 0.05, 0.06, dims.length * 0.7),
        trimMat,
      );
      trim.position.set(0, wheelTop + 0.15, 0);
      group.add(trim);
      // Chrome bumper
      const bumper = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width + 0.1, 0.18, 0.12),
        trimMat,
      );
      bumper.position.set(0, wheelTop + 0.2, dims.length / 2 + 0.02);
      group.add(bumper);
      const bumperR = bumper.clone();
      bumperR.position.z = -dims.length / 2 - 0.02;
      group.add(bumperR);
      break;
    }
    case 'finned-muscle-1960s': {
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width, bodyH * 0.5, dims.length),
        bodyMat,
      );
      lower.position.y = wheelTop + (bodyH * 0.5) / 2;
      group.add(lower);
      // Hood (lower section in front)
      const hood = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.95, hoodH * 0.7, hoodLen),
        bodyMat,
      );
      hood.position.set(0, wheelTop + bodyH * 0.5 + (hoodH * 0.7) / 2, dims.length * 0.3);
      group.add(hood);
      // Cabin (sloping)
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.88, cabinH, cabinLen),
        bodyMat,
      );
      cabin.position.set(0, wheelTop + bodyH * 0.5 + cabinH / 2, -dims.length * 0.05);
      group.add(cabin);
      // Windows
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.9, cabinH * 0.55, cabinLen * 0.75),
        glassMat,
      );
      win.position.copy(cabin.position);
      group.add(win);
      // Tail fins (signature 1960s)
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(0.5, 0);
      finShape.lineTo(0.15, 0.7);
      finShape.lineTo(0, 0.7);
      finShape.closePath();
      const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });
      for (const sx of [-dims.width * 0.42, dims.width * 0.42]) {
        const fin = new THREE.Mesh(finGeo, bodyMat);
        fin.position.set(sx, wheelTop + bodyH * 0.5, -dims.length * 0.42);
        fin.rotation.y = sx < 0 ? 0 : Math.PI;
        group.add(fin);
      }
      // Chrome trim strip
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width + 0.04, 0.05, dims.length * 0.8),
        trimMat,
      );
      trim.position.set(0, wheelTop + bodyH * 0.35, 0);
      group.add(trim);
      break;
    }
    case 'boxy-aero-1980s': {
      // Boxy single-body with flat planes
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width, bodyH * 0.45, dims.length),
        bodyMat,
      );
      lower.position.y = wheelTop + (bodyH * 0.45) / 2;
      group.add(lower);
      // Greenhouse (boxy cabin, slightly narrower)
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.92, cabinH, dims.length * 0.6),
        bodyMat,
      );
      cabin.position.set(0, wheelTop + bodyH * 0.45 + cabinH / 2, -dims.length * 0.05);
      group.add(cabin);
      // Windows (full wraparound band)
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.94, cabinH * 0.5, dims.length * 0.62),
        glassMat,
      );
      win.position.set(0, wheelTop + bodyH * 0.45 + cabinH * 0.5, -dims.length * 0.05);
      group.add(win);
      // Bumpers (black plastic, boxy)
      const bumperMat = makeBoxMaterial('#1a1a1a', 0.8, 0.2);
      for (const sz of [dims.length / 2 + 0.03, -dims.length / 2 - 0.03]) {
        const bumper = new THREE.Mesh(
          new THREE.BoxGeometry(dims.width + 0.08, 0.2, 0.1),
          bumperMat,
        );
        bumper.position.set(0, wheelTop + 0.2, sz);
        group.add(bumper);
      }
      break;
    }
    case 'rounded-sedan-2000s': {
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width, bodyH * 0.5, dims.length),
        bodyMat,
      );
      lower.position.y = wheelTop + (bodyH * 0.5) / 2;
      group.add(lower);
      // Rounded cabin (scale Y to give a curved look)
      const cabinGeo = new THREE.BoxGeometry(dims.width * 0.88, cabinH, cabinLen);
      const cabin = new THREE.Mesh(cabinGeo, bodyMat);
      cabin.position.set(0, wheelTop + bodyH * 0.5 + cabinH / 2, -dims.length * 0.03);
      // Slight bevel via scale
      group.add(cabin);
      // Windows
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.9, cabinH * 0.55, cabinLen * 0.78),
        glassMat,
      );
      win.position.copy(cabin.position);
      group.add(win);
      // Body-color bumpers
      for (const sz of [dims.length / 2 + 0.02, -dims.length / 2 - 0.02]) {
        const bumper = new THREE.Mesh(
          new THREE.BoxGeometry(dims.width + 0.04, 0.18, 0.08),
          bodyMat,
        );
        bumper.position.set(0, wheelTop + 0.18, sz);
        group.add(bumper);
      }
      // Side mirror
      const mirrorMat = makeBoxMaterial('#2a2a2a', 0.5, 0.4);
      for (const sx of [-dims.width / 2 - 0.06, dims.width / 2 + 0.06]) {
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), mirrorMat);
        mirror.position.set(sx, wheelTop + bodyH * 0.6, dims.length * 0.25);
        group.add(mirror);
      }
      break;
    }
    case 'sleek-ev-2020s': {
      // Smooth single-volume (cabin merges with hood)
      const fullBody = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width, bodyH, dims.length),
        bodyMat,
      );
      fullBody.position.y = wheelTop + bodyH / 2;
      group.add(fullBody);
      // Glass canopy (longer, sleeker)
      const canopyGeo = new THREE.BoxGeometry(dims.width * 0.85, cabinH * 0.6, dims.length * 0.6);
      const canopy = new THREE.Mesh(canopyGeo, glassMat);
      canopy.position.set(0, wheelTop + bodyH - cabinH * 0.15, -dims.length * 0.02);
      group.add(canopy);
      // Smooth front fascia (no grille — closed panel)
      const fascia = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.6, bodyH * 0.35, 0.04),
        makeBoxMaterial('#1a1a1a', 0.3, 0.6),
      );
      fascia.position.set(0, wheelTop + bodyH * 0.25, dims.length / 2 + 0.01);
      group.add(fascia);
      // Accent light bar (runs full width, tied to LED headlight)
      const accentMat = new THREE.MeshStandardMaterial({
        color: spec.headlightColor,
        emissive: spec.headlightColor,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      });
      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 0.75, 0.03, 0.02),
        accentMat,
      );
      accent.position.set(0, wheelTop + bodyH * 0.55, dims.length / 2 + 0.02);
      group.add(accent);
      break;
    }
  }

  // Taillights for all eras (red emissive)
  const taillightMat = new THREE.MeshStandardMaterial({
    color: '#cc2020',
    emissive: '#cc2020',
    emissiveIntensity: 0.5,
    roughness: 0.4,
  });
  const tailGeo = new THREE.BoxGeometry(dims.width * 0.3, 0.12, 0.04);
  for (const sx of [-dims.width * 0.3, dims.width * 0.3]) {
    const tail = new THREE.Mesh(tailGeo, taillightMat);
    tail.position.set(sx, wheelTop + bodyH * 0.45, -dims.length / 2 - 0.02);
    group.add(tail);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Cache + public API
// ---------------------------------------------------------------------------

const vehicleCache = new Map<string, THREE.Group>();

/**
 * Build an era-correct vehicle.
 *
 * @param spec       Era spec (paint, silhouette, headlights, wheels, grille).
 * @param variantSeed  Stable integer seed for deterministic size/colour pick.
 */
export function buildVehicle(spec: EraSpec, variantSeed: number): THREE.Group {
  const cacheKey = `${spec.eraId}:vehicle:${variantSeed % 1000}`;
  const cached = vehicleCache.get(cacheKey);
  if (cached) return cached.clone();

  const rng = makeRng(`${spec.eraId}:vehicle:${variantSeed}`);
  const vSpec = spec.vehicles;
  const dims = computeBodyDims(vSpec, rng);
  const paint = vSpec.paintPalette[Math.floor(rng() * vSpec.paintPalette.length)] ?? '#444';

  const group = new THREE.Group();
  const body = buildBodyGroup(vSpec, dims, paint);
  group.add(body);

  addWheels(group, vSpec, dims.length, dims.width);
  addHeadlights(group, vSpec, dims.width, dims.length / 2 + 0.03, dims.groundClearance + dims.height * 0.4);
  addGrille(group, vSpec, dims.width, dims.length / 2 + 0.03, dims.groundClearance + dims.height * 0.3);

  group.userData = { eraId: spec.eraId, paint, silhouette: vSpec.silhouette, length: dims.length };

  vehicleCache.set(cacheKey, group);
  return group.clone();
}

/** Clear the vehicle cache (disposes geometries/materials). */
export function clearVehicleCache(): void {
  vehicleCache.clear();
}
