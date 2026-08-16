// ─── Vehicle Factory ─────────────────────────────────────────────────
// Creates era-true procedural vehicles using Three.js primitives.
// Returns THREE.Group per vehicle with distinct era silhouettes.
// Uses instanced rendering for repeated identical vehicles.

import * as THREE from 'three';
import type { EraId } from '../eras.js';
import type { VehicleType } from './specs.js';
import {
  assembleVehicle,
  createEScooter,
  createEBike,
} from './parts.js';

// ── Deterministic seeded random (for reproducible vehicle colors) ─────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Tailfin builder (1965 signature feature) ─────────────────────────

function addTailfins(vehicle: THREE.Group, eraColor: number): void {
  const finMat = new THREE.MeshStandardMaterial({
    color: eraColor,
    roughness: 0.15,
    metalness: 0.4,
  });

  for (const xDir of [-1, 1]) {
    // Vertical fin at rear corner
    const finGeo = new THREE.BoxGeometry(0.08, 0.5, 0.35);
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(xDir * 0.75, 0.95, -1.85);
    fin.rotation.z = xDir * -0.15;
    vehicle.add(fin);

    // Chrome trim strip on fin
    const trimGeo = new THREE.BoxGeometry(0.02, 0.45, 0.3);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.05,
      metalness: 0.95,
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(xDir * 0.78, 0.9, -1.85);
    trim.rotation.z = xDir * -0.15;
    vehicle.add(trim);
  }
}

// ── War-era grill builder (1945 tall grille) ──────────────────────────

function addWarGrill(vehicle: THREE.Group): void {
  const grillMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.7,
    metalness: 0.5,
  });

  // Tall vertical-bar grille
  for (let i = -2; i <= 2; i++) {
    const barGeo = new THREE.BoxGeometry(0.04, 0.6, 0.05);
    const bar = new THREE.Mesh(barGeo, grillMat);
    bar.position.set(i * 0.12, 0.7, 2.02);
    vehicle.add(bar);
  }

  // Grille surround
  const surroundGeo = new THREE.BoxGeometry(0.6, 0.7, 0.03);
  const surroundMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.6,
    metalness: 0.4,
  });
  const surround = new THREE.Mesh(surroundGeo, surroundMat);
  surround.position.set(0, 0.7, 2.01);
  vehicle.add(surround);
}

// ── Sealed-beam headlight cluster (1985 quad setup) ──────────────────

function addQuadHeadlights(vehicle: THREE.Group): void {
  // Additional upper headlights for 1985 sealed-beam look
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d0,
    emissive: 0xfff0d0,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    transparent: true,
    opacity: 0.8,
  });

  for (const [x, y] of [[-0.8, 0.85], [0.8, 0.85]]) {
    const extraGeo = new THREE.CircleGeometry(0.12, 12);
    const extra = new THREE.Mesh(extraGeo, lensMat);
    extra.position.set(x, y, 2.02);
    vehicle.add(extra);
  }
}

// ── Taxi yellow paint job (2005) ─────────────────────────────────────

function applyTaxiLivery(vehicle: THREE.Group): void {
  // Add a "TAXI" sign on roof
  const signGeo = new THREE.BoxGeometry(0.5, 0.12, 0.3);
  const signMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.3,
    roughness: 0.3,
  });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, 1.1, -0.1);
  vehicle.add(sign);
}

// ── Roof sensor suite (2025 EV) ──────────────────────────────────────

function addRooftopSensors(vehicle: THREE.Group): void {
  const sensorMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.3,
    metalness: 0.6,
  });

  // LiDAR dome
  const lidarGeo = new THREE.SphereGeometry(0.08, 8, 6);
  const lidar = new THREE.Mesh(lidarGeo, sensorMat);
  lidar.position.set(0, 1.1, 0.2);
  vehicle.add(lidar);

  // Camera bump
  const camGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
  const camMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.1,
    metalness: 0.8,
  });
  const camera = new THREE.Mesh(camGeo, camMat);
  camera.position.set(0, 1.0, 1.6);
  vehicle.add(camera);

  // Side sensors
  for (const xDir of [-1, 1]) {
    const sideSensor = new THREE.Mesh(camGeo, camMat);
    sideSensor.position.set(xDir * 0.9, 0.5, 0);
    sideSensor.rotation.y = xDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    vehicle.add(sideSensor);
  }
}

