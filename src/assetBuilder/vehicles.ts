/**
 * Procedural vehicle builder.
 *
 * Produces era-correct vehicles: a boxed body with a period silhouette,
 * wheels, headlights, and taillights. Each vehicle is cached per
 * (eraId + shape + colorIndex) so traffic can reuse meshes efficiently.
 */

import * as THREE from 'three';

import type { EraSpec } from '../eras.js';
import { getAssetSet } from './eras.js';
import type { AssetSet, VehicleShape } from './eras.js';

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

/** A built vehicle: the group plus its bounding length. */
export interface BuiltVehicle {
  readonly group: THREE.Group;
  readonly length: number;
  readonly width: number;
  readonly height: number;
}

const vehicleCache = new Map<string, BuiltVehicle>();

/**
 * Build (or fetch a cached) vehicle for the given era, shape, and color.
 *
 * @param spec       The era specification.
 * @param shapeIndex Index into the era's vehicle shape list.
 * @param colorIndex Index into the era's paint palette.
 */
export function buildVehicle(
  spec: EraSpec,
  shapeIndex: number = 0,
  colorIndex: number = 0,
): BuiltVehicle {
  const set = getAssetSet(spec);
  const shape: VehicleShape = set.vehicle.shapes[shapeIndex % set.vehicle.shapes.length];
  const color = set.vehicle.palette[colorIndex % set.vehicle.palette.length];
  const cacheKey = `${spec.id}:veh:${shape}:${colorIndex % set.vehicle.palette.length}`;

  const existing = vehicleCache.get(cacheKey);
  if (existing) return existing;

  const group = new THREE.Group();
  group.name = `vehicle:${spec.id}:${shape}:${colorIndex}`;

  const [minLen, maxLen] = set.vehicle.lengthRange;
  const length = minLen + (maxLen - minLen) * 0.5;
  const width = 1.8;

  // ── Body ────────────────────────────────────────────────────────────────
  buildBody(group, set, shape, color, length, width);

  // ── Wheels ──────────────────────────────────────────────────────────────
  buildWheels(group, set, shape, length, width);

  // ── Lights ──────────────────────────────────────────────────────────────
  buildLights(group, set, length, width);

  // ── Roof accents ─────────────────────────────────────────────────────────
  if (Math.random() < set.vehicle.roofAccentChance) {
    buildRoofAccent(group, set, shape, length, width);
  }

  const built: BuiltVehicle = {
    group,
    length,
    width,
    height: getBodyHeight(shape),
  };
  vehicleCache.set(cacheKey, built);
  return built;
}

// ─────────────────────────────────────────────────────────────────────────────
// Body construction per silhouette
// ─────────────────────────────────────────────────────────────────────────────

function getBodyHeight(shape: VehicleShape): number {
  switch (shape) {
    case 'rounded-sedan': return 1.4;
    case 'muscle': return 1.3;
    case 'boxy-sedan': return 1.5;
    case 'suv': return 1.9;
    case 'ev': return 1.5;
    case 'trolley': return 2.6;
    default: return 1.4;
  }
}

function getCabinHeight(shape: VehicleShape): number {
  switch (shape) {
    case 'rounded-sedan': return 0.8;
    case 'muscle': return 0.7;
    case 'boxy-sedan': return 0.9;
    case 'suv': return 1.2;
    case 'ev': return 1.0;
    case 'trolley': return 1.8;
    default: return 0.8;
  }
}

function buildBody(
  group: THREE.Group,
  set: AssetSet,
  shape: VehicleShape,
  color: string,
  length: number,
  width: number,
): void {
  const v = set.vehicle;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: shape === 'ev' ? 0.2 : 0.4,
    metalness: shape === 'ev' ? 0.8 : 0.5,
  });

  if (shape === 'trolley') {
    buildTrolley(group, bodyMat, v.wheelColor, length, width);
    return;
  }

  const bodyH = getBodyHeight(shape) * 0.55;
  const cabinH = getCabinHeight(shape);
  const wheelRadius = 0.35;

  // Lower body (chassis)
  const chassisGeo = new THREE.BoxGeometry(length, bodyH, width);
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.position.y = wheelRadius + bodyH / 2;
  chassis.castShadow = true;
  group.add(chassis);

  // Cabin / greenhouse
  const cabinLen = length * (shape === 'suv' ? 0.75 : 0.55);
  const cabinGeo = new THREE.BoxGeometry(cabinLen, cabinH, width * 0.9);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a2030'),
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.75,
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(
    shape === 'muscle' ? -length * 0.05 : 0,
    wheelRadius + bodyH + cabinH / 2,
    0,
  );
  cabin.castShadow = true;
  group.add(cabin);

  // Shape-specific silhouette tweaks
  switch (shape) {
    case 'muscle': {
      // Hood scoop
      const scoopGeo = new THREE.BoxGeometry(length * 0.2, 0.15, width * 0.3);
      const scoop = new THREE.Mesh(scoopGeo, bodyMat);
      scoop.position.set(length * 0.25, wheelRadius + bodyH + 0.08, 0);
      group.add(scoop);
      break;
    }
    case 'boxy-sedan': {
      // Boxy greenhouse already handled; add a sharp trunk edge
      const trunkGeo = new THREE.BoxGeometry(length * 0.25, bodyH * 0.7, width * 0.95);
      const trunk = new THREE.Mesh(trunkGeo, bodyMat);
      trunk.position.set(-length * 0.35, wheelRadius + bodyH * 0.5, 0);
      group.add(trunk);
      break;
    }
    case 'suv': {
      // Roof rack
      const rackGeo = new THREE.BoxGeometry(cabinLen * 0.9, 0.08, width * 0.8);
      const rackMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.6, metalness: 0.4 });
      const rack = new THREE.Mesh(rackGeo, rackMat);
      rack.position.set(0, wheelRadius + bodyH + cabinH + 0.04, 0);
      group.add(rack);
      break;
    }
    case 'ev': {
      // Smooth aero — add a tinted glass canopy
      const canopyGeo = new THREE.BoxGeometry(cabinLen * 1.05, cabinH * 0.9, width * 0.92);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: '#2a3a4a',
        roughness: 0.05,
        metalness: 0.4,
        transparent: true,
        opacity: 0.6,
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(0, wheelRadius + bodyH + cabinH / 2, 0);
      group.add(canopy);
      break;
    }
    case 'rounded-sedan':
    default:
      break;
  }
}

