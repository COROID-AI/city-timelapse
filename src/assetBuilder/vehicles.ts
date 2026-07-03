/**
 * Procedural vehicle builder for the City Time Period Timelapse.
 *
 * Generates era-appropriate low-poly vehicle meshes from simple Three.js
 * primitives. Each vehicle is a boxed body with era-specific silhouette,
 * wheels, headlights, and era-correct paint. Vehicles are cached per-era
 * and per-variant-index.
 */

import * as THREE from 'three';
import type { EraSpec } from '../eras/types.js';
import {
  cacheKey,
  assetCache,
  createRng,
  eraSeed,
  stdMaterial,
  boxMesh,
  cylMesh,
} from './util.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard vehicle width in metres. */
const DEFAULT_WIDTH = 1.8;

/** Microcar width in metres. */
const MICRO_WIDTH = 1.5;

/** Wheel radius in metres. */
const WHEEL_RADIUS = 0.35;

/** Wheel width in metres. */
const WHEEL_WIDTH = 0.22;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Paint quality parameters that vary by era. */
interface PaintQuality {
  metalness: number;
  roughness: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate (or fetch from cache) an era-appropriate vehicle.
 *
 * @param era          The era spec.
 * @param variantIndex  Index into the era's body-styles array.
 * @returns A cached `THREE.Group` representing the vehicle, facing +Z.
 */
export function getVehicle(era: EraSpec, variantIndex = 0): THREE.Group {
  const key = cacheKey(era.id, `vehicle:${variantIndex}`);
  const cached = assetCache.get(key);
  if (cached) return cached;

  const rng = createRng(eraSeed(era, `vehicle:${variantIndex}`));
  const group = buildVehicle(era, variantIndex, rng);
  group.name = key;
  return assetCache.set(key, group);
}

// ---------------------------------------------------------------------------
// Vehicle construction
// ---------------------------------------------------------------------------

/**
 * Build a complete vehicle from primitives.
 */
function buildVehicle(era: EraSpec, variantIndex: number, rng: () => number): THREE.Group {
  const group = new THREE.Group();
  const v = era.vehicles;

  // Select body style
  const bodyStyle = v.bodyStyles[variantIndex % v.bodyStyles.length] ?? 'sedan';

  // Dimensions
  const [minLen, maxLen] = v.lengthRange;
  const [minHt, maxHt] = v.heightRange;
  const length = minLen + (maxLen - minLen) * (0.3 + rng() * 0.5);
  const height = minHt + (maxHt - minHt) * (0.3 + rng() * 0.5);
  const width = bodyStyle === 'microcar' ? MICRO_WIDTH : DEFAULT_WIDTH;

  // Paint colour
  const paintColor = v.palette[variantIndex % v.palette.length] ?? '#2b2b2b';
  const quality = getPaintQuality(era);
  const paintMat = stdMaterial(paintColor, {
    metalness: quality.metalness,
    roughness: quality.roughness,
  });

  // Build the body
  const body = buildBody(bodyStyle, length, height, width, paintMat, era, rng);

  group.add(body);

  // Build wheels
  const rideHeight = getRideHeight(bodyStyle);
  const wheels = buildWheels(length, width, rideHeight, bodyStyle);
  group.add(wheels);

  // Headlights
  const headlights = buildHeadlights(length, width, height, v.headlightColor, era);
  group.add(headlights);

  // Taillights
  const taillights = buildTaillights(length, width, height);
  group.add(taillights);

  // Era-specific details
  addEraDetails(group, era, length, width, height, bodyStyle, rng);

  return group;
}

/**
 * Build the vehicle body based on the body style.
 */
function buildBody(
  style: string,
  length: number,
  height: number,
  width: number,
  paintMat: THREE.Material,
  _era: EraSpec,
  _rng: () => number,
): THREE.Group {
  const group = new THREE.Group();
  const darkMat = stdMaterial('#1a1a1a', { roughness: 0.8, metalness: 0.2 });
  const glassMat = stdMaterial('#2a3a4a', {
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });

  switch (style) {
    case 'sedan': {
      // 3-box: hood, cabin, trunk
      const bodyH = height * 0.55;
      const bodyMesh = boxMesh(length, bodyH, width, paintMat);
      bodyMesh.position.y = bodyH / 2 + WHEEL_RADIUS;
      group.add(bodyMesh);
      // Cabin
      const cabinLen = length * 0.45;
      const cabinH = height * 0.45;
      const cabin = boxMesh(cabinLen, cabinH, width * 0.9, glassMat);
      cabin.position.set(-length * 0.05, bodyH + cabinH / 2 + WHEEL_RADIUS, 0);
      group.add(cabin);
      break;
    }
    case 'coupe': {
      const bodyH = height * 0.5;
      const bodyMesh = boxMesh(length, bodyH, width, paintMat);
      bodyMesh.position.y = bodyH / 2 + WHEEL_RADIUS;
      group.add(bodyMesh);
      // Sloped cabin — shorter and leans back
      const cabinLen = length * 0.38;
      const cabinH = height * 0.5;
      const cabin = boxMesh(cabinLen, cabinH, width * 0.88, glassMat);
      cabin.position.set(length * 0.02, bodyH + cabinH / 2 + WHEEL_RADIUS, 0);
      cabin.rotation.z = -0.08;
      group.add(cabin);
      break;
    }
    case 'wagon': {
      const bodyH = height * 0.55;
      const bodyMesh = boxMesh(length, bodyH, width, paintMat);
      bodyMesh.position.y = bodyH / 2 + WHEEL_RADIUS;
      group.add(bodyMesh);
      // Extended cabin to rear
      const cabinLen = length * 0.7;
      const cabinH = height * 0.45;
      const cabin = boxMesh(cabinLen, cabinH, width * 0.9, glassMat);
      cabin.position.set(-length * 0.08, bodyH + cabinH / 2 + WHEEL_RADIUS, 0);
      group.add(cabin);
      break;
    }
    case 'pickup': {
      const bodyH = height * 0.6;
      // Cab (front portion)
      const cabLen = length * 0.38;
      const cabMesh = boxMesh(cabLen, bodyH, width, paintMat);
      cabMesh.position.set(length * 0.25, bodyH / 2 + WHEEL_RADIUS + 0.05, 0);
      group.add(cabMesh);
      // Cabin on top of cab
      const cabinH = height * 0.35;
      const cabin = boxMesh(cabLen * 0.85, cabinH, width * 0.88, glassMat);
      cabin.position.set(length * 0.25, bodyH + cabinH / 2 + WHEEL_RADIUS + 0.05, 0);
      group.add(cabin);
      // Flatbed (rear)
      const bedLen = length * 0.55;
      const bedH = bodyH * 0.6;
      const bed = boxMesh(bedLen, bedH, width, paintMat);
      bed.position.set(-length * 0.2, bedH / 2 + WHEEL_RADIUS, 0);
      group.add(bed);
      // Bed walls
      const wallMat = darkMat;
      const wallH = 0.3;
      const wallL = boxMesh(0.05, wallH, width, wallMat);
      wallL.position.set(-length * 0.2 + bedLen / 2, bedH + wallH / 2 + WHEEL_RADIUS, 0);
      group.add(wallL);
      const wallR = boxMesh(0.05, wallH, width, wallMat);
      wallR.position.set(-length * 0.2 - bedLen / 2, bedH + wallH / 2 + WHEEL_RADIUS, 0);
      group.add(wallR);
      const wallB = boxMesh(bedLen, wallH, 0.05, wallMat);
      wallB.position.set(-length * 0.2, bedH + wallH / 2 + WHEEL_RADIUS, -width / 2);
      group.add(wallB);
      const wallF = boxMesh(bedLen, wallH, 0.05, wallMat);
      wallF.position.set(-length * 0.2, bedH + wallH / 2 + WHEEL_RADIUS, width / 2);
      group.add(wallF);
      break;
    }
    case 'hatchback': {
      const bodyH = height * 0.6;
      const bodyMesh = boxMesh(length * 0.95, bodyH, width, paintMat);
      bodyMesh.position.y = bodyH / 2 + WHEEL_RADIUS;
      group.add(bodyMesh);
      // Tall cabin, steep rear
      const cabinLen = length * 0.55;
      const cabinH = height * 0.4;
      const cabin = boxMesh(cabinLen, cabinH, width * 0.88, glassMat);
      cabin.position.set(-length * 0.05, bodyH + cabinH / 2 + WHEEL_RADIUS, 0);
      group.add(cabin);
      break;
    }
    case 'suv': {
      const bodyH = height * 0.7;
      const bodyMesh = boxMesh(length, bodyH, width, paintMat);
      bodyMesh.position.y = bodyH / 2 + WHEEL_RADIUS + 0.1;
      group.add(bodyMesh);
      // Boxy cabin
      const cabinLen = length * 0.65;
      const cabinH = height * 0.3;
      const cabin = boxMesh(cabinLen, cabinH, width * 0.9, glassMat);
      cabin.position.set(-length * 0.05, bodyH + cabinH / 2 + WHEEL_RADIUS + 0.1, 0);
      group.add(cabin);
      break;
    }
    case 'roadster': {
      const bodyH = height * 0.45;
      // Long hood
      const bodyMesh = boxMesh(length, bodyH, width * 0.95, paintMat);
      bodyMesh.position.y = bodyH / 2 + WHEEL_RADIUS;
      group.add(bodyMesh);
      // Minimal cabin
      const cabinLen = length * 0.2;
      const cabinH = height * 0.4;
      const cabin = boxMesh(cabinLen, cabinH, width * 0.85, glassMat);
      cabin.position.set(-length * 0.1, bodyH + cabinH / 2 + WHEEL_RADIUS, 0);
      group.add(cabin);
      break;
    }
    case 'microcar': {
      const bodyH = height * 0.7;
      const bodyMesh = boxMesh(length * 0.9, bodyH, width, paintMat);
      bodyMesh.position.y = bodyH / 2 + WHEEL_RADIUS;
      group.add(bodyMesh);
      // Tall narrow cabin
      const cabinLen = length * 0.6;
      const cabinH = height * 0.3;
      const cabin = boxMesh(cabinLen, cabinH, width * 0.85, glassMat);
      cabin.position.set(0, bodyH + cabinH / 2 + WHEEL_RADIUS, 0);
      group.add(cabin);
      break;
    }
    default: {
      // Fallback: simple box
      const bodyMesh = boxMesh(length, height, width, paintMat);
      bodyMesh.position.y = height / 2 + WHEEL_RADIUS;
      group.add(bodyMesh);
    }
  }

  return group;
}

/**
 * Build 4 wheels positioned for the vehicle.
 */
function buildWheels(
  length: number,
  width: number,
  rideHeight: number,
  _style: string,
): THREE.Group {
  const group = new THREE.Group();
  const tireMat = stdMaterial('#1a1a1a', { roughness: 0.9, metalness: 0.05 });
  const hubMat = stdMaterial('#888888', { roughness: 0.3, metalness: 0.7 });

  const wheelX = length * 0.35;
  const wheelZ = width / 2 + WHEEL_WIDTH / 2;
  const wheelY = WHEEL_RADIUS + rideHeight;

  const positions: [number, number, number][] = [
    [wheelX, wheelY, wheelZ],
    [wheelX, wheelY, -wheelZ],
    [-wheelX, wheelY, wheelZ],
    [-wheelX, wheelY, -wheelZ],
  ];

  for (const [x, y, z] of positions) {
    const wheelGroup = new THREE.Group();
    // Tire (cylinder rotated to roll on Z axis)
    const tire = cylMesh(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 12, tireMat);
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);
    // Hub
    const hub = cylMesh(WHEEL_RADIUS * 0.4, WHEEL_RADIUS * 0.4, WHEEL_WIDTH + 0.02, 8, hubMat);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);
    wheelGroup.position.set(x, y, z);
    group.add(wheelGroup);
  }

  return group;
}