// ── Main factory function ────────────────────────────────────────────

/**
 * Build an era-correct vehicle and return its THREE.Group.
 * @param era — era identifier
 * @param type — vehicle silhouette type
 * @param instanceIndex — optional index for instancing variation (color, position)
 */
export function createVehicle(
  era: EraId,
  type: VehicleType,
  instanceIndex = 0,
): THREE.Group {
  const rng = seededRandom(instanceIndex * 7919 + era.charCodeAt(0) * 1000);

  // Determine base body color from era palette
  const bodyColors: Record<EraId, number[]> = {
    '1945': [0x2d2a1e, 0x3a3528, 0x4a4436, 0x1c1b17, 0x3b3b2a],
    '1965': [0xcc2200, 0x0033aa, 0xfaf0e6, 0xffcc00, 0x006644, 0xdd4488],
    '1985': [0xeeeeee, 0x222222, 0xcc3333, 0x336699, 0xffff00, 0x663399],
    '2005': [0xf5f5dc, 0xc0c0c0, 0x333333, 0xffcc00, 0x6699cc, 0xcc4444, 0xffdd44],
    '2025': [0xffffff, 0x111111, 0x00aaff, 0x00cc88, 0x888888, 0x2244aa, 0xeeeeee],
  };

  // Handle micromobility types separately
  if (type === 'escooter') {
    return createEScooter();
  }
  if (type === 'ebike') {
    return createEBike();
  }

  // For taxi/minivan, resolve to base geometry type
  let geoType: 'sedan' | 'truck' | 'trolley' | 'suv' | 'hatchback';
  switch (type) {
    case 'taxi':
      geoType = 'sedan';
      break;
    case 'minivan':
      geoType = 'suv'; // minivans use SUV chassis in this system
      break;
    default:
      geoType = type as 'sedan' | 'truck' | 'trolley' | 'suv' | 'hatchback';
  }

  const vehicle = assembleVehicle(era, geoType);

  // Pick a random color from the era palette
  const colors = bodyColors[era];
  const bodyColor = colors[Math.floor(rng() * colors.length)];

  // Apply color to all child meshes that aren't glass/metal/lights
  vehicle.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      const mat = child.material;
      // Only recolor primary body parts (not chrome, not glass, not rubber)
      if (mat.metalness < 0.5 && mat.color.getHex() !== 0x222222 && mat.color.getHex() !== 0x88bbdd) {
        // Keep chrome/special materials unchanged
        if (mat.roughness < 0.15 && mat.metalness > 0.8) return; // chrome
        if (mat.opacity < 0.5 && !mat.emissive) return; // glass
        mat.color.setHex(bodyColor);
      }
    }
  });

  // ── Era-specific visual enhancements ──────────────────────────────

  // 1945: tall war-era grille on sedans/trucks
  if (era === '1945' && (geoType === 'sedan' || geoType === 'truck')) {
    addWarGrill(vehicle);
  }

  // 1965: tailfins on sedans
  if (era === '1965' && geoType === 'sedan') {
    addTailfins(vehicle, bodyColor);
  }

  // 1985: quad sealed-beam headlights
  if (era === '1985' && geoType === 'sedan') {
    addQuadHeadlights(vehicle);
  }

  // 2005: taxi livery
  if (type === 'taxi') {
    applyTaxiLivery(vehicle);
  }

  // 2025: rooftop sensors on sedans and SUVs
  if (era === '2025' && (geoType === 'sedan' || geoType === 'suv')) {
    addRooftopSensors(vehicle);
  }

  return vehicle;
}

// ── Instanced vehicle pool ───────────────────────────────────────────

/**
 * Create an instanced vehicle group — shares geometry across instances
 * but has unique transforms and per-instance color variations.
 */
export function createInstancedVehicle(
  era: EraId,
  type: VehicleType,
  count: number,
): THREE.Group[] {
  const instances: THREE.Group[] = [];
  for (let i = 0; i < count; i++) {
    instances.push(createVehicle(era, type, i));
  }
  return instances;
}