function buildTrolley(
  group: THREE.Group,
  bodyMat: THREE.MeshStandardMaterial,
  wheelColor: string,
  length: number,
  width: number,
): void {
  const bodyH = 1.6;
  const wheelRadius = 0.4;

  // Main body
  const geo = new THREE.BoxGeometry(length, bodyH, width);
  const body = new THREE.Mesh(geo, bodyMat);
  body.position.y = wheelRadius + bodyH / 2;
  body.castShadow = true;
  group.add(body);

  // Rounded roof
  const roofGeo = new THREE.CylinderGeometry(width * 0.55, width * 0.55, length, 12);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#5a5a5a', roughness: 0.5, metalness: 0.4 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.z = Math.PI / 2;
  roof.position.y = wheelRadius + bodyH + width * 0.4;
  group.add(roof);

  // Trolley pole
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', metalness: 0.8, roughness: 0.3 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, wheelRadius + bodyH + 1.0, 0);
  pole.rotation.x = -0.3;
  group.add(pole);

  // Windows strip
  const winGeo = new THREE.PlaneGeometry(length * 0.85, bodyH * 0.5);
  const winMat = new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.1, metalness: 0.2 });
  for (const side of [width / 2 + 0.01, -width / 2 - 0.01]) {
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(0, wheelRadius + bodyH * 0.55, side);
    win.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(win);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wheels
// ─────────────────────────────────────────────────────────────────────────────

function buildWheels(
  group: THREE.Group,
  set: AssetSet,
  shape: VehicleShape,
  length: number,
  width: number,
): void {
  const wheelRadius = shape === 'suv' ? 0.42 : 0.35;
  const wheelWidth = 0.25;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 12);
  const tireMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(set.vehicle.wheelColor),
    roughness: 0.9,
    metalness: 0.1,
  });
  const hubMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', roughness: 0.4, metalness: 0.7 });

  const axleX = length * 0.32;
  const axleZ = width / 2 - wheelWidth / 2;

  for (const [fx, fz] of [
    [axleX, axleZ], [axleX, -axleZ],
    [-axleX, axleZ], [-axleX, -axleZ],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(fx, wheelRadius, fz);
    wheel.castShadow = true;
    group.add(wheel);

    // Hubcap
    const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.4, wheelRadius * 0.4, wheelWidth + 0.02, 8);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(fx, wheelRadius, fz);
    group.add(hub);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lights
// ─────────────────────────────────────────────────────────────────────────────

function buildLights(
  group: THREE.Group,
  set: AssetSet,
  length: number,
  width: number,
): void {
  const v = set.vehicle;
  const headGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(v.headlightColor),
    emissive: new THREE.Color(v.headlightColor),
    emissiveIntensity: 1.5,
    roughness: 0.3,
  });

  const tailGeo = new THREE.BoxGeometry(0.08, 0.12, 0.04);
  const tailMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(v.taillightColor),
    emissive: new THREE.Color(v.taillightColor),
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });

  // Headlights at the front (+X)
  for (const z of [width * 0.32, -width * 0.32]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(length / 2 - 0.05, 0.6, z);
    group.add(head);
  }

  // Taillights at the rear (-X)
  for (const z of [width * 0.32, -width * 0.32]) {
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-length / 2 + 0.02, 0.6, z);
    group.add(tail);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Roof accents
// ─────────────────────────────────────────────────────────────────────────────

function buildRoofAccent(
  group: THREE.Group,
  set: AssetSet,
  shape: VehicleShape,
  length: number,
  width: number,
): void {
  if (shape === 'trolley') return;
  const accentMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.5, metalness: 0.5 });

  switch (shape) {
    case 'muscle': {
      // Spoiler
      const spoilerGeo = new THREE.BoxGeometry(0.2, 0.04, width * 0.9);
      const spoiler = new THREE.Mesh(spoilerGeo, accentMat);
      spoiler.position.set(-length * 0.45, 1.3, 0);
      group.add(spoiler);
      // Supports
      for (const z of [width * 0.3, -width * 0.3]) {
        const supGeo = new THREE.BoxGeometry(0.04, 0.2, 0.04);
        const sup = new THREE.Mesh(supGeo, accentMat);
        sup.position.set(-length * 0.45, 1.2, z);
        group.add(sup);
      }
      break;
    }
    case 'boxy-sedan':
    case 'suv': {
      // Light bar / antenna
      const barGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
      const bar = new THREE.Mesh(barGeo, accentMat);
      bar.position.set(0, 1.6, 0);
      group.add(bar);
      break;
    }
    default: {
      // Roof antenna
      const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6);
      const ant = new THREE.Mesh(antGeo, accentMat);
      ant.position.set(length * 0.2, 1.4, 0);
      group.add(ant);
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Disposal
// ─────────────────────────────────────────────────────────────────────────────

/** Dispose all cached vehicle groups and their geometry/materials. */
export function disposeAllVehicles(): void {
  for (const built of vehicleCache.values()) {
    built.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  }
  vehicleCache.clear();
}