/**
 * Build headlights at the front of the vehicle.
 */
function buildHeadlights(
  length: number,
  width: number,
  height: number,
  headlightColor: string,
  _era: EraSpec,
): THREE.Group {
  const group = new THREE.Group();
  const lightMat = stdMaterial(headlightColor, {
    emissive: headlightColor,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.3,
  });

  const offsetX = width * 0.32;
  const posZ = length / 2 - 0.05;
  const posY = WHEEL_RADIUS + height * 0.3;

  const left = boxMesh(0.2, 0.15, 0.05, lightMat);
  left.position.set(offsetX, posY, posZ);
  group.add(left);

  const right = boxMesh(0.2, 0.15, 0.05, lightMat);
  right.position.set(-offsetX, posY, posZ);
  group.add(right);

  return group;
}

/**
 * Build taillights at the rear of the vehicle.
 */
function buildTaillights(length: number, width: number, height: number): THREE.Group {
  const group = new THREE.Group();
  const tailMat = stdMaterial('#ff2222', {
    emissive: '#ff2222',
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });

  const offsetX = width * 0.32;
  const posZ = -(length / 2 - 0.05);
  const posY = WHEEL_RADIUS + height * 0.3;

  const left = boxMesh(0.18, 0.12, 0.05, tailMat);
  left.position.set(offsetX, posY, posZ);
  group.add(left);

  const right = boxMesh(0.18, 0.12, 0.05, tailMat);
  right.position.set(-offsetX, posY, posZ);
  group.add(right);

  return group;
}

/**
 * Add era-specific styling details to the vehicle.
 */
function addEraDetails(
  group: THREE.Group,
  era: EraSpec,
  length: number,
  width: number,
  height: number,
  _style: string,
  rng: () => number,
): void {
  const v = era.vehicles;

  // Chrome bumpers for older eras
  if (era.year <= 1985) {
    const chromeMat = stdMaterial('#c0c0c0', { metalness: 0.9, roughness: 0.15 });
    const frontBumper = boxMesh(width + 0.1, 0.15, 0.08, chromeMat);
    frontBumper.position.set(0, WHEEL_RADIUS + 0.25, length / 2 + 0.02);
    group.add(frontBumper);
    const rearBumper = boxMesh(width + 0.1, 0.15, 0.08, chromeMat);
    rearBumper.position.set(0, WHEEL_RADIUS + 0.25, -(length / 2 + 0.02));
    group.add(rearBumper);
  }

  // Black plastic bumpers for 1985-2005
  if (era.year >= 1985 && era.year <= 2005) {
    const plasticMat = stdMaterial('#222222', { roughness: 0.8, metalness: 0.1 });
    const frontBumper = boxMesh(width + 0.05, 0.25, 0.1, plasticMat);
    frontBumper.position.set(0, WHEEL_RADIUS + 0.2, length / 2 + 0.01);
    group.add(frontBumper);
    const rearBumper = boxMesh(width + 0.05, 0.25, 0.1, plasticMat);
    rearBumper.position.set(0, WHEEL_RADIUS + 0.2, -(length / 2 + 0.01));
    group.add(rearBumper);
  }

  // Tail fins for 1965
  if (era.year === 1965) {
    const finMat = stdMaterial(v.palette[rng() * v.palette.length | 0] ?? '#c8102e', {
      metalness: 0.5,
      roughness: 0.3,
    });
    const finL = boxMesh(0.15, 0.3, 0.2, finMat);
    finL.position.set(width * 0.35, WHEEL_RADIUS + height * 0.6, -(length / 2 - 0.1));
    finL.rotation.z = 0.2;
    group.add(finL);
    const finR = boxMesh(0.15, 0.3, 0.2, finMat);
    finR.position.set(-(width * 0.35), WHEEL_RADIUS + height * 0.6, -(length / 2 - 0.1));
    finR.rotation.z = -0.2;
    group.add(finR);
  }

  // Electric underglow for 2025
  if (v.hasElectric && era.year >= 2025) {
    const glowMat = stdMaterial('#3a7fff', {
      emissive: '#3a7fff',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.5,
    });
    const glow = boxMesh(length * 0.8, 0.03, width * 0.9, glowMat);
    glow.position.set(0, 0.05, 0);
    group.add(glow);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the paint quality (metalness/roughness) for an era. */
function getPaintQuality(era: EraSpec): PaintQuality {
  switch (era.id) {
    case '1945':
      return { metalness: 0.3, roughness: 0.6 };
    case '1965':
      return { metalness: 0.5, roughness: 0.4 };
    case '1985':
      return { metalness: 0.4, roughness: 0.5 };
    case '2005':
      return { metalness: 0.7, roughness: 0.3 };
    case '2025':
      return { metalness: 0.8, roughness: 0.15 };
    default:
      return { metalness: 0.4, roughness: 0.5 };
  }
}

/** Get the ride height for a body style. */
function getRideHeight(style: string): number {
  switch (style) {
    case 'suv':
    case 'pickup':
      return 0.1;
    case 'roadster':
      return -0.05;
    case 'microcar':
      return 0.02;
    default:
      return 0;
  }
}
